import { conAlfa, useTema } from "@/contexts/ThemeContext";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, ViewProps } from "react-native";

// Panel semitransparente para poner sobre la cámara, tintado según el tema.
// iOS: desenfoque real (expo-blur) + capa del color de tarjeta.
// Android: en Expo Go el desenfoque necesita envolver la cámara en un
// BlurTargetView, así que se usa la tarjeta del tema casi opaca.
export default function PanelRA({ style, children, ...props }: ViewProps) {
  const { colores, esOscuro } = useTema();
  const bordes = { borderColor: conAlfa(colores.borde, 0.7) };

  if (Platform.OS === "ios") {
    return (
      <BlurView
        tint={esOscuro ? "dark" : "light"}
        intensity={45}
        style={[styles.base, bordes, style]}
        {...props}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: conAlfa(colores.tarjeta, 0.55) }]}
        />
        {children}
      </BlurView>
    );
  }

  return (
    <View
      style={[styles.base, bordes, { backgroundColor: conAlfa(colores.tarjeta, 0.88) }, style]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
});
