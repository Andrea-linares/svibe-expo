import AccesoRestringido from "@/components/admin/acceso-restringido";
import AdminHeader from "@/components/admin/admin-header";
import { COLOR_ACENTO } from "@/constants/theme";
import { useTema } from "@/contexts/ThemeContext";
import { useEsAdmin } from "@/hooks/use-es-admin";
import { eliminarEvento, Evento, imagenDeEvento, obtenerEventosAdmin } from "@/lib/eventos";
import { formatearFechaCorta, formatearHora, hoyLocal } from "@/lib/fechas";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/* ---------------------------------------------------------------------------
 * Panel de eventos (admin)
 * - Todos: todos los eventos (incluidos pasados y borradores).
 * - Activos: publicados con fecha de hoy o futura.
 * - Borradores: no publicados (cualquier fecha).
 * ------------------------------------------------------------------------- */

type Filtro = "todos" | "activos" | "borradores";

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "activos", etiqueta: "Activos" },
  { valor: "borradores", etiqueta: "Borradores" },
];

type Estado = "publicado" | "borrador" | "finalizado";

const ESTILO_ESTADO: Record<Estado, { etiqueta: string; color: string; fondo: string }> = {
  publicado: { etiqueta: "Publicado", color: "#2E9E5B", fondo: "#E3F5E9" },
  borrador: { etiqueta: "Borrador", color: "#B8860B", fondo: "#FBF2DD" },
  finalizado: { etiqueta: "Finalizado", color: "#6B6B6B", fondo: "#EEEEEE" },
};

function estadoDe(evento: Evento, hoy: string): Estado {
  if (!evento.publicado) return "borrador";
  return evento.fecha < hoy ? "finalizado" : "publicado";
}

export default function AdminEventosScreen() {
  const estadoAdmin = useEsAdmin();
  const { colores } = useTema();

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setEventos(await obtenerEventosAdmin());
    } catch (e: any) {
      console.error("Error cargando eventos (admin):", e);
      setError(e?.message ?? "Inténtalo de nuevo.");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (estadoAdmin === "admin") cargar();
    }, [cargar, estadoAdmin]),
  );

  const hoy = hoyLocal();

  // Primero los vigentes (del más cercano al más lejano), luego los pasados (del más reciente)
  const eventosFiltrados = useMemo(() => {
    let lista = eventos;
    if (filtro === "activos") lista = lista.filter((e) => e.publicado && e.fecha >= hoy);
    if (filtro === "borradores") lista = lista.filter((e) => !e.publicado);
    const vigentes = lista.filter((e) => e.fecha >= hoy);
    const pasados = lista.filter((e) => e.fecha < hoy).reverse();
    return [...vigentes, ...pasados];
  }, [eventos, filtro, hoy]);

  function confirmarEliminar(evento: Evento) {
    Alert.alert(
      "Eliminar evento",
      `¿Seguro que quieres eliminar "${evento.titulo}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await eliminarEvento(evento.id);
              setEventos((actual) => actual.filter((e) => e.id !== evento.id));
            } catch (e: any) {
              Alert.alert("No se pudo eliminar", e?.message ?? "Inténtalo de nuevo.");
            }
          },
        },
      ],
    );
  }

  if (estadoAdmin !== "admin") {
    return <AccesoRestringido verificando={estadoAdmin === "cargando"} />;
  }

  const botonNuevo = (
    <TouchableOpacity
      style={styles.botonNuevo}
      onPress={() => router.push("/admin/evento-formulario")}
    >
      <Ionicons name="add" size={18} color="#fff" />
      <Text style={styles.textoBotonNuevo}>Nuevo evento</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <AdminHeader titulo="Eventos" accion={botonNuevo} />

      {/* Pestañas de filtro */}
      <View style={styles.pestañas}>
        {FILTROS.map((opcion) => (
          <TouchableOpacity
            key={opcion.valor}
            style={[styles.pestaña, filtro === opcion.valor && styles.pestañaActiva]}
            onPress={() => setFiltro(opcion.valor)}
          >
            <Text style={filtro === opcion.valor ? styles.textoPestañaActiva : styles.textoPestaña}>
              {opcion.etiqueta}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={COLOR_ACENTO} />
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
            <Text style={styles.reintentar}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={eventosFiltrados}
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
          renderItem={({ item }) => {
            const estado = ESTILO_ESTADO[estadoDe(item, hoy)];
            return (
              <TouchableOpacity
                style={[styles.fila, { backgroundColor: colores.tarjeta }]}
                onPress={() => router.push(`/admin/evento-formulario?id=${item.id}`)}
              >
                <Image source={imagenDeEvento(item)} style={styles.imagen} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nombre, { color: colores.texto }]} numberOfLines={1}>
                    {item.titulo}
                  </Text>
                  <Text
                    style={[styles.secundario, { color: colores.textoSecundario }]}
                    numberOfLines={1}
                  >
                    {item.hito?.nombre ?? "Sin hito relacionado"}
                  </Text>
                  <Text style={[styles.secundario, { color: colores.textoSecundario }]}>
                    {formatearFechaCorta(item.fecha)}
                    {item.hora ? ` · ${formatearHora(item.hora)}` : ""}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: estado.fondo }]}>
                    <Text style={[styles.textoBadge, { color: estado.color }]}>{estado.etiqueta}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.botonAccion}
                  onPress={() => router.push(`/admin/evento-formulario?id=${item.id}`)}
                  accessibilityLabel="Editar evento"
                >
                  <Ionicons name="pencil-outline" size={19} color={colores.textoSecundario} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.botonAccion}
                  onPress={() => confirmarEliminar(item)}
                  accessibilityLabel="Eliminar evento"
                >
                  <Ionicons name="trash-outline" size={19} color="#D32F2F" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={[styles.textoVacio, { color: colores.textoSecundario, marginTop: 40 }]}>
              {filtro === "borradores"
                ? "No hay borradores."
                : filtro === "activos"
                  ? "No hay eventos activos."
                  : "Todavía no hay eventos. Crea el primero con \"Nuevo evento\"."}
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
  botonNuevo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLOR_ACENTO,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  textoBotonNuevo: { color: "#fff", fontWeight: "600", fontSize: 13 },
  pestañas: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  pestaña: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  pestañaActiva: { backgroundColor: COLOR_ACENTO },
  textoPestaña: { color: "#555", fontSize: 13, fontWeight: "600" },
  textoPestañaActiva: { color: "#fff", fontSize: 13, fontWeight: "600" },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    gap: 10,
    elevation: 2,
  },
  imagen: { width: 60, height: 60, borderRadius: 10 },
  nombre: { fontSize: 15, fontWeight: "600" },
  secundario: { fontSize: 12, marginTop: 2 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 5,
  },
  textoBadge: { fontSize: 11, fontWeight: "600" },
  botonAccion: { padding: 6 },
  textoVacio: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  reintentar: { color: COLOR_ACENTO, fontWeight: "600", marginTop: 12 },
});
