// Pruebas de las utilidades geográficas de la RA. Ejecutar con: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  desplazarCoordenada,
  diferenciaAngular,
  distanciaHaversine,
  formatearDistancia,
  normalizarAngulo,
  puntoCardinal,
  rumbo,
  rumboCamara,
  suavizarAngulo,
} from "../lib/geo.ts";

// Catedral Metropolitana de San Salvador (aprox.)
const CATEDRAL = { lat: 13.6989, lng: -89.1914 };

const casi = (real, esperado, tolerancia) =>
  assert.ok(Math.abs(real - esperado) <= tolerancia, `${real} ≉ ${esperado}`);

describe("distanciaHaversine", () => {
  it("es 0 para el mismo punto", () => {
    assert.equal(distanciaHaversine(CATEDRAL, CATEDRAL), 0);
  });

  it("1° de latitud mide unos 111 km", () => {
    const norte = { lat: CATEDRAL.lat + 1, lng: CATEDRAL.lng };
    casi(distanciaHaversine(CATEDRAL, norte), 111195, 50);
  });
});

describe("rumbo", () => {
  it("apunta al norte, este, sur y oeste", () => {
    casi(rumbo(CATEDRAL, { lat: CATEDRAL.lat + 0.01, lng: CATEDRAL.lng }), 0, 0.01);
    casi(rumbo(CATEDRAL, { lat: CATEDRAL.lat, lng: CATEDRAL.lng + 0.01 }), 90, 0.01);
    casi(rumbo(CATEDRAL, { lat: CATEDRAL.lat - 0.01, lng: CATEDRAL.lng }), 180, 0.01);
    casi(rumbo(CATEDRAL, { lat: CATEDRAL.lat, lng: CATEDRAL.lng - 0.01 }), 270, 0.01);
  });
});

describe("ángulos", () => {
  it("normaliza a 0..360", () => {
    assert.equal(normalizarAngulo(-10), 350);
    assert.equal(normalizarAngulo(370), 10);
    assert.equal(normalizarAngulo(360), 0);
  });

  it("la diferencia cruza 0° por el camino corto", () => {
    assert.equal(diferenciaAngular(350, 10), 20);
    assert.equal(diferenciaAngular(10, 350), -20);
    assert.equal(diferenciaAngular(90, 270), 180);
  });

  it("el suavizado no da la vuelta por 180° entre 359° y 1°", () => {
    const resultado = suavizarAngulo(359, 1, 0.5);
    assert.equal(Math.round(resultado), 0);
  });

  it("punto cardinal con grados", () => {
    assert.equal(puntoCardinal(45), "NE 45°");
    assert.equal(puntoCardinal(359.6), "N 0°");
    assert.equal(puntoCardinal(225), "SO 225°");
    assert.equal(puntoCardinal(-90), "O 270°");
  });
});

describe("desplazarCoordenada", () => {
  it("40 m al sur queda a 40 m y con rumbo norte hacia el origen", () => {
    const punto = desplazarCoordenada(CATEDRAL, 40, 180);
    casi(distanciaHaversine(punto, CATEDRAL), 40, 0.01);
    casi(rumbo(punto, CATEDRAL), 0, 0.01);
  });
});

describe("rumboCamara", () => {
  // Teléfono vertical: la gravedad se lee en +Y y la cámara trasera es -Z
  const vertical = { x: 0, y: 1, z: 0 };

  it("cámara hacia el norte", () => {
    casi(rumboCamara(vertical, { x: 0, y: -0.3, z: -1 }), 0, 0.01);
  });

  it("cámara hacia el este (el norte queda a la izquierda)", () => {
    casi(rumboCamara(vertical, { x: -1, y: -0.3, z: 0 }), 90, 0.01);
  });

  it("cámara hacia el sur y el oeste", () => {
    casi(rumboCamara(vertical, { x: 0, y: -0.3, z: 1 }), 180, 0.01);
    casi(rumboCamara(vertical, { x: 1, y: -0.3, z: 0 }), 270, 0.01);
  });

  it("teléfono plano: usa el borde superior", () => {
    const plano = { x: 0, y: 0, z: 1 };
    casi(rumboCamara(plano, { x: 0, y: 1, z: -0.5 }), 0, 0.01);
    casi(rumboCamara(plano, { x: -1, y: 0, z: -0.5 }), 90, 0.01);
  });

  it("lecturas vacías devuelven null", () => {
    assert.equal(rumboCamara({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), null);
  });
});

describe("formatearDistancia", () => {
  it("metros y kilómetros", () => {
    assert.equal(formatearDistancia(149.6), "150 m");
    assert.equal(formatearDistancia(1234), "1.2 km");
  });
});
