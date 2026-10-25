import StatCard from "@/components/admin/StatCard";
import { ESPACIADO_PANEL, useTema } from "@/contexts/ThemeContext";
import { hoyLocal, MESES } from "@/lib/fechas";
import { contarHitosRA } from "@/lib/ra-servicio";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type Colores = ReturnType<typeof useTema>["colores"];

// "20 de octubre de 2026" con la fecha actual del dispositivo
function fechaDeHoy() {
  const hoy = new Date();
  return `${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;
}

export default function AdminDashboardScreen() {
  const { colores, esOscuro, alternarTema } = useTema();
  const insets = useSafeAreaInsets();
  const [cargando, setCargando] = useState(true);
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [totalHitos, setTotalHitos] = useState(0);
  const [totalReportes, setTotalReportes] = useState(0);
  const [totalEventos, setTotalEventos] = useState(0);
  const [totalForo, setTotalForo] = useState(0);
  const [totalRA, setTotalRA] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function cargar() {
        const [usuarios, hitos, reportes, eventos, resenas, comentarios, hitosRA] =
          await Promise.all([
          supabase.from("perfiles").select("*", { count: "exact", head: true }),
          supabase.from("hitos").select("*", { count: "exact", head: true }),
          supabase
            .from("reportes_problemas")
            .select("*", { count: "exact", head: true }),
          // Eventos próximos = activos: publicados y con fecha de hoy o futura
          supabase
            .from("eventos")
            .select("*", { count: "exact", head: true })
            .eq("publicado", true)
            .gte("fecha", hoyLocal()),
          // Publicaciones del foro = reseñas + comentarios (igual que la pestaña Foro)
          supabase.from("foro_posts").select("*", { count: "exact", head: true }),
          supabase
            .from("foro_comentarios")
            .select("*", { count: "exact", head: true }),
          // Hitos con RA = ar_activo verdadero
          contarHitosRA(),
        ]);

        setTotalUsuarios(usuarios.count ?? 0);
        setTotalHitos(hitos.count ?? 0);
        setTotalReportes(reportes.count ?? 0);
        setTotalEventos(eventos.count ?? 0);
        setTotalForo((resenas.count ?? 0) + (comentarios.count ?? 0));
        setTotalRA(hitosRA.count ?? 0);
        setCargando(false);
      }
      cargar();
    }, []),
  );

  async function cerrarSesion() {
    setMenuVisible(false);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (cargando) {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.panelFondo }]}>
        <ActivityIndicator size="large" color={colores.panelAzul} />
      </View>
    );
  }

  // TODO: reemplazar por datos reales cuando exista una fuente de actividad reciente.
  // Datos de ejemplo (mock), sin lógica de backend.
  const actividadReciente = [
    {
      icono: "alert" as const,
      color: colores.panelRosa,
      titulo: "Nuevos reportes",
      descripcion: "Hay 5 reportes que requieren revisión.",
      tiempo: "Hace 2 h",
      ruta: "/admin/reportes" as const,
    },
    {
      icono: "location" as const,
      color: colores.panelDorado,
      titulo: "Hito cultural registrado",
      descripcion: "Se agregó un nuevo hito en la categoría 'Museos'.",
      tiempo: "Hace 4 h",
      ruta: "/admin/hitos" as const,
    },
    {
      icono: "people" as const,
      color: colores.panelAzul,
      titulo: "Nuevo usuario registrado",
      descripcion: "Se unió un nuevo usuario a la plataforma.",
      tiempo: "Hace 6 h",
      ruta: "/admin/usuarios" as const,
    },
  ];

  const estiloTarjeta = {
    backgroundColor: colores.panelTarjeta,
    borderColor: colores.panelBorde,
    shadowColor: colores.panelSombra,
    shadowOpacity: colores.panelSombraOpacidad,
    elevation: esOscuro ? 0 : 2,
  };

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.panelFondo }]}>
      <Ilustracion colores={colores} top={insets.top + 8} />

      <ScrollView
        contentContainerStyle={[
          styles.cuerpo,
          { paddingTop: insets.top + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Encabezado */}
        <View style={styles.filaEncabezado}>
          <View style={styles.columnaEncabezado}>
            <Text style={[styles.logo, { color: colores.panelTexto }]}>
              SVibe
            </Text>
            <View
              style={[styles.subrayadoLogo, { backgroundColor: colores.panelAzul }]}
            />
            <Text style={[styles.etiquetaPanel, { color: colores.panelAzul }]}>
              Panel de administración
            </Text>
          </View>

          <TouchableOpacity
            style={styles.botonEscudo}
            onPress={() => setMenuVisible(true)}
            accessibilityLabel="Opciones de administrador"
          >
            <View
              style={[
                styles.circuloEscudo,
                {
                  backgroundColor: colores.panelAzulDegradado,
                  borderColor: colores.panelAzul,
                },
              ]}
            >
              <Ionicons name="shield" size={22} color="#fff" />
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colores.panelTextoSecundario}
            />
          </TouchableOpacity>
        </View>

        <Text style={[styles.saludo, { color: colores.panelTexto }]}>
          ¡Hola, Admin!
        </Text>
        <Text style={[styles.subtitulo, { color: colores.panelTextoSecundario }]}>
          Aquí tienes un resumen general de la app.
        </Text>
        <View style={styles.filaFecha}>
          <Ionicons
            name="calendar-outline"
            size={15}
            color={colores.panelTextoSecundario}
          />
          <Text style={[styles.fecha, { color: colores.panelTextoSecundario }]}>
            {fechaDeHoy()}
          </Text>
        </View>

        {/* Estadísticas */}
        <View style={styles.grid}>
          <StatCard
            icono="people"
            colorAcento={colores.panelAzul}
            numero={totalUsuarios}
            etiqueta="Usuarios totales"
            colores={colores}
            estiloTarjeta={estiloTarjeta}
            onPress={() => router.push("/admin/usuarios")}
          />
          <StatCard
            icono="library"
            colorAcento={colores.panelDorado}
            numero={totalHitos}
            etiqueta="Hitos culturales"
            colores={colores}
            estiloTarjeta={estiloTarjeta}
            onPress={() => router.push("/admin/hitos")}
          />
          <StatCard
            icono="alert"
            colorAcento={colores.panelRosa}
            numero={totalReportes}
            etiqueta="Reportes pendientes"
            colores={colores}
            estiloTarjeta={estiloTarjeta}
            onPress={() => router.push("/admin/reportes")}
          />
          <StatCard
            icono="calendar"
            colorAcento={colores.panelAzul}
            numero={totalEventos}
            etiqueta="Eventos próximos"
            colores={colores}
            estiloTarjeta={estiloTarjeta}
            onPress={() => router.push("/admin/eventos")}
          />
          <StatCard
            icono="chatbubbles"
            colorAcento={colores.panelMorado}
            numero={totalForo}
            etiqueta="Publicaciones del foro"
            colores={colores}
            estiloTarjeta={estiloTarjeta}
            onPress={() => router.push("/admin/foro")}
          />
          <StatCard
            icono="scan"
            colorAcento={colores.acentoRA}
            numero={totalRA}
            etiqueta="Hitos con RA"
            colores={colores}
            estiloTarjeta={estiloTarjeta}
            onPress={() => router.push("/admin/ra")}
          />
        </View>

        {/* Actividad reciente */}
        <View style={styles.encabezadoSeccion}>
          <View style={styles.tituloSeccion}>
            <Ionicons name="time-outline" size={20} color={colores.panelAzul} />
            <Text style={[styles.textoSeccion, { color: colores.panelTexto }]}>
              Actividad reciente
            </Text>
          </View>
          {/* TODO: conectar "Ver todo" cuando exista una pantalla de actividad */}
          <TouchableOpacity style={styles.verTodo}>
            <Text style={[styles.textoVerTodo, { color: colores.panelAzul }]}>
              Ver todo
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colores.panelAzul} />
          </TouchableOpacity>
        </View>

        <View style={[styles.tarjetaLista, estiloTarjeta]}>
          {actividadReciente.map((item, indice) => (
            <TouchableOpacity
              key={item.titulo}
              style={[
                styles.filaActividad,
                indice > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colores.panelBorde,
                },
              ]}
              onPress={() => router.push(item.ruta)}
            >
              <View
                style={[
                  styles.circuloIcono,
                  { backgroundColor: item.color },
                ]}
              >
                <Ionicons name={item.icono} size={18} color="#fff" />
              </View>
              <View style={styles.textosFila}>
                <Text
                  style={[styles.tituloFila, { color: colores.panelTexto }]}
                  numberOfLines={1}
                >
                  {item.titulo}
                </Text>
                <Text
                  style={[
                    styles.descripcionFila,
                    { color: colores.panelTextoSecundario },
                  ]}
                  numberOfLines={2}
                >
                  {item.descripcion}
                </Text>
              </View>
              <Text
                style={[styles.tiempo, { color: colores.panelTextoSecundario }]}
              >
                {item.tiempo}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colores.panelTextoSecundario}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Ver como usuario */}
        <TouchableOpacity
          style={[styles.tarjetaLista, styles.filaActividad, estiloTarjeta]}
          onPress={() => router.push("/(tabs)/home")}
        >
          <View
            style={[
              styles.circuloIcono,
              { backgroundColor: colores.panelIconoNeutro },
            ]}
          >
            <Ionicons
              name="eye-outline"
              size={20}
              color={colores.panelTexto}
            />
          </View>
          <View style={styles.textosFila}>
            <Text style={[styles.tituloFila, { color: colores.panelTexto }]}>
              Ver como usuario
            </Text>
            <Text
              style={[
                styles.descripcionFila,
                { color: colores.panelTextoSecundario },
              ]}
            >
              Explora la app como un usuario regular.
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colores.panelTextoSecundario}
          />
        </TouchableOpacity>
      </ScrollView>

      {/* Menú del escudo: tema y cerrar sesión */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.fondoMenu}
          onPress={() => setMenuVisible(false)}
        >
          <View
            style={[
              styles.menu,
              estiloTarjeta,
              { top: insets.top + 64, borderWidth: 1 },
            ]}
          >
            <TouchableOpacity
              style={styles.opcionMenu}
              onPress={() => {
                alternarTema();
                setMenuVisible(false);
              }}
            >
              <Ionicons
                name={esOscuro ? "sunny-outline" : "moon-outline"}
                size={18}
                color={colores.panelTexto}
              />
              <Text style={[styles.textoOpcion, { color: colores.panelTexto }]}>
                {esOscuro ? "Modo claro" : "Modo oscuro"}
              </Text>
            </TouchableOpacity>
            <View
              style={[styles.separadorMenu, { backgroundColor: colores.panelBorde }]}
            />
            <TouchableOpacity style={styles.opcionMenu} onPress={cerrarSesion}>
              <Ionicons name="log-out-outline" size={18} color={colores.panelRosa} />
              <Text style={[styles.textoOpcion, { color: colores.panelRosa }]}>
                Cerrar sesión
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// Silueta decorativa: montañas y edificio histórico con torre de reloj
function Ilustracion({ colores, top }: { colores: Colores; top: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.ilustracion,
        { top, opacity: colores.panelIlustracionOpacidad },
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 240 180">
        {/* Nube */}
        <Path
          d="M40 40 A10 10 0 0 1 58 32 A14 14 0 0 1 84 34 A9 9 0 0 1 96 46 L40 46 Z"
          fill={colores.panelIlustracion}
        />
        <Path
          d="M0 180 L45 110 L75 140 L125 70 L165 120 L200 85 L240 125 L240 180 Z"
          fill={colores.panelIlustracion}
        />
        {/* Cuerpo del edificio */}
        <Rect x="105" y="120" width="110" height="60" fill={colores.panelIlustracion} />
        <Path d="M100 122 L160 98 L220 122 Z" fill={colores.panelIlustracion} />
        {/* Torre del reloj */}
        <Rect x="146" y="45" width="28" height="80" fill={colores.panelIlustracion} />
        <Path d="M142 47 L160 18 L178 47 Z" fill={colores.panelIlustracion} />
        <Circle cx="160" cy="66" r="8" fill={colores.panelFondo} />
        <Path
          d="M160 60 L160 66 L164 69"
          stroke={colores.panelIlustracion}
          strokeWidth="1.6"
          fill="none"
        />
        {/* Arcos */}
        <Path
          d="M118 180 L118 150 A7 7 0 0 1 132 150 L132 180 Z M188 180 L188 150 A7 7 0 0 1 202 150 L202 180 Z M153 180 L153 146 A7 7 0 0 1 167 146 L167 180 Z"
          fill={colores.panelFondo}
        />
      </Svg>
    </View>
  );
}

const E = ESPACIADO_PANEL;

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  ilustracion: {
    position: "absolute",
    right: 0,
    width: "46%",
    aspectRatio: 240 / 180,
  },
  cuerpo: { paddingHorizontal: E.margen, paddingBottom: 30 },
  filaEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  columnaEncabezado: { flex: 1 },
  logo: { fontSize: 32, fontWeight: "800", fontStyle: "italic" },
  subrayadoLogo: { width: 72, height: 2, borderRadius: 1, marginTop: -2 },
  etiquetaPanel: { fontSize: 15, fontWeight: "500", marginTop: 8 },
  botonEscudo: { flexDirection: "row", alignItems: "center", gap: 4 },
  circuloEscudo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  saludo: { fontSize: 30, fontWeight: "800", marginTop: 6 },
  subtitulo: { fontSize: 15, marginTop: 4 },
  filaFecha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  fecha: { fontSize: 13 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: E.separacion,
    marginTop: 22,
  },
  circuloIcono: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  encabezadoSeccion: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 26,
    marginBottom: E.separacion,
  },
  tituloSeccion: { flexDirection: "row", alignItems: "center", gap: 8 },
  textoSeccion: { fontSize: 17, fontWeight: "bold" },
  verTodo: { flexDirection: "row", alignItems: "center", gap: 2 },
  textoVerTodo: { fontSize: 13, fontWeight: "600" },
  tarjetaLista: {
    borderRadius: E.radioTarjeta,
    borderWidth: 1,
    marginBottom: E.separacion + 4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  filaActividad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  textosFila: { flex: 1 },
  tituloFila: { fontSize: 14.5, fontWeight: "600" },
  descripcionFila: { fontSize: 12.5, marginTop: 2 },
  tiempo: { fontSize: 11.5 },
  fondoMenu: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  menu: {
    position: "absolute",
    right: E.margen,
    minWidth: 200,
    borderRadius: E.radioTarjeta,
    paddingVertical: 6,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
  },
  opcionMenu: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textoOpcion: { fontSize: 15, fontWeight: "600" },
  separadorMenu: { height: StyleSheet.hairlineWidth, marginHorizontal: 12 },
});
