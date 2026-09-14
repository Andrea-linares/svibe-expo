import AdminHeader from "@/components/admin/admin-header";
import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Hito = {
  id: string;
  nombre: string;
  direccion_referencia: string | null;
  es_lugar_oculto: boolean;
  hito_imagenes: { url: string; orden: number }[];
};

type Filtro = "todos" | "visibles" | "ocultos";

export default function AdminHitosScreen() {
  const { colores } = useTema();
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  useFocusEffect(
    useCallback(() => {
      async function cargar() {
        const { data } = await supabase
          .from("hitos")
          .select(
            "id, nombre, direccion_referencia, es_lugar_oculto, hito_imagenes(url, orden)",
          )
          .order("nombre", { ascending: true });
        setHitos(data ?? []);
        setCargando(false);
      }
      cargar();
    }, []),
  );

  const totalOcultos = useMemo(
    () => hitos.filter((h) => h.es_lugar_oculto).length,
    [hitos],
  );

  const hitosFiltrados = useMemo(() => {
    let lista = hitos;
    if (filtro === "visibles") lista = lista.filter((h) => !h.es_lugar_oculto);
    if (filtro === "ocultos") lista = lista.filter((h) => h.es_lugar_oculto);
    if (busqueda.trim()) {
      const texto = busqueda.trim().toLowerCase();
      lista = lista.filter(
        (h) =>
          h.nombre.toLowerCase().includes(texto) ||
          h.direccion_referencia?.toLowerCase().includes(texto),
      );
    }
    return lista;
  }, [hitos, filtro, busqueda]);

  function confirmarEliminar(hito: Hito) {
    Alert.alert(
      "Eliminar lugar",
      `¿Seguro que quieres eliminar "${hito.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.rpc("admin_eliminar_hito", {
              p_id: hito.id,
            });
            if (error) {
              Alert.alert("Error", error.message);
            } else {
              setHitos((actual) => actual.filter((h) => h.id !== hito.id));
            }
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
      <AdminHeader titulo="Hitos culturales" />

      {/* Tarjetas de estadísticas */}
      <View style={styles.filaEstadisticas}>
        <View
          style={[
            styles.tarjetaEstadistica,
            { backgroundColor: colores.tarjeta },
          ]}
        >
          <Text style={styles.numeroEstadistica}>{hitos.length}</Text>
          <Text
            style={[
              styles.etiquetaEstadistica,
              { color: colores.textoSecundario },
            ]}
          >
            Total de lugares
          </Text>
        </View>
        <View
          style={[
            styles.tarjetaEstadistica,
            { backgroundColor: colores.tarjeta },
          ]}
        >
          <Text style={[styles.numeroEstadistica, { color: "#D9587A" }]}>
            {totalOcultos}
          </Text>
          <Text
            style={[
              styles.etiquetaEstadistica,
              { color: colores.textoSecundario },
            ]}
          >
            Lugares ocultos
          </Text>
        </View>
      </View>

      {/* Buscador */}
      <View
        style={[
          styles.buscador,
          { backgroundColor: colores.tarjeta, borderColor: colores.borde },
        ]}
      >
        <Ionicons name="search" size={18} color={colores.textoSecundario} />
        <TextInput
          style={[styles.inputBuscador, { color: colores.texto }]}
          placeholder="Buscar hito..."
          placeholderTextColor={colores.textoSecundario}
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {/* Pestañas de filtro */}
      <View style={styles.pestañas}>
        {(["todos", "visibles", "ocultos"] as Filtro[]).map((opcion) => (
          <TouchableOpacity
            key={opcion}
            style={[styles.pestaña, filtro === opcion && styles.pestañaActiva]}
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
                : opcion === "visibles"
                  ? "Visibles"
                  : "Ocultos"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={hitosFiltrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          paddingTop: 4,
          paddingBottom: 100,
        }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.fila, { backgroundColor: colores.tarjeta }]}
            onPress={() => router.push(`/admin/hito-formulario?id=${item.id}`)}
          >
            <Image
              source={
                item.hito_imagenes?.length > 0
                  ? { uri: item.hito_imagenes[0].url }
                  : require("@/assets/images/partial-react-logo.png")
              }
              style={styles.imagen}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.nombre, { color: colores.texto }]}
                numberOfLines={1}
              >
                {item.nombre}
              </Text>
              {item.direccion_referencia && (
                <Text
                  style={[styles.ubicacion, { color: colores.textoSecundario }]}
                  numberOfLines={1}
                >
                  📍 {item.direccion_referencia}
                </Text>
              )}
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: item.es_lugar_oculto
                      ? "#FCEBEE"
                      : "#E3F5E9",
                  },
                ]}
              >
                <Text
                  style={{
                    color: item.es_lugar_oculto ? "#D9587A" : "#2E9E5B",
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  {item.es_lugar_oculto ? "Oculto" : "Visible"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.botonAccion}
              onPress={() => confirmarEliminar(item)}
            >
              <Ionicons name="trash-outline" size={20} color="#D32F2F" />
            </TouchableOpacity>
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
            No se encontraron lugares.
          </Text>
        }
      />

      <TouchableOpacity
        style={styles.botonFlotante}
        onPress={() => router.push("/admin/hito-formulario")}
      >
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.textoBotonFlotante}>Agregar nuevo hito</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  filaEstadisticas: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  tarjetaEstadistica: { flex: 1, borderRadius: 14, padding: 14, elevation: 2 },
  numeroEstadistica: { fontSize: 22, fontWeight: "bold", color: "#3B6FA0" },
  etiquetaEstadistica: { fontSize: 12, marginTop: 2 },
  buscador: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 12,
  },
  inputBuscador: { flex: 1, fontSize: 14 },
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
  pestañaActiva: { backgroundColor: "#3B6FA0" },
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
  imagen: { width: 56, height: 56, borderRadius: 10 },
  nombre: { fontSize: 15, fontWeight: "600" },
  ubicacion: { fontSize: 12, marginTop: 2 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 5,
  },
  botonAccion: { padding: 8 },
  botonFlotante: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#3B6FA0",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    elevation: 6,
  },
  textoBotonFlotante: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
