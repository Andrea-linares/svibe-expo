// Pruebas del orden de las sugerencias. Ejecutar con: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { debeRecargar, mezclarDelDia, ordenarPorIds } from "../lib/sugerencias-orden.ts";

const a = { id: "a", nombre: "A" };
const b = { id: "b", nombre: "B" };
const c = { id: "c", nombre: "C" };

describe("ordenarPorIds", () => {
  it("respeta el orden de los ids", () => {
    assert.deepEqual(ordenarPorIds([a, b, c], ["c", "a", "b"]), [c, a, b]);
  });

  it("omite ids sin item", () => {
    assert.deepEqual(ordenarPorIds([a, c], ["c", "x", "a"]), [c, a]);
  });

  it("descarta items que no están en ids", () => {
    assert.deepEqual(ordenarPorIds([a, b, c], ["b"]), [b]);
  });

  it("ids repetidos cuentan una vez", () => {
    assert.deepEqual(ordenarPorIds([a, b], ["b", "a", "b"]), [b, a]);
  });

  it("listas vacías", () => {
    assert.deepEqual(ordenarPorIds([], ["a"]), []);
    assert.deepEqual(ordenarPorIds([a], []), []);
  });

  it("no modifica la lista original", () => {
    const items = [a, b];
    ordenarPorIds(items, ["b", "a"]);
    assert.deepEqual(items, [a, b]);
  });
});

describe("debeRecargar", () => {
  it("sin carga previa recarga", () => {
    assert.equal(debeRecargar(null, 1000, 60000), true);
  });

  it("antes del intervalo no recarga", () => {
    assert.equal(debeRecargar(0, 59999, 60000), false);
  });

  it("al cumplir el intervalo recarga", () => {
    assert.equal(debeRecargar(0, 60000, 60000), true);
  });
});

describe("mezclarDelDia", () => {
  // 36 hitos: los 15 más nuevos al principio, como los devuelve la consulta
  const hitos = Array.from({ length: 36 }, (_, i) => ({ id: `hito-${i}`, nuevo: i < 15 }));

  it("misma semilla: mismo orden", () => {
    assert.deepEqual(mezclarDelDia(hitos, "2026-11-27"), mezclarDelDia(hitos, "2026-11-27"));
  });

  it("otra semilla: otro orden", () => {
    assert.notDeepEqual(
      mezclarDelDia(hitos, "2026-11-27").map((h) => h.id),
      mezclarDelDia(hitos, "2026-11-28").map((h) => h.id),
    );
  });

  it("conserva todos los elementos y no modifica la lista", () => {
    const copia = [...hitos];
    const mezclados = mezclarDelDia(hitos, "2026-11-27");
    assert.equal(mezclados.length, hitos.length);
    assert.deepEqual([...mezclados].sort((a, b) => a.id.localeCompare(b.id)), [...hitos].sort((a, b) => a.id.localeCompare(b.id)));
    assert.deepEqual(hitos, copia);
  });

  it("los 10 primeros no son solo los más nuevos", () => {
    const primeros = mezclarDelDia(hitos, "2026-11-27").slice(0, 10);
    assert.ok(primeros.some((h) => !h.nuevo));
  });
});
