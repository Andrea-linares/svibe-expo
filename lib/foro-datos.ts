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

// Texto de confirmación al eliminar una reseña que tiene comentarios
export function avisoComentariosAlEliminar(totalComentarios: number) {
  if (totalComentarios <= 0) return "";
  return totalComentarios === 1
    ? " También se eliminará su comentario."
    : ` También se eliminarán sus ${totalComentarios} comentarios.`;
}
