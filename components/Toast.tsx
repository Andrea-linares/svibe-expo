import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  mensaje: string;
  icono?: keyof typeof Ionicons.glyphMap;
  duracion?: number;
  onOcultar: () => void;
};

// Aviso breve en la parte inferior de la pantalla que se oculta solo.
// El padre controla `visible` y lo pone en false en `onOcultar`.
export default function Toast({
  visible,
  mensaje,
  icono = "heart",
  duracion = 2500,
  onOcultar,
}: Props) {
  const insets = useSafeAreaInsets();
  const [opacidad] = useState(() => new Animated.Value(0));
  const onOcultarRef = useRef(onOcultar);

  useEffect(() => {
    onOcultarRef.current = onOcultar;
  }, [onOcultar]);

  useEffect(() => {
    if (!visible) return;

    opacidad.setValue(0);
    Animated.timing(opacidad, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const temporizador = setTimeout(() => {
      Animated.timing(opacidad, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onOcultarRef.current());
    }, duracion);

    return () => clearTimeout(temporizador);
  }, [visible, duracion, opacidad]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          bottom: insets.bottom + 24,
          opacity: opacidad,
          transform: [
            {
              translateY: opacidad.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Ionicons name={icono} size={18} color="#fff" />
      <Text style={styles.texto}>{mensaje}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#263238",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  texto: { color: "#fff", fontSize: 14, fontWeight: "500", flex: 1 },
});
