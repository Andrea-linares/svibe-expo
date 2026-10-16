// Pruebas de las utilidades del foro. Ejecutar con: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { agruparPorResena, avisoComentariosAlEliminar, fechaForo } from "../lib/foro-datos.ts";

describe("fechaForo", () => {
  // Fecha construida en hora local para que la prueba no dependa de la zona horaria
  const creado = new Date(2026, 8, 18, 12, 0).toISOString();

  it("formatea la fecha como dd/mm/aaaa", () => {
    assert.equal(fechaForo(creado), "18/09/2026");
  });

  it("marca las publicaciones editadas", () => {
    assert.equal(fechaForo(creado, new Date(2026, 8, 19).toISOString()), "18/09/2026 · editado");
  });

  it("no marca como editada si editado_en es null o no viene", () => {
    assert.equal(fechaForo(creado, null), "18/09/2026");
    assert.equal(fechaForo(creado, undefined), "18/09/2026");
  });
});

describe("agruparPorResena", () => {
  it("agrupa por post_id conservando el orden", () => {
    const grupos = agruparPorResena([
      { id: "c1", post_id: "r1" },
      { id: "c2", post_id: "r2" },
      { id: "c3", post_id: "r1" },
    ]);
    assert.deepEqual(grupos.r1.map((c) => c.id), ["c1", "c3"]);
    assert.deepEqual(grupos.r2.map((c) => c.id), ["c2"]);
  });

  it("devuelve un objeto vacío sin comentarios", () => {
    assert.deepEqual(agruparPorResena([]), {});
  });
});

describe("avisoComentariosAlEliminar", () => {
  it("no añade texto si no hay comentarios", () => {
    assert.equal(avisoComentariosAlEliminar(0), "");
  });

  it("usa singular y plural", () => {
    assert.equal(avisoComentariosAlEliminar(1), " También se eliminará su comentario.");
    assert.equal(avisoComentariosAlEliminar(3), " También se eliminarán sus 3 comentarios.");
  });
});
