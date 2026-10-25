import { diferenciaAngular, normalizarAngulo, puntoCardinal, rumboCamara, suavizarAngulo, Vector3 } from "@/lib/geo";
import * as Location from "expo-location";
import { Accelerometer, Magnetometer } from "expo-sensors";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { SharedValue, useSharedValue } from "react-native-reanimated";

/* ---------------------------------------------------------------------------
 * Brújula de la cámara RA
 * - iOS: heading de expo-location (CLHeading). Ya compensa la inclinación,
 *   da el norte verdadero y su nivel de calibración.
 * - Android: el heading de expo-location usa el borde superior del teléfono y
 *   se vuelve inestable con el teléfono vertical; por eso se combinan
 *   magnetómetro y acelerómetro (expo-sensors) para obtener hacia dónde apunta
 *   la cámara trasera (rumboCamara en lib/geo.ts).
 * El rumbo vive en un SharedValue (hilo de UI): las etiquetas se mueven sin
 * re-renderizar React. Al estado solo llega el texto "NE 45°", ~4 veces/seg.
 * ------------------------------------------------------------------------- */

export const FUENTE_BRUJULA: "ubicacion" | "sensores" =
  Platform.OS === "ios" ? "ubicacion" : "sensores";

const INTERVALO_MS = 66; // ~15 lecturas por segundo como máximo
const FACTOR_SUAVIZADO = 0.25; // 0..1: más bajo = más suave pero más lento
const UMBRAL_GRADOS = 1.5; // cambios menores no mueven nada (evita temblor)
const INTERVALO_TEXTO_MS = 250;
const ESPERA_CALIBRAR_MS = 2000;
// Campo magnético terrestre normal: ~25-65 µT. Fuera de eso hay interferencia.
const CAMPO_MIN_UT = 20;
const CAMPO_MAX_UT = 75;

export type Brujula = {
  heading: SharedValue<number>;
  texto: string;
  calibrar: boolean;
  manual: boolean;
  // Modo prueba: fija el rumbo a mano (null = volver al sensor)
  setManual: (grados: number | null) => void;
  girar: (delta: number) => void;
};

export function useHeading(activo: boolean): Brujula {
  const heading = useSharedValue(0);
  const [texto, setTexto] = useState("N 0°");
  const [calibrar, setCalibrar] = useState(false);
  const [manual, setManualEstado] = useState(false);

  const suavizado = useRef<number | null>(null);
  const ultimaLectura = useRef(0);
  const bajaDesde = useRef<number | null>(null);

  // Filtro: limita frecuencia, suaviza en círculo y aplica el umbral
  const aplicar = useCallback(
    (nuevo: number) => {
      const ahora = Date.now();
      if (ahora - ultimaLectura.current < INTERVALO_MS) return;
      ultimaLectura.current = ahora;

      const s =
        suavizado.current === null
          ? normalizarAngulo(nuevo)
          : suavizarAngulo(suavizado.current, nuevo, FACTOR_SUAVIZADO);
      suavizado.current = s;
      if (Math.abs(diferenciaAngular(heading.value, s)) >= UMBRAL_GRADOS) {
        heading.value = s;
      }
    },
    [heading],
  );

  // Pide calibrar solo si la precisión es mala durante un rato
  const reportarPrecision = useCallback((buena: boolean) => {
    if (buena) {
      bajaDesde.current = null;
      setCalibrar(false);
      return;
    }
    const ahora = Date.now();
    if (bajaDesde.current === null) bajaDesde.current = ahora;
    else if (ahora - bajaDesde.current > ESPERA_CALIBRAR_MS) setCalibrar(true);
  }, []);

  // Sensores: solo con la pantalla activa y sin rumbo manual
  useEffect(() => {
    if (!activo || manual) return;
    let cancelado = false;
    suavizado.current = null;

    if (FUENTE_BRUJULA === "ubicacion") {
      let suscripcion: Location.LocationSubscription | null = null;
      Location.watchHeadingAsync((h) => {
        aplicar(h.trueHeading >= 0 ? h.trueHeading : h.magHeading);
        reportarPrecision(h.accuracy >= 2);
      })
        .then((s) => {
          if (cancelado) s.remove();
          else suscripcion = s;
        })
        .catch((e) => console.error("No se pudo leer la brújula:", e));
      return () => {
        cancelado = true;
        suscripcion?.remove();
      };
    }

    // Android: gravedad filtrada (paso bajo) + campo magnético
    let gravedad: Vector3 | null = null;
    Accelerometer.setUpdateInterval(INTERVALO_MS);
    Magnetometer.setUpdateInterval(INTERVALO_MS);
    const subAcel = Accelerometer.addListener((a) => {
      gravedad = gravedad
        ? {
            x: gravedad.x * 0.8 + a.x * 0.2,
            y: gravedad.y * 0.8 + a.y * 0.2,
            z: gravedad.z * 0.8 + a.z * 0.2,
          }
        : a;
    });
    const subMag = Magnetometer.addListener((m) => {
      if (!gravedad) return;
      const rumbo = rumboCamara(gravedad, m);
      if (rumbo !== null) aplicar(rumbo);
      const intensidad = Math.hypot(m.x, m.y, m.z);
      reportarPrecision(intensidad >= CAMPO_MIN_UT && intensidad <= CAMPO_MAX_UT);
    });
    return () => {
      subAcel.remove();
      subMag.remove();
    };
  }, [activo, manual, aplicar, reportarPrecision]);

  // Texto de la brújula a frecuencia baja (React descarta valores iguales)
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => setTexto(puntoCardinal(heading.value)), INTERVALO_TEXTO_MS);
    return () => clearInterval(id);
  }, [activo, heading]);

  const setManual = useCallback(
    (grados: number | null) => {
      if (grados === null) {
        setManualEstado(false);
        return;
      }
      setManualEstado(true);
      setCalibrar(false);
      heading.value = normalizarAngulo(grados);
    },
    [heading],
  );

  const girar = useCallback(
    (delta: number) => {
      heading.value = normalizarAngulo(heading.value + delta);
    },
    [heading],
  );

  return { heading, texto, calibrar, manual, setManual, girar };
}
