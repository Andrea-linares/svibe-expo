import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ---------------------------------------------------------------------------
 * Mis rutas guardadas
 * Lee las rutas del usuario (tablas rutas + ruta_items) y las muestra como
 * tarjetas: se pueden abrir para ver sus paradas, iniciar en Google Maps o eliminar.
 * ------------------------------------------------------------------------- */

const ACENTO = "#5B9BD5";
const ROJO = "#D32F2F";

type NombreIcono = keyof typeof Ionicons.glyphMap;

type ParadaGuardada = {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  categoria: string;
  imagenUrl: string | null;
};

type RutaGuardada = {
  id: string;
  nombre: string;
  creadaEn: string | null;
  paradas: ParadaGuardada[];
};

function estiloCategoria(nombre: string): { color: string; icono: NombreIcono } {
  const n = nombre.toLowerCase();
  if (n.includes("arqueol")) return { color: "#8D5A2B", icono: "triangle-outline" };
  if (n.includes("hist")) return { color: "#7E57C2", icono: "library-outline" };
  if (n.includes("natur")) return { color: "#2E9E5B", icono: "leaf-outline" };
  if (n.includes("cultur")) return { color: "#D9587A", icono: "color-palette-outline" };
  if (n.includes("religi")) return { color: "#B8860B", icono: "business-outline" };
  return { color: ACENTO, icono: "location-outline" };
}

function formatearFecha(iso: string | null) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return "";
  return fecha.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export default function MisRutasScreen() {
  // ---- Todos los hooks van arriba, antes de cualquier return ----
  const { colores } = useTema();
  const insets = useSafeAreaInsets();

  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [rutas, setRutas] = useState<RutaGuardada[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const { data: sesion } = await supabase.auth.getUser();
      if (!sesion?.user) {
        setUsuarioId(null);
        setRutas([]);
        return;
      }
      const uid = sesion.user.id;
      setUsuarioId(uid);

      // 1) Rutas del usuario
      const { data: rutasData, error: errRutas } = await supabase
        .from("rutas")
        .select("id, nombre, creada_en")
        .eq("usuario_id", uid)
        .order("creada_en", { ascending: false });
      if (errRutas) throw errRutas;

      const ids = (rutasData ?? []).map((r: any) => r.id);
      if (ids.length === 0) {
        setRutas([]);
        return;
      }

      // 2) Paradas de esas rutas
      const { data: itemsData, error: errItems } = await supabase
        .from("ruta_items")
        .select("ruta_id, referencia_id, orden")
        .in("ruta_id", ids);
      if (errItems) throw errItems;

      const hitoIds = Array.from(new Set((itemsData ?? []).map((i: any) => i.referencia_id)));
      if (hitoIds.length === 0) {
        setRutas(
          (rutasData ?? []).map((r: any) => ({
            id: r.id,
            nombre: r.nombre,
            creadaEn: r.creada_en,
            paradas: [],
          })),
        );
        return;
      }

      // 3) Datos de los hitos (nombre, ubicación, categoría y primera foto)
      const { data: hitosData, error: errHitos } = await supabase
        .from("hitos")
        .select("id, nombre, lat, lng, categoria_id, hito_imagenes(url, orden)")
        .in("id", hitoIds);
      if (errHitos) throw errHitos;

      const { data: catData } = await supabase.from("categorias").select("id, nombre");
      const nombreCategoria = new Map<number, string>(
        (catData ?? []).map((c: any) => [c.id, c.nombre]),
      );

      const mapaHitos = new Map<string, ParadaGuardada>();
      (hitosData ?? []).forEach((h: any) => {
        const imgs = [...(h.hito_imagenes ?? [])].sort(
          (a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0),
        );
        mapaHitos.set(h.id, {
          id: h.id,
          nombre: h.nombre,
          lat: h.lat,
          lng: h.lng,
          categoria: nombreCategoria.get(h.categoria_id) ?? "Hito",
          imagenUrl: imgs.length > 0 ? imgs[0].url : null,
        });
      });

      setRutas(
        (rutasData ?? []).map((r: any) => ({
          id: r.id,
          nombre: r.nombre,
          creadaEn: r.creada_en,
          paradas: (itemsData ?? [])
            .filter((i: any) => i.ruta_id === r.id)
            .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0))
            .map((i: any) => mapaHitos.get(i.referencia_id))
            .filter((p): p is ParadaGuardada => p !== undefined),
        })),
      );
    } catch (e: any) {
      console.error("Error cargando rutas guardadas:", e);
      setError(e?.message ?? "Error al cargar tus rutas");
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

  // Abrir la ruta en Google Maps (sin API key, solo URL)
  function iniciarRuta(ruta: RutaGuardada) {
    if (ruta.paradas.length < 2) return;
    const f = (p: ParadaGuardada) => `${p.lat},${p.lng}`;
    const pts = ruta.paradas;
    const medio = pts.slice(1, -1).map(f).join("|");
    let url =
      `https://www.google.com/maps/dir/?api=1&travelmode=driving` +
      `&origin=${f(pts[0])}&destination=${f(pts[pts.length - 1])}`;
    if (medio) url += `&waypoints=${encodeURIComponent(medio)}`;
    Linking.openURL(url);
  }

  function confirmarEliminar(ruta: RutaGuardada) {
    Alert.alert("Eliminar ruta", `¿Quieres eliminar "${ruta.nombre}" de tus rutas guardadas?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => eliminar(ruta) },
    ]);
  }

  async function eliminar(ruta: RutaGuardada) {
    setEliminando(ruta.id);
    try {
      const { error: errItems } = await supabase.from("ruta_items").delete().eq("ruta_id", ruta.id);
      if (errItems) throw errItems;
      const { error: errRuta } = await supabase.from("rutas").delete().eq("id", ruta.id);
      if (errRuta) throw errRuta;
      setRutas((actual) => actual.filter((r) => r.id !== ruta.id));
      if (abierta === ruta.id) setAbierta(null);
    } catch (e: any) {
      Alert.alert("No se pudo eliminar", e?.message ?? "Inténtalo de nuevo.");
    } finally {
      setEliminando(null);
    }
  }

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
      <Text style={[styles.titulo, { color: colores.texto }]}>Mis rutas guardadas</Text>
      <View style={{ width: 26 }} />
    </View>
  );

  if (cargando) {
    return (
      <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
        {encabezado}
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={ACENTO} />
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
          <Ionicons name="person-circle-outline" size={64} color={ACENTO} />
          <Text style={[styles.tituloVacio, { color: colores.texto }]}>Estás como invitado</Text>
          <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>
            Inicia sesión para guardar rutas y verlas aquí.
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
          <Ionicons name="alert-circle-outline" size={64} color={ACENTO} />
          <Text style={[styles.tituloVacio, { color: colores.texto }]}>No pudimos cargar tus rutas</Text>
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
        data={rutas}
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
        ListHeaderComponent={
          rutas.length > 0 ? (
            <Text style={[styles.resumen, { color: colores.textoSecundario }]}>
              {rutas.length} ruta{rutas.length !== 1 ? "s" : ""} guardada{rutas.length !== 1 ? "s" : ""}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.centrado}>
            <Ionicons name="map-outline" size={64} color={ACENTO} />
            <Text style={[styles.tituloVacio, { color: colores.texto }]}>Todavía no tienes rutas guardadas</Text>
            <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>
              Toca el corazón en una ruta sugerida para guardarla y la verás aquí.
            </Text>
            <TouchableOpacity style={styles.botonPrimarioGrande} onPress={() => router.push("/rutas" as any)}>
              <Text style={styles.textoBotonPrimario}>Ver rutas sugeridas</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const expandida = abierta === item.id;
          const fecha = formatearFecha(item.creadaEn);
          return (
            <View style={[styles.tarjeta, { backgroundColor: colores.tarjeta, borderColor: colores.borde }]}>
              {/* Cabecera: toca para abrir o cerrar las paradas */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.cabeceraTarjeta}
                onPress={() => setAbierta(expandida ? null : item.id)}
              >
                <View style={styles.iconoRuta}>
                  <Ionicons name="map" size={20} color={ACENTO} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nombreRuta, { color: colores.texto }]} numberOfLines={2}>
                    {item.nombre}
                  </Text>
                  <Text style={[styles.metaRuta, { color: colores.textoSecundario }]}>
                    {item.paradas.length} parada{item.paradas.length !== 1 ? "s" : ""}
                    {fecha ? ` · ${fecha}` : ""}
                  </Text>
                </View>
                <Ionicons
                  name={expandida ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colores.textoSecundario}
                />
              </TouchableOpacity>

              {/* Fotos de las paradas */}
              {item.paradas.length > 0 && (
                <View style={styles.filaAvatares}>
                  {item.paradas.slice(0, 6).map((p, i) => {
                    const cat = estiloCategoria(p.categoria);
                    return p.imagenUrl ? (
                      <Image
                        key={`${p.id}-${i}`}
                        source={{ uri: p.imagenUrl }}
                        style={[styles.avatar, { borderColor: cat.color }]}
                      />
                    ) : (
                      <View
                        key={`${p.id}-${i}`}
                        style={[styles.avatar, styles.avatarVacio, { borderColor: cat.color, backgroundColor: cat.color + "22" }]}
                      >
                        <Ionicons name={cat.icono} size={18} color={cat.color} />
                      </View>
                    );
                  })}
                  {item.paradas.length > 6 && (
                    <View style={[styles.avatar, styles.avatarVacio, { borderColor: colores.borde }]}>
                      <Text style={{ color: colores.textoSecundario, fontWeight: "700", fontSize: 12 }}>
                        +{item.paradas.length - 6}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Lista de paradas (al abrir) */}
              {expandida && (
                <View style={[styles.listaParadas, { borderTopColor: colores.borde }]}>
                  {item.paradas.length === 0 ? (
                    <Text style={{ color: colores.textoSecundario, fontSize: 13 }}>
                      Esta ruta no tiene paradas.
                    </Text>
                  ) : (
                    item.paradas.map((p, i) => {
                      const cat = estiloCategoria(p.categoria);
                      return (
                        <TouchableOpacity
                          key={`${p.id}-${i}`}
                          style={styles.filaParada}
                          activeOpacity={0.6}
                          onPress={() => router.push(`/hito/${p.id}`)}
                        >
                          <View style={[styles.numeroParada, { backgroundColor: cat.color }]}>
                            <Text style={styles.textoNumeroParada}>{i + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.nombreParada, { color: colores.texto }]} numberOfLines={1}>
                              {p.nombre}
                            </Text>
                            <View style={styles.filaCategoria}>
                              <Ionicons name={cat.icono} size={13} color={cat.color} />
                              <Text style={[styles.textoCategoria, { color: cat.color }]}>{p.categoria}</Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={colores.textoSecundario} />
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}

              {/* Acciones */}
              <View style={styles.filaAcciones}>
                {item.paradas.length >= 2 && (
                  <TouchableOpacity style={styles.botonIniciar} onPress={() => iniciarRuta(item)}>
                    <Ionicons name="play" size={15} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.textoBotonPrimario}>Iniciar ruta</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.botonEliminar}
                  onPress={() => confirmarEliminar(item)}
                  disabled={eliminando === item.id}
                >
                  {eliminando === item.id ? (
                    <ActivityIndicator size="small" color={ROJO} />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={15} color={ROJO} style={{ marginRight: 6 }} />
                      <Text style={styles.textoBotonEliminar}>Eliminar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

/* ------------------------------- Estilos --------------------------------- */

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
  resumen: { fontSize: 13, marginBottom: 12 },

  tarjeta: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cabeceraTarjeta: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconoRuta: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#EAF2FA",
    justifyContent: "center",
    alignItems: "center",
  },
  nombreRuta: { fontSize: 16, fontWeight: "700" },
  metaRuta: { fontSize: 12.5, marginTop: 2 },

  filaAvatares: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2 },
  avatarVacio: { justifyContent: "center", alignItems: "center" },

  listaParadas: { marginTop: 14, paddingTop: 6, borderTopWidth: 1 },
  filaParada: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  numeroParada: { width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  textoNumeroParada: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  nombreParada: { fontSize: 14.5, fontWeight: "600" },
  filaCategoria: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  textoCategoria: { fontSize: 12, fontWeight: "600" },

  filaAcciones: { flexDirection: "row", gap: 10, marginTop: 16 },
  botonIniciar: {
    flex: 1,
    flexDirection: "row",
    height: 44,
    borderRadius: 22,
    backgroundColor: ACENTO,
    justifyContent: "center",
    alignItems: "center",
  },
  botonEliminar: {
    flexDirection: "row",
    height: 44,
    minWidth: 110,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: ROJO,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonEliminar: { color: ROJO, fontSize: 14, fontWeight: "600" },
  textoBotonPrimario: { color: "#fff", fontSize: 14, fontWeight: "600" },

  botonPrimarioGrande: {
    marginTop: 20,
    backgroundColor: ACENTO,
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  tituloVacio: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginTop: 16 },
  textoVacio: { fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 },
});