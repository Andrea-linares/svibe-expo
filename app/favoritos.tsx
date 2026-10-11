import Toast from "@/components/Toast";
import { COLOR_FAVORITOS } from "@/constants/theme";
import { useTema } from "@/contexts/ThemeContext";
import { useFavoritos } from "@/hooks/use-favoritos";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ---------------------------------------------------------------------------
 * Favoritos
 * Lista los lugares (hitos) guardados por el usuario. La lista se recarga al
 * enfocar la pantalla y se filtra con el estado global de useFavoritos, así
 * lo que se quite en otra pantalla desaparece al instante.
 * ------------------------------------------------------------------------- */

type HitoFavorito = {
  id: string;
  nombre: string;
  direccion_referencia: string | null;
  precio: number | null;
  hito_imagenes: { url: string; orden: number }[] | null;
};

const CAMPOS_HITO =
  "id, nombre, direccion_referencia, precio, hito_imagenes(url, orden)";

async function obtenerHitosFavoritos(usuarioId: string): Promise<HitoFavorito[]> {
  // 1) Consulta anidada favoritos → hitos
  const { data, error } = await supabase
    .from("favoritos")
    .select(`creado_en, hitos(${CAMPOS_HITO})`)
    .eq("usuario_id", usuarioId)
    .order("creado_en", { ascending: false });

  if (!error) {
    return (data ?? [])
      .map((f: any) => (Array.isArray(f.hitos) ? f.hitos[0] : f.hitos))
      .filter(Boolean) as HitoFavorito[];
  }

  // 2) Si la relación no está disponible, se hace en dos consultas
  console.warn("Consulta anidada de favoritos falló, usando dos consultas:", error);

  const { data: favs, error: errFavs } = await supabase
    .from("favoritos")
    .select("hito_id, creado_en")
    .eq("usuario_id", usuarioId)
    .order("creado_en", { ascending: false });
  if (errFavs) throw errFavs;

  const hitoIds = (favs ?? []).map((f) => f.hito_id as string);
  if (hitoIds.length === 0) return [];

  const { data: hitos, error: errHitos } = await supabase
    .from("hitos")
    .select(CAMPOS_HITO)
    .in("id", hitoIds);
  if (errHitos) throw errHitos;

  const mapa = new Map((hitos ?? []).map((h: any) => [h.id, h as HitoFavorito]));
  return hitoIds.map((id) => mapa.get(id)).filter(Boolean) as HitoFavorito[];
}

function obtenerImagenPrincipal(hito: HitoFavorito) {
  if (hito.hito_imagenes && hito.hito_imagenes.length > 0) {
    const ordenadas = [...hito.hito_imagenes].sort((a, b) => a.orden - b.orden);
    return { uri: ordenadas[0].url };
  }
  return require("@/assets/images/partial-react-logo.png");
}

export default function FavoritosScreen() {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const { usuarioId, ids, cargando: cargandoSesion, alternarFavorito } = useFavoritos();

  const [hitos, setHitos] = useState<HitoFavorito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const cargar = useCallback(async () => {
    if (!usuarioId) {
      setHitos([]);
      setCargando(false);
      setRefrescando(false);
      return;
    }
    try {
      setError(null);
      setHitos(await obtenerHitosFavoritos(usuarioId));
    } catch (e: any) {
      console.error("Error cargando favoritos:", e);
      setError(e?.message ?? "Inténtalo de nuevo.");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [usuarioId]);

  useFocusEffect(
    useCallback(() => {
      if (!cargandoSesion) cargar();
    }, [cargar, cargandoSesion]),
  );

  async function quitar(hitoId: string) {
    const resultado = await alternarFavorito(hitoId);
    if (resultado === "quitado") setToastVisible(true);
  }

  // Solo se muestran los que siguen marcados como favoritos
  const visibles = hitos.filter((h) => ids.has(h.id));

  /* ------------------------------ Render -------------------------------- */

  const encabezado = (
    <View
      style={[
        styles.encabezado,
        { paddingTop: insets.top + 8, backgroundColor: colores.encabezado, borderBottomColor: colores.borde },
      ]}
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={26} color={colores.texto} />
      </TouchableOpacity>
      <Text style={[styles.titulo, { color: colores.texto }]}>Favoritos</Text>
      <View style={{ width: 26 }} />
    </View>
  );

  if (cargandoSesion || cargando) {
    return (
      <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
        {encabezado}
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={COLOR_FAVORITOS} />
        </View>
      </View>
    );
  }

  // Sin sesión (invitado)
  if (!usuarioId) {
    return (
      <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
        {encabezado}
        <View style={styles.centrado}>
          <Ionicons name="person-circle-outline" size={64} color={COLOR_FAVORITOS} />
          <Text style={[styles.tituloVacio, { color: colores.texto }]}>Estás como invitado</Text>
          <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>
            Inicia sesión para guardar tus lugares favoritos y verlos aquí.
          </Text>
          <TouchableOpacity style={styles.botonPrimarioGrande} onPress={() => router.push("/login")}>
            <Text style={styles.textoBotonPrimario}>Iniciar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
        {encabezado}
        <View style={styles.centrado}>
          <Ionicons name="alert-circle-outline" size={64} color={COLOR_FAVORITOS} />
          <Text style={[styles.tituloVacio, { color: colores.texto }]}>No pudimos cargar tus favoritos</Text>
          <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>{error}</Text>
          <TouchableOpacity
            style={styles.botonPrimarioGrande}
            onPress={() => {
              setCargando(true);
              cargar();
            }}
          >
            <Text style={styles.textoBotonPrimario}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
      {encabezado}

      <FlatList
        data={visibles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              cargar();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.centrado}>
            {/* Ilustración: mapa con corazón */}
            <View style={styles.ilustracion}>
              <Ionicons name="sparkles" size={18} color={COLOR_FAVORITOS} style={styles.destelloIzq} />
              <Ionicons name="map-outline" size={96} color={COLOR_FAVORITOS} />
              <View style={[styles.corazonIlustracion, { backgroundColor: colores.fondo }]}>
                <Ionicons name="heart-outline" size={36} color={COLOR_FAVORITOS} />
              </View>
              <Ionicons name="sparkles" size={14} color={COLOR_FAVORITOS} style={styles.destelloDer} />
            </View>
            <Text style={[styles.tituloVacio, { color: colores.texto }]}>Aún no tienes favoritos</Text>
            <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>
              Guarda los lugares que más te gusten para encontrarlos fácilmente.
            </Text>
            <TouchableOpacity
              style={styles.botonPrimarioGrande}
              onPress={() => router.navigate("/(tabs)/home")}
            >
              <Text style={styles.textoBotonPrimario}>Explorar lugares</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.fila, { borderBottomColor: colores.borde }]}
            onPress={() => router.push(`/hito/${item.id}`)}
            activeOpacity={0.8}
          >
            <Image source={obtenerImagenPrincipal(item)} style={styles.miniatura} />
            <View style={styles.infoFila}>
              <Text style={[styles.nombre, { color: colores.texto }]} numberOfLines={2}>
                {item.nombre}
              </Text>
              {item.direccion_referencia && (
                <Text style={[styles.ubicacion, { color: colores.textoSecundario }]} numberOfLines={1}>
                  {item.direccion_referencia}
                </Text>
              )}
              <Text style={styles.precio}>
                {item.precio && item.precio > 0 ? `Desde $${item.precio.toFixed(2)}` : "Gratis"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => quitar(item.id)}
              hitSlop={12}
              accessibilityLabel="Quitar de favoritos"
            >
              <Ionicons name="heart" size={22} color={COLOR_FAVORITOS} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      <Toast
        visible={toastVisible}
        mensaje="El lugar se eliminó de tus favoritos"
        onOcultar={() => setToastVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  titulo: { fontSize: 18, fontWeight: "bold" },

  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  miniatura: { width: 76, height: 76, borderRadius: 12 },
  infoFila: { flex: 1 },
  nombre: { fontSize: 15, fontWeight: "bold" },
  ubicacion: { fontSize: 13, marginTop: 4 },
  precio: { fontSize: 13, color: COLOR_FAVORITOS, fontWeight: "600", marginTop: 4 },

  ilustracion: {
    width: 150,
    height: 130,
    justifyContent: "center",
    alignItems: "center",
  },
  corazonIlustracion: {
    position: "absolute",
    top: 4,
    borderRadius: 24,
    padding: 4,
  },
  destelloIzq: { position: "absolute", left: 6, top: 40 },
  destelloDer: { position: "absolute", right: 8, top: 22 },

  textoBotonPrimario: { color: "#fff", fontSize: 14, fontWeight: "600" },
  botonPrimarioGrande: {
    marginTop: 20,
    backgroundColor: COLOR_FAVORITOS,
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  tituloVacio: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginTop: 16 },
  textoVacio: { fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 },
});
