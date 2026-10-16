import { BotonTema } from "@/components/BotonTema";
import { COLORES, useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ---------------------------------------------------------------------------
 * Perfil
 * Encabezado (título, avatar, nombre, ciudad y "Editar perfil"), franja de
 * estadísticas, lista de opciones y cierre de sesión. Respeta el tema
 * claro/oscuro.
 * ------------------------------------------------------------------------- */

type Colores = typeof COLORES.claro;
type NombreIcono = keyof typeof Ionicons.glyphMap;
type Variante = "claro" | "oscuro";

type Perfil = {
  nombre: string | null;
  apellido: string | null;
  ciudad: string | null;
  foto_perfil_url: string | null;
  rol: string | null;
};

type Progreso = { puntos: number; nivel: number };

type DatosPerfil = {
  perfil: Perfil | null;
  totalVisitados: number;
  totalRutas: number;
  totalLogros: number;
  totalResenas: number;
  progreso: Progreso | null;
};

// Color de cada estadística: variante para modo claro y aclarada para oscuro
const ACENTOS = {
  lugares: { claro: "#3B6FA0", oscuro: "#7FB0E0" },
  niveles: { claro: "#2E8B57", oscuro: "#5FC48D" },
  insignias: { claro: "#D2693C", oscuro: "#F0956A" },
};

// Fondo sólido y tenue para la franja de estadísticas y el avatar sin foto
const FONDO_TENUE: Record<Variante, string> = { claro: "#EEF4FA", oscuro: "#1A2633" };

/* ------------------------------ Datos ------------------------------------ */

async function cargarDatosPerfil(userId: string): Promise<DatosPerfil> {
  const [perfilRes, visitasRes, rutasRes, logrosRes, progresoRes, resenasRes] = await Promise.all([
    // Datos del perfil
    supabase
      .from("perfiles")
      .select("nombre, apellido, ciudad, foto_perfil_url, rol")
      .eq("id", userId)
      .single(),
    // Hitos visitados (distintos)
    supabase
      .from("interacciones_usuario")
      .select("hito_id")
      .eq("usuario_id", userId)
      .eq("tipo_interaccion", "visita"),
    // Rutas guardadas
    supabase
      .from("rutas")
      .select("id, nombre")
      .eq("usuario_id", userId)
      .order("creada_en", { ascending: false }),
    // Logros obtenidos
    supabase
      .from("usuario_insignias")
      .select("insignia_id, insignias(nombre, descripcion, icono)")
      .eq("usuario_id", userId),
    // Nivel y puntos (misma tabla que la pantalla de Niveles)
    supabase
      .from("progreso_usuario")
      .select("puntos, nivel")
      .eq("usuario_id", userId)
      .maybeSingle(),
    // Reseñas escritas en el foro
    supabase
      .from("foro_posts")
      .select("*", { count: "exact", head: true })
      .eq("usuario_id", userId),
  ]);

  const hitosUnicos = new Set((visitasRes.data ?? []).map((v) => v.hito_id));

  return {
    perfil: perfilRes.data as Perfil | null,
    totalVisitados: hitosUnicos.size,
    totalRutas: rutasRes.data?.length ?? 0,
    totalLogros: logrosRes.data?.length ?? 0,
    totalResenas: resenasRes.count ?? 0,
    progreso: progresoRes.data as Progreso | null,
  };
}

/* ----------------------------- Utilidades -------------------------------- */

function obtenerNombreCompleto(perfil: Perfil | null) {
  const nombre = perfil?.nombre?.trim();
  if (!nombre) return "Usuario";
  const apellido = perfil?.apellido?.trim();
  return apellido ? `${nombre} ${apellido}` : nombre;
}

function obtenerIniciales(perfil: Perfil | null) {
  const letras = [perfil?.nombre, perfil?.apellido]
    .map((parte) => parte?.trim().charAt(0) ?? "")
    .join("");
  return letras.toUpperCase() || "U";
}

function pluralizar(cantidad: number, singular: string, plural: string) {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

// Tarjeta con borde sutil en ambos temas y sin elevation: en Android,
// elevation + borderRadius deja líneas grises en las esquinas.
function estiloTarjeta(colores: Colores, fondo: string): ViewStyle[] {
  return [styles.tarjeta, { backgroundColor: fondo, borderColor: colores.borde }];
}

/* ---------------------------- Componentes -------------------------------- */

function AvatarPerfil({
  perfil,
  colores,
  fondoIniciales,
}: Readonly<{ perfil: Perfil | null; colores: Colores; fondoIniciales: string }>) {
  const url = perfil?.foto_perfil_url;

  return (
    <View style={[styles.anilloAvatar, { borderColor: colores.acento }]}>
      {url ? (
        <Image source={{ uri: url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarIniciales, { backgroundColor: fondoIniciales }]}>
          <Text style={[styles.textoIniciales, { color: colores.acento }]}>
            {obtenerIniciales(perfil)}
          </Text>
        </View>
      )}
    </View>
  );
}

function EncabezadoPerfil({
  perfil,
  colores,
  fondoIniciales,
}: Readonly<{ perfil: Perfil | null; colores: Colores; fondoIniciales: string }>) {
  const ciudad = perfil?.ciudad?.trim();

  return (
    <View>
      <View style={styles.filaTitulo}>
        <Text style={[styles.tituloPantalla, { color: colores.texto }]}>Perfil</Text>
        <BotonTema />
      </View>

      <View style={styles.bloqueAvatar}>
        <AvatarPerfil perfil={perfil} colores={colores} fondoIniciales={fondoIniciales} />
        <Text style={[styles.nombre, { color: colores.texto }]} numberOfLines={2}>
          {obtenerNombreCompleto(perfil)}
        </Text>
        {ciudad ? (
          <View style={styles.filaCiudad}>
            <Ionicons name="location-outline" size={15} color={colores.textoSecundario} />
            <Text style={[styles.ciudad, { color: colores.textoSecundario }]} numberOfLines={1}>
              {ciudad}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.botonEditarPerfil, { borderColor: colores.acento }]}
          onPress={() => router.push("/editar-perfil")}
        >
          <Ionicons name="pencil-outline" size={14} color={colores.acento} />
          <Text style={[styles.textoBotonEditarPerfil, { color: colores.acento }]}>Editar perfil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ColumnaEstadistica({
  icono,
  color,
  valor,
  etiqueta,
  colores,
  onPress,
}: Readonly<{
  icono: NombreIcono;
  color: string;
  valor: number;
  etiqueta: string;
  colores: Colores;
  onPress?: () => void;
}>) {
  return (
    <TouchableOpacity
      style={styles.columnaEstadistica}
      activeOpacity={0.6}
      disabled={!onPress}
      onPress={onPress}
    >
      <Ionicons name={icono} size={22} color={color} />
      <Text style={[styles.numeroEstadistica, { color: colores.texto }]}>{valor}</Text>
      <Text style={[styles.etiquetaEstadistica, { color: colores.textoSecundario }]} numberOfLines={2}>
        {etiqueta}
      </Text>
    </TouchableOpacity>
  );
}

function FilaOpcion({
  icono,
  titulo,
  subtitulo,
  colores,
  onPress,
}: Readonly<{
  icono: NombreIcono;
  titulo: string;
  subtitulo: string;
  colores: Colores;
  onPress: () => void;
}>) {
  return (
    <TouchableOpacity style={styles.filaOpcion} activeOpacity={0.6} onPress={onPress}>
      <Ionicons name={icono} size={22} color={colores.acento} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.tituloOpcion, { color: colores.texto }]}>{titulo}</Text>
        <Text style={[styles.subtituloOpcion, { color: colores.textoSecundario }]}>{subtitulo}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colores.textoSecundario} />
    </TouchableOpacity>
  );
}

function BotonCerrarSesion({ colores, onPress }: Readonly<{ colores: Colores; onPress: () => void }>) {
  return (
    <TouchableOpacity
      style={[styles.botonCerrarSesion, { borderColor: colores.peligro }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Ionicons name="log-out-outline" size={19} color={colores.peligro} />
      <Text style={[styles.textoBotonCerrarSesion, { color: colores.peligro }]}>Cerrar Sesión</Text>
    </TouchableOpacity>
  );
}

function VistaInvitado({ colores }: Readonly<{ colores: Colores }>) {
  return (
    <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
      <Ionicons name="person-circle-outline" size={64} color={colores.acento} />
      <Text style={[styles.tituloInvitado, { color: colores.texto }]}>Estás como invitado</Text>
      <Text style={[styles.textoInvitado, { color: colores.textoSecundario }]}>
        Inicia sesión para ver tu perfil, tus favoritos y tus rutas guardadas.
      </Text>
      {/* Azul del modo claro también en oscuro: el texto blanco necesita un fondo oscuro */}
      <TouchableOpacity
        style={[styles.botonIniciarSesion, { backgroundColor: COLORES.claro.acento }]}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.textoBotonIniciarSesion}>Iniciar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------ Pantalla --------------------------------- */

export default function PerfilScreen() {
  const { colores, esOscuro } = useTema();
  const insets = useSafeAreaInsets();
  const variante: Variante = esOscuro ? "oscuro" : "claro";

  const [cargando, setCargando] = useState(true);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosPerfil | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function cargarPerfil() {
        const { data: sesion } = await supabase.auth.getUser();

        if (!sesion?.user) {
          setUsuarioId(null);
          setCargando(false);
          return;
        }

        setUsuarioId(sesion.user.id);
        const resultado = await cargarDatosPerfil(sesion.user.id);

        if (resultado.perfil?.rol === "administrador") {
          router.replace("/admin/dashboard");
          return;
        }

        setDatos(resultado);
        setCargando(false);
      }

      cargarPerfil();
    }, []),
  );

  // Barra de estado según el tema de la app mientras Perfil está enfocada
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(esOscuro ? "light" : "dark");
      return () => setStatusBarStyle("auto");
    }, [esOscuro]),
  );

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function confirmarCerrarSesion() {
    Alert.alert("Cerrar sesión", "¿Seguro que quieres cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: cerrarSesion },
    ]);
  }

  if (cargando) {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.acento} />
      </View>
    );
  }

  if (!usuarioId) return <VistaInvitado colores={colores} />;

  const totalRutas = datos?.totalRutas ?? 0;
  const totalLogros = datos?.totalLogros ?? 0;
  const totalResenas = datos?.totalResenas ?? 0;
  const separadorVertical = [styles.separadorVertical, { backgroundColor: colores.borde }];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40 }}
    >
      <EncabezadoPerfil
        perfil={datos?.perfil ?? null}
        colores={colores}
        fondoIniciales={FONDO_TENUE[variante]}
      />

      {/* Franja de estadísticas: 3 columnas */}
      <View style={[estiloTarjeta(colores, FONDO_TENUE[variante]), styles.franja]}>
        <ColumnaEstadistica
          icono="location"
          color={ACENTOS.lugares[variante]}
          valor={datos?.totalVisitados ?? 0}
          etiqueta="Lugares visitados"
          colores={colores}
        />
        <View style={separadorVertical} />
        <ColumnaEstadistica
          icono="trending-up"
          color={ACENTOS.niveles[variante]}
          valor={datos?.progreso?.nivel ?? 1}
          etiqueta="Niveles"
          colores={colores}
          onPress={() => router.push("/niveles")}
        />
        <View style={separadorVertical} />
        <ColumnaEstadistica
          icono="ribbon"
          color={ACENTOS.insignias[variante]}
          valor={totalLogros}
          etiqueta="Insignias"
          colores={colores}
        />
      </View>

      {/* Opciones */}
      <View style={[estiloTarjeta(colores, colores.tarjeta), styles.lista]}>
        <FilaOpcion
          icono="calendar-outline"
          titulo="Calendario de eventos"
          subtitulo="Ver próximos eventos"
          colores={colores}
          onPress={() => router.push("/eventos")}
        />
        <View style={[styles.separador, { backgroundColor: colores.borde }]} />
        <FilaOpcion
          icono="map-outline"
          titulo="Mis rutas guardadas"
          subtitulo={pluralizar(totalRutas, "ruta", "rutas")}
          colores={colores}
          onPress={() => router.push("/mis-rutas")}
        />
        <View style={[styles.separador, { backgroundColor: colores.borde }]} />
        <FilaOpcion
          icono="trophy-outline"
          titulo="Logros obtenidos"
          subtitulo={pluralizar(totalLogros, "logro", "logros")}
          colores={colores}
          onPress={() => router.push("/insignias")}
        />
        <View style={[styles.separador, { backgroundColor: colores.borde }]} />
        <FilaOpcion
          icono="chatbubble-ellipses-outline"
          titulo="Mis reseñas"
          subtitulo={pluralizar(totalResenas, "reseña", "reseñas")}
          colores={colores}
          onPress={() => router.push("/mis-resenas")}
        />
      </View>

      <BotonCerrarSesion colores={colores} onPress={confirmarCerrarSesion} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },

  // Tarjeta: borde sutil, sin elevation ni sombra
  tarjeta: {
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 16,
  },

  // Invitado
  tituloInvitado: { fontSize: 20, fontWeight: "bold", marginTop: 12, marginBottom: 8 },
  textoInvitado: { fontSize: 14, textAlign: "center", marginBottom: 20, lineHeight: 20 },
  botonIniciarSesion: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  textoBotonIniciarSesion: { color: "#fff", fontWeight: "600" },

  // Encabezado
  filaTitulo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  tituloPantalla: { fontSize: 24, fontWeight: "bold" },
  bloqueAvatar: { alignItems: "center", marginTop: 12, paddingHorizontal: 20 },
  anilloAvatar: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 3,
    padding: 4,
  },
  avatar: { width: "100%", height: "100%", borderRadius: 52 },
  avatarIniciales: { justifyContent: "center", alignItems: "center" },
  textoIniciales: { fontSize: 36, fontWeight: "bold" },
  nombre: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 14,
    letterSpacing: -0.3,
  },
  filaCiudad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    maxWidth: "100%",
  },
  ciudad: { fontSize: 14 },
  botonEditarPerfil: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    borderWidth: 1.3,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  textoBotonEditarPerfil: { fontSize: 13, fontWeight: "600" },

  // Franja de estadísticas
  franja: { flexDirection: "row", marginTop: 24, paddingVertical: 16 },
  columnaEstadistica: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  numeroEstadistica: {
    fontSize: 24,
    fontWeight: "800",
    marginTop: 6,
    fontVariant: ["tabular-nums"],
  },
  etiquetaEstadistica: { fontSize: 12, marginTop: 2, textAlign: "center" },
  separadorVertical: { width: StyleSheet.hairlineWidth, marginVertical: 4 },

  // Lista de opciones
  lista: { marginTop: 18 },
  filaOpcion: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  tituloOpcion: { fontSize: 15.5, fontWeight: "600" },
  subtituloOpcion: { fontSize: 12.5, marginTop: 2 },
  separador: { height: StyleSheet.hairlineWidth, marginLeft: 52 },

  // Cerrar sesión
  botonCerrarSesion: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 28,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 8,
  },
  textoBotonCerrarSesion: { fontWeight: "700", fontSize: 15 },
});
