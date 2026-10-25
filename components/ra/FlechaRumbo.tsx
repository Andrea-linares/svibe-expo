import { diferenciaAngular } from "@/lib/geo";
import { Ionicons } from "@expo/vector-icons";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";

// Flecha que apunta hacia "rumbo" según hacia dónde mira el teléfono.
// Gira en el hilo de UI con cada lectura de la brújula.
export default function FlechaRumbo({
  heading,
  rumbo,
  color,
  tamano = 26,
}: {
  heading: SharedValue<number>;
  rumbo: number;
  color: string;
  tamano?: number;
}) {
  const estilo = useAnimatedStyle(
    () => ({
      transform: [{ rotate: `${diferenciaAngular(heading.value, rumbo)}deg` }],
    }),
    [rumbo],
  );

  return (
    <Animated.View style={estilo}>
      <Ionicons name="arrow-up-circle" size={tamano} color={color} />
    </Animated.View>
  );
}
