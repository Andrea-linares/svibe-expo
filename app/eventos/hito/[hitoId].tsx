import TarjetaEvento from "@/components/eventos/TarjetaEvento";
import { COLOR_ACENTO } from "@/constants/theme";
import { useTema } from "@/contexts/ThemeContext";
import { Evento, obtenerEventosVigentes } from "@/lib/eventos";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
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

/* ---------------------------------------------------------------------------
 * Eventos de un hito (usuarios)
 * Próximos eventos de un lugar y, al final, el texto general de eventos del
 * hito (hitos.eventos_info) como "Información general".
 * ------------------------------------------------------------------------- */

type HitoResumen = { nombre: string; eventos_info: string | null };

export default function EventosDeHitoScreen() {
  const { hitoId } = useLocalSearchParams<{ hitoId: string }>();
  const { colores } = useTema();
  const insets = useSafeAreaInsets();

  const [hito, setHito] = useState<HitoResumen | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!hitoId) return;
    try {
      setError(null);
      const [{ data: hitoData, error: errHito }, lista] = await Promise.all([
        supabase.from("hitos").select("nombre, eventos_info").eq("id", hitoId).maybeSingle(),
        obtenerEventosVigentes(hitoId),
      ]);
      if (errHito) throw errHito;
      setHito(hitoData);
      setEventos(lista);
    } catch (e: any) {
      console.error("Error cargando eventos del hito:", e);
      setError(e?.message ?? "Inténtalo de nuevo.");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [hitoId]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

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
      <View style={styles.bloqueTitulo}>
        <Text style={[styles.titulo, { color: colores.texto }]}>Eventos</Text>
        {hito && (
          <Text style={[styles.subtitulo, { color: colores.textoSecundario }]} numberOfLines={1}>
            {hito.nombre}
          </Text>
        )}
      </View>
      <View style={{ width: 26 }} />
    </View>
  );

  if (cargando || error) {
    return (
      <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
        {encabezado}
        <View style={styles.centrado}>
          {cargando ? (
            <ActivityIndicator size="large" color={COLOR_ACENTO} />
          ) : (
            <>
              <Ionicons name="alert-circle-outline" size={64} color={COLOR_ACENTO} />
              <Text style={[styles.tituloVacio, { color: colores.texto }]}>
                No pudimos cargar los eventos
              </Text>
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
            </>
          )}
        </View>
      </View>
    );
  }

  const infoGeneral = hito?.eventos_info?.trim();

  return (
    <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
      {encabezado}

      <FlatList
        data={eventos}
        keyExtractor={(item) => item.id}
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
        ListHeaderComponent={
          <Text style={[styles.tituloSeccion, { color: colores.texto }]}>Próximos eventos</Text>
        }
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Ionicons name="calendar-outline" size={48} color={COLOR_ACENTO} />
            <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>
              No hay eventos próximos en este lugar.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TarjetaEvento
            evento={item}
            mostrarLugar={false}
            onPress={() => router.push(`/eventos/${item.id}`)}
          />
        )}
        ListFooterComponent={
          infoGeneral ? (
            <View style={[styles.tarjetaInfo, { backgroundColor: colores.tarjeta }]}>
              <View style={styles.filaInfo}>
                <Ionicons name="information-circle-outline" size={20} color={COLOR_ACENTO} />
                <Text style={[styles.tituloInfo, { color: colores.texto }]}>Información general</Text>
              </View>
              <Text style={[styles.textoInfo, { color: colores.textoSecundario }]}>{infoGeneral}</Text>
            </View>
          ) : null
        }
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
  bloqueTitulo: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  titulo: { fontSize: 18, fontWeight: "bold" },
  subtitulo: { fontSize: 12, marginTop: 2 },
  tituloSeccion: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  vacio: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 16 },
  tarjetaInfo: {
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  filaInfo: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  tituloInfo: { fontSize: 15, fontWeight: "bold" },
  textoInfo: { fontSize: 14, lineHeight: 21 },
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
