import { useTema } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import PanelRA from "./PanelRA";

const ARCOS = [0, 1, 2];

// Píldora "Buscando lugares..." con arcos que se expanden (efecto de escaneo).
// Toda la animación corre en el hilo de UI.
export default function ScanOverlay({ top }: { top: number }) {
  const { colores } = useTema();
  const fase = useSharedValue(0);

  useEffect(() => {
    fase.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1);
    return () => cancelAnimation(fase);
  }, [fase]);

  return (
    <View pointerEvents="none" style={[styles.contenedor, { top }]}>
      <PanelRA style={styles.pildora}>
        <Ionicons name="wifi" size={16} color={colores.acentoRA} />
        <Text style={[styles.texto, { color: colores.texto }]}>Buscando lugares...</Text>
      </PanelRA>
      <View style={styles.zonaArcos}>
        {ARCOS.map((i) => (
          <Arco key={i} indice={i} fase={fase} color={colores.acentoRA} />
        ))}
      </View>
    </View>
  );
}

function Arco({ indice, fase, color }: { indice: number; fase: SharedValue<number>; color: string }) {
  const estilo = useAnimatedStyle(() => {
    // Cada arco va desfasado un tercio del ciclo
    const t = (fase.value + indice / ARCOS.length) % 1;
    return {
      opacity: 1 - t,
      transform: [{ scale: 0.4 + t * 0.9 }],
    };
  });
  return <Animated.View style={[styles.arco, { borderTopColor: color }, estilo]} />;
}

const styles = StyleSheet.create({
  contenedor: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  pildora: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  texto: { fontSize: 14, fontWeight: "600" },
  zonaArcos: { width: 180, height: 70, alignItems: "center", marginTop: 6 },
  arco: {
    position: "absolute",
    top: 0,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: "transparent",
  },
});
