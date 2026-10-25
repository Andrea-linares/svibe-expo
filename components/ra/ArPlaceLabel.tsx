import { useTema } from "@/contexts/ThemeContext";
import { LugarAR } from "@/hooks/use-ar-places";
import { diferenciaAngular, formatearDistancia } from "@/lib/geo";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { FOV_HORIZONTAL } from "./constantes";
import PanelRA from "./PanelRA";

type Props = {
  lugar: LugarAR;
  heading: SharedValue<number>;
  anchoPantalla: number;
  top: number;
  compacta: boolean;
  destacada: boolean;
  onPress: () => void;
};

// Etiqueta flotante de un lugar. Su posición horizontal sale de la diferencia
// entre el rumbo al lugar y el del teléfono: centro = de frente, borde = a
// FOV/2 grados. Fuera del campo de visión sale de la pantalla y se desvanece.
export default function ArPlaceLabel({
  lugar,
  heading,
  anchoPantalla,
  top,
  compacta,
  destacada,
  onPress,
}: Props) {
  const { colores } = useTema();
  const anchoEtiqueta = useSharedValue(0);

  const estilo = useAnimatedStyle(() => {
    const diferencia = diferenciaAngular(heading.value, lugar.rumbo);
    const x =
      anchoPantalla / 2 + (diferencia / FOV_HORIZONTAL) * anchoPantalla - anchoEtiqueta.value / 2;
    const visible = Math.abs(diferencia) <= FOV_HORIZONTAL / 2 + 6;
    return {
      opacity: withTiming(visible && anchoEtiqueta.value > 0 ? 1 : 0, { duration: 180 }),
      transform: [
        { translateX: withTiming(x, { duration: 110 }) },
        { scale: withTiming(destacada ? 1.06 : 1, { duration: 200 }) },
      ],
    };
  }, [lugar.rumbo, anchoPantalla, destacada]);

  return (
    <Animated.View
      style={[styles.contenedor, { top }, estilo]}
      onLayout={(e) => {
        anchoEtiqueta.value = e.nativeEvent.layout.width;
      }}
    >
      <Pressable
        onPress={onPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${lugar.nombre}, a ${formatearDistancia(lugar.distancia)}`}
      >
        <PanelRA
          style={[
            styles.panel,
            compacta && styles.panelCompacta,
            destacada && { borderColor: colores.acentoRA, borderWidth: 2 },
          ]}
        >
          <View
            style={[
              styles.pin,
              compacta && styles.pinCompacto,
              { backgroundColor: colores.acentoRA },
            ]}
          >
            <Ionicons name="location" size={compacta ? 13 : 17} color="#fff" />
          </View>
          <View style={styles.textos}>
            <Text
              style={[styles.nombre, compacta && styles.nombreCompacto, { color: colores.texto }]}
              numberOfLines={1}
            >
              {lugar.nombre}
            </Text>
            <Text
              style={[
                styles.distancia,
                compacta && styles.distanciaCompacta,
                { color: colores.textoSecundario },
              ]}
            >
              {formatearDistancia(lugar.distancia)}
            </Text>
          </View>
        </PanelRA>
      </Pressable>
      {/* Tallo que señala el lugar */}
      <View style={[styles.tallo, { backgroundColor: colores.acentoRA }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contenedor: { position: "absolute", left: 0, alignItems: "center" },
  panel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    maxWidth: 240,
  },
  panelCompacta: { paddingVertical: 5, paddingLeft: 5, paddingRight: 10, gap: 6, maxWidth: 180 },
  pin: { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  pinCompacto: { width: 22, height: 22, borderRadius: 11 },
  textos: { flexShrink: 1 },
  nombre: { fontSize: 15, fontWeight: "700" },
  nombreCompacto: { fontSize: 12.5 },
  distancia: { fontSize: 12.5, marginTop: 1 },
  distanciaCompacta: { fontSize: 11 },
  tallo: { width: 2, height: 16, opacity: 0.8 },
});
