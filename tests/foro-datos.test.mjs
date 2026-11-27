// Pruebas de las utilidades del foro. Ejecutar con: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  agruparPorResena,
  avisoComentariosAlEliminar,
  etiquetaEstrellas,
  fechaForo,
  filtrarPorLugar,
  normalizarTexto,
  formasEstrellas,
  resumenCalificaciones,
  textoValoraciones,
} from "../lib/foro-datos.ts";

describe("resumenCalificaciones", () => {
  it("calcula el promedio con un decimal", () => {
    assert.deepEqual(resumenCalificaciones([5, 4, 5]), { promedio: 4.7, total: 3 });
  });

  it("ignora reseñas sin calificación", () => {
    assert.deepEqual(resumenCalificaciones([4, null, undefined]), { promedio: 4, total: 1 });
  });

  it("devuelve total 0 sin valoraciones", () => {
    assert.deepEqual(resumenCalificaciones([]), { promedio: 0, total: 0 });
  });
});

describe("formasEstrellas", () => {
  it("valores enteros", () => {
    assert.deepEqual(formasEstrellas(3), ["llena", "llena", "llena", "vacia", "vacia"]);
  });

  it("media estrella", () => {
    assert.deepEqual(formasEstrellas(4.6), ["llena", "llena", "llena", "llena", "media"]);
  });

  it("redondea hacia abajo y hacia arriba", () => {
    assert.deepEqual(formasEstrellas(4.2), ["llena", "llena", "llena", "llena", "vacia"]);
    assert.deepEqual(formasEstrellas(4.8), ["llena", "llena", "llena", "llena", "llena"]);
  });
});

describe("textos de calificación", () => {
  it("singular y plural de valoraciones", () => {
    assert.equal(textoValoraciones(1), "1 valoración");
    assert.equal(textoValoraciones(124), "124 valoraciones");
  });

  it("etiqueta accesible", () => {
    assert.equal(etiquetaEstrellas(3), "3 de 5 estrellas");
    assert.equal(etiquetaEstrellas(4.6), "4,6 de 5 estrellas");
  });
});

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

describe("normalizarTexto", () => {
  it("quita tildes, mayúsculas y espacios de los extremos", () => {
    assert.equal(normalizarTexto("  Laguna de ALEGRÍA "), "laguna de alegria");
  });

  it("null o undefined → texto vacío", () => {
    assert.equal(normalizarTexto(null), "");
    assert.equal(normalizarTexto(undefined), "");
  });
});

describe("filtrarPorLugar", () => {
  const resenas = [
    { id: "1", hito_id: "a", hito_nombre: "Laguna de Alegría" },
    { id: "2", hito_id: "b", hito_nombre: "Finca Rauda" },
    { id: "3", hito_id: "a", hito_nombre: "Laguna de Alegría" },
    { id: "4", hito_id: "c", hito_nombre: "Finca Rauda Norte" },
  ];

  it("coincide sin tildes: 'alegria' encuentra 'Laguna de Alegría'", () => {
    assert.deepEqual(filtrarPorLugar(resenas, "alegria").map((r) => r.id), ["1", "3"]);
  });

  it("no distingue mayúsculas", () => {
    assert.deepEqual(filtrarPorLugar(resenas, "FINCA").map((r) => r.id), ["2", "4"]);
  });

  it("texto vacío devuelve todo", () => {
    assert.deepEqual(filtrarPorLugar(resenas, "   ").map((r) => r.id), ["1", "2", "3", "4"]);
  });

  it("sin coincidencias devuelve lista vacía", () => {
    assert.deepEqual(filtrarPorLugar(resenas, "volcán"), []);
  });

  it("con hitoId deja solo ese hito aunque otro nombre lo contenga", () => {
    assert.deepEqual(filtrarPorLugar(resenas, "Finca Rauda", "b").map((r) => r.id), ["2"]);
  });

  it("no modifica la lista original", () => {
    const copia = [...resenas];
    filtrarPorLugar(resenas, "");
    assert.deepEqual(resenas, copia);
  });
});
