import { router } from "expo-router";
import {
    Alert,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function BienvenidaScreen() {
  function entrarComoInvitado() {
    router.replace("/(tabs)/home");
  }

  function iniciarSesion() {
    Alert.alert(
      "En desarrollo",
      "Esta función estará disponible próximamente.",
    );
  }

  return (
    <View style={styles.contenedor}>
      <Image source={require("@/assets/images/icon.png")} style={styles.logo} />

      <Text style={styles.titulo}>¡Bienvenido a{"\n"}SVibe!</Text>

      <Text style={styles.subtitulo}>
        Descubre lugares ocultos y experiencias únicas
      </Text>

      <View style={{ height: 48 }} />

      <TouchableOpacity
        style={styles.botonPrimario}
        onPress={entrarComoInvitado}
      >
        <Text style={styles.textoBotonPrimario}>Entrar como invitado</Text>
      </TouchableOpacity>

      <View style={{ height: 16 }} />

      <TouchableOpacity style={styles.botonSecundario} onPress={iniciarSesion}>
        <Text style={styles.textoBotonSecundario}>
          Iniciar sesión / Registrarme
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#fff",
  },
  logo: {
    width: 190,
    height: 190,
    marginBottom: 24,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
    lineHeight: 30,
  },
  subtitulo: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginTop: 8,
  },
  botonPrimario: {
    width: "100%",
    height: 56,
    backgroundColor: "#2196F3",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonPrimario: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  botonSecundario: {
    width: "100%",
    height: 56,
    backgroundColor: "#E0E0E0",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonSecundario: {
    color: "#333",
    fontSize: 16,
    fontWeight: "bold",
  },
});
