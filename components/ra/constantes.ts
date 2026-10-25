// Ajustes de la cámara RA

// Campo de visión horizontal aproximado de la cámara trasera (grados).
// Las etiquetas fuera de ±FOV/2 salen de la pantalla.
export const FOV_HORIZONTAL = 62;

// A menos de estos grados del centro la etiqueta se considera "bien centrada"
export const UMBRAL_CENTRADO = 6;

// Tiempo que una etiqueta debe estar bien centrada para abrir su tarjeta sola
export const ESPERA_AUTO_TARJETA_MS = 1500;

// Etiquetas que se muestran a la vez (las más cercanas)
export const MAX_ETIQUETAS = 6;

// Modo prueba: la ubicación simulada queda a esta distancia al sur del hito
export const DISTANCIA_PRUEBA_M = 40;

// Pulsación larga sobre la brújula para activar el modo prueba fuera de __DEV__
export const PULSACION_MODO_PRUEBA_MS = 3000;
