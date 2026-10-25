import { Camera } from "expo-camera";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/* ---------------------------------------------------------------------------
 * Permisos de cámara y ubicación para la RA
 * La primera vez se piden con el diálogo del sistema. Si el usuario los niega
 * (o ya estaban bloqueados) el estado queda en "negados" y la pantalla muestra
 * "Permisos necesarios". Al volver de Ajustes se revisan de nuevo.
 * ------------------------------------------------------------------------- */

export type EstadoPermisos = "verificando" | "concedidos" | "negados";

type Permiso = { granted: boolean; status: string; canAskAgain: boolean };

// Pide el permiso solo si nunca se ha preguntado
async function revisar(
  obtener: () => Promise<Permiso>,
  pedir: () => Promise<Permiso>,
  preguntar: boolean,
) {
  const actual = await obtener();
  if (actual.granted) return true;
  if (preguntar && actual.status === "undetermined" && actual.canAskAgain) {
    return (await pedir()).granted;
  }
  return false;
}

export function useArPermisos() {
  const [estado, setEstado] = useState<EstadoPermisos>("verificando");
  const [camara, setCamara] = useState(false);
  const [ubicacion, setUbicacion] = useState(false);

  // Cerrar un diálogo del sistema también dispara "active": no se revisa
  // mientras se están pidiendo los permisos
  const preguntando = useRef(false);

  const verificar = useCallback(async (preguntar: boolean) => {
    if (preguntando.current) return;
    preguntando.current = preguntar;
    try {
      // Uno después del otro: iOS no muestra dos diálogos a la vez
      const okCamara = await revisar(
        Camera.getCameraPermissionsAsync,
        Camera.requestCameraPermissionsAsync,
        preguntar,
      );
      const okUbicacion = await revisar(
        Location.getForegroundPermissionsAsync,
        Location.requestForegroundPermissionsAsync,
        preguntar,
      );
      setCamara(okCamara);
      setUbicacion(okUbicacion);
      setEstado(okCamara && okUbicacion ? "concedidos" : "negados");
    } catch (e) {
      console.error("Error revisando permisos de RA:", e);
      setEstado("negados");
    } finally {
      preguntando.current = false;
    }
  }, []);

  useEffect(() => {
    verificar(true);
    // Al volver de Ajustes (la app pasa a primer plano) se revisa otra vez
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") verificar(false);
    });
    return () => sub.remove();
  }, [verificar]);

  return { estado, camara, ubicacion };
}
