import { hoyLocal } from "@/lib/fechas";
import { supabase } from "@/lib/supabase";

/* ---------------------------------------------------------------------------
 * Eventos (tabla `eventos`)
 * - Vista de usuarios: solo eventos publicados, con fecha de hoy o futura
 *   (caducidad por fecha local) y que no pertenezcan a un hito oculto.
 *   Los eventos sin hito (hito_id null) sí se muestran.
 *   El filtro `publicado` se aplica también en la consulta aunque la RLS ya
 *   oculte los borradores, porque al admin la RLS le deja ver todo y no debe
 *   ver borradores cuando usa la app como usuario.
 * - Vista de admin: todos los eventos.
 * ------------------------------------------------------------------------- */

export type TipoEvento = "cultural" | "religioso" | "artistico" | "natural";

// Misma paleta que retos.tsx / insignias.tsx
export const TIPOS_EVENTO: { valor: TipoEvento; etiqueta: string; color: string }[] = [
  { valor: "cultural", etiqueta: "Cultural", color: "#3B6FA0" },
  { valor: "religioso", etiqueta: "Religioso", color: "#D2693C" },
  { valor: "artistico", etiqueta: "Artístico", color: "#7E57C2" },
  { valor: "natural", etiqueta: "Natural", color: "#2E8B57" },
];

export function infoTipo(tipo: string) {
  return TIPOS_EVENTO.find((t) => t.valor === tipo) ?? TIPOS_EVENTO[0];
}

export type HitoDeEvento = {
  id: string;
  nombre: string;
  direccion_referencia: string | null;
  es_lugar_oculto: boolean | null;
  hito_imagenes: { url: string; orden: number }[] | null;
};

export type Evento = {
  id: string;
  hito_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha: string; // "YYYY-MM-DD"
  hora: string | null; // "HH:MM:SS"
  hora_fin: string | null;
  tipo: TipoEvento;
  publicado: boolean;
  creado_en: string | null;
  hito: HitoDeEvento | null;
};

export type DatosEvento = {
  titulo: string;
  hito_id: string | null;
  fecha: string;
  hora: string | null;
  hora_fin: string | null;
  tipo: TipoEvento;
  descripcion: string | null;
  publicado: boolean;
};

const CAMPOS_EVENTO =
  "id, hito_id, titulo, descripcion, fecha, hora, hora_fin, tipo, publicado, creado_en";
const CAMPOS_HITO =
  "id, nombre, direccion_referencia, es_lugar_oculto, hito_imagenes(url, orden)";

type Filtros = {
  vistaUsuario: boolean;
  id?: string;
  hitoId?: string;
  fecha?: string; // solo esa fecha
};

function aplicarFiltros(consulta: any, filtros: Filtros) {
  let q = consulta;
  if (filtros.vistaUsuario) {
    q = q.eq("publicado", true).gte("fecha", hoyLocal());
  }
  if (filtros.id) q = q.eq("id", filtros.id);
  if (filtros.hitoId) q = q.eq("hito_id", filtros.hitoId);
  if (filtros.fecha) q = q.eq("fecha", filtros.fecha);
  return q
    .order("fecha", { ascending: true })
    .order("hora", { ascending: true, nullsFirst: false });
}

async function consultarEventos(filtros: Filtros): Promise<Evento[]> {
  // 1) Consulta anidada eventos → hitos
  const { data, error } = await aplicarFiltros(
    supabase.from("eventos").select(`${CAMPOS_EVENTO}, hito:hitos(${CAMPOS_HITO})`),
    filtros,
  );

  let eventos: Evento[];

  if (!error) {
    eventos = ((data ?? []) as any[]).map((e) => ({
      ...e,
      hito: Array.isArray(e.hito) ? (e.hito[0] ?? null) : (e.hito ?? null),
    }));
  } else {
    // 2) Si la relación no está disponible, se hace en dos consultas
    console.warn("Consulta anidada de eventos falló, usando dos consultas:", error);

    const { data: filas, error: errEventos } = await aplicarFiltros(
      supabase.from("eventos").select(CAMPOS_EVENTO),
      filtros,
    );
    if (errEventos) throw errEventos;

    const hitoIds = Array.from(
      new Set(((filas ?? []) as any[]).map((e) => e.hito_id).filter(Boolean)),
    );
    const mapa = new Map<string, HitoDeEvento>();
    if (hitoIds.length > 0) {
      const { data: hitos, error: errHitos } = await supabase
        .from("hitos")
        .select(CAMPOS_HITO)
        .in("id", hitoIds);
      if (errHitos) throw errHitos;
      (hitos ?? []).forEach((h: any) => mapa.set(h.id, h));
    }

    eventos = ((filas ?? []) as any[]).map((e) => ({
      ...e,
      hito: e.hito_id ? (mapa.get(e.hito_id) ?? null) : null,
    }));
  }

  // Los usuarios no ven eventos de hitos ocultos (los que no tienen hito, sí)
  if (filtros.vistaUsuario) {
    eventos = eventos.filter((e) => !e.hito?.es_lugar_oculto);
  }

  return eventos;
}

/* ------------------------------ Usuarios --------------------------------- */

// Eventos vigentes de todos los hitos o de uno en concreto
export function obtenerEventosVigentes(hitoId?: string) {
  return consultarEventos({ vistaUsuario: true, hitoId });
}

// Eventos de la fecha actual (para el aviso en Inicio)
export function obtenerEventosDeHoy() {
  return consultarEventos({ vistaUsuario: true, fecha: hoyLocal() });
}

// Un evento vigente; null si no existe, caducó, es borrador o su hito es oculto
export async function obtenerEventoPublico(id: string) {
  const eventos = await consultarEventos({ vistaUsuario: true, id });
  return eventos[0] ?? null;
}

/* -------------------------------- Admin ---------------------------------- */

export function obtenerEventosAdmin() {
  return consultarEventos({ vistaUsuario: false });
}

export async function obtenerEventoAdmin(id: string) {
  const eventos = await consultarEventos({ vistaUsuario: false, id });
  return eventos[0] ?? null;
}

export async function guardarEvento(datos: DatosEvento, id?: string) {
  const { error } = id
    ? await supabase.from("eventos").update(datos).eq("id", id)
    : await supabase.from("eventos").insert(datos);
  if (error) throw error;
}

export async function eliminarEvento(id: string) {
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) throw error;
}

// Lista de hitos para el selector del formulario de eventos
export async function obtenerHitosParaSelector() {
  const { data, error } = await supabase
    .from("hitos")
    .select("id, nombre, direccion_referencia")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return (data ?? []) as { id: string; nombre: string; direccion_referencia: string | null }[];
}

/* ------------------------------- Imagen ---------------------------------- */

// La imagen del evento es la imagen principal de su hito
export function imagenDeEvento(evento: Evento) {
  const imagenes = evento.hito?.hito_imagenes;
  if (imagenes && imagenes.length > 0) {
    const ordenadas = [...imagenes].sort((a, b) => a.orden - b.orden);
    return { uri: ordenadas[0].url };
  }
  return require("@/assets/images/partial-react-logo.png");
}
