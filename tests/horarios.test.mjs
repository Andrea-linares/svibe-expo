// Pruebas del estado abierto/cerrado de los hitos. Ejecutar con: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calcularEstado, esHorario24Horas, horaASegundos } from "../lib/horarios.ts";

// Fecha y hora de El Salvador (UTC-6). 2026-11-25 es miércoles (dia_semana 3).
function sv(hora, minuto = 0, segundo = 0, dia = 25) {
  return new Date(Date.UTC(2026, 10, dia, hora + 6, minuto, segundo));
}

function semana(apertura, cierre) {
  return [0, 1, 2, 3, 4, 5, 6].map((dia_semana) => ({
    dia_semana,
    hora_apertura: apertura,
    hora_cierre: cierre,
  }));
}

const TODO_EL_DIA = semana("00:00:00", "23:59:00");
const NORMAL = semana("08:00:00", "17:00:00");

describe("calcularEstado: 00:00 – 23:59", () => {
  it("abierto a las 16:00", () => {
    const e = calcularEstado(TODO_EL_DIA, sv(16));
    assert.equal(e.abierto, true);
    assert.equal(e.tipo, "abierto");
    assert.equal(e.mensajeHora, "Abierto las 24 horas");
  });

  it("abierto a las 00:00", () => {
    assert.equal(calcularEstado(TODO_EL_DIA, sv(0)).abierto, true);
  });

  it("abierto a las 23:59:30", () => {
    assert.equal(calcularEstado(TODO_EL_DIA, sv(23, 59, 30)).abierto, true);
  });

  it("acepta horas sin segundos (HH:MM)", () => {
    assert.equal(calcularEstado(semana("00:00", "23:59"), sv(16)).abierto, true);
  });
});

describe("calcularEstado: 08:00 – 17:00", () => {
  it("abierto dentro del rango", () => {
    const e = calcularEstado(NORMAL, sv(10, 30));
    assert.equal(e.abierto, true);
    assert.equal(e.mensajeHora, "Cierra a las 5:00 PM");
  });

  it("abierto justo al abrir", () => {
    assert.equal(calcularEstado(NORMAL, sv(8)).abierto, true);
  });

  it("cerrado antes de abrir", () => {
    const e = calcularEstado(NORMAL, sv(7, 59));
    assert.equal(e.abierto, false);
    assert.equal(e.mensajeHora, "Abre a las 8:00 AM");
  });

  it("cerrado al llegar la hora de cierre", () => {
    const e = calcularEstado(NORMAL, sv(17));
    assert.equal(e.abierto, false);
    assert.equal(e.mensajeHora, "Cerró a las 5:00 PM");
  });

  it("usa la hora de El Salvador, no la del teléfono", () => {
    // 16:00 en El Salvador = 22:00 UTC
    const ahora = new Date(Date.UTC(2026, 10, 25, 22, 0, 0));
    assert.equal(calcularEstado(NORMAL, ahora).abierto, true);
  });
});

describe("calcularEstado: filas del día", () => {
  it("toma la fila de hoy entre horarios distintos por día", () => {
    const horarios = [
      { dia_semana: 3, hora_apertura: "05:30:00", hora_cierre: "18:00:00" },
      { dia_semana: 4, hora_apertura: "05:30:00", hora_cierre: "17:30:00" },
    ];
    assert.equal(calcularEstado(horarios, sv(17, 45)).abierto, true);
    // jueves 26 a las 17:45: ya cerró
    assert.equal(calcularEstado(horarios, sv(17, 45, 0, 26)).abierto, false);
  });

  it("dia_semana como texto también cuenta", () => {
    const horarios = [{ dia_semana: "3", hora_apertura: "08:00:00", hora_cierre: "17:00:00" }];
    assert.equal(calcularEstado(horarios, sv(12)).abierto, true);
  });

  it("día sin fila: cerrado hoy", () => {
    const sinMiercoles = NORMAL.filter((h) => h.dia_semana !== 3);
    const e = calcularEstado(sinMiercoles, sv(12));
    assert.equal(e.tipo, "cerrado");
    assert.equal(e.mensajeHora, "Cerrado hoy");
  });

  it("hito sin filas: Horario no disponible (no 'Cerrado')", () => {
    for (const horarios of [[], null, undefined]) {
      const e = calcularEstado(horarios, sv(12));
      assert.equal(e.tipo, "sin_horario");
      assert.equal(e.titulo, "Horario no disponible");
      assert.ok(!e.titulo.includes("Cerrado"));
    }
  });
});

describe("esHorario24Horas", () => {
  it("7 días 00:00–23:59 = true", () => {
    assert.equal(esHorario24Horas(TODO_EL_DIA), true);
  });

  it("7 días 08:00–17:00 = false", () => {
    assert.equal(esHorario24Horas(NORMAL), false);
  });

  it("6 días 00:00–23:59 y uno distinto = false", () => {
    const mezcla = TODO_EL_DIA.map((h) =>
      h.dia_semana === 0 ? { ...h, hora_apertura: "08:00:00", hora_cierre: "17:00:00" } : h,
    );
    assert.equal(esHorario24Horas(mezcla), false);
  });

  it("6 días 00:00–23:59 y uno sin fila = false", () => {
    assert.equal(esHorario24Horas(TODO_EL_DIA.slice(1)), false);
  });

  it("lista vacía = false", () => {
    assert.equal(esHorario24Horas([]), false);
  });
});

describe("horaASegundos", () => {
  it("HH:MM y HH:MM:SS", () => {
    assert.equal(horaASegundos("08:30"), 8 * 3600 + 30 * 60);
    assert.equal(horaASegundos("00:00:00"), 0);
    assert.equal(horaASegundos("23:59:30"), 23 * 3600 + 59 * 60 + 30);
  });

  it("00:00 no se trata como vacío", () => {
    assert.equal(horaASegundos("00:00"), 0);
  });

  it("inválidas o vacías → null", () => {
    assert.equal(horaASegundos(""), null);
    assert.equal(horaASegundos(null), null);
    assert.equal(horaASegundos("25:00"), null);
  });
});
