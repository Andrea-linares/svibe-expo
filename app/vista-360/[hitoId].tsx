import Visor360 from "@/components/vista360/Visor360";
import { useTema } from "@/contexts/ThemeContext";
import { cargarVistaActiva, VistaPublica360 } from "@/lib/vista360-servicio";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Vista 360 de un hito a pantalla completa
export default function Vista360Screen() {
  const { hitoId } = useLocalSearchParams<{ hitoId: string }>();
  const { colores } = useTema();
  // undefined = cargando, null = el hito no tiene vista activa
  const [vista, setVista] = useState<VistaPublica360 | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!hitoId) return;
    let cancelado = false;
    cargarVistaActiva(hitoId)
      .then((resultado) => {
        if (!cancelado) setVista(resultado);
      })
      .catch((e) => {
        if (!cancelado) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelado = true;
    };
  }, [hitoId, intento]);

  function reintentar() {
    setVista(undefined);
    setError(null);
    setIntento((n) => n + 1);
  }

  const cerrar = () => router.back();

  if (vista) {
    return (
      <Visor360
        tipo={vista.tipo}
        imagenes={vista.imagenes.map((img) => img.url)}
        onCerrar={cerrar}
      />
    );
  }

  return (
    <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
      {vista === undefined && !error ? (
        <ActivityIndicator size="large" color={colores.acentoRA} />
      ) : (
        <>
          <Ionicons name="planet-outline" size={40} color={colores.textoSecundario} />
          <Text style={[styles.texto, { color: colores.texto }]}>
            {error ? "No se pudo cargar la vista 360." : "Este lugar no tiene vista 360."}
          </Text>
          {error && (
            <TouchableOpacity onPress={reintentar} style={styles.boton}>
              <Text style={{ color: colores.acentoRA, fontWeight: "700" }}>Reintentar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={cerrar} style={styles.boton}>
            <Text style={{ color: colores.textoSecundario, fontWeight: "600" }}>Volver</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 8 },
  texto: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  boton: { padding: 8 },
});
