// ============================================================
// 📁 app/preferencias.tsx - VERSIÓN FINAL (LOGS LIMPIOS)
// ============================================================
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Categoria = {
  id: number;
  nombre: string;
  icono: string | null;
};

const ICONOS_POR_DEFECTO: Record<string, string> = {
  Arte: "🎨",
  Cultura: "🏛️",
  Historia: "📜",
  Naturaleza: "🌿",
  Gastronomía: "🍽️",
  Religión: "⛪",
  Entretenimiento: "🎭",
  VidaNocturna: "🌃",
};

// Mapeo de iconos si no hay en la BD
function obtenerIcono(categoria: Categoria): string {
  // Mapeo de nombres de iconos a emojis
  const MAPA_ICONOS: Record<string, string> = {
    landmark: "📜",
    church: "⛪",
    tree: "🌿",
    ancient: "🏛️",
    "theater-masks": "🎭",
    // Si hay más, agrégalos aquí
  };

  // Si el icono existe en el mapeo, usar el emoji
  if (categoria.icono && MAPA_ICONOS[categoria.icono]) {
    return MAPA_ICONOS[categoria.icono];
  }

  // Si no, buscar por nombre
  return ICONOS_POR_DEFECTO[categoria.nombre] ?? "📍";
}

export default function PreferenciasScreen() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set());
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargarDatos() {
      try {
        console.log("🔄 Cargando preferencias...");

        // 1. Obtener usuario autenticado
        const { data: sesion, error: sesionError } = await supabase.auth.getUser();
        
        console.log("🔍 Usuario autenticado:", sesion?.user?.id || "No autenticado");

        if (sesionError || !sesion?.user) {
          console.log("❌ Error de sesión:", sesionError);
          Alert.alert("Error", "No has iniciado sesión.");
          router.replace("/login");
          return;
        }

        const userId = sesion.user.id;
        setUsuarioId(userId);
        console.log("✅ Usuario ID:", userId);

        // 2. Obtener todas las categorías
        console.log("🔄 Consultando categorías...");
        const { data: categoriasData, error: categoriasError } = await supabase
          .from("categorias")
          .select("*")
          .order("nombre");

        console.log("📋 Categorías encontradas:", categoriasData?.length || 0);

        if (categoriasError) {
          console.log("❌ Error en categorías:", categoriasError);
          setError("No se pudieron cargar las categorías.");
          setCategorias([]);
          setCargando(false);
          return;
        }

        if (!categoriasData || categoriasData.length === 0) {
          console.log("⚠️ No hay categorías en la base de datos");
          setError("No hay categorías disponibles. Contacta al administrador.");
          setCategorias([]);
          setCargando(false);
          return;
        }

        setCategorias(categoriasData);
        setError(null);
        console.log(`✅ ${categoriasData.length} categorías cargadas`);

        // 3. Obtener categorías ya seleccionadas
        console.log("🔄 Consultando preferencias del usuario...");
        const { data: preferenciasData, error: prefError } = await supabase
          .from("usuario_categorias")
          .select("categoria_id")
          .eq("usuario_id", userId);

        console.log("📌 Preferencias existentes:", preferenciasData?.length || 0);
        if (prefError) {
          console.log("❌ Error en preferencias:", prefError);
        }

        const seleccionadasIds = new Set(
          (preferenciasData ?? []).map((p) => p.categoria_id)
        );
        setSeleccionadas(seleccionadasIds);
        console.log("📌 IDs seleccionados:", Array.from(seleccionadasIds));

      } catch (error) {
        console.log("❌ Error general:", error);
        setError("Ocurrió un error inesperado.");
      } finally {
        setCargando(false);
        console.log("✅ Carga de preferencias finalizada");
      }
    }

    cargarDatos();
  }, []);

  async function guardarPreferencias() {
    if (seleccionadas.size === 0) {
      Alert.alert(
        "Selecciona al menos una",
        "Elige al menos una categoría de interés para continuar."
      );
      return;
    }

    setGuardando(true);

    try {
      // 1. Eliminar preferencias actuales
      const { error: deleteError } = await supabase
        .from("usuario_categorias")
        .delete()
        .eq("usuario_id", usuarioId);

      if (deleteError) {
        console.error("❌ Error eliminando preferencias:", deleteError);
        Alert.alert("Error", "No se pudieron actualizar las preferencias.");
        setGuardando(false);
        return;
      }

      // 2. Insertar nuevas preferencias
      const nuevasPreferencias = Array.from(seleccionadas).map(
        (categoria_id) => ({
          usuario_id: usuarioId,
          categoria_id,
        })
      );

      const { error: insertError } = await supabase
        .from("usuario_categorias")
        .insert(nuevasPreferencias);

      if (insertError) {
        console.error("❌ Error insertando preferencias:", insertError);
        Alert.alert("Error", "No se pudieron guardar las preferencias.");
        setGuardando(false);
        return;
      }

      console.log("✅ Preferencias guardadas:", nuevasPreferencias.length);

      Alert.alert("¡Éxito!", "Tus preferencias han sido guardadas.", [
        { text: "Continuar", onPress: () => router.replace("/(tabs)/home") },
      ]);

    } catch (error) {
      console.error("❌ Error guardando:", error);
      Alert.alert("Error", "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  function toggleCategoria(id: number) {
    const nuevas = new Set(seleccionadas);
    if (nuevas.has(id)) {
      nuevas.delete(id);
    } else {
      nuevas.add(id);
    }
    setSeleccionadas(nuevas);
    console.log("📌 Seleccionadas ahora:", Array.from(nuevas));
  }

  function obtenerIcono(categoria: Categoria): string {
    // Si la categoría tiene icono en la BD, usarlo
    if (categoria.icono) {
      return categoria.icono;
    }
    // Si no, buscar en el mapeo por defecto
    return ICONOS_POR_DEFECTO[categoria.nombre] ?? "📍";
  }

  // ============================================================
  // RENDER - CARGANDO
  // ============================================================
  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#3B6FA0" />
        <Text style={styles.textoCargando}>Cargando preferencias...</Text>
      </View>
    );
  }

  // ============================================================
  // RENDER - ERROR
  // ============================================================
  if (error || categorias.length === 0) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.tituloError}>😕 {error || "No hay categorías disponibles"}</Text>
        <TouchableOpacity
          style={styles.botonReintentar}
          onPress={() => router.replace("/(tabs)/home")}
        >
          <Text style={styles.textoBotonReintentar}>Ir al inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ============================================================
  // RENDER - CATEGORÍAS
  // ============================================================
  return (
    <ImageBackground
      source={{
        uri: "https://gdrrajvafwzgnbvjmqtw.supabase.co/storage/v1/object/public/hitos-imagenes/fondo.png",
      }}
      style={styles.fondo}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contenido}>
          {/* Encabezado */}
          <View style={styles.encabezado}>
            <Text style={styles.titulo}>¿Qué te gusta explorar?</Text>
            <Text style={styles.subtitulo}>
              Selecciona las categorías que más te interesan
            </Text>
          </View>

          {/* Grid de categorías */}
          <View style={styles.gridCategorias}>
            {categorias.map((categoria) => {
              const seleccionada = seleccionadas.has(categoria.id);
              return (
                <TouchableOpacity
                  key={categoria.id}
                  style={[
                    styles.tarjetaCategoria,
                    seleccionada && styles.tarjetaSeleccionada,
                  ]}
                  onPress={() => toggleCategoria(categoria.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.iconoCategoria}>
                    {obtenerIcono(categoria)}
                  </Text>
                  <Text
                    style={[
                      styles.nombreCategoria,
                      seleccionada && styles.nombreSeleccionado,
                    ]}
                  >
                    {categoria.nombre}
                  </Text>
                  {seleccionada && (
                    <View style={styles.checkSeleccionado}>
                      <Text style={styles.checkTexto}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Pie */}
          <View style={styles.pie}>
            <Text style={styles.contador}>
              {seleccionadas.size} categoría{seleccionadas.size !== 1 ? "s" : ""} seleccionada
              {seleccionadas.size !== 1 ? "s" : ""}
            </Text>

            <TouchableOpacity
              style={[
                styles.botonGuardar,
                (guardando || seleccionadas.size === 0) && styles.botonDeshabilitado,
              ]}
              onPress={guardarPreferencias}
              disabled={guardando || seleccionadas.size === 0}
            >
              {guardando ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.textoBotonGuardar}>
                  {seleccionadas.size === 0
                    ? "Selecciona al menos una"
                    : "Guardar preferencias"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Saltar preferencias",
                  "Puedes configurar tus preferencias más tarde desde el menú.",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Saltar",
                      onPress: () => router.replace("/(tabs)/home"),
                    },
                  ]
                );
              }}
            >
              <Text style={styles.textoSaltar}>Omitir por ahora</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

// ============================================================
// ESTILOS (SIN CAMBIOS)
// ============================================================
const styles = StyleSheet.create({
  fondo: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 30, 0.45)",
  },
  centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 24,
  },
  textoCargando: {
    color: "#EAEAEA",
    marginTop: 12,
    fontSize: 14,
  },
  tituloError: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  botonReintentar: {
    backgroundColor: "#3B6FA0",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  textoBotonReintentar: {
    color: "#fff",
    fontWeight: "600",
  },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  contenido: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  encabezado: {
    marginBottom: 30,
  },
  titulo: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  subtitulo: {
    fontSize: 15,
    color: "#EAEAEA",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  gridCategorias: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  tarjetaCategoria: {
    width: "48%",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
    marginBottom: 10,
    position: "relative",
  },
  tarjetaSeleccionada: {
    backgroundColor: "rgba(59, 111, 160, 0.85)",
    borderColor: "#5B9BD5",
  },
  iconoCategoria: {
    fontSize: 34,
    marginBottom: 8,
  },
  nombreCategoria: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
    textAlign: "center",
  },
  nombreSeleccionado: {
    color: "#fff",
    fontWeight: "600",
  },
  checkSeleccionado: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  checkTexto: {
    color: "#3B6FA0",
    fontSize: 14,
    fontWeight: "bold",
  },
  pie: {
    marginTop: 20,
    alignItems: "center",
  },
  contador: {
    color: "#EAEAEA",
    fontSize: 14,
    marginBottom: 16,
  },
  botonGuardar: {
    width: "100%",
    backgroundColor: "#3B6FA0",
    borderRadius: 27,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
  },
  botonDeshabilitado: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  textoBotonGuardar: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  textoSaltar: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    marginTop: 16,
    textDecorationLine: "underline",
  },
});