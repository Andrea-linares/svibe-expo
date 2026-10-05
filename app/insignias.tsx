// app/insignias.tsx
//
// Pantalla de Logros — Escenario 1 de HU-025:
// "el usuario ve sus insignias obtenidas y las que le faltan".
import { useTema } from "@/contexts/ThemeContext";
import { InsigniaConEstado, useInsignias } from "@/hooks/use-insignias";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo, useState } from "react";
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

type Filtro = "todas" | "obtenidas" | "bloqueadas";

const FILTROS: { clave: Filtro; etiqueta: string }[] = [
  { clave: "todas", etiqueta: "Todas" },
  { clave: "obtenidas", etiqueta: "Obtenidas" },
  { clave: "bloqueadas", etiqueta: "Bloqueadas" },
];

// Misma paleta que retos.tsx: azul, terracota, morado y verde.
const PALETA_INSIGNIAS = ["#3B6FA0", "#D2693C", "#7E57C2", "#2E8B57"];

// Color estable por insignia. Acepta id numérico o de texto.
function colorDeInsignia(id: number | string): string {
  let indice: number;
  if (typeof id === "number") {
    indice = Math.abs(id);
  } else {
    indice = 0;
    for (let i = 0; i < id.length; i++) indice = (indice * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETA_INSIGNIAS[indice % PALETA_INSIGNIAS.length];
}

// Colores propios de esta pantalla que el tema global no trae
function coloresExtra(esOscuro: boolean) {
  return esOscuro
    ? {
        verde: "#43B65F",
        gris: "#6B6B6B",
        fondoGris: "#2A2A2A",
        textoBloqueada: "#CFCFCF",
        chipActivo: "#5B9BD5",
        acento: "#5B9BD5",
        error: "#EF5350",
      }
    : {
        verde: "#2E9E4F",
        gris: "#8A8F98",
        fondoGris: "#E4E6EA",
        textoBloqueada: "#FFFFFF",
        chipActivo: "#3B6FA0",
        acento: "#3B6FA0",
        error: "#D32F2F",
      };
}

type ColoresExtra = ReturnType<typeof coloresExtra>;
type ColoresTema = ReturnType<typeof useTema>["colores"];

// ---------- Pantalla ----------

export default function LogrosScreen() {
  const { insignias, cargando, error, usuarioId, recargar } = useInsignias();
  const { colores, esOscuro } = useTema();
  const extras = coloresExtra(esOscuro);
  const insets = useSafeAreaInsets();
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const insigniasFiltradas = useMemo(() => {
    if (filtro === "obtenidas") return insignias.filter((i) => i.desbloqueada);
    if (filtro === "bloqueadas") return insignias.filter((i) => !i.desbloqueada);
    return insignias;
  }, [insignias, filtro]);

  if (cargando && insignias.length === 0) {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={extras.acento} />
      </View>
    );
  }

  // ---- Invitado / sin sesión (mismo patrón que perfil.tsx) ----
  if (!usuarioId) {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
        <Text style={[styles.tituloInvitado, { color: colores.texto }]}>
          Estás como invitado
        </Text>
        <Text style={[styles.textoInvitado, { color: colores.textoSecundario }]}>
          Inicia sesión para ver tus insignias y tu progreso.
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
          No se pudieron cargar tus logros: {error}
        </Text>
      </View>
    );
  }

  const totalObtenidas = insignias.filter((i) => i.desbloqueada).length;
  const porcentajeGeneral =
    insignias.length > 0 ? Math.round((totalObtenidas / insignias.length) * 100) : 0;

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
          <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.filaTitulo}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.titulo}>Mis Logros</Text>
            <Text style={styles.subtitulo}>
              {totalObtenidas} de {insignias.length} insignias obtenidas
            </Text>
          </View>
          <AnilloProgreso porcentaje={porcentajeGeneral} />
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
    filtro === "obtenidas"
      ? "Aún no has obtenido insignias. ¡Visita hitos para ganarlas!"
      : filtro === "bloqueadas"
        ? "¡Desbloqueaste todas las insignias!"
        : "Todavía no hay insignias disponibles.";

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <FlatList
        data={insigniasFiltradas}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        ListHeaderComponent={encabezadoLista}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={cargando}
            onRefresh={recargar}
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
          <View style={styles.celda}>
            <TarjetaInsignia insignia={item} colores={colores} extras={extras} />
          </View>
        )}
      />
    </View>
  );
}

// ---------- Anillo de progreso con medalla ----------

function AnilloProgreso({ porcentaje }: { porcentaje: number }) {
  const tamano = 92;
  const grosor = 8;
  const radio = (tamano - grosor) / 2;
  const centro = tamano / 2;
  const circunferencia = 2 * Math.PI * radio;
  const desplazamiento =
    circunferencia * (1 - Math.min(100, Math.max(0, porcentaje)) / 100);

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
        <Ionicons name="medal" size={28} color="#F5C451" />
        <Text style={styles.textoAnillo}>{porcentaje}%</Text>
      </View>
    </View>
  );
}

// ---------- Tarjeta de insignia ----------

function TarjetaInsignia({
  insignia,
  colores,
  extras,
}: {
  insignia: InsigniaConEstado;
  colores: ColoresTema;
  extras: ColoresExtra;
}) {
  const desbloqueada = insignia.desbloqueada;
  const colorInsignia = desbloqueada ? colorDeInsignia(insignia.id) : extras.gris;

  return (
    <View
      style={[
        styles.tarjeta,
        { backgroundColor: colores.tarjeta, borderColor: colores.borde },
      ]}
    >
      <View style={styles.contenedorCirculo}>
        <View
          style={[
            styles.circuloIcono,
            {
              borderColor: colorInsignia,
              backgroundColor: desbloqueada ? `${colorInsignia}22` : extras.fondoGris,
            },
          ]}
        >
          <Text style={[styles.icono, !desbloqueada && styles.iconoBloqueado]}>
            {insignia.icono ?? "🏅"}
          </Text>
        </View>

        {/* Distintivo de la esquina: check si está obtenida, candado si no */}
        <View
          style={[
            styles.distintivo,
            {
              backgroundColor: desbloqueada ? extras.verde : extras.gris,
              borderColor: colores.tarjeta,
            },
          ]}
        >
          <Ionicons
            name={desbloqueada ? "checkmark" : "lock-closed"}
            size={desbloqueada ? 16 : 13}
            color="#FFFFFF"
          />
        </View>

        {!desbloqueada && (
          <View style={[styles.etiquetaBloqueada, { backgroundColor: extras.gris }]}>
            <Text style={[styles.textoEtiquetaBloqueada, { color: extras.textoBloqueada }]}>
              BLOQUEADA
            </Text>
          </View>
        )}
      </View>

      <Text
        style={[
          styles.nombre,
          { color: desbloqueada ? colores.texto : colores.textoSecundario },
        ]}
      >
        {insignia.nombre}
      </Text>
      <Text
        style={[styles.descripcion, { color: colores.textoSecundario }]}
        numberOfLines={3}
      >
        {desbloqueada ? insignia.descripcion : insignia.requisito}
      </Text>
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
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  botonRegresar: { alignSelf: "flex-start", marginBottom: 8 },
  filaTitulo: { flexDirection: "row", alignItems: "center" },
  titulo: { fontSize: 30, fontWeight: "800", color: "#FFFFFF" },
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

  // Chips de filtro
  filaChips: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
  },
  textoChip: { fontSize: 13.5, fontWeight: "600" },

  // Cuadrícula
  lista: { paddingBottom: 24 },
  textoVacio: { textAlign: "center", marginTop: 32, paddingHorizontal: 32, fontSize: 14 },
  // Cada celda ocupa media fila, así una insignia sola no se estira a todo el ancho
  celda: { width: "50%", paddingHorizontal: 6, paddingVertical: 6 },
  tarjeta: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  contenedorCirculo: {
    width: 92,
    height: 92,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  circuloIcono: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  icono: { fontSize: 40 },
  iconoBloqueado: { opacity: 0.35 },
  distintivo: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  etiquetaBloqueada: {
    position: "absolute",
    bottom: -6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  textoEtiquetaBloqueada: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  nombre: { fontSize: 15.5, fontWeight: "800", textAlign: "center" },
  descripcion: { fontSize: 12.5, textAlign: "center", marginTop: 4 },
});