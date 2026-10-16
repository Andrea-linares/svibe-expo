import { useTema } from "@/contexts/ThemeContext";
import { obtenerResenasRecientes, ResenaReciente } from "@/lib/foro";
import { fechaForo } from "@/lib/foro-datos";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/* ---------------------------------------------------------------------------
 * Foro (menú de Inicio)
 * Últimas reseñas de todos los lugares. Al tocar una se abre el detalle del
 * hito, donde se puede comentar o escribir otra reseña. Visible para invitados.
 * ------------------------------------------------------------------------- */

function pluralizar(cantidad: number, singular: string, plural: string) {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

export default function ForoScreen() {
  const { colores } = useTema();
  const [resenas, setResenas] = useState<ResenaReciente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setResenas(await obtenerResenasRecientes());
    } catch (e: any) {
      console.error("Error cargando el foro:", e);
      setError("No se pudo cargar el foro.");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  // Al volver de un hito se ven los comentarios o reseñas nuevos
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <TouchableOpacity style={styles.botonAtras} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={colores.texto} />
      </TouchableOpacity>

      <Text style={[styles.titulo, { color: colores.texto }]}>Foro</Text>
      <Text style={[styles.subtitulo, { color: colores.textoSecundario }]}>
        Experiencias recientes de otros viajeros
      </Text>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={colores.acento} />
        </View>
      ) : error ? (
        <View style={styles.centrado}>
          <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setCargando(true);
              cargar();
            }}
          >
            <Text style={[styles.reintentar, { color: colores.acento }]}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={resenas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true);
                cargar();
              }}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tarjeta, { backgroundColor: colores.tarjeta }]}
              onPress={() => router.push(`/hito/${item.hito_id}`)}
              accessibilityHint="Abre el lugar para leer y comentar"
            >
              <Text style={[styles.lugar, { color: colores.acento }]} numberOfLines={1}>
                📍 {item.hito_nombre}
              </Text>
              <View style={styles.filaAutor}>
                <Text style={[styles.autor, { color: colores.texto }]} numberOfLines={1}>
                  {item.autor}
                  {item.es_mia ? " (tú)" : ""}
                </Text>
                <Text style={[styles.fecha, { color: colores.textoSecundario }]}>
                  {fechaForo(item.creado_en, item.editado_en)}
                </Text>
              </View>
              <Text style={[styles.contenido, { color: colores.texto }]} numberOfLines={4}>
                {item.contenido}
              </Text>
              <View style={styles.filaComentarios}>
                <Ionicons name="chatbubble-outline" size={14} color={colores.textoSecundario} />
                <Text style={[styles.comentarios, { color: colores.textoSecundario }]}>
                  {item.total_comentarios > 0
                    ? pluralizar(item.total_comentarios, "comentario", "comentarios")
                    : "Sé el primero en comentar"}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={[styles.textoVacio, { color: colores.textoSecundario, marginTop: 40 }]}>
              Todavía no hay reseñas en el foro.{"\n"}Abre cualquier lugar y comparte tu experiencia.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  botonAtras: { marginTop: 55, marginLeft: 16, marginBottom: 4 },
  titulo: { fontSize: 22, fontWeight: "bold", marginHorizontal: 16 },
  subtitulo: { fontSize: 14, marginHorizontal: 16, marginTop: 4, marginBottom: 14 },
  tarjeta: { borderRadius: 14, padding: 14, marginBottom: 12, elevation: 2 },
  lugar: { fontSize: 13, fontWeight: "600" },
  filaAutor: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  autor: { fontSize: 14, fontWeight: "bold", flexShrink: 1, marginRight: "auto" },
  fecha: { fontSize: 11 },
  contenido: { fontSize: 14, marginTop: 4, lineHeight: 19 },
  filaComentarios: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  comentarios: { fontSize: 12 },
  textoVacio: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  reintentar: { fontWeight: "600", marginTop: 12 },
});
