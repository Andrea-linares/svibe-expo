import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Hito = {
  id: string;
  nombre: string;
  direccion_referencia: string | null;
};

export default function OcultoScreen() {
  const [lugares, setLugares] = useState<Hito[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarOcultos() {
      const { data } = await supabase
        .from("hitos")
        .select("id, nombre, direccion_referencia")
        .eq("es_lugar_oculto", true) // <-- la única diferencia con home.tsx
        .order("nombre", { ascending: true });

      setLugares(data ?? []);
      setCargando(false);
    }
    cargarOcultos();
  }, []);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.contenedor}>
      <Text style={styles.tituloSeccion}>Lugares ocultos</Text>
      <Text style={styles.subtitulo}>
        Destinos poco conocidos para explorar
      </Text>

      <View style={styles.grid}>
        {lugares.map((hito) => (
          <TouchableOpacity
            key={hito.id}
            style={styles.cardGrid}
            onPress={() => router.push(`/hito/${hito.id}`)}
          >
            <Image
              source={require("@/assets/images/partial-react-logo.png")}
              style={styles.imagenGrid}
            />
            <Text style={styles.nombreGrid} numberOfLines={2}>
              {hito.nombre}
            </Text>
            {hito.direccion_referencia && (
              <Text style={styles.ubicacionGrid} numberOfLines={1}>
                📍 {hito.direccion_referencia}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#F5F5F5" },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  tituloSeccion: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 55,
    marginHorizontal: 16,
  },
  subtitulo: {
    fontSize: 14,
    color: "#666",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  cardGrid: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 3,
  },
  imagenGrid: { width: "100%", height: 90 },
  nombreGrid: { paddingHorizontal: 8, paddingTop: 8, fontWeight: "600" },
  ubicacionGrid: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    fontSize: 12,
    color: "#666",
  },
});
