import { useTema } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

type Props = {
  antesUri: string;
  despuesUri: string;
  // Contenedor: define el alto (o aspectRatio) y los bordes
  style?: StyleProp<ViewStyle>;
  // Posición inicial del deslizador (0 = todo "después", 1 = todo "antes")
  posicionInicial?: number;
  // Etiquetas u otros elementos encima de las fotos (no bloquean el arrastre)
  children?: ReactNode;
};

const TAMANO_MANIJA = 40;

// Comparador antes/después: la foto "antes" se recorta desde la izquierda
// hasta la posición del dedo. El arrastre corre en el hilo de UI.
export default function BeforeAfterSlider({
  antesUri,
  despuesUri,
  style,
  posicionInicial = 0.5,
  children,
}: Props) {
  const { colores } = useTema();
  const ancho = useSharedValue(0);
  const posicion = useSharedValue(posicionInicial);

  const mover = (x: number) => {
    "worklet";
    if (ancho.value > 0) {
      posicion.value = Math.min(1, Math.max(0, x / ancho.value));
    }
  };

  // Tocar también salta a esa posición; minDistance 0 para que responda al instante
  const arrastre = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      "worklet";
      mover(e.x);
    },
    onUpdate: (e) => {
      "worklet";
      mover(e.x);
    },
  });

  const estiloRecorte = useAnimatedStyle(() => ({
    width: posicion.value * ancho.value,
  }));
  const estiloImagenAntes = useAnimatedStyle(() => ({ width: ancho.value }));
  const estiloDivisor = useAnimatedStyle(() => ({
    transform: [{ translateX: posicion.value * ancho.value }],
  }));

  return (
    <GestureDetector gesture={arrastre}>
      <View
        style={[styles.contenedor, style]}
        onLayout={(e) => {
          ancho.value = e.nativeEvent.layout.width;
        }}
        accessible
        accessibilityLabel="Comparador antes y después. Desliza para comparar."
      >
        <Image source={{ uri: despuesUri }} style={StyleSheet.absoluteFill} contentFit="cover" />

        <Animated.View style={[styles.recorte, estiloRecorte]}>
          <Animated.View style={[styles.capaAntes, estiloImagenAntes]}>
            <Image source={{ uri: antesUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.divisor, estiloDivisor]}>
          <View style={[styles.linea, { backgroundColor: colores.tarjeta }]} />
          <View style={[styles.manija, { backgroundColor: colores.tarjeta }]}>
            <Ionicons name="swap-horizontal" size={20} color={colores.acentoRA} />
          </View>
        </Animated.View>

        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {children}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  contenedor: { overflow: "hidden", width: "100%" },
  recorte: { position: "absolute", top: 0, bottom: 0, left: 0, overflow: "hidden" },
  capaAntes: { position: "absolute", top: 0, bottom: 0, left: 0 },
  divisor: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: -TAMANO_MANIJA / 2,
    width: TAMANO_MANIJA,
    alignItems: "center",
    justifyContent: "center",
  },
  linea: { position: "absolute", top: 0, bottom: 0, width: 2 },
  manija: {
    width: TAMANO_MANIJA,
    height: TAMANO_MANIJA,
    borderRadius: TAMANO_MANIJA / 2,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
