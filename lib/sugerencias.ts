import { supabase } from "@/lib/supabase";
import { debeRecargar, ordenarPorIds } from "@/lib/sugerencias-orden";

export { ordenarPorIds } from "@/lib/sugerencias-orden";

/* ---------------------------------------------------------------------------
 * Sugerencias de hitos para el carrusel "Descubre El Salvador" (Inicio).
 * El RPC sugerir_hitos ya ordena por puntaje y excluye favoritos, hitos en
 * rutas del usuario, "no me interesa" y lugares ocultos.
 * ------------------------------------------------------------------------- */

// Misma forma de datos que usa el carrusel de Inicio
export type HitoCarrusel = {
  id: string;
  nombre: string;
  direccion_referencia: string | null;
  precio: number | null;
  categoria_id: number | null;
  creado_en?: string;
  hito_imagenes: { url: string; orden: number }[];
};

export type HitoSugerido = HitoCarrusel & { motivo: string };

type FilaSugerencia = { id_hito: string; puntaje: number; motivo: string };

// Mínimo entre recargas al volver a la pestaña Inicio
export const INTERVALO_MINIMO_SUGERENCIAS_MS = 60_000;

/* Pide las sugerencias al servidor. null si el RPC falla o no hay resultados
 * (la pantalla usa entonces el carrusel de siempre). */
export async function obtenerSugerencias(
  limite = 10,
): Promise<HitoSugerido[] | null> {
  try {
    const { data, error } = await supabase.rpc("sugerir_hitos", {
      p_limite: limite,
    });
    if (error) {
      console.error("Error obteniendo sugerencias:", error);
      return null;
    }

    const filas = (data ?? []) as FilaSugerencia[];
    if (filas.length === 0) return null;

    const ids = filas.map((f) => String(f.id_hito));
    const motivos = new Map(filas.map((f) => [String(f.id_hito), f.motivo]));

    const { data: hitosData, error: errorHitos } = await supabase
      .from("hitos")
      .select(
        `
          id,
          nombre,
          direccion_referencia,
          precio,
          categoria_id,
          creado_en,
          hito_imagenes(url, orden)
        `,
      )
      .eq("es_lugar_oculto", false)
      .in("id", ids);

    if (errorHitos) {
      console.error("Error cargando hitos sugeridos:", errorHitos);
      return null;
    }

    const ordenados = ordenarPorIds((hitosData ?? []) as HitoCarrusel[], ids);
    if (ordenados.length === 0) return null;

    return ordenados.map((hito) => ({
      ...hito,
      motivo: motivos.get(hito.id) ?? "",
    }));
  } catch (error) {
    console.error("Error en obtenerSugerencias:", error);
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * Caché en memoria (nivel de módulo)
 * Se guarda por usuario (null = invitado) para no mezclar sesiones.
 * ------------------------------------------------------------------------- */

type CacheSugerencias = {
  usuarioId: string | null;
  datos: HitoSugerido[] | null;
  cargadoEn: number;
};

let cache: CacheSugerencias | null = null;
// Sube en cada invalidación: una carga en curso que empezó antes no se guarda
let version = 0;

// Llamar tras marcar/quitar favorito, agregar a ruta o "no me interesa"
export function invalidarSugerencias() {
  cache = null;
  version += 1;
}

// Última lista en caché (para pintar al montar sin esperar a la red)
export function sugerenciasEnCache(): HitoSugerido[] | null {
  return cache?.datos ?? null;
}

/* Devuelve las sugerencias usando la caché si es reciente y del mismo usuario.
 * `forzar` ignora el intervalo mínimo (pull-to-refresh). */
export async function cargarSugerencias(
  forzar = false,
  limite = 10,
): Promise<HitoSugerido[] | null> {
  const { data: sesion } = await supabase.auth.getSession();
  const usuarioId = sesion.session?.user?.id ?? null;

  if (
    !forzar &&
    cache &&
    cache.usuarioId === usuarioId &&
    !debeRecargar(cache.cargadoEn, Date.now(), INTERVALO_MINIMO_SUGERENCIAS_MS)
  ) {
    return cache.datos;
  }

  const versionInicio = version;
  const datos = await obtenerSugerencias(limite);

  if (versionInicio === version) {
    cache = { usuarioId, datos, cargadoEn: Date.now() };
  }
  return datos;
}
