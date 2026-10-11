/* ---------------------------------------------------------------------------
 * Utilidades de fechas y horas
 * Las fechas de la base de datos (columnas `date`) llegan como "YYYY-MM-DD".
 * Siempre se interpretan como fecha LOCAL del dispositivo: nunca con
 * new Date("YYYY-MM-DD") ni toISOString(), que usan UTC y en El Salvador
 * (UTC-6) desplazarían la fecha un día.
 * ------------------------------------------------------------------------- */

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const MESES_CORTOS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Encabezado del calendario: la semana empieza el lunes
export const DIAS_SEMANA_CORTOS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function dosDigitos(n: number) {
  return n.toString().padStart(2, "0");
}

// Date → "YYYY-MM-DD" usando la fecha local
export function aFechaISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
}

// Fecha de hoy en el dispositivo, como "YYYY-MM-DD"
export function hoyLocal(): string {
  return aFechaISO(new Date());
}

// "YYYY-MM-DD" → Date local (medianoche)
export function desdeFechaISO(iso: string): Date {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

// "2026-09-18" → { dia: 18, mesCorto: "SEP" }
export function partesFecha(iso: string) {
  const fecha = desdeFechaISO(iso);
  return { dia: fecha.getDate(), mesCorto: MESES_CORTOS[fecha.getMonth()] };
}

// "2026-09-18" → "Viernes, 18 de septiembre de 2026"
export function formatearFechaLarga(iso: string) {
  const fecha = desdeFechaISO(iso);
  const texto = `${DIAS[fecha.getDay()]}, ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "2026-09-18" → "18 de septiembre"
export function formatearDiaMes(iso: string) {
  const fecha = desdeFechaISO(iso);
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

// "2026-09-18" → "18/09/2026"
export function formatearFechaCorta(iso: string) {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

// (8, 2026) → "Septiembre 2026"  (mes base 0)
export function nombreMes(mes: number, anio: number) {
  const nombre = MESES[mes];
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

// "18:00:00" o "18:00" → "6:00 PM"
export function formatearHora(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  const periodo = h >= 12 ? "PM" : "AM";
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${m.toString().padStart(2, "0")} ${periodo}`;
}

// Horario de un evento: "6:00 PM - 9:00 PM", "6:00 PM" o null si no tiene hora
export function formatearHorario(hora: string | null, horaFin: string | null) {
  if (!hora) return null;
  return horaFin
    ? `${formatearHora(hora)} - ${formatearHora(horaFin)}`
    : formatearHora(hora);
}

// Valida una hora escrita a mano ("8:30", "18:00") y la normaliza a "HH:MM".
// Devuelve null si no es válida.
export function normalizarHora(texto: string): string | null {
  const coincidencia = texto.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!coincidencia) return null;
  const h = Number(coincidencia[1]);
  const m = Number(coincidencia[2]);
  if (h > 23 || m > 59) return null;
  return `${dosDigitos(h)}:${dosDigitos(m)}`;
}
