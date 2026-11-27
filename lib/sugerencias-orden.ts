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

// true si toca volver a pedir las sugerencias (pasó el intervalo mínimo)
export function debeRecargar(
  ultimaCarga: number | null,
  ahora: number,
  intervaloMs: number,
): boolean {
  return ultimaCarga === null || ahora - ultimaCarga >= intervaloMs;
}
