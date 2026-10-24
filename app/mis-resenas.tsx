import FormularioResena from "@/components/FormularioResena";
import Toast from "@/components/Toast";
import { useTema } from "@/contexts/ThemeContext";
import { useMargenSuperior } from "@/hooks/use-margen-superior";
import { avisar, confirmar } from "@/lib/confirmar";
import { editarResena, eliminarResena, MiResena, obtenerMisResenas } from "@/lib/foro";
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
 * Mis reseñas (S3-11)
 * El usuario ve, edita y elimina sus propias reseñas del foro.
 * La RLS de foro_posts impide editar o eliminar reseñas de otros usuarios.
 * ------------------------------------------------------------------------- */

export default function MisResenasScreen() {
  const { colores } = useTema();
  const margenSuperior = useMargenSuperior(55);
  const [resenas, setResenas] = useState<MiResena[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<MiResena | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setResenas(await obtenerMisResenas());
    } catch (e: any) {
      console.error("Error cargando mis reseñas:", e);
      setError(e?.message ?? "Inténtalo de nuevo.");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function guardarEdicion(texto: string) {
    if (!editando) return;
    await editarResena(editando.id, texto);
    const id = editando.id;
    setResenas((actual) => actual.map((r) => (r.id === id ? { ...r, contenido: texto } : r)));
    setEditando(null);
    setToast("Tu reseña se actualizó");
  }

  function confirmarEliminar(resena: MiResena) {
    confirmar({
      titulo: "Eliminar reseña",
      mensaje: `¿Seguro que quieres eliminar tu reseña de "${resena.hito?.nombre ?? "este lugar"}"? También se eliminarán los comentarios que tenga. Esta acción no se puede deshacer.`,
      onConfirmar: async () => {
        setEliminando(resena.id);
        try {
          await eliminarResena(resena.id);
          setResenas((actual) => actual.filter((r) => r.id !== resena.id));
          setToast("Tu reseña se eliminó");
        } catch (e: any) {
          avisar("No se pudo eliminar", e?.message ?? "Inténtalo de nuevo.");
        } finally {
          setEliminando(null);
        }
      },
    });
  }

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <TouchableOpacity
        style={[styles.botonAtras, { marginTop: margenSuperior }]}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color={colores.texto} />
      </TouchableOpacity>

      <Text style={[styles.titulo, { color: colores.texto }]}>Mis reseñas</Text>

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
            <View style={[styles.tarjeta, { backgroundColor: colores.tarjeta }]}>
              <View style={styles.filaTarjeta}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  disabled={!item.hito}
                  onPress={() => item.hito && router.push(`/hito/${item.hito.id}`)}
                >
                  <Text style={[styles.lugar, { color: colores.acento }]} numberOfLines={1}>
                    📍 {item.hito?.nombre ?? "Lugar no disponible"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.botonAccion}
                  onPress={() => setEditando(item)}
                  disabled={eliminando !== null}
                  accessibilityLabel="Editar reseña"
                >
                  <Ionicons name="pencil-outline" size={19} color={colores.textoSecundario} />
                </TouchableOpacity>
                {eliminando === item.id ? (
                  <ActivityIndicator size="small" color={colores.peligro} style={styles.botonAccion} />
                ) : (
                  <TouchableOpacity
                    style={styles.botonAccion}
                    onPress={() => confirmarEliminar(item)}
                    disabled={eliminando !== null}
                    accessibilityLabel="Eliminar reseña"
                  >
                    <Ionicons name="trash-outline" size={19} color={colores.peligro} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.contenido, { color: colores.texto }]}>{item.contenido}</Text>

              <Text style={[styles.fecha, { color: colores.textoSecundario }]}>
                {fechaForo(item.creado_en)}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.textoVacio, { color: colores.textoSecundario, marginTop: 40 }]}>
              Todavía no has escrito ninguna reseña.{"\n"}Puedes hacerlo desde el detalle de
              cualquier lugar.
            </Text>
          }
        />
      )}

      {editando && (
        <FormularioResena
          titulo="Editar reseña"
          subtitulo={editando.hito?.nombre}
          textoInicial={editando.contenido}
          textoBoton="Guardar cambios"
          onGuardar={guardarEdicion}
          onCerrar={() => setEditando(null)}
        />
      )}

      <Toast
        visible={toast !== null}
        mensaje={toast ?? ""}
        icono="checkmark-circle"
        onOcultar={() => setToast(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  botonAtras: { marginTop: 55, marginLeft: 16, marginBottom: 4 },
  titulo: { fontSize: 22, fontWeight: "bold", marginHorizontal: 16, marginBottom: 14 },
  tarjeta: { borderRadius: 14, padding: 14, marginBottom: 12, elevation: 2 },
  filaTarjeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  lugar: { fontSize: 13, fontWeight: "600" },
  botonAccion: { padding: 6 },
  contenido: { fontSize: 14, marginTop: 6, lineHeight: 19 },
  fecha: { fontSize: 11, marginTop: 8 },
  textoVacio: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  reintentar: { fontWeight: "600", marginTop: 12 },
});
