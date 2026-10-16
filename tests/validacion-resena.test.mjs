// Pruebas de la validación de reseñas (S3-10). Ejecutar con: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contarCaracteres,
  MAX_CARACTERES_RESENA,
  MIN_CARACTERES_RESENA,
  normalizarResena,
  validarResena,
} from "../lib/validacion-resena.ts";

describe("validarResena", () => {
  it("rechaza una reseña vacía o solo con espacios", () => {
    assert.equal(validarResena(""), "Escribe tu reseña.");
    assert.equal(validarResena("   \n\t "), "Escribe tu reseña.");
  });

  it("rechaza menos de 10 caracteres", () => {
    assert.match(validarResena("Muy bonito".slice(0, 9)), /al menos 10/);
  });

  it("acepta exactamente 10 caracteres", () => {
    assert.equal(validarResena("a".repeat(MIN_CARACTERES_RESENA)), null);
  });

  it("acepta exactamente 500 caracteres", () => {
    assert.equal(validarResena("a".repeat(MAX_CARACTERES_RESENA)), null);
  });

  it("rechaza 501 caracteres", () => {
    assert.match(validarResena("a".repeat(MAX_CARACTERES_RESENA + 1)), /no puede superar los 500/);
  });

  it("no cuenta los espacios del inicio y el fin", () => {
    assert.match(validarResena(`   ${"a".repeat(9)}   `), /al menos 10/);
    assert.equal(validarResena(`  ${"a".repeat(500)}\n`), null);
  });

  it("cuenta cada emoji como un carácter, igual que Postgres", () => {
    assert.equal(contarCaracteres("😀😀"), 2);
    assert.equal(validarResena("😀".repeat(10)), null);
    assert.match(validarResena("😀".repeat(501)), /no puede superar/);
  });
});

describe("normalizarResena", () => {
  it("quita los espacios del inicio y el fin", () => {
    assert.equal(normalizarResena("  Me encantó el lugar \n"), "Me encantó el lugar");
  });
});
