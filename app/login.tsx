import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
    Alert,
    ImageBackground,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function LoginScreen() {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);

  async function iniciarSesion() {
    if (!correo.trim() || !contrasena) {
      Alert.alert("Faltan datos", "Ingresa tu correo y contraseña.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password: contrasena,
    });

    if (error) {
      Alert.alert("Error al iniciar sesión", error.message);
      return;
    }

    router.replace("/(tabs)/home");
  }

  function continuarConRed(nombreRed: string) {
    Alert.alert(
      "En desarrollo",
      `Inicio de sesión con ${nombreRed} próximamente.`,
    );
  }

  return (
    <ImageBackground
      source={{
        uri: "https://gdrrajvafwzgnbvjmqtw.supabase.co/storage/v1/object/public/hitos-imagenes/fondo.png",
      }}
      style={styles.fondo}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <TouchableOpacity style={styles.botonAtras} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={26} color="#fff" />
      </TouchableOpacity>

      <View style={styles.contenido}>
        <Text style={styles.logo}>
          S<Text style={styles.logoAcento}>V</Text>ibe
        </Text>
        <Text style={styles.subtitulo}>
          Tu viaje por la historia{"\n"}empieza aquí.
        </Text>

        <View style={{ height: 30 }} />

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="rgba(255,255,255,0.6)"
          value={correo}
          onChangeText={setCorreo}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View style={styles.inputConIcono}>
          <TextInput
            style={styles.inputTextoConIcono}
            placeholder="Contraseña"
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={contrasena}
            onChangeText={setContrasena}
            secureTextEntry={!mostrarContrasena}
          />
          <TouchableOpacity
            onPress={() => setMostrarContrasena(!mostrarContrasena)}
          >
            <Ionicons
              name={mostrarContrasena ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="rgba(255,255,255,0.8)"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => Alert.alert("En desarrollo", "Próximamente.")}
        >
          <Text style={styles.olvidaste}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botonIniciar} onPress={iniciarSesion}>
          <Text style={styles.textoBotonIniciar}>Iniciar sesión</Text>
        </TouchableOpacity>

        <View style={styles.filaSeparador}>
          <View style={styles.linea} />
          <Text style={styles.textoSeparador}>o</Text>
          <View style={styles.linea} />
        </View>

        <TouchableOpacity
          style={styles.botonInvitado}
          onPress={() => router.replace("/(tabs)/home")}
        >
          <Ionicons
            name="person-outline"
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.textoBotonInvitado}>Continuar como invitado</Text>
        </TouchableOpacity>

        {/* Accesos rápidos: solo íconos, sin texto */}
        <View style={styles.filaIconos}>
          <TouchableOpacity
            style={styles.iconoRedondo}
            onPress={() => continuarConRed("Apple")}
          >
            <Ionicons name="logo-apple" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconoRedondo}
            onPress={() => continuarConRed("Google")}
          >
            <Ionicons name="logo-google" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconoRedondo}
            onPress={() => continuarConRed("Facebook")}
          >
            <Ionicons name="logo-facebook" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push("/registro")}>
          <Text style={styles.registrate}>
            ¿No tienes cuenta?{" "}
            <Text style={styles.registrateLink}>Regístrate</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 30, 0.45)",
  },
  botonAtras: { position: "absolute", top: 55, left: 20, zIndex: 1 },
  contenido: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  logo: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  logoAcento: { color: "#5B9BD5" },
  subtitulo: {
    fontSize: 15,
    color: "#EAEAEA",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 12,
    paddingHorizontal: 16,
    color: "#fff",
    marginBottom: 14,
  },
  inputConIcono: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  inputTextoConIcono: { flex: 1, color: "#fff" },
  olvidaste: {
    color: "#9DBEE0",
    textAlign: "right",
    marginBottom: 20,
    fontSize: 13,
  },
  botonIniciar: {
    height: 52,
    backgroundColor: "#3B6FA0",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonIniciar: { color: "#fff", fontSize: 15, fontWeight: "600" },
  filaSeparador: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  linea: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.3)" },
  textoSeparador: { color: "rgba(255,255,255,0.7)", marginHorizontal: 10 },
  botonInvitado: {
    flexDirection: "row",
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonInvitado: { color: "#fff", fontSize: 15, fontWeight: "600" },
  filaIconos: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 24,
  },
  iconoRedondo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  registrate: {
    color: "#EAEAEA",
    textAlign: "center",
    marginTop: 26,
    fontSize: 13,
  },
  registrateLink: { color: "#9DBEE0", fontWeight: "600" },
});
