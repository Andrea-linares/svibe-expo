// Pruebas de los bloques de horario del formulario de admin. Ejecutar con: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizarHora } from "../lib/fechas.ts";
import {
  agruparEnBloques,
  alternarDia,
  expandirAFilas,
  formDesdeFilas,
  formNuevo,
  hayCambios,
  nuevoBloque,
  validarForm,
} from "../lib/horarios-bloques.ts";
import { lineasHorario } from "../lib/horarios.ts";

function fila(dia, apertura, cierre) {
  return { dia_semana: dia, hora_apertura: apertura, hora_cierre: cierre };
}

function semana(apertura, cierre) {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => fila(d, apertura, cierre));
}

// Bloques sin el id (cambia en cada llamada)
function sinId(bloques) {
  return bloques.map(({ id: _id, ...resto }) => resto);
}

// Horarios de la Catedral en la BD
const CATEDRAL = [
  fila(0, "05:30:00", "20:00:00"),
  fila(1, "05:30:00", "18:00:00"),
  fila(2, "05:30:00", "18:00:00"),
  fila(3, "05:30:00", "18:00:00"),
  fila(4, "05:30:00", "17:30:00"),
  fila(5, "05:30:00", "18:00:00"),
  fila(6, "05:30:00", "18:30:00"),
];

describe("formDesdeFilas", () => {
  it("7 días iguales: un solo par, sin 'por día'", () => {
    const form = formDesdeFilas(semana("08:00:00", "17:00:00"));
    assert.equal(form.veinticuatro, false);
    assert.equal(form.porDia, false);
    assert.equal(form.apertura, "08:00");
    assert.equal(form.cierre, "17:00");
  });

  it("00:00–23:59 los 7 días: 24 horas", () => {
    const form = formDesdeFilas(semana("00:00:00", "23:59:00"));
    assert.equal(form.veinticuatro, true);
    assert.equal(form.porDia, false);
  });

  it("lunes–viernes + sábado: 'por día' con dos bloques y domingo cerrado", () => {
    const filas = [1, 2, 3, 4, 5].map((d) => fila(d, "08:00:00", "16:00:00"));
    filas.push(fila(6, "09:00:00", "12:00:00"));
    const form = formDesdeFilas(filas);
    assert.equal(form.porDia, true);
    assert.deepEqual(sinId(form.bloques), [
      { dias: [1, 2, 3, 4, 5], apertura: "08:00", cierre: "16:00", cerrado: false },
      { dias: [6], apertura: "09:00", cierre: "12:00", cerrado: false },
      { dias: [0], apertura: "08:00", cierre: "17:00", cerrado: true },
    ]);
  });

  it("horarios distintos (Catedral): un bloque por horario", () => {
    const form = formDesdeFilas(CATEDRAL);
    assert.equal(form.porDia, true);
    assert.deepEqual(
      sinId(form.bloques).map((b) => [b.dias, b.apertura, b.cierre]),
      [
        [[1, 2, 3, 5], "05:30", "18:00"],
        [[4], "05:30", "17:30"],
        [[6], "05:30", "18:30"],
        [[0], "05:30", "20:00"],
      ],
    );
  });

  it("sin filas: 'por día' sin bloques", () => {
    const form = formDesdeFilas([]);
    assert.equal(form.porDia, true);
    assert.deepEqual(form.bloques, []);
  });
});

describe("expandirAFilas", () => {
  it("24 horas: 7 filas 00:00–23:59", () => {
    const filas = expandirAFilas({ ...formNuevo(), veinticuatro: true }, normalizarHora);
    assert.deepEqual(filas, semana("00:00", "23:59"));
  });

  it("un solo par: 7 filas iguales (normaliza 8:00 → 08:00)", () => {
    const form = { ...formNuevo(), apertura: "8:00", cierre: "16:30" };
    assert.deepEqual(expandirAFilas(form, normalizarHora), semana("08:00", "16:30"));
  });

  it("días cerrados y días sin bloque no llevan fila", () => {
    const form = {
      ...formNuevo(),
      porDia: true,
      bloques: [
        nuevoBloque([1, 2, 3, 4, 5], "08:00", "16:00"),
        nuevoBloque([6, 0], "08:00", "17:00", true),
      ],
    };
    assert.deepEqual(
      expandirAFilas(form, normalizarHora),
      [1, 2, 3, 4, 5].map((d) => fila(d, "08:00", "16:00")),
    );
  });

  it("ida y vuelta: Catedral sin cambios", () => {
    const filas = expandirAFilas(formDesdeFilas(CATEDRAL), normalizarHora);
    assert.equal(hayCambios(CATEDRAL, filas), false);
  });

  it("ida y vuelta: lunes–viernes + sábado", () => {
    const originales = [1, 2, 3, 4, 5].map((d) => fila(d, "08:00:00", "16:00:00"));
    originales.push(fila(6, "09:00:00", "12:00:00"));
    const filas = expandirAFilas(formDesdeFilas(originales), normalizarHora);
    assert.equal(hayCambios(originales, filas), false);
  });
});

describe("validarForm", () => {
  it("solapamiento: un día en dos bloques es inválido", () => {
    const form = {
      ...formNuevo(),
      porDia: true,
      bloques: [nuevoBloque([1, 2, 3]), nuevoBloque([3, 4])],
    };
    assert.match(validarForm(form, normalizarHora), /Miércoles está en dos horarios/);
  });

  it("apertura después del cierre es inválida", () => {
    const form = { ...formNuevo(), apertura: "18:00", cierre: "08:00" };
    assert.match(validarForm(form, normalizarHora), /antes del cierre/);
  });

  it("formato HH:MM inválido", () => {
    const form = { ...formNuevo(), apertura: "8am" };
    assert.match(validarForm(form, normalizarHora), /HH:MM/);
  });

  it("bloque sin días es inválido", () => {
    const form = { ...formNuevo(), porDia: true, bloques: [nuevoBloque([])] };
    assert.match(validarForm(form, normalizarHora), /al menos un día/);
  });

  it("bloque cerrado no valida horas", () => {
    const cerrado = { ...nuevoBloque([6, 0], "xx", "yy", true) };
    const form = { ...formNuevo(), porDia: true, bloques: [nuevoBloque([1, 2, 3, 4, 5]), cerrado] };
    assert.equal(validarForm(form, normalizarHora), null);
  });

  it("24 horas siempre es válido", () => {
    const form = { ...formNuevo(), veinticuatro: true, apertura: "mal" };
    assert.equal(validarForm(form, normalizarHora), null);
  });
});

describe("hayCambios", () => {
  it("sin cambios aunque cambien segundos y orden", () => {
    const nuevas = [...semana("08:00", "17:00")].reverse();
    assert.equal(hayCambios(semana("08:00:00", "17:00:00"), nuevas), false);
  });

  it("detecta una hora distinta", () => {
    const nuevas = semana("08:00", "17:00");
    nuevas[3] = fila(3, "08:00", "18:00");
    assert.equal(hayCambios(semana("08:00:00", "17:00:00"), nuevas), true);
  });

  it("detecta un día quitado", () => {
    assert.equal(hayCambios(semana("08:00", "17:00"), semana("08:00", "17:00").slice(1)), true);
  });

  it("formulario sin tocar de un hito sin horario: sin cambios", () => {
    assert.equal(hayCambios([], expandirAFilas(formDesdeFilas([]), normalizarHora)), false);
  });
});

describe("alternarDia y agruparEnBloques", () => {
  it("activa y desactiva días manteniendo lunes a domingo", () => {
    let b = nuevoBloque([1]);
    b = alternarDia(b, 0);
    b = alternarDia(b, 3);
    assert.deepEqual(b.dias, [1, 3, 0]);
    assert.deepEqual(alternarDia(b, 1).dias, [3, 0]);
  });

  it("sin filas no crea bloque 'Cerrado'", () => {
    assert.deepEqual(agruparEnBloques([]), []);
  });
});

describe("lineasHorario (modal del detalle)", () => {
  it("lunes a viernes y fin de semana cerrado", () => {
    const filas = [1, 2, 3, 4, 5].map((d) => fila(d, "08:00:00", "16:00:00"));
    assert.deepEqual(lineasHorario(filas), [
      { rango: "Lunes - Viernes", horario: "8:00 AM - 4:00 PM" },
      { rango: "Sábado - Domingo", horario: "Cerrado" },
    ]);
  });

  it("24 horas todos los días", () => {
    assert.deepEqual(lineasHorario(semana("00:00:00", "23:59:00")), [
      { rango: "Todos los días", horario: "24 horas" },
    ]);
  });

  it("Catedral: agrupa solo días consecutivos", () => {
    assert.deepEqual(lineasHorario(CATEDRAL), [
      { rango: "Lunes - Miércoles", horario: "5:30 AM - 6:00 PM" },
      { rango: "Jueves", horario: "5:30 AM - 5:30 PM" },
      { rango: "Viernes", horario: "5:30 AM - 6:00 PM" },
      { rango: "Sábado", horario: "5:30 AM - 6:30 PM" },
      { rango: "Domingo", horario: "5:30 AM - 8:00 PM" },
    ]);
  });

  it("sin filas: lista vacía (no se muestra la fila)", () => {
    assert.deepEqual(lineasHorario([]), []);
  });
});
