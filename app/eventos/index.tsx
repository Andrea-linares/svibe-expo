import CalendarioMensual from "@/components/eventos/CalendarioMensual";
import TarjetaEvento from "@/components/eventos/TarjetaEvento";
import { COLOR_ACENTO } from "@/constants/theme";
import { useTema } from "@/contexts/ThemeContext";
import { Evento, infoTipo, obtenerEventosVigentes, TIPOS_EVENTO } from "@/lib/eventos";
import { formatearDiaMes, hoyLocal } from "@/lib/fechas";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ---------------------------------------------------------------------------
 * Calendario de eventos (usuarios)
 * Mes con puntos en los días con eventos y, debajo, los eventos próximos de
 * todos los hitos. Tocar un día filtra la lista; tocarlo otra vez la restaura.
 * ------------------------------------------------------------------------- */

export default function CalendarioEventosScreen() {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setEventos(await obtenerEventosVigentes());
    } catch (e: any) {
      console.error("Error cargando eventos:", e);
      setError(e?.message ?? "Inténtalo de nuevo.");
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

  // Un punto por tipo distinto en cada día
  const marcas = useMemo(() => {
    const resultado: Record<string, string[]> = {};
    eventos.forEach((e) => {
      const color = infoTipo(e.tipo).color;
      const lista = (resultado[e.fecha] ??= []);
      if (!lista.includes(color)) lista.push(color);
    });
    return resultado;
  }, [eventos]);

  const lista = diaSeleccionado
    ? eventos.filter((e) => e.fecha === diaSeleccionado)
    : eventos;

  function seleccionarDia(fecha: string) {
    setDiaSeleccionado((actual) => (actual === fecha ? null : fecha));
  }

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
      <Text style={[styles.titulo, { color: colores.texto }]}>Calendario de eventos</Text>
      <View style={{ width: 26 }} />
    </View>
  );

  if (cargando) {
    return (
      <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
        {encabezado}
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={COLOR_ACENTO} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
        {encabezado}
        <View style={styles.centrado}>
          <Ionicons name="alert-circle-outline" size={64} color={COLOR_ACENTO} />
          <Text style={[styles.tituloVacio, { color: colores.texto }]}>No pudimos cargar los eventos</Text>
          <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>{error}</Text>
          <TouchableOpacity
            style={styles.botonPrimario}
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

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              cargar();
            }}
          />
        }
      >
        <Text style={[styles.subtitulo, { color: colores.textoSecundario }]}>
          Descubre los próximos eventos culturales, religiosos y artísticos en El Salvador.
        </Text>

        <View style={[styles.tarjetaCalendario, { backgroundColor: colores.tarjeta }]}>
          <CalendarioMensual
            seleccionado={diaSeleccionado}
            onSeleccionar={seleccionarDia}
            marcas={marcas}
            fechaMinima={hoyLocal()}
          />

          {/* Leyenda de tipos */}
          <View style={styles.leyenda}>
            {TIPOS_EVENTO.map((t) => (
              <View key={t.valor} style={styles.itemLeyenda}>
                <View style={[styles.puntoLeyenda, { backgroundColor: t.color }]} />
                <Text style={[styles.textoLeyenda, { color: colores.textoSecundario }]}>
                  {t.etiqueta}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.encabezadoLista}>
          <Text style={[styles.tituloSeccion, { color: colores.texto }]}>
            {diaSeleccionado ? `Eventos del ${formatearDiaMes(diaSeleccionado)}` : "Eventos próximos"}
          </Text>
          {diaSeleccionado && (
            <TouchableOpacity onPress={() => setDiaSeleccionado(null)}>
              <Text style={styles.verTodos}>Ver todos</Text>
            </TouchableOpacity>
          )}
        </View>

        {lista.length === 0 ? (
          <View style={styles.vacio}>
            <Ionicons name="calendar-outline" size={48} color={COLOR_ACENTO} />
            <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>
              {diaSeleccionado
                ? "No hay eventos este día."
                : "Por ahora no hay eventos próximos. ¡Vuelve pronto!"}
            </Text>
          </View>
        ) : (
          lista.map((evento) => (
            <TarjetaEvento
              key={evento.id}
              evento={evento}
              onPress={() => router.push(`/eventos/${evento.id}`)}
            />
          ))
        )}
      </ScrollView>
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
  subtitulo: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  tarjetaCalendario: {
    borderRadius: 18,
    padding: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  leyenda: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
    marginTop: 10,
  },
  itemLeyenda: { flexDirection: "row", alignItems: "center", gap: 5 },
  puntoLeyenda: { width: 8, height: 8, borderRadius: 4 },
  textoLeyenda: { fontSize: 12 },
  encabezadoLista: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 12,
  },
  tituloSeccion: { fontSize: 18, fontWeight: "bold" },
  verTodos: { color: COLOR_ACENTO, fontWeight: "600" },
  vacio: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 16 },
  tituloVacio: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginTop: 16 },
  textoVacio: { fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 },
  botonPrimario: {
    marginTop: 20,
    backgroundColor: COLOR_ACENTO,
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonPrimario: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
