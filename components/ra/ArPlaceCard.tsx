import { conAlfa, useTema } from "@/contexts/ThemeContext";
import { LugarAR } from "@/hooks/use-ar-places";
import { formatearDistancia } from "@/lib/geo";
import { colorEstado } from "@/lib/horarios";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import PanelRA from "./PanelRA";

type Props = {
  lugar: LugarAR;
  onCerrar: () => void;
  onVerAntesDespues: () => void;
  onVerDetalle: () => void;
};

// Tarjeta centrada con la información del lugar. Se cierra con la X o
// tocando fuera de ella.
export default function ArPlaceCard({ lugar, onCerrar, onVerAntesDespues, onVerDetalle }: Props) {
  const { colores, esOscuro } = useTema();
  const { estado } = lugar;
  const colorDeEstado = colorEstado(estado.abierto, esOscuro, colores.peligro);

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(150)}
      style={StyleSheet.absoluteFill}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: conAlfa(colores.fondo, 0.25) }]}
        onPress={onCerrar}
        accessibilityLabel="Cerrar tarjeta"
      />
      <View pointerEvents="box-none" style={styles.centro}>
        <Animated.View
          entering={ZoomIn.springify().damping(16)}
          exiting={ZoomOut.duration(150)}
          style={styles.ancho}
        >
          <PanelRA style={styles.tarjeta}>
            <View style={styles.filaTitulo}>
              <Text style={[styles.titulo, { color: colores.texto }]} numberOfLines={2}>
                {lugar.nombre}
              </Text>
              <TouchableOpacity onPress={onCerrar} hitSlop={10} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={22} color={colores.textoSecundario} />
              </TouchableOpacity>
            </View>

            <View style={[styles.insignia, { backgroundColor: conAlfa(colorDeEstado, 0.15) }]}>
              <Ionicons
                name={estado.abierto ? "checkmark-circle" : "close-circle"}
                size={14}
                color={colorDeEstado}
              />
              <Text style={[styles.textoInsignia, { color: colorDeEstado }]}>
                {estado.abierto ? "Abierto" : "Cerrado"}
              </Text>
            </View>

            <View style={styles.filaDato}>
              <Ionicons name="time-outline" size={16} color={colores.textoSecundario} />
              <Text style={[styles.dato, { color: colores.texto }]}>
                {estado.horarioHoy ? `Hoy: ${estado.horarioHoy}` : estado.mensajeHora}
              </Text>
            </View>
            <View style={styles.filaDato}>
              <Ionicons name="location-outline" size={16} color={colores.textoSecundario} />
              <Text style={[styles.dato, { color: colores.texto }]}>
                {formatearDistancia(lugar.distancia)}
              </Text>
            </View>

            {lugar.descripcionCorta && (
              <Text style={[styles.descripcion, { color: colores.texto }]}>
                {lugar.descripcionCorta}
              </Text>
            )}

            <View style={styles.filaAcciones}>
              {lugar.miniatura && (
                <Image
                  source={{ uri: lugar.miniatura }}
                  style={styles.miniatura}
                  contentFit="cover"
                />
              )}
              <View style={styles.botones}>
                {lugar.antes && lugar.ahoraUri && (
                  <TouchableOpacity
                    style={[styles.boton, { backgroundColor: colores.acentoRA }]}
                    onPress={onVerAntesDespues}
                  >
                    <Text style={[styles.textoBoton, { color: "#fff" }]}>
                      Ver antes y después
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.boton, styles.botonSecundario, { borderColor: colores.acentoRA }]}
                  onPress={onVerDetalle}
                >
                  <Text style={[styles.textoBoton, { color: colores.acentoRA }]}>Ver detalle</Text>
                </TouchableOpacity>
              </View>
            </View>
          </PanelRA>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  ancho: { width: "100%", maxWidth: 380 },
  tarjeta: { borderRadius: 20, padding: 16, gap: 8 },
  filaTitulo: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  titulo: { flex: 1, fontSize: 19, fontWeight: "800" },
  insignia: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  textoInsignia: { fontSize: 12.5, fontWeight: "700" },
  filaDato: { flexDirection: "row", alignItems: "center", gap: 8 },
  dato: { fontSize: 14 },
  descripcion: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  filaAcciones: { flexDirection: "row", gap: 12, marginTop: 6, alignItems: "center" },
  miniatura: { width: 88, height: 88, borderRadius: 12 },
  botones: { flex: 1, gap: 8 },
  boton: {
    minHeight: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  botonSecundario: { borderWidth: 1.5 },
  textoBoton: { fontSize: 14, fontWeight: "700", textAlign: "center" },
});
