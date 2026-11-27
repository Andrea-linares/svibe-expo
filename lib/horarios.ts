/* ---------------------------------------------------------------------------
 * Estado abierto/cerrado de un hito según horarios_hito.
 * Sin dependencias (se prueba con npm test).
 *
 * - dia_semana: 0 = domingo ... 6 = sábado.
 * - Horas "HH:MM" o "HH:MM:SS" (Postgres devuelve "HH:MM:SS").
 * - Se usa la hora de El Salvador (UTC-6, sin horario de verano), no la del
 *   teléfono: el horario es el del lugar aunque el usuario esté en otro país.
 * - Un cierre a las 23:59 cuenta como fin del día (abierto hasta medianoche).
 * ------------------------------------------------------------------------- */

export type HorarioDia = {
  dia_semana: number | string;
  hora_apertura: string | null;
  hora_cierre: string | null;
};

export type EstadoHorario = {
  tipo: "abierto" | "cerrado" | "sin_horario";
  abierto: boolean;
  titulo: string;
  mensajeHora: string;
};

const DESFASE_EL_SALVADOR_MS = -6 * 60 * 60 * 1000;
const SEGUNDOS_DIA = 24 * 60 * 60;
// Desde 23:59:00 se considera "hasta el final del día"
const CIERRE_FIN_DE_DIA = 23 * 3600 + 59 * 60;

// "08:30" o "08:30:00" → segundos desde medianoche; null si no es válida
export function horaASegundos(hora: string | null | undefined): number | null {
  if (typeof hora !== "string") return null;
  const coincidencia = hora.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!coincidencia) return null;
  const h = Number(coincidencia[1]);
  const m = Number(coincidencia[2]);
  const s = Number(coincidencia[3] ?? 0);
  if (h > 23 || m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

// Día de la semana y segundos del día en El Salvador
export function momentoElSalvador(ahora: Date) {
  const local = new Date(ahora.getTime() + DESFASE_EL_SALVADOR_MS);
  return {
    dia: local.getUTCDay(),
    segundos:
      local.getUTCHours() * 3600 + local.getUTCMinutes() * 60 + local.getUTCSeconds(),
  };
}

// "17:00:00" → "5:00 PM"
function horaLegible(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  const periodo = h >= 12 ? "PM" : "AM";
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${String(m).padStart(2, "0")} ${periodo}`;
}

const NOMBRES_DIA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
// La lista se muestra de lunes a domingo
const ORDEN_LUNES_A_DOMINGO = [1, 2, 3, 4, 5, 6, 0];

/* Líneas para el modal "Horarios de atención": agrupa días consecutivos
 * (lunes a domingo) con el mismo horario; los días sin fila salen "Cerrado".
 * Sin filas devuelve [] (el detalle no muestra la fila). */
export function lineasHorario(
  horarios: readonly HorarioDia[] | null | undefined,
): { rango: string; horario: string }[] {
  if (!horarios || horarios.length === 0) return [];

  const textoPorDia = new Map<number, string>();
  for (const h of horarios) {
    const apertura = horaASegundos(h.hora_apertura);
    const cierre = horaASegundos(h.hora_cierre);
    if (apertura === null || cierre === null) continue;
    textoPorDia.set(
      Number(h.dia_semana),
      apertura === 0 && cierre >= CIERRE_FIN_DE_DIA
        ? "24 horas"
        : `${horaLegible(h.hora_apertura as string)} - ${horaLegible(h.hora_cierre as string)}`,
    );
  }

  const textos = ORDEN_LUNES_A_DOMINGO.map((d) => textoPorDia.get(d) ?? "Cerrado");

  const lineas: { rango: string; horario: string }[] = [];
  let inicio = 0;
  for (let i = 1; i <= textos.length; i++) {
    if (i < textos.length && textos[i] === textos[inicio]) continue;
    const primero = NOMBRES_DIA[ORDEN_LUNES_A_DOMINGO[inicio]];
    const ultimo = NOMBRES_DIA[ORDEN_LUNES_A_DOMINGO[i - 1]];
    const rango =
      i - inicio === textos.length
        ? "Todos los días"
        : i - 1 === inicio
          ? primero
          : `${primero} - ${ultimo}`;
    lineas.push({ rango, horario: textos[inicio] });
    inicio = i;
  }
  return lineas;
}

// true si abre los 7 días de 00:00 a 23:59 (el detalle no muestra la fila de horarios)
export function esHorario24Horas(
  horarios: readonly HorarioDia[] | null | undefined,
): boolean {
  const lineas = lineasHorario(horarios);
  return (
    lineas.length === 1 &&
    lineas[0].rango === "Todos los días" &&
    lineas[0].horario === "24 horas"
  );
}

export function calcularEstado(
  horarios: readonly HorarioDia[] | null | undefined,
  ahora: Date = new Date(),
): EstadoHorario {
  if (!horarios || horarios.length === 0) {
    return {
      tipo: "sin_horario",
      abierto: false,
      titulo: "Horario no disponible",
      mensajeHora: "",
    };
  }

  const { dia, segundos } = momentoElSalvador(ahora);
  const hoy = horarios.find((h) => Number(h.dia_semana) === dia);
  const apertura = horaASegundos(hoy?.hora_apertura);
  const cierreBruto = horaASegundos(hoy?.hora_cierre);

  if (!hoy || apertura === null || cierreBruto === null) {
    return {
      tipo: "cerrado",
      abierto: false,
      titulo: "Cerrado ahora",
      mensajeHora: "Cerrado hoy",
    };
  }

  const todoElDia = apertura === 0 && cierreBruto >= CIERRE_FIN_DE_DIA;
  const cierre = cierreBruto >= CIERRE_FIN_DE_DIA ? SEGUNDOS_DIA : cierreBruto;
  const abierto = segundos >= apertura && segundos < cierre;

  if (abierto) {
    return {
      tipo: "abierto",
      abierto: true,
      titulo: "Abierto hoy",
      mensajeHora: todoElDia
        ? "Abierto las 24 horas"
        : `Cierra a las ${horaLegible(hoy.hora_cierre as string)}`,
    };
  }

  return {
    tipo: "cerrado",
    abierto: false,
    titulo: "Cerrado ahora",
    mensajeHora:
      segundos < apertura
        ? `Abre a las ${horaLegible(hoy.hora_apertura as string)}`
        : `Cerró a las ${horaLegible(hoy.hora_cierre as string)}`,
  };
}
