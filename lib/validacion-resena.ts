/* ---------------------------------------------------------------------------
 * Validación de reseñas del foro
 * Misma regla que la restricción foro_posts_contenido_longitud de la base de
 * datos: entre 10 y 500 caracteres sin contar los espacios del inicio y el fin.
 * Sin imports para poder probarlo con `node --test`.
 * ------------------------------------------------------------------------- */

export const MIN_CARACTERES_RESENA = 10;
export const MAX_CARACTERES_RESENA = 500;

// Cuenta caracteres reales (un emoji cuenta 1), igual que char_length de Postgres
export function contarCaracteres(texto: string) {
  return Array.from(texto).length;
}

export function normalizarResena(texto: string) {
  return texto.trim();
}

// Devuelve el mensaje de error o null si la reseña es válida
export function validarResena(texto: string): string | null {
  const cantidad = contarCaracteres(normalizarResena(texto));
  if (cantidad === 0) return "Escribe tu reseña.";
  if (cantidad < MIN_CARACTERES_RESENA) {
    return `La reseña debe tener al menos ${MIN_CARACTERES_RESENA} caracteres.`;
  }
  if (cantidad > MAX_CARACTERES_RESENA) {
    return `La reseña no puede superar los ${MAX_CARACTERES_RESENA} caracteres.`;
  }
  return null;
}
