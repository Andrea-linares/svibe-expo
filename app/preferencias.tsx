import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Categoria = {
  id: number;
  nombre: string;
};

export default function PreferenciasScreen() {
  const { colores } = useTema();
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set());
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  useEffect(() => {
    async function cargarDatos() {
      const { data: sesion } = await supabase.auth.getUser();

      if (!sesion?.user) {
        Alert.alert("Error", "No has iniciado sesión.");
        router.back();
        return;
      }

      const userId = sesion.user.id;
      setUsuarioId(userId);

      const { data: categoriasData } = await supabase
        .from("categorias")
        .select("id, nombre")
        .order("nombre");

      setCategorias(categoriasData ?? []);

      const { data: preferenciasData } = await supabase
        .from("usuario_categorias")
        .select("categoria_id")
        .eq("usuario_id", userId);

      setSeleccionadas(
        new Set((preferenciasData ?? []).map((p) => p.categoria_id)),
      );

      setCargando(false);
    }

    cargarDatos();
  }, []);

  function toggleCategoria(id: number) {
    setSeleccionadas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) {
        nuevo.delete(id);
      } else {
        nuevo.add(id);
      }
      return nuevo;
    });
  }

  async function guardarPreferencias() {
    if (!usuarioId) return;

    setGuardando(true);

    await supabase
      .from("usuario_categorias")
      .delete()
      .eq("usuario_id", usuarioId);

    if (seleccionadas.size > 0) {
      const filas = Array.from(seleccionadas).map((categoria_id) => ({
        usuario_id: usuarioId,
        categoria_id,
      }));
      await supabase.from("usuario_categorias").insert(filas);
    }

    setGuardando(false);
    Alert.alert("Listo", "Tus preferencias se actualizaron.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  }

  if (cargando) {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color="#3B6FA0" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
        <View style={[styles.encabezado, { backgroundColor: colores.tarjeta }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colores.texto} />
          </TouchableOpacity>
          <Text style={[styles.tituloEncabezado, { color: colores.texto }]}>
            Mis preferencias
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={[styles.subtitulo, { color: colores.texto }]}>
            Elige las categorías que más te interesan
          </Text>

          <View style={styles.grid}>
            {categorias.map((categoria) => {
              const activa = seleccionadas.has(categoria.id);
              return (
                <TouchableOpacity
                  key={categoria.id}
                  style={[
                    styles.tarjeta,
                    { backgroundColor: colores.tarjeta },
                    activa && styles.tarjetaActiva,
                  ]}
                  onPress={() => toggleCategoria(categoria.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.nombreCategoria,
                      { color: activa ? "#fff" : colores.texto },
                    ]}
                  >
                    {categoria.nombre}
                  </Text>
                  {activa && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#fff"
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.botonGuardar}
            onPress={guardarPreferencias}
            disabled={guardando}
          >
            {guardando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.textoBotonGuardar}>Guardar cambios</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  tituloEncabezado: { fontSize: 17, fontWeight: "bold" },
  subtitulo: { fontSize: 14, marginBottom: 16 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tarjeta: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  tarjetaActiva: { backgroundColor: "#3B6FA0" },
  nombreCategoria: { fontSize: 14, fontWeight: "600" },
  botonGuardar: {
    marginTop: 28,
    height: 52,
    backgroundColor: "#3B6FA0",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonGuardar: { color: "#fff", fontSize: 15, fontWeight: "600" },
});