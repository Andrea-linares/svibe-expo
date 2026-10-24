import { useTema } from "@/contexts/ThemeContext";
import { Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

// Destino de la URL de retorno del login con Google (auth/callback).
// En Android, Expo Router también recibe ese enlace y navega aquí; sin esta
// ruta mostraría "Unmatched route". No tiene lógica ni redirecciones propias:
// login.tsx crea la sesión y navega cuando termina.
export default function AuthCallbackScreen() {
  const { colores } = useTema();

  return (
    <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={colores.acento} />
    </View>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
});
