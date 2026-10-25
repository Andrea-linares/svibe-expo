import { Coordenada } from "@/lib/geo";
import * as Location from "expo-location";
import { useEffect, useState } from "react";

/* ---------------------------------------------------------------------------
 * Ubicación del usuario para la RA
 * Solo escucha el GPS mientras "activo" (pantalla enfocada y app en primer
 * plano). Con "simulada" (modo prueba) no usa el GPS.
 * ------------------------------------------------------------------------- */

// Precisión peor que esto (en metros) muestra "señal GPS débil"
export const PRECISION_DEBIL_M = 30;

export type UbicacionUsuario = Coordenada & { precision: number | null };

export function useUserLocation(activo: boolean, simulada: Coordenada | null) {
  const [ubicacion, setUbicacion] = useState<UbicacionUsuario | null>(null);

  useEffect(() => {
    if (simulada || !activo) return;
    let cancelado = false;
    let suscripcion: Location.LocationSubscription | null = null;

    const guardar = (p: Location.LocationObject) =>
      setUbicacion({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        precision: p.coords.accuracy ?? null,
      });

    // Arranque rápido con la última posición conocida
    Location.getLastKnownPositionAsync()
      .then((p) => {
        if (p && !cancelado) guardar(p);
      })
      .catch(() => {});

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 3 },
      (p) => {
        if (!cancelado) guardar(p);
      },
    )
      .then((s) => {
        if (cancelado) s.remove();
        else suscripcion = s;
      })
      .catch((e) => console.error("No se pudo leer la ubicación:", e));

    return () => {
      cancelado = true;
      suscripcion?.remove();
    };
  }, [activo, simulada]);

  const actual: UbicacionUsuario | null = simulada
    ? { ...simulada, precision: 5 }
    : ubicacion;

  return {
    ubicacion: actual,
    gpsDebil: !!actual && actual.precision !== null && actual.precision > PRECISION_DEBIL_M,
  };
}
