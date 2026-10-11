import { COLOR_ACENTO } from "@/constants/theme";
import { useTema } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Pantalla para usuarios sin rol de administrador (o mientras se verifica)
export default function AccesoRestringido({ verificando }: { verificando: boolean }) {
  const { colores } = useTema();

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      {verificando ? (
        <ActivityIndicator size="large" color={COLOR_ACENTO} />
      ) : (
        <>
          <Ionicons name="lock-closed-outline" size={56} color={COLOR_ACENTO} />
          <Text style={[styles.titulo, { color: colores.texto }]}>Acceso restringido</Text>
          <Text style={[styles.texto, { color: colores.textoSecundario }]}>
            Esta sección solo está disponible para administradores.
          </Text>
          <TouchableOpacity
            style={styles.boton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Text style={styles.textoBoton}>Volver</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  titulo: { fontSize: 20, fontWeight: "bold", marginTop: 16 },
  texto: { fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 },
  boton: {
    marginTop: 20,
    backgroundColor: COLOR_ACENTO,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 24,
    justifyContent: "center",
  },
  textoBoton: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
