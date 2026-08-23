import { useTema } from "@/contexts/ThemeContext";
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
  hito_imagenes: { url: string; orden: number }[];
};

export default function OcultoScreen() {
  const { colores } = useTema();
  const [lugares, setLugares] = useState<Hito[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarOcultos() {
      const { data } = await supabase
        .from("hitos")
        .select("id, nombre, direccion_referencia, hito_imagenes(url, orden)")
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
    <ScrollView style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <Text style={[styles.tituloSeccion, { color: colores.texto }]}>
        Lugares ocultos
      </Text>
      <Text style={[styles.subtitulo, { color: colores.textoSecundario }]}>
        Destinos poco conocidos para explorar
      </Text>

      <View style={styles.grid}>
        {lugares.map((hito) => (
          <TouchableOpacity
            key={hito.id}
            style={[styles.cardGrid, { backgroundColor: colores.tarjeta }]}
            onPress={() => router.push(`/hito/${hito.id}`)}
          >
            <Image
              source={obtenerImagenPrincipal(hito)}
              style={styles.imagenGrid}
            />
            <Text
              style={[styles.nombreGrid, { color: colores.texto }]}
              numberOfLines={2}
            >
              {hito.nombre}
            </Text>
            {hito.direccion_referencia && (
              <Text
                style={[
                  styles.ubicacionGrid,
                  { color: colores.textoSecundario },
                ]}
                numberOfLines={1}
              >
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

function obtenerImagenPrincipal(hito: Hito) {
  if (hito.hito_imagenes && hito.hito_imagenes.length > 0) {
    const ordenadas = [...hito.hito_imagenes].sort((a, b) => a.orden - b.orden);
    return { uri: ordenadas[0].url };
  }
  return require("@/assets/images/partial-react-logo.png");
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  tituloSeccion: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 55,
    marginHorizontal: 16,
  },
  subtitulo: {
    fontSize: 14,
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
  },
});
