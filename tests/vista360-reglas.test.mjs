// Pruebas de las reglas de la vista 360. Ejecutar con: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  anchoMaximoDe,
  campoPanoramica,
  esProporcionEsfera,
  MAX_FOTOS_COLLAGE,
  MIN_FOTOS_COLLAGE,
  mover,
  rutasSinUso,
  rutaVista360,
  validarCantidadFotos,
  VAOV_PANORAMICA,
} from "../lib/vista360-reglas.ts";

describe("validarCantidadFotos", () => {
  it("esfera y panorámica piden exactamente una foto", () => {
    for (const tipo of ["esfera", "panoramica"]) {
      assert.ok(validarCantidadFotos(tipo, 0));
      assert.equal(validarCantidadFotos(tipo, 1), null);
      assert.ok(validarCantidadFotos(tipo, 2));
    }
  });

  it("el collage acepta de 6 a 24 fotos", () => {
    assert.ok(validarCantidadFotos("collage", MIN_FOTOS_COLLAGE - 1));
    assert.equal(validarCantidadFotos("collage", MIN_FOTOS_COLLAGE), null);
    assert.equal(validarCantidadFotos("collage", MAX_FOTOS_COLLAGE), null);
    assert.ok(validarCantidadFotos("collage", MAX_FOTOS_COLLAGE + 1));
  });
});

describe("esProporcionEsfera", () => {
  it("acepta 2:1 y valores cercanos", () => {
    assert.ok(esProporcionEsfera(4096, 2048));
    assert.ok(esProporcionEsfera(5376, 2688));
    assert.ok(esProporcionEsfera(4000, 2100));
  });

  it("rechaza fotos normales y panorámicas", () => {
    assert.equal(esProporcionEsfera(4032, 3024), false);
    assert.equal(esProporcionEsfera(9000, 2000), false);
  });

  it("no avisa si no hay medidas", () => {
    assert.ok(esProporcionEsfera(0, 0));
  });
});

describe("campoPanoramica", () => {
  it("una foto 3:1 cubre 180°", () => {
    assert.deepEqual(campoPanoramica(3000, 1000), { haov: 180, vaov: VAOV_PANORAMICA });
  });

  it("nunca pasa de 360° y recalcula el alto", () => {
    const { haov, vaov } = campoPanoramica(10000, 1000);
    assert.equal(haov, 360);
    assert.equal(vaov, 36);
  });

  it("sin medidas usa una proporción razonable", () => {
    const { haov } = campoPanoramica(0, 0);
    assert.ok(haov > 0 && haov <= 360);
  });
});

describe("utilidades", () => {
  it("ancho máximo según el tipo", () => {
    assert.equal(anchoMaximoDe("esfera"), 4096);
    assert.equal(anchoMaximoDe("panoramica"), 4096);
    assert.equal(anchoMaximoDe("collage"), 1600);
  });

  it("ruta en el bucket", () => {
    assert.equal(rutaVista360("abc", 3, 123), "360/abc/3-123.jpg");
  });

  it("mover reordena sin tocar la lista original", () => {
    const lista = ["a", "b", "c"];
    assert.deepEqual(mover(lista, 0, 2), ["b", "c", "a"]);
    assert.deepEqual(mover(lista, 2, 1), ["a", "c", "b"]);
    assert.deepEqual(lista, ["a", "b", "c"]);
    assert.equal(mover(lista, 0, 5), lista);
  });

  it("rutasSinUso devuelve solo las que ya no están", () => {
    assert.deepEqual(rutasSinUso(["x", "y", "z"], ["y", "w"]), ["x", "z"]);
  });
});
