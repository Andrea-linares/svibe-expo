import { useTema } from "@/contexts/ThemeContext";
import { obtenerRetosConProgreso, RetoConProgreso } from "@/hooks/use-retos";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

// ---------- Tipos y constantes ----------

type Filtro = "todos" | "en_progreso" | "completados";
type NombreIcono = keyof typeof Ionicons.glyphMap;

interface ResumenUsuario {
  puntos: number;
  nivel: number;
  insignias: number;
}

const RESUMEN_VACIO: ResumenUsuario = { puntos: 0, nivel: 1, insignias: 0 };

const FILTROS: { clave: Filtro; etiqueta: string }[] = [
  { clave: "todos", etiqueta: "Todos" },
  { clave: "en_progreso", etiqueta: "En progreso" },
  { clave: "completados", etiqueta: "Completados" },
];

// Azul, terracota, morado y verde. Cada reto recibe siempre el mismo según su id.
const PALETA_RETOS = ["#3B6FA0", "#D2693C", "#7E57C2", "#2E8B57"];

function colorDeReto(id: number): string {
  return PALETA_RETOS[Math.abs(id) % PALETA_RETOS.length];
}

// 1250 -> "1,250" (sin depender de Intl, que no siempre está en Android)
function formatearPuntos(puntos: number): string {
  return String(puntos).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Colores propios de esta pantalla que el tema global no trae
function coloresExtra(esOscuro: boolean) {
  return esOscuro
    ? {
        fondoCompletado: "#16261B",
        bordeCompletado: "#24452E",
        verde: "#43B65F",
        fondoBarra: "#2C2C2C",
        fondoPildora: "#3A3016",
        textoPildora: "#F5C451",
        iconoPildora: "#F5C451",
        chipActivo: "#5B9BD5",
        acento: "#5B9BD5",
        error: "#EF5350",
      }
    : {
        fondoCompletado: "#EAF7EE",
        bordeCompletado: "#CDEBD6",
        verde: "#2E9E4F",
        fondoBarra: "#E9ECEF",
        fondoPildora: "#FFE08A",
        textoPildora: "#7A5200",
        iconoPildora: "#B7791F",
        chipActivo: "#3B6FA0",
        acento: "#3B6FA0",
        error: "#D32F2F",
      };
}

type ColoresExtra = ReturnType<typeof coloresExtra>;
type ColoresTema = ReturnType<typeof useTema>["colores"];

// ---------- Datos del resumen (puntos, nivel, insignias) ----------

async function obtenerResumenUsuario(usuarioId: string): Promise<ResumenUsuario> {
  const [respuestaProgreso, respuestaInsignias] = await Promise.all([
    supabase
      .from("progreso_usuario")
      .select("puntos, nivel")
      .eq("usuario_id", usuarioId)
      .maybeSingle(),
    supabase
      .from("usuario_insignias")
      .select("*", { count: "exact", head: true })
      .eq("usuario_id", usuarioId),
  ]);

  if (respuestaProgreso.error) throw respuestaProgreso.error;
  if (respuestaInsignias.error) throw respuestaInsignias.error;

  return {
    puntos: respuestaProgreso.data?.puntos ?? 0,
    nivel: respuestaProgreso.data?.nivel ?? 1,
    insignias: respuestaInsignias.count ?? 0,
  };
}

// ---------- Pantalla ----------

export default function RetosScreen() {
  const { colores, esOscuro } = useTema();
  const extras = coloresExtra(esOscuro);
  const insets = useSafeAreaInsets();

  const [retos, setRetos] = useState<RetoConProgreso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenUsuario>(RESUMEN_VACIO);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const cargarRetos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { data: sesion } = await supabase.auth.getUser();

      if (!sesion?.user) {
        setUsuarioId(null);
        setRetos([]);
        setResumen(RESUMEN_VACIO);
        setCargando(false);
        return;
      }

      setUsuarioId(sesion.user.id);

      // El resumen es secundario: si falla, la lista de retos se muestra igual.
      const [datos, resumenUsuario] = await Promise.all([
        obtenerRetosConProgreso(sesion.user.id),
        obtenerResumenUsuario(sesion.user.id).catch((e) => {
          console.warn("No se pudo cargar el resumen del usuario:", e);
          return RESUMEN_VACIO;
        }),
      ]);
      setRetos(datos);
      setResumen(resumenUsuario);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar retos");
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarRetos();
    }, [cargarRetos])
  );

  const retosFiltrados = useMemo(() => {
    if (filtro === "completados") return retos.filter((r) => r.completado);
    if (filtro === "en_progreso") return retos.filter((r) => !r.completado);
    return retos;
  }, [retos, filtro]);

  if (cargando && retos.length === 0) {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={extras.acento} />
      </View>
    );
  }

  // ---- Invitado / sin sesión (mismo patrón que perfil.tsx e insignias.tsx) ----
  if (!usuarioId) {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
        <Text style={[styles.tituloInvitado, { color: colores.texto }]}>
          Estás como invitado
        </Text>
        <Text style={[styles.textoInvitado, { color: colores.textoSecundario }]}>
          Inicia sesión para ver tus retos y tu progreso.
        </Text>
        <TouchableOpacity
          style={[styles.botonIniciarSesion, { backgroundColor: extras.acento }]}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.textoBotonIniciarSesion}>Iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
        <Text style={[styles.textoError, { color: extras.error }]}>
          No se pudieron cargar tus retos: {error}
        </Text>
      </View>
    );
  }

  const totalCompletados = retos.filter((r) => r.completado).length;
  const porcentajeGeneral =
    retos.length > 0 ? Math.round((totalCompletados / retos.length) * 100) : 0;

  const regresar = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const encabezadoLista = (
    <View>
      <LinearGradient
        colors={["#1a1a2e", "#5B9BD5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.encabezado, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity
          onPress={regresar}
          style={styles.botonRegresar}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Regresar"
        >
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.filaTitulo}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.titulo}>Retos Culturales</Text>
            <Text style={styles.subtitulo}>
              {totalCompletados} de {retos.length} retos completados
            </Text>
          </View>
          <AnilloProgreso porcentaje={porcentajeGeneral} />
        </View>

        <View style={styles.filaCapsulas}>
          <Capsula
            icono="star"
            colorIcono="#FFC83D"
            texto={`${formatearPuntos(resumen.puntos)} pts`}
          />
          <Capsula icono="stats-chart" colorIcono="#9CC7F0" texto={`Nivel ${resumen.nivel}`} />
          <Capsula
            icono="ribbon"
            colorIcono="#9CC7F0"
            texto={`${resumen.insignias} ${resumen.insignias === 1 ? "insignia" : "insignias"}`}
          />
        </View>
      </LinearGradient>

      <View style={styles.filaChips}>
        {FILTROS.map(({ clave, etiqueta }) => {
          const activo = filtro === clave;
          return (
            <TouchableOpacity
              key={clave}
              onPress={() => setFiltro(clave)}
              style={[
                styles.chip,
                activo
                  ? { backgroundColor: extras.chipActivo, borderColor: extras.chipActivo }
                  : { backgroundColor: colores.tarjeta, borderColor: colores.borde },
              ]}
              accessibilityState={{ selected: activo }}
            >
              <Text
                style={[styles.textoChip, { color: activo ? "#FFFFFF" : colores.texto }]}
              >
                {etiqueta}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const textoVacio =
    filtro === "completados"
      ? "Aún no has completado ningún reto. ¡Sigue explorando!"
      : filtro === "en_progreso"
        ? "¡Completaste todos los retos!"
        : "Todavía no hay retos disponibles.";

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <FlatList
        data={retosFiltrados}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={encabezadoLista}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={cargando}
            onRefresh={cargarRetos}
            tintColor={extras.acento}
            colors={[extras.acento]}
          />
        }
        ListEmptyComponent={
          <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>
            {textoVacio}
          </Text>
        }
        renderItem={({ item }) => (
          <TarjetaReto reto={item} colores={colores} extras={extras} />
        )}
      />
    </View>
  );
}

// ---------- Anillo de progreso con trofeo ----------

function AnilloProgreso({ porcentaje }: { porcentaje: number }) {
  const tamano = 92;
  const grosor = 8;
  const radio = (tamano - grosor) / 2;
  const centro = tamano / 2;
  const circunferencia = 2 * Math.PI * radio;
  const desplazamiento = circunferencia * (1 - Math.min(100, Math.max(0, porcentaje)) / 100);

  return (
    <View style={{ width: tamano, height: tamano }}>
      <Svg width={tamano} height={tamano}>
        <Circle
          cx={centro}
          cy={centro}
          r={radio}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={grosor}
          fill="rgba(26,26,46,0.55)"
        />
        <Circle
          cx={centro}
          cy={centro}
          r={radio}
          stroke="#64B5F6"
          strokeWidth={grosor}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circunferencia} ${circunferencia}`}
          strokeDashoffset={desplazamiento}
          rotation={-90}
          origin={`${centro}, ${centro}`}
        />
      </Svg>
      <View style={styles.contenidoAnillo}>
        <Ionicons name="trophy" size={28} color="#F5C451" />
        <Text style={styles.textoAnillo}>{porcentaje}%</Text>
      </View>
    </View>
  );
}

// ---------- Cápsula del encabezado ----------

function Capsula({
  icono,
  colorIcono,
  texto,
}: {
  icono: NombreIcono;
  colorIcono: string;
  texto: string;
}) {
  return (
    <View style={styles.capsula}>
      <Ionicons name={icono} size={16} color={colorIcono} />
      <Text style={styles.textoCapsula} numberOfLines={1}>
        {texto}
      </Text>
    </View>
  );
}

// ---------- Tarjeta de reto ----------

function TarjetaReto({
  reto,
  colores,
  extras,
}: {
  reto: RetoConProgreso;
  colores: ColoresTema;
  extras: ColoresExtra;
}) {
  const porcentaje =
    reto.progreso_total > 0
      ? Math.min(100, Math.round((reto.progreso_actual / reto.progreso_total) * 100))
      : 0;

  const colorReto = colorDeReto(reto.id);
  const sinIniciar = !reto.completado && reto.progreso_actual === 0;

  return (
    <View
      style={[
        styles.tarjeta,
        reto.completado
          ? { backgroundColor: extras.fondoCompletado, borderColor: extras.bordeCompletado }
          : { backgroundColor: colores.tarjeta, borderColor: colores.borde },
        sinIniciar && styles.tarjetaApagada,
      ]}
    >
      <View
        style={[
          styles.circuloIcono,
          { borderColor: colorReto, backgroundColor: `${colorReto}22` },
        ]}
      >
        <Text style={styles.icono}>{reto.icono ?? "🏆"}</Text>
      </View>

      <View style={styles.cuerpoTarjeta}>
        <Text style={[styles.nombre, { color: colores.texto }]}>{reto.nombre}</Text>
        {reto.descripcion ? (
          <Text style={[styles.descripcion, { color: colores.textoSecundario }]}>
            {reto.descripcion}
          </Text>
        ) : null}

        <View style={styles.filaProgreso}>
          <View style={[styles.progresoFondo, { backgroundColor: extras.fondoBarra }]}>
            <View
              style={[
                styles.progresoBarra,
                {
                  width: `${porcentaje}%`,
                  backgroundColor: reto.completado ? extras.verde : colorReto,
                },
              ]}
            />
          </View>
          <Text style={[styles.progresoTexto, { color: colores.textoSecundario }]}>
            {reto.progreso_actual} / {reto.progreso_total}
          </Text>
        </View>
      </View>

      <View style={styles.ladoDerecho}>
        {reto.completado ? (
          <>
            <View style={[styles.circuloCheck, { backgroundColor: extras.verde }]}>
              <Ionicons name="checkmark" size={24} color="#FFFFFF" />
            </View>
            <View style={[styles.sello, { backgroundColor: extras.verde }]}>
              <Text style={styles.textoSello}>Completado</Text>
            </View>
          </>
        ) : (
          <View style={[styles.pildora, { backgroundColor: extras.fondoPildora }]}>
            <Ionicons
              name={reto.recompensa_insignia_id ? "ribbon" : "star"}
              size={15}
              color={extras.iconoPildora}
            />
            <Text style={[styles.textoPildora, { color: extras.textoPildora }]}>
              +{reto.recompensa_puntos} pts
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ---------- Estilos ----------

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  tituloInvitado: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  textoInvitado: { fontSize: 14, textAlign: "center", marginBottom: 20 },
  botonIniciarSesion: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  textoBotonIniciarSesion: { color: "#fff", fontWeight: "600" },
  textoError: { textAlign: "center", paddingHorizontal: 24 },

  // Encabezado
  encabezado: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  botonRegresar: { alignSelf: "flex-start", marginLeft: -6, marginBottom: 6 },
  filaTitulo: { flexDirection: "row", alignItems: "center" },
  titulo: { fontSize: 28, fontWeight: "800", color: "#FFFFFF" },
  subtitulo: { fontSize: 14.5, color: "rgba(255,255,255,0.85)", marginTop: 6 },
  contenidoAnillo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  textoAnillo: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", marginTop: 2 },
  filaCapsulas: { flexDirection: "row", marginTop: 20, gap: 8 },
  capsula: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  textoCapsula: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", flexShrink: 1 },

  // Chips de filtro
  filaChips: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
  },
  textoChip: { fontSize: 13.5, fontWeight: "600" },

  // Lista y tarjetas
  lista: { paddingBottom: 24 },
  textoVacio: { textAlign: "center", marginTop: 32, paddingHorizontal: 32, fontSize: 14 },
  tarjeta: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tarjetaApagada: { opacity: 0.72 },
  circuloIcono: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  icono: { fontSize: 28 },
  cuerpoTarjeta: { flex: 1 },
  nombre: { fontSize: 16, fontWeight: "800" },
  descripcion: { fontSize: 12.5, marginTop: 3 },
  filaProgreso: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  progresoFondo: { flex: 1, height: 12, borderRadius: 6, overflow: "hidden" },
  progresoBarra: { height: 12, borderRadius: 6 },
  progresoTexto: { fontSize: 12.5, fontWeight: "700", marginLeft: 8, minWidth: 36 },
  ladoDerecho: { marginLeft: 10, alignItems: "center", justifyContent: "center" },
  circuloCheck: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sello: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  textoSello: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "700" },
  pildora: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
  },
  textoPildora: { fontSize: 12.5, fontWeight: "700" },
});