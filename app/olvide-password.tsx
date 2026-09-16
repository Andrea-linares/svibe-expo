import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function OlvidePasswordScreen() {
  const [correo, setCorreo] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviarCodigo() {
    if (!correo.trim()) {
      Alert.alert("Falta el correo", "Ingresa tu correo electrónico.");
      return;
    }

    setCargando(true);

    // Primero verificamos si el correo existe y ya fue confirmado
    const { data: verificacion, error: errorVerificacion } = await supabase.rpc(
      "verificar_correo_existe",
      { p_correo: correo.trim() },
    );

    if (errorVerificacion) {
      setCargando(false);
      Alert.alert("Error", "No se pudo verificar el correo. Intenta de nuevo.");
      return;
    }

    const resultado = verificacion?.[0];

    if (!resultado?.existe) {
      setCargando(false);
      Alert.alert(
        "Correo no encontrado",
        "Este correo no está registrado en SVibe.",
      );
      return;
    }

    if (!resultado?.verificado) {
      setCargando(false);
      Alert.alert(
        "Correo no verificado",
        "Esta cuenta todavía no ha verificado su correo. Completa el proceso de registro primero.",
      );
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(correo.trim());
    setCargando(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    router.push({
      pathname: "/verificar-recuperacion",
      params: { correo: correo.trim() },
    });
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
        <Text style={styles.titulo}>Recupera tu contraseña</Text>
        <Text style={styles.subtitulo}>
          Ingresa el correo con el que te registraste y te enviaremos un código
          de verificación.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="rgba(255,255,255,0.6)"
          value={correo}
          onChangeText={setCorreo}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TouchableOpacity
          style={styles.boton}
          onPress={enviarCodigo}
          disabled={cargando}
        >
          {cargando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.textoBoton}>Enviar código</Text>
          )}
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
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#fff",
  },
  subtitulo: {
    fontSize: 14,
    color: "#EAEAEA",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 30,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    color: "#fff",
  },
  boton: {
    height: 52,
    backgroundColor: "#3B6FA0",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBoton: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
