import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function BienvenidaScreen() {
  return (
    <ImageBackground
      source={{
        uri: "https://gdrrajvafwzgnbvjmqtw.supabase.co/storage/v1/object/public/hitos-imagenes/fondo.png",
      }}
      style={styles.fondo}
      resizeMode="cover"
    >
      {/* Capa oscura semitransparente para que el texto se lea bien sobre la foto */}
      <View style={styles.overlay} />

      <View style={styles.contenido}>
        <View style={styles.arriba}>
          <Text style={styles.logo}>
            S<Text style={styles.logoAcento}>V</Text>ibe
          </Text>
          <Text style={styles.subtitulo}>
            Tu viaje por la historia{"\n"}empieza aquí.
          </Text>
        </View>

        <View style={styles.botones}>
          <TouchableOpacity
            style={styles.botonInvitado}
            onPress={() => router.replace("/(tabs)/home")}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color="#1a1a2e"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.textoBotonInvitado}>Entrar como invitado</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botonLogin}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.textoBotonLogin}>
              Iniciar sesión / Registrarse
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 30, 0.35)",
  },
  contenido: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 100,
    paddingBottom: 50,
  },
  arriba: { alignItems: "center" },
  logo: { fontSize: 42, fontWeight: "bold", color: "#fff" },
  logoAcento: { color: "#5B9BD5" },
  subtitulo: {
    fontSize: 16,
    color: "#EAEAEA",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 22,
  },
  botones: { gap: 14 },
  botonInvitado: {
    flexDirection: "row",
    backgroundColor: "#fff",
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonInvitado: { color: "#1a1a2e", fontSize: 15, fontWeight: "600" },
  botonLogin: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonLogin: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
