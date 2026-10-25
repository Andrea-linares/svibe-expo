import ArCamera from "@/components/ra/ArCamera";
import PantallaPermisos from "@/components/ra/PantallaPermisos";
import { useTema } from "@/contexts/ThemeContext";
import { useArPermisos } from "@/hooks/use-ar-permisos";
import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native";

// Pestaña "RA": permisos y cámara de realidad aumentada.
// Los sensores y la cámara se pausan fuera de esta pestaña o con la app en segundo plano.
export default function RAScreen() {
  const { colores } = useTema();
  const permisos = useArPermisos();
  const enfocada = useIsFocused();
  const [primerPlano, setPrimerPlano] = useState(AppState.currentState === "active");

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setPrimerPlano(s === "active"));
    return () => sub.remove();
  }, []);

  if (permisos.estado === "verificando") {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.acentoRA} />
      </View>
    );
  }

  if (permisos.estado === "negados") {
    return <PantallaPermisos camara={permisos.camara} ubicacion={permisos.ubicacion} />;
  }

  return <ArCamera activo={enfocada && primerPlano} />;
}

const styles = StyleSheet.create({
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
});
