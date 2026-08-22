import { supabase } from "@/lib/supabase";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function VerificarRecuperacionScreen() {
  const { correo } = useLocalSearchParams<{ correo: string }>();
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);

  async function verificarCodigo() {
    if (codigo.trim().length !== 8) {
      Alert.alert(
        "Código incompleto",
        "Ingresa el código completo que te enviamos.",
      );
      return;
    }

    setCargando(true);

    const { error } = await supabase.auth.verifyOtp({
      email: correo,
      token: codigo.trim(),
      type: "recovery",
    });

    setCargando(false);

    if (error) {
      Alert.alert(
        "Código incorrecto",
        "Verifica el código e intenta de nuevo.",
      );
      return;
    }

    // Código correcto -> ya hay una sesión activa, lo mandamos a poner la nueva contraseña
    router.replace("/nueva-contrasena");
  }

  async function reenviarCodigo() {
    const { error } = await supabase.auth.resetPasswordForEmail(correo);
    if (error) {
      Alert.alert("Error", "No se pudo reenviar el código.");
    } else {
      Alert.alert("Código reenviado", "Revisa tu correo de nuevo.");
    }
  }

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Verifica tu correo</Text>
      <Text style={styles.subtitulo}>
        Te enviamos un código a{"\n"}
        <Text style={{ fontWeight: "600" }}>{correo}</Text>
      </Text>

      <TextInput
        style={styles.inputCodigo}
        placeholder="00000000"
        placeholderTextColor="#ccc"
        value={codigo}
        onChangeText={setCodigo}
        keyboardType="number-pad"
        maxLength={8}
        textAlign="center"
      />

      <TouchableOpacity
        style={styles.boton}
        onPress={verificarCodigo}
        disabled={cargando}
      >
        {cargando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.textoBoton}>Verificar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={reenviarCodigo}>
        <Text style={styles.reenviar}>¿No te llegó? Reenviar código</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    padding: 28,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitulo: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 30,
  },
  inputCodigo: {
    height: 60,
    borderWidth: 1.5,
    borderColor: "#ccc",
    borderRadius: 12,
    fontSize: 22,
    letterSpacing: 6,
    marginBottom: 24,
  },
  boton: {
    height: 52,
    backgroundColor: "#3B6FA0",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  textoBoton: { color: "#fff", fontSize: 15, fontWeight: "600" },
  reenviar: { textAlign: "center", color: "#3B6FA0", fontWeight: "600" },
});
