import { formatearHora } from "@/lib/fechas";

/* ---------------------------------------------------------------------------
 * Estado abierto/cerrado de un hito
 * Lo usan el detalle del hito y la tarjeta de la realidad aumentada.
 * ------------------------------------------------------------------------- */

export type Horario = {
  dia_semana: number; // 0=domingo ... 6=sábado
  hora_apertura: string; // "08:00:00"
  hora_cierre: string;
};

// Columna hitos.estado_manual: los tres primeros mandan sobre el horario
export type EstadoManual = "abierto" | "cerrado" | "mantenimiento" | "automatico";

export type EstadoHito = {
  abierto: boolean;
  mensajeHora: string;
  // "8:00 AM - 5:00 PM" o null si hoy no hay horario
  horarioHoy: string | null;
};

// Verde de estado; en modo oscuro se aclara para mantener contraste
export const VERDE = "#2E7D32";
export const VERDE_OSCURO = "#81C784";

// Color del texto "Abierto" / "Cerrado"
export function colorEstado(abierto: boolean, esOscuro: boolean, colorCerrado: string) {
  if (!abierto) return colorCerrado;
  return esOscuro ? VERDE_OSCURO : VERDE;
}

// ---- Lógica de abierto/cerrado (equivalente a tu Calendar.getInstance() de Kotlin) ----
export function calcularEstado(
  horarios: Horario[],
  estadoManual: EstadoManual | null = "automatico",
): EstadoHito {
  const ahora = new Date();
  const diaActual = ahora.getDay(); // 0=domingo ... 6=sábado (igual que en tu BD)
  const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();

  const horarioHoy = horarios.find((h) => h.dia_semana === diaActual);
  const textoHorarioHoy = horarioHoy
    ? `${formatearHora(horarioHoy.hora_apertura)} - ${formatearHora(horarioHoy.hora_cierre)}`
    : null;

  if (estadoManual === "abierto") {
    return { abierto: true, mensajeHora: "Abierto", horarioHoy: textoHorarioHoy };
  }
  if (estadoManual === "cerrado") {
    return { abierto: false, mensajeHora: "Cerrado temporalmente", horarioHoy: textoHorarioHoy };
  }
  if (estadoManual === "mantenimiento") {
    return { abierto: false, mensajeHora: "En mantenimiento", horarioHoy: textoHorarioHoy };
  }

  if (!horarioHoy) {
    return { abierto: false, mensajeHora: "Cerrado hoy", horarioHoy: null };
  }

  const [horaA, minA] = horarioHoy.hora_apertura.split(":").map(Number);
  const [horaC, minC] = horarioHoy.hora_cierre.split(":").map(Number);
  const apertura = horaA * 60 + minA;
  const cierre = horaC * 60 + minC;

  const abierto = minutosActuales >= apertura && minutosActuales < cierre;

  return {
    abierto,
    mensajeHora: abierto
      ? `Cierra a las ${formatearHora(horarioHoy.hora_cierre)}`
      : `Abre a las ${formatearHora(horarioHoy.hora_apertura)}`,
    horarioHoy: textoHorarioHoy,
  };
}
