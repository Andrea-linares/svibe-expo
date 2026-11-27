import { useTema } from "@/contexts/ThemeContext";
import { useMargenSuperior } from "@/hooks/use-margen-superior";
import { obtenerResenasRecientes, ResenaReciente } from "@/lib/foro";
import { fechaForo, filtrarPorLugar } from "@/lib/foro-datos";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/* ---------------------------------------------------------------------------
 * Foro (pestaña de la barra inferior)
 * Últimas reseñas de todos los lugares. Al tocar una se abre el detalle del
 * hito, donde se puede comentar o escribir otra reseña. Visible para invitados.
 * ------------------------------------------------------------------------- */

function pluralizar(cantidad: number, singular: string, plural: string) {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

export default function ForoScreen() {
  const { colores } = useTema();
  const margenSuperior = useMargenSuperior(55);
  const [resenas, setResenas] = useState<ResenaReciente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Filtro por lugar: texto de la barra y, si se tocó un nombre, el hito exacto
  const [busqueda, setBusqueda] = useState("");
  const [hitoFiltro, setHitoFiltro] = useState<string | null>(null);

  const resenasFiltradas = filtrarPorLugar(resenas, busqueda, hitoFiltro);
  const hayFiltro = busqueda.trim().length > 0 || hitoFiltro !== null;

  // Escribir en la barra vuelve a buscar por texto (deja de fijar el hito)
  function cambiarBusqueda(texto: string) {
    setBusqueda(texto);
    setHitoFiltro(null);
  }

  function filtrarPorHito(hitoId: string, nombre: string) {
    setBusqueda(nombre);
    setHitoFiltro(hitoId);
  }

  function limpiarFiltro() {
    setBusqueda("");
    setHitoFiltro(null);
  }

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
      {/* Es una pestaña: sin flecha de atrás, como Mapa y Oculto */}
      <Text style={[styles.titulo, { color: colores.texto, marginTop: margenSuperior }]}>
        Foro
      </Text>
      <Text style={[styles.subtitulo, { color: colores.textoSecundario }]}>
        Experiencias recientes de otros viajeros
      </Text>

      {/* Filtro por lugar (mismo estilo que la búsqueda de Inicio) */}
      <View style={[styles.barraBusqueda, { backgroundColor: colores.tarjeta }]}>
        <Ionicons name="search" size={18} color={colores.textoSecundario} />
        <TextInput
          style={[styles.inputBusqueda, { color: colores.texto }]}
          placeholder="Buscar por lugar..."
          placeholderTextColor={colores.textoSecundario}
          value={busqueda}
          onChangeText={cambiarBusqueda}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Buscar reseñas por lugar"
        />
        {hayFiltro && (
          <TouchableOpacity
            onPress={limpiarFiltro}
            hitSlop={10}
            accessibilityLabel="Limpiar búsqueda"
          >
            <Ionicons name="close-circle" size={18} color={colores.textoSecundario} />
          </TouchableOpacity>
        )}
      </View>

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
          data={resenasFiltradas}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
              {/* Tocar el nombre filtra por ese lugar; el resto abre el hito */}
              <TouchableOpacity
                style={styles.botonLugar}
                onPress={() => filtrarPorHito(item.hito_id, item.hito_nombre)}
                hitSlop={{ top: 6, bottom: 6 }}
                accessibilityLabel={`Ver solo reseñas de ${item.hito_nombre}`}
              >
                <Text style={[styles.lugar, { color: colores.acento }]} numberOfLines={1}>
                  📍 {item.hito_nombre}
                </Text>
              </TouchableOpacity>
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
            hayFiltro && resenas.length > 0 ? (
              <View style={{ marginTop: 40, alignItems: "center" }}>
                <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>
                  No hay reseñas de ese lugar todavía.
                </Text>
                <TouchableOpacity onPress={limpiarFiltro}>
                  <Text style={[styles.reintentar, { color: colores.acento }]}>Ver todas</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.textoVacio, { color: colores.textoSecundario, marginTop: 40 }]}>
                Todavía no hay reseñas en el foro.{"\n"}Abre cualquier lugar y comparte tu experiencia.
              </Text>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  titulo: { fontSize: 22, fontWeight: "bold", marginHorizontal: 16 },
  subtitulo: { fontSize: 14, marginHorizontal: 16, marginTop: 4, marginBottom: 14 },
  tarjeta: { borderRadius: 14, padding: 14, marginBottom: 12, elevation: 2 },
  lugar: { fontSize: 13, fontWeight: "600" },
  botonLugar: { alignSelf: "flex-start", maxWidth: "100%" },
  barraBusqueda: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
  },
  inputBusqueda: { flex: 1, height: 40, fontSize: 14, paddingVertical: 0 },
  filaAutor: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  autor: { fontSize: 14, fontWeight: "bold", flexShrink: 1, marginRight: "auto" },
  fecha: { fontSize: 11 },
  contenido: { fontSize: 14, marginTop: 4, lineHeight: 19 },
  filaComentarios: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  comentarios: { fontSize: 12 },
  textoVacio: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  reintentar: { fontWeight: "600", marginTop: 12 },
});
