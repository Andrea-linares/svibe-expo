import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
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

export default function OlvidePasswordScreen() {
  const [correo, setCorreo] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviarCodigo() {
    if (!correo.trim()) {
      Alert.alert("Falta el correo", "Ingresa tu correo electrónico.");
      return;
    }

    setCargando(true);

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
    <View style={styles.contenedor}>
      <TouchableOpacity style={styles.botonAtras} onPress={() => router.back()}>
        <Text style={styles.textoAtras}>← Volver</Text>
      </TouchableOpacity>

      <Text style={styles.titulo}>Recupera tu contraseña</Text>
      <Text style={styles.subtitulo}>
        Ingresa el correo con el que te registraste y te enviaremos un código de
        verificación.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        placeholderTextColor="#999"
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
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    padding: 28,
  },
  botonAtras: { position: "absolute", top: 60, left: 20 },
  textoAtras: { color: "#3B6FA0", fontWeight: "600" },
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
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
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
