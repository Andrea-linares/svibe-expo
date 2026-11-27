/* ---------------------------------------------------------------------------
 * Reglas puras de las sugerencias (sin dependencias, se prueban con npm test)
 * ------------------------------------------------------------------------- */

// Devuelve los items en el orden de `ids`. Los ids sin item se omiten, los
// items cuyo id no está en `ids` se descartan y los ids repetidos cuentan una vez.
export function ordenarPorIds<T extends { id: string }>(
  items: readonly T[],
  ids: readonly string[],
): T[] {
  const porId = new Map<string, T>();
  for (const item of items) {
    if (!porId.has(item.id)) porId.set(item.id, item);
  }

  const vistos = new Set<string>();
  const resultado: T[] = [];
  for (const id of ids) {
    if (vistos.has(id)) continue;
    vistos.add(id);
    const item = porId.get(id);
    if (item) resultado.push(item);
  }
  return resultado;
}

// Hash FNV-1a de 32 bits (para mezclar de forma estable)
function hashTexto(texto: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/* Mezcla la lista de forma variada pero estable para una misma semilla
 * (p. ej. la fecha de hoy): no depende de cuándo se creó cada hito y no
 * cambia de orden al recargar durante el día. No modifica la lista original. */
export function mezclarDelDia<T extends { id: string }>(
  items: readonly T[],
  semilla: string,
): T[] {
  return items
    .map((item) => ({ item, clave: hashTexto(`${item.id}|${semilla}`) }))
    .sort((a, b) => a.clave - b.clave || a.item.id.localeCompare(b.item.id))
    .map(({ item }) => item);
}

// true si toca volver a pedir las sugerencias (pasó el intervalo mínimo)
export function debeRecargar(
  ultimaCarga: number | null,
  ahora: number,
  intervaloMs: number,
): boolean {
  return ultimaCarga === null || ahora - ultimaCarga >= intervaloMs;
}
