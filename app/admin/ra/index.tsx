import SoloAdmin from "@/components/admin/SoloAdmin";
import { ESPACIADO_PANEL, useTema } from "@/contexts/ThemeContext";
import { useMargenSuperior } from "@/hooks/use-margen-superior";
import { avisar } from "@/lib/confirmar";
import { alternarArActivo, cargarHitosRA, HitoRAResumen } from "@/lib/ra-servicio";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Colores = ReturnType<typeof useTema>["colores"];

export default function ListaRAScreen() {
  return (
    <SoloAdmin>
      <ListaRA />
    </SoloAdmin>
  );
}

function ListaRA() {
  const { colores, esOscuro } = useTema();
  const margenSuperior = useMargenSuperior(50);
  const insets = useSafeAreaInsets();
  const [hitos, setHitos] = useState<HitoRAResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [soloSinAntes, setSoloSinAntes] = useState(false);
  // Hitos con un cambio de interruptor en curso
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    try {
      setHitos(await cargarHitosRA());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  // Recarga al volver del editor
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return hitos.filter(
      (h) =>
        (!soloSinAntes || !h.tieneAntes) &&
        (!texto || h.nombre.toLowerCase().includes(texto)),
    );
  }, [hitos, busqueda, soloSinAntes]);

  function marcarPendiente(id: string, pendiente: boolean) {
    setPendientes((actual) => {
      const nuevo = new Set(actual);
      if (pendiente) nuevo.add(id);
      else nuevo.delete(id);
      return nuevo;
    });
  }

  // Actualización inmediata en pantalla; si la BD falla, se revierte
  async function alternar(hito: HitoRAResumen, activo: boolean) {
    const ponerValor = (valor: boolean) =>
      setHitos((actual) =>
        actual.map((h) => (h.id === hito.id ? { ...h, ar_activo: valor } : h)),
      );
    ponerValor(activo);
    marcarPendiente(hito.id, true);
    try {
      await alternarArActivo(hito.id, activo);
    } catch (e) {
      ponerValor(!activo);
      avisar(
        "No se pudo cambiar",
        `No se pudo ${activo ? "activar" : "desactivar"} la RA de "${hito.nombre}". ${
          e instanceof Error ? e.message : ""
        }`,
      );
    } finally {
      marcarPendiente(hito.id, false);
    }
  }

  const estiloTarjeta = {
    backgroundColor: colores.panelTarjeta,
    borderColor: colores.panelBorde,
    shadowColor: colores.panelSombra,
    shadowOpacity: colores.panelSombraOpacidad,
    elevation: esOscuro ? 0 : 2,
  };

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.panelFondo }]}>
      <View style={[styles.encabezado, { paddingTop: margenSuperior }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.botonVolver}
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={22} color={colores.panelTexto} />
        </TouchableOpacity>
        <Text style={[styles.titulo, { color: colores.panelTexto }]}>Hitos con RA</Text>
      </View>

      <View style={styles.filaFiltros}>
        <View
          style={[
            styles.buscador,
            { backgroundColor: colores.panelTarjeta, borderColor: colores.panelBorde },
          ]}
        >
          <Ionicons name="search" size={18} color={colores.panelTextoSecundario} />
          <TextInput
            style={[styles.inputBuscador, { color: colores.panelTexto }]}
            placeholder="Buscar hito..."
            placeholderTextColor={colores.panelTextoSecundario}
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.filtro,
            {
              borderColor: soloSinAntes ? colores.acentoRA : colores.panelBorde,
              backgroundColor: soloSinAntes ? colores.acentoRA : colores.panelTarjeta,
            },
          ]}
          onPress={() => setSoloSinAntes((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ selected: soloSinAntes }}
        >
          <Ionicons
            name="image-outline"
            size={16}
            color={soloSinAntes ? "#fff" : colores.panelTextoSecundario}
          />
          <Text
            style={[
              styles.textoFiltro,
              { color: soloSinAntes ? "#fff" : colores.panelTexto },
            ]}
          >
            Sin foto antes
          </Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colores.acentoRA} />
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={(h) => h.id}
          contentContainerStyle={{
            paddingHorizontal: ESPACIADO_PANEL.margen,
            paddingBottom: insets.bottom + 24,
            gap: ESPACIADO_PANEL.separacion,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true);
                cargar();
              }}
              tintColor={colores.acentoRA}
            />
          }
          renderItem={({ item }) => (
            <FilaHito
              hito={item}
              colores={colores}
              estiloTarjeta={estiloTarjeta}
              pendiente={pendientes.has(item.id)}
              onAlternar={(v) => alternar(item, v)}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.vacio, { color: colores.panelTextoSecundario }]}>
              {error ? `No se pudo cargar la lista. ${error}` : "No se encontraron hitos."}
            </Text>
          }
        />
      )}
    </View>
  );
}

function FilaHito({
  hito,
  colores,
  estiloTarjeta,
  pendiente,
  onAlternar,
}: {
  hito: HitoRAResumen;
  colores: Colores;
  estiloTarjeta: object;
  pendiente: boolean;
  onAlternar: (activo: boolean) => void;
}) {
  const colorEstadoRA = hito.ar_activo ? colores.acentoRA : colores.panelTextoSecundario;

  return (
    <TouchableOpacity
      style={[styles.fila, estiloTarjeta]}
      onPress={() => router.push(`/admin/ra/${hito.id}`)}
      accessibilityLabel={`Editar RA de ${hito.nombre}`}
    >
      {hito.miniatura ? (
        <Image source={{ uri: hito.miniatura }} style={styles.miniatura} contentFit="cover" />
      ) : (
        <View style={[styles.miniatura, styles.sinMiniatura, { backgroundColor: colores.panelIconoNeutro }]}>
          <Ionicons name="image-outline" size={22} color={colores.panelTextoSecundario} />
        </View>
      )}

      <View style={styles.textos}>
        <Text style={[styles.nombre, { color: colores.panelTexto }]} numberOfLines={1}>
          {hito.nombre}
        </Text>
        <View style={styles.filaDato}>
          <View style={[styles.punto, { backgroundColor: colorEstadoRA }]} />
          <Text style={[styles.dato, { color: colorEstadoRA }]}>
            {hito.ar_activo ? "RA activa" : "RA desactivada"}
          </Text>
        </View>
        <View style={styles.filaDato}>
          <View
            style={[
              styles.insignia,
              { borderColor: hito.tieneAntes ? colores.acentoRA : colores.panelBorde },
            ]}
          >
            <Ionicons
              name={hito.tieneAntes ? "image" : "image-outline"}
              size={12}
              color={hito.tieneAntes ? colores.acentoRA : colores.panelTextoSecundario}
            />
            <Text
              style={[
                styles.textoInsignia,
                { color: hito.tieneAntes ? colores.acentoRA : colores.panelTextoSecundario },
              ]}
            >
              {hito.tieneAntes ? "Antes" : "Sin foto antes"}
            </Text>
          </View>
          <Ionicons name="locate-outline" size={13} color={colores.panelTextoSecundario} />
          <Text style={[styles.dato, { color: colores.panelTextoSecundario }]}>
            Radio: {hito.ar_radio_metros} m
          </Text>
        </View>
      </View>

      <Switch
        value={hito.ar_activo}
        onValueChange={onAlternar}
        disabled={pendiente}
        trackColor={{ true: colores.acentoRA, false: colores.panelIconoNeutro }}
        accessibilityLabel={`RA de ${hito.nombre}`}
      />
      <Ionicons name="chevron-forward" size={18} color={colores.panelTextoSecundario} />
    </TouchableOpacity>
  );
}

const E = ESPACIADO_PANEL;

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: E.margen,
    paddingBottom: 12,
    gap: 8,
  },
  botonVolver: { width: 36, height: 36, justifyContent: "center", marginLeft: -6 },
  titulo: { fontSize: 22, fontWeight: "bold" },
  filaFiltros: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: E.margen,
    marginBottom: 14,
  },
  buscador: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  inputBuscador: { flex: 1, fontSize: 14 },
  filtro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  textoFiltro: { fontSize: 13, fontWeight: "600" },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: E.radioTarjeta,
    padding: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  miniatura: { width: 64, height: 64, borderRadius: 12 },
  sinMiniatura: { justifyContent: "center", alignItems: "center" },
  textos: { flex: 1, gap: 4 },
  nombre: { fontSize: 15, fontWeight: "700" },
  filaDato: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  punto: { width: 8, height: 8, borderRadius: 4 },
  dato: { fontSize: 12.5 },
  insignia: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginRight: 6,
  },
  textoInsignia: { fontSize: 11.5, fontWeight: "600" },
  vacio: { textAlign: "center", marginTop: 40 },
});
