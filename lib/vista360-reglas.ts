/* ---------------------------------------------------------------------------
 * Reglas de la vista 360 sin dependencias (se prueban con npm test)
 * ------------------------------------------------------------------------- */

export type TipoVista360 = "esfera" | "panoramica" | "collage";

export const TIPOS_VISTA_360: TipoVista360[] = ["esfera", "panoramica", "collage"];

export const MIN_FOTOS_COLLAGE = 6;
export const MAX_FOTOS_COLLAGE = 24;

// Ancho máximo al comprimir antes de subir
export const ANCHO_MAXIMO_360 = 4096;
export const ANCHO_MAXIMO_COLLAGE = 1600;

// Alto visible (en grados) que se supone para una panorámica del celular
export const VAOV_PANORAMICA = 60;

// Margen aceptado alrededor de la proporción 2:1 de una foto equirectangular
const TOLERANCIA_ESFERA = 0.08;

export function anchoMaximoDe(tipo: TipoVista360) {
  return tipo === "collage" ? ANCHO_MAXIMO_COLLAGE : ANCHO_MAXIMO_360;
}

export function esUnaSolaFoto(tipo: TipoVista360) {
  return tipo !== "collage";
}

// Mensaje de error si la cantidad de fotos no sirve para el tipo; si sirve, null
export function validarCantidadFotos(tipo: TipoVista360, cantidad: number): string | null {
  if (esUnaSolaFoto(tipo)) {
    if (cantidad === 0) return "Elige una foto.";
    if (cantidad > 1) return "Este tipo usa una sola foto: quita las demás.";
    return null;
  }
  if (cantidad < MIN_FOTOS_COLLAGE) {
    return `El collage necesita al menos ${MIN_FOTOS_COLLAGE} fotos (tienes ${cantidad}).`;
  }
  if (cantidad > MAX_FOTOS_COLLAGE) {
    return `El collage admite como máximo ${MAX_FOTOS_COLLAGE} fotos (tienes ${cantidad}).`;
  }
  return null;
}

// ¿La foto tiene aproximadamente proporción 2:1 (equirectangular)?
export function esProporcionEsfera(ancho: number, alto: number) {
  if (!ancho || !alto) return true; // sin medidas no se avisa
  return Math.abs(ancho / alto - 2) <= 2 * TOLERANCIA_ESFERA;
}

// Campo de visión de una panorámica según su proporción: el alto se supone
// fijo y el ancho crece con la proporción hasta 360°. Si llega a 360°, el alto
// se recalcula para no estirar la foto.
export function campoPanoramica(ancho: number, alto: number) {
  const proporcion = ancho > 0 && alto > 0 ? ancho / alto : 4;
  const haov = Math.min(360, proporcion * VAOV_PANORAMICA);
  const vaov = haov >= 360 ? 360 / proporcion : VAOV_PANORAMICA;
  return { haov, vaov };
}

// "360/<hitoId>/<orden>-<timestamp>.jpg"
export function rutaVista360(hitoId: string, orden: number, marcaTiempo: number) {
  return `360/${hitoId}/${orden}-${marcaTiempo}.jpg`;
}

// Mueve un elemento de una lista a otra posición (sin modificar la original)
export function mover<T>(lista: T[], desde: number, hasta: number): T[] {
  if (desde === hasta || hasta < 0 || hasta >= lista.length) return lista;
  const copia = [...lista];
  const [elemento] = copia.splice(desde, 1);
  copia.splice(hasta, 0, elemento);
  return copia;
}

// Rutas de Storage que dejaron de usarse tras guardar
export function rutasSinUso(anteriores: string[], actuales: string[]) {
  const enUso = new Set(actuales);
  return anteriores.filter((ruta) => !enUso.has(ruta));
}
