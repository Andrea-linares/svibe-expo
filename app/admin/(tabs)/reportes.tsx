import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Reporte = {
  id: string;
  tipo: string | null;
  descripcion: string;
  es_anonimo: boolean;
  estado: string;
  creado_en: string;
  imagen_url: string | null;
  hitos: { nombre: string } | null;
  perfiles: { nombre: string | null } | null;
};

type Filtro = "todos" | "pendiente" | "revisando" | "resuelto";

const ETIQUETAS_TIPO: Record<string, string> = {
  sitio: "Sitio",
  app: "App",
  cuenta: "Cuenta",
  otro: "Otro",
};

export default function AdminReportesScreen() {
  const { colores } = useTema();
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  useFocusEffect(
    useCallback(() => {
      async function cargar() {
        const { data } = await supabase
          .from("reportes_problemas")
          .select(
            "id, tipo, descripcion, es_anonimo, estado, creado_en, imagen_url, hitos(nombre), perfiles(nombre)",
          )
          .order("creado_en", { ascending: false });
        setReportes((data ?? []) as unknown as Reporte[]);
        setCargando(false);
      }
      cargar();
    }, []),
  );

  const reportesFiltrados = useMemo(() => {
    if (filtro === "todos") return reportes;
    return reportes.filter((r) => r.estado === filtro);
  }, [reportes, filtro]);

  const totalPendientes = useMemo(
    () => reportes.filter((r) => r.estado === "pendiente").length,
    [reportes],
  );

  function cambiarEstado(reporte: Reporte, nuevoEstado: string) {
    Alert.alert(
      "Actualizar estado",
      `¿Marcar este reporte como "${nuevoEstado}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            const { error } = await supabase
              .from("reportes_problemas")
              .update({ estado: nuevoEstado })
              .eq("id", reporte.id);

            if (error) {
              Alert.alert("Error", error.message);
              return;
            }

            setReportes((actual) =>
              actual.map((r) =>
                r.id === reporte.id ? { ...r, estado: nuevoEstado } : r,
              ),
            );
          },
        },
      ],
    );
  }

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#3B6FA0" />
      </View>
    );
  }

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <Text style={[styles.titulo, { color: colores.texto }]}>
        Reportes de problemas
      </Text>

      <View style={styles.filaEstadisticas}>
        <View
          style={[
            styles.tarjetaEstadistica,
            { backgroundColor: colores.tarjeta },
          ]}
        >
          <Text style={styles.numeroEstadistica}>{reportes.length}</Text>
          <Text
            style={[
              styles.etiquetaEstadistica,
              { color: colores.textoSecundario },
            ]}
          >
            Total
          </Text>
        </View>
        <View
          style={[
            styles.tarjetaEstadistica,
            { backgroundColor: colores.tarjeta },
          ]}
        >
          <Text style={[styles.numeroEstadistica, { color: "#D9587A" }]}>
            {totalPendientes}
          </Text>
          <Text
            style={[
              styles.etiquetaEstadistica,
              { color: colores.textoSecundario },
            ]}
          >
            Pendientes
          </Text>
        </View>
      </View>

      <View style={styles.pestañas}>
        {(["todos", "pendiente", "revisando", "resuelto"] as Filtro[]).map(
          (opcion) => (
            <TouchableOpacity
              key={opcion}
              style={[
                styles.pestaña,
                filtro === opcion && styles.pestañaActiva,
              ]}
              onPress={() => setFiltro(opcion)}
            >
              <Text
                style={
                  filtro === opcion
                    ? styles.textoPestañaActiva
                    : styles.textoPestaña
                }
              >
                {opcion === "todos"
                  ? "Todos"
                  : opcion.charAt(0).toUpperCase() + opcion.slice(1)}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </View>

      <FlatList
        data={reportesFiltrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.tarjeta, { backgroundColor: colores.tarjeta }]}
            onPress={() => router.push(`/admin/reporte-detalle?id=${item.id}`)}
            activeOpacity={0.8}
          >
            <View style={styles.filaTarjeta}>
              <View style={styles.badgeTipo}>
                <Text style={styles.textoBadgeTipo}>
                  {ETIQUETAS_TIPO[item.tipo ?? "otro"]}
                </Text>
              </View>
              <View
                style={[
                  styles.badgeEstado,
                  {
                    backgroundColor:
                      item.estado === "pendiente"
                        ? "#FCEBEE"
                        : item.estado === "revisando"
                          ? "#FBF2DD"
                          : "#E3F5E9",
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color:
                      item.estado === "pendiente"
                        ? "#D9587A"
                        : item.estado === "revisando"
                          ? "#D9A62A"
                          : "#2E9E5B",
                  }}
                >
                  {item.estado}
                </Text>
              </View>
            </View>

            {item.hitos?.nombre && (
              <Text
                style={{
                  color: colores.textoSecundario,
                  fontSize: 12,
                  marginTop: 6,
                }}
              >
                📍 {item.hitos.nombre}
              </Text>
            )}

            <Text style={[styles.descripcion, { color: colores.texto }]}>
              {item.descripcion}
            </Text>

            {item.imagen_url && (
              <Image
                source={{ uri: item.imagen_url }}
                style={styles.imagenAdjunta}
              />
            )}

            <Text style={[styles.autor, { color: colores.textoSecundario }]}>
              {item.es_anonimo
                ? "Reporte anónimo"
                : (item.perfiles?.nombre ?? "Usuario")}
              {" · "}
              {new Date(item.creado_en).toLocaleDateString()}
            </Text>

            <View style={styles.filaBotonesEstado}>
              {item.estado !== "revisando" && (
                <TouchableOpacity
                  style={styles.botonEstado}
                  onPress={() => cambiarEstado(item, "revisando")}
                >
                  <Text style={styles.textoBotonEstado}>
                    Marcar en revisión
                  </Text>
                </TouchableOpacity>
              )}
              {item.estado !== "resuelto" && (
                <TouchableOpacity
                  style={styles.botonEstado}
                  onPress={() => cambiarEstado(item, "resuelto")}
                >
                  <Text style={styles.textoBotonEstado}>Marcar resuelto</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text
            style={{
              textAlign: "center",
              color: colores.textoSecundario,
              marginTop: 40,
            }}
          >
            No hay reportes en esta categoría.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  titulo: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 55,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  filaEstadisticas: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  tarjetaEstadistica: { flex: 1, borderRadius: 14, padding: 14, elevation: 2 },
  numeroEstadistica: { fontSize: 22, fontWeight: "bold", color: "#3B6FA0" },
  etiquetaEstadistica: { fontSize: 12, marginTop: 2 },
  pestañas: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  pestaña: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  pestañaActiva: { backgroundColor: "#3B6FA0" },
  textoPestaña: { color: "#555", fontSize: 13, fontWeight: "600" },
  textoPestañaActiva: { color: "#fff", fontSize: 13, fontWeight: "600" },
  tarjeta: { borderRadius: 14, padding: 14, marginBottom: 12, elevation: 2 },
  filaTarjeta: { flexDirection: "row", justifyContent: "space-between" },
  badgeTipo: {
    backgroundColor: "#E3EEF8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  textoBadgeTipo: { color: "#3B6FA0", fontSize: 11, fontWeight: "600" },
  badgeEstado: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  descripcion: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  imagenAdjunta: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginTop: 10,
  },
  autor: { fontSize: 11, marginTop: 8 },
  filaBotonesEstado: { flexDirection: "row", gap: 8, marginTop: 12 },
  botonEstado: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "#F0F0F0",
  },
  textoBotonEstado: { fontSize: 11, fontWeight: "600", color: "#333" },
});
