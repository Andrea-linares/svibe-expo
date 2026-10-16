import { supabase } from "@/lib/supabase";
import { normalizarResena, validarResena } from "@/lib/validacion-resena";

/* ---------------------------------------------------------------------------
 * Foro (tablas `foro_posts` y `foro_comentarios`)
 * - foro_posts: reseñas de un hito (hito_id).
 * - foro_comentarios: comentarios de una reseña (post_id, ON DELETE CASCADE).
 * RLS:
 * - Admin: lee y elimina cualquier reseña y comentario (es_admin()).
 * - Usuario: crea, lee, edita (solo `contenido`) y elimina sus propias reseñas
 *   y comentarios.
 * - Todos (también invitados): leen el foro con las funciones
 *   obtener_resenas_hito, obtener_comentarios_hito y obtener_resenas_recientes,
 *   que solo exponen el nombre del autor ("Nombre A.").
 * - Las restricciones *_contenido_longitud exigen 10–500 caracteres.
 * - El servidor rellena `editado_en` al cambiar el texto.
 * Migraciones en supabase/migrations/.
 * ------------------------------------------------------------------------- */

export type AutorForo = { nombre: string | null; apellido: string | null } | null;

export type ComentarioForo = {
  id: string;
  post_id: string;
  contenido: string;
  creado_en: string | null;
  autor: AutorForo;
};

export type ResenaForo = {
  id: string;
  hito_id: string | null;
  contenido: string;
  creado_en: string | null;
  autor: AutorForo;
  comentarios: ComentarioForo[];
};

export type HitoForo = {
  id: string | null; // null agrupa las reseñas sin hito
  nombre: string;
  direccion_referencia: string | null;
  resenas: ResenaForo[];
  totalComentarios: number;
};

const CAMPOS_RESENA =
  "id, hito_id, contenido, creado_en, autor:perfiles(nombre, apellido), comentarios:foro_comentarios(id, post_id, contenido, creado_en, autor:perfiles(nombre, apellido))";

// Más recientes primero
function porFechaDesc(a: { creado_en: string | null }, b: { creado_en: string | null }) {
  return (b.creado_en ?? "").localeCompare(a.creado_en ?? "");
}

function unico<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

export function nombreAutor(autor: AutorForo) {
  const nombre = [autor?.nombre, autor?.apellido].filter(Boolean).join(" ").trim();
  return nombre || "Usuario";
}

/* ------------------------------ Usuarios --------------------------------- */

export type ResenaPublica = {
  id: string;
  contenido: string;
  creado_en: string;
  editado_en?: string | null;
  autor: string;
  es_mia: boolean;
};

export type ComentarioPublico = {
  id: string;
  post_id: string;
  contenido: string;
  creado_en: string;
  editado_en: string | null;
  autor: string;
  es_mio: boolean;
};

export type ResenaReciente = ResenaPublica & {
  hito_id: string;
  hito_nombre: string;
  total_comentarios: number;
};

export type MiResena = {
  id: string;
  hito_id: string;
  contenido: string;
  creado_en: string;
  hito: { id: string; nombre: string } | null;
};

// Valida en el cliente antes de enviar; el servidor vuelve a validar con el CHECK
function textoValidado(texto: string) {
  const error = validarResena(texto);
  if (error) throw new Error(error);
  return normalizarResena(texto);
}

// Traduce la violación del CHECK de longitud a un mensaje para el usuario
function errorDeGuardado(error: { code?: string; message: string }, que = "La reseña") {
  if (error.code === "23514") {
    return new Error(`${que} debe tener entre 10 y 500 caracteres.`);
  }
  return error;
}

async function usuarioActualId() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Inicia sesión para participar en el foro.");
  return data.user.id;
}

// PGRST202 = la función no existe en la API: falta ejecutar la migración del foro
function errorDeLectura(error: { code?: string; message: string }, funcion: string) {
  if (error.code === "PGRST202") {
    console.error(
      `Falta la función ${funcion} en Supabase. Revisa las migraciones de supabase/migrations/`,
    );
  }
  return error;
}

// Reseñas de un hito, más recientes primero (disponible también para invitados)
export async function obtenerResenasHito(hitoId: string): Promise<ResenaPublica[]> {
  const { data, error } = await supabase.rpc("obtener_resenas_hito", { p_hito_id: hitoId });
  if (error) throw errorDeLectura(error, "obtener_resenas_hito");
  return (data ?? []) as ResenaPublica[];
}

// Comentarios de todas las reseñas de un hito, más antiguos primero
export async function obtenerComentariosHito(hitoId: string): Promise<ComentarioPublico[]> {
  const { data, error } = await supabase.rpc("obtener_comentarios_hito", { p_hito_id: hitoId });
  if (error) throw errorDeLectura(error, "obtener_comentarios_hito");
  return (data ?? []) as ComentarioPublico[];
}

// Últimas reseñas de todos los hitos (pantalla Foro)
export async function obtenerResenasRecientes(limite = 50): Promise<ResenaReciente[]> {
  const { data, error } = await supabase.rpc("obtener_resenas_recientes", { p_limite: limite });
  if (error) throw errorDeLectura(error, "obtener_resenas_recientes");
  return (data ?? []) as ResenaReciente[];
}

export async function obtenerMisResenas(): Promise<MiResena[]> {
  const usuarioId = await usuarioActualId();
  const { data, error } = await supabase
    .from("foro_posts")
    .select("id, hito_id, contenido, creado_en, hito:hitos(id, nombre)")
    .eq("usuario_id", usuarioId)
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({ ...r, hito: unico(r.hito) }));
}

export async function publicarResena(hitoId: string, texto: string) {
  const contenido = textoValidado(texto);
  const usuarioId = await usuarioActualId();
  const { error } = await supabase
    .from("foro_posts")
    .insert({ hito_id: hitoId, usuario_id: usuarioId, contenido });
  if (error) throw errorDeGuardado(error);
}

// Solo cambia el texto; la RLS impide editar reseñas de otros usuarios
export async function editarResena(id: string, texto: string) {
  const contenido = textoValidado(texto);
  const { data, error } = await supabase
    .from("foro_posts")
    .update({ contenido })
    .eq("id", id)
    .select("id");
  if (error) throw errorDeGuardado(error);
  if (!data || data.length === 0) {
    throw new Error("No tienes permiso para editar esta reseña o ya fue eliminada.");
  }
}

export async function publicarComentario(resenaId: string, texto: string) {
  const contenido = textoValidado(texto);
  const usuarioId = await usuarioActualId();
  const { error } = await supabase
    .from("foro_comentarios")
    .insert({ post_id: resenaId, usuario_id: usuarioId, contenido });
  if (error) throw errorDeGuardado(error, "El comentario");
}

// Solo cambia el texto; la RLS impide editar comentarios de otros usuarios
export async function editarComentario(id: string, texto: string) {
  const contenido = textoValidado(texto);
  const { data, error } = await supabase
    .from("foro_comentarios")
    .update({ contenido })
    .eq("id", id)
    .select("id");
  if (error) throw errorDeGuardado(error, "El comentario");
  if (!data || data.length === 0) {
    throw new Error("No tienes permiso para editar este comentario o ya fue eliminado.");
  }
}

/* -------------------------------- Admin ---------------------------------- */

// Todos los hitos con sus reseñas y comentarios (los hitos sin publicaciones también)
export async function obtenerForoAdmin(): Promise<HitoForo[]> {
  const [hitosRes, resenasRes] = await Promise.all([
    supabase
      .from("hitos")
      .select("id, nombre, direccion_referencia")
      .order("nombre", { ascending: true }),
    supabase.from("foro_posts").select(CAMPOS_RESENA),
  ]);
  if (hitosRes.error) throw hitosRes.error;
  if (resenasRes.error) throw resenasRes.error;

  const resenas: ResenaForo[] = ((resenasRes.data ?? []) as any[])
    .map((r) => ({
      ...r,
      autor: unico(r.autor),
      comentarios: ((r.comentarios ?? []) as any[])
        .map((c) => ({ ...c, autor: unico(c.autor) }))
        .sort(porFechaDesc),
    }))
    .sort(porFechaDesc);

  const porHito = new Map<string | null, ResenaForo[]>();
  resenas.forEach((r) => {
    porHito.set(r.hito_id, [...(porHito.get(r.hito_id) ?? []), r]);
  });

  const armar = (id: string | null, nombre: string, direccion: string | null): HitoForo => {
    const lista = porHito.get(id) ?? [];
    return {
      id,
      nombre,
      direccion_referencia: direccion,
      resenas: lista,
      totalComentarios: lista.reduce((suma, r) => suma + r.comentarios.length, 0),
    };
  };

  const hitos = ((hitosRes.data ?? []) as any[]).map((h) =>
    armar(h.id, h.nombre, h.direccion_referencia),
  );
  if (porHito.has(null)) hitos.push(armar(null, "Sin hito relacionado", null));

  return hitos;
}

// Si la RLS bloquea el borrado no hay error, solo 0 filas: se trata como no autorizado
async function eliminarDe(tabla: "foro_posts" | "foro_comentarios", id: string) {
  const { data, error } = await supabase.from(tabla).delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("No tienes permiso para eliminar esta publicación o ya fue eliminada.");
  }
}

// La usan el admin y el autor (la RLS decide)
export function eliminarComentario(id: string) {
  return eliminarDe("foro_comentarios", id);
}

// La usan el admin y el autor (la RLS decide). También elimina sus comentarios (ON DELETE CASCADE)
export function eliminarResena(id: string) {
  return eliminarDe("foro_posts", id);
}
