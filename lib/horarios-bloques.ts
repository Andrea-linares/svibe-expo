/* ---------------------------------------------------------------------------
 * Horarios del formulario de admin en bloques de días.
 * Sin dependencias (se prueba con npm test). La validación recibe
 * normalizarHora (lib/fechas.ts) como parámetro para no importar nada.
 *
 * - dia_semana: 0 = domingo ... 6 = sábado (como horarios_hito).
 * - Un día sin fila en horarios_hito está cerrado.
 * ------------------------------------------------------------------------- */

export type FilaHorario = {
  dia_semana: number;
  hora_apertura: string;
  hora_cierre: string;
};

export type BloqueHorario = {
  id: string;
  dias: number[];
  apertura: string;
  cierre: string;
  cerrado: boolean;
};

export type FormHorario = {
  // 00:00 a 23:59 los 7 días
  veinticuatro: boolean;
  // false: un solo par apertura/cierre para los 7 días
  porDia: boolean;
  apertura: string;
  cierre: string;
  bloques: BloqueHorario[];
};

type Normalizar = (texto: string) => string | null;

export const DIAS_SEMANA = [0, 1, 2, 3, 4, 5, 6];
// Orden en pantalla: lunes a domingo
export const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
export const NOMBRE_CORTO_DIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const NOMBRE_DIA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const ATAJOS_DIAS = [
  { etiqueta: "Lunes a viernes", dias: [1, 2, 3, 4, 5] },
  { etiqueta: "Sábado y domingo", dias: [6, 0] },
  { etiqueta: "Todos los días", dias: ORDEN_DIAS },
];

export const APERTURA_DEFECTO = "08:00";
export const CIERRE_DEFECTO = "17:00";
const INICIO_DIA = "00:00";
const FIN_DIA = "23:59";

// "08:00:00" → "08:00"
function hhmm(hora: string) {
  return String(hora).slice(0, 5);
}

export function ordenarDias(dias: readonly number[]) {
  return ORDEN_DIAS.filter((d) => dias.includes(d));
}

let contadorBloques = 0;

export function nuevoBloque(
  dias: readonly number[] = [],
  apertura = APERTURA_DEFECTO,
  cierre = CIERRE_DEFECTO,
  cerrado = false,
): BloqueHorario {
  contadorBloques += 1;
  return { id: `bloque-${contadorBloques}`, dias: ordenarDias(dias), apertura, cierre, cerrado };
}

// Activa o desactiva un día en un bloque
export function alternarDia(bloque: BloqueHorario, dia: number): BloqueHorario {
  const dias = bloque.dias.includes(dia)
    ? bloque.dias.filter((d) => d !== dia)
    : [...bloque.dias, dia];
  return { ...bloque, dias: ordenarDias(dias) };
}

// Filas en "HH:MM", ordenadas por día
function normalizarFilas(filas: readonly FilaHorario[]): FilaHorario[] {
  return filas
    .map((f) => ({
      dia_semana: Number(f.dia_semana),
      hora_apertura: hhmm(f.hora_apertura),
      hora_cierre: hhmm(f.hora_cierre),
    }))
    .sort((a, b) => a.dia_semana - b.dia_semana);
}

/* Agrupa las filas en bloques de días con el mismo horario (lunes a domingo).
 * Los días sin fila se agrupan en un bloque "Cerrado". */
export function agruparEnBloques(filas: readonly FilaHorario[]): BloqueHorario[] {
  const normalizadas = normalizarFilas(filas);
  const grupos = new Map<string, { apertura: string; cierre: string; dias: number[] }>();
  const faltantes: number[] = [];

  for (const dia of ORDEN_DIAS) {
    const fila = normalizadas.find((f) => f.dia_semana === dia);
    if (!fila) {
      faltantes.push(dia);
      continue;
    }
    const clave = `${fila.hora_apertura}-${fila.hora_cierre}`;
    const grupo = grupos.get(clave);
    if (grupo) grupo.dias.push(dia);
    else grupos.set(clave, { apertura: fila.hora_apertura, cierre: fila.hora_cierre, dias: [dia] });
  }

  const bloques = [...grupos.values()].map((g) => nuevoBloque(g.dias, g.apertura, g.cierre));
  if (faltantes.length > 0 && bloques.length > 0) {
    bloques.push(nuevoBloque(faltantes, APERTURA_DEFECTO, CIERRE_DEFECTO, true));
  }
  return bloques;
}

// Formulario vacío (lugar nuevo)
export function formNuevo(): FormHorario {
  return {
    veinticuatro: false,
    porDia: false,
    apertura: APERTURA_DEFECTO,
    cierre: CIERRE_DEFECTO,
    bloques: [nuevoBloque(ORDEN_DIAS)],
  };
}

/* Estado del formulario a partir de las filas de horarios_hito:
 * - 7 días 00:00–23:59 → "24 horas".
 * - 7 días con el mismo horario → un solo par (porDia apagado).
 * - Horarios distintos, días faltantes o sin filas → porDia encendido. */
export function formDesdeFilas(filas: readonly FilaHorario[]): FormHorario {
  const normalizadas = normalizarFilas(filas);
  const bloques = agruparEnBloques(normalizadas);
  const claves = new Set(normalizadas.map((f) => `${f.hora_apertura}-${f.hora_cierre}`));
  const diasDistintos = new Set(normalizadas.map((f) => f.dia_semana));
  const sieteIguales = diasDistintos.size === DIAS_SEMANA.length && claves.size === 1;

  if (sieteIguales) {
    const { hora_apertura, hora_cierre } = normalizadas[0];
    if (hora_apertura === INICIO_DIA && hora_cierre === FIN_DIA) {
      return {
        veinticuatro: true,
        porDia: false,
        apertura: APERTURA_DEFECTO,
        cierre: CIERRE_DEFECTO,
        bloques: [nuevoBloque(ORDEN_DIAS)],
      };
    }
    return { veinticuatro: false, porDia: false, apertura: hora_apertura, cierre: hora_cierre, bloques };
  }

  return {
    veinticuatro: false,
    porDia: true,
    apertura: APERTURA_DEFECTO,
    cierre: CIERRE_DEFECTO,
    bloques,
  };
}

function validarPar(apertura: string, cierre: string, normalizar: Normalizar): string | null {
  const a = normalizar(apertura);
  const c = normalizar(cierre);
  if (!a || !c) return "Escribe las horas como HH:MM (00:00 a 23:59).";
  if (a >= c) return "La hora de apertura debe ser antes del cierre.";
  return null;
}

// Mensaje de error o null si el horario es válido
export function validarForm(form: FormHorario, normalizar: Normalizar): string | null {
  if (form.veinticuatro) return null;
  if (!form.porDia) return validarPar(form.apertura, form.cierre, normalizar);

  const usados = new Set<number>();
  for (let i = 0; i < form.bloques.length; i++) {
    const bloque = form.bloques[i];
    const nombre = `Horario ${i + 1}`;
    if (bloque.dias.length === 0) return `${nombre}: elige al menos un día.`;
    for (const dia of bloque.dias) {
      if (usados.has(dia)) {
        return `${NOMBRE_DIA[dia]} está en dos horarios. Cada día solo puede estar en uno.`;
      }
      usados.add(dia);
    }
    if (!bloque.cerrado) {
      const error = validarPar(bloque.apertura, bloque.cierre, normalizar);
      if (error) return `${nombre}: ${error}`;
    }
  }
  return null;
}

/* Una fila por día abierto, ordenadas por día. Los días cerrados o que no
 * están en ningún bloque no llevan fila. Llamar solo con un form válido. */
export function expandirAFilas(form: FormHorario, normalizar: Normalizar): FilaHorario[] {
  if (form.veinticuatro) {
    return DIAS_SEMANA.map((dia) => ({ dia_semana: dia, hora_apertura: INICIO_DIA, hora_cierre: FIN_DIA }));
  }

  if (!form.porDia) {
    const apertura = normalizar(form.apertura) ?? form.apertura;
    const cierre = normalizar(form.cierre) ?? form.cierre;
    return DIAS_SEMANA.map((dia) => ({ dia_semana: dia, hora_apertura: apertura, hora_cierre: cierre }));
  }

  const filas: FilaHorario[] = [];
  for (const bloque of form.bloques) {
    if (bloque.cerrado) continue;
    const apertura = normalizar(bloque.apertura) ?? bloque.apertura;
    const cierre = normalizar(bloque.cierre) ?? bloque.cierre;
    for (const dia of bloque.dias) {
      filas.push({ dia_semana: dia, hora_apertura: apertura, hora_cierre: cierre });
    }
  }
  return filas.sort((a, b) => a.dia_semana - b.dia_semana);
}

// true si las filas nuevas son distintas de las cargadas (ignora segundos y orden)
export function hayCambios(
  cargadas: readonly FilaHorario[],
  nuevas: readonly FilaHorario[],
): boolean {
  const clave = (filas: readonly FilaHorario[]) =>
    normalizarFilas(filas)
      .map((f) => `${f.dia_semana}|${f.hora_apertura}|${f.hora_cierre}`)
      .join(",");
  return clave(cargadas) !== clave(nuevas);
}
