/* ---------------------------------------------------------------------------
 * Utilidades del foro sin dependencias (se prueban con `node --test`)
 * ------------------------------------------------------------------------- */

function dosDigitos(n: number) {
  return n.toString().padStart(2, "0");
}

// "2026-09-18T15:00:00Z" → "18/09/2026" (fecha local) y " · editado" si se editó
export function fechaForo(creadoEn: string, editadoEn?: string | null) {
  const fecha = new Date(creadoEn);
  const texto = `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
  return editadoEn ? `${texto} · editado` : texto;
}

// Agrupa los comentarios por reseña conservando su orden
export function agruparPorResena<T extends { post_id: string }>(comentarios: T[]) {
  const grupos: Record<string, T[]> = {};
  for (const comentario of comentarios) {
    (grupos[comentario.post_id] ??= []).push(comentario);
  }
  return grupos;
}

/* ------------------------- Calificaciones (HU-019) ------------------------ */

export type FormaEstrella = "llena" | "media" | "vacia";

// Promedio con un decimal y total de valoraciones (ignora valores fuera de 1–5)
export function resumenCalificaciones(valores: (number | null | undefined)[]) {
  const validas = valores.filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
  if (validas.length === 0) return { promedio: 0, total: 0 };
  const suma = validas.reduce((a, b) => a + b, 0);
  return { promedio: Math.round((suma / validas.length) * 10) / 10, total: validas.length };
}

// 5 estrellas: media si la fracción está entre 0.25 y 0.75; desde 0.75 cuenta como llena
export function formasEstrellas(valor: number): FormaEstrella[] {
  const enteras = Math.floor(valor);
  const fraccion = valor - enteras;
  const llenas = fraccion >= 0.75 ? enteras + 1 : enteras;
  const media = fraccion >= 0.25 && fraccion < 0.75;
  return Array.from({ length: 5 }, (_, i) => {
    if (i < llenas) return "llena";
    if (i === llenas && media) return "media";
    return "vacia";
  });
}

export function textoValoraciones(total: number) {
  return total === 1 ? "1 valoración" : `${total} valoraciones`;
}

// "4.5" → "4,5 de 5 estrellas" (lector de pantalla)
export function etiquetaEstrellas(valor: number) {
  const texto = Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace(".", ",");
  return `${texto} de 5 estrellas`;
}

// "Laguna de Alegría " → "laguna de alegria" (sin tildes ni mayúsculas, para buscar)
export function normalizarTexto(texto: string | null | undefined) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/* Filtra reseñas por lugar. Con hitoId (al tocar el nombre en una tarjeta)
 * deja solo las de ese hito; si no, busca el texto dentro de hito_nombre.
 * Texto vacío y sin hitoId devuelve la lista completa. */
export function filtrarPorLugar<T extends { hito_id: string | null; hito_nombre: string | null }>(
  resenas: readonly T[],
  texto: string,
  hitoId: string | null = null,
): T[] {
  if (hitoId) return resenas.filter((r) => r.hito_id === hitoId);
  const buscado = normalizarTexto(texto);
  if (!buscado) return [...resenas];
  return resenas.filter((r) => normalizarTexto(r.hito_nombre).includes(buscado));
}

// Texto de confirmación al eliminar una reseña que tiene comentarios
export function avisoComentariosAlEliminar(totalComentarios: number) {
  if (totalComentarios <= 0) return "";
  return totalComentarios === 1
    ? " También se eliminará su comentario."
    : ` También se eliminarán sus ${totalComentarios} comentarios.`;
}
