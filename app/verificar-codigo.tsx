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

export default function VerificarCodigoScreen() {
  const { correo, nombre } = useLocalSearchParams<{ correo: string; nombre: string; }>();
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);

  async function verificarCodigo() {
    if (codigo.trim().length !== 8) {
      Alert.alert(
        "Código incompleto",
        "Ingresa el código de 8 dígitos que te enviamos.",
      );
      return;
    }

    setCargando(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email: correo,
      token: codigo.trim(),
      type: "signup",
    });

    setCargando(false);

    if (error) {
      Alert.alert(
        "Código incorrecto",
        "Verifica el código e intenta de nuevo.",
      );
      return;
    }

     if (data.user) {
      try {
        // Verificar si el perfil ya existe
        const { data: perfilExistente } = await supabase
          .from("perfiles")
          .select("id")
          .eq("id", data.user.id)
          .single();

        // Si no existe, crearlo
        if (!perfilExistente) {
          const { error: perfilError } = await supabase.from("perfiles").insert({
            id: data.user.id,
            nombre: nombre?.trim() || "Usuario",
          });

          if (perfilError) {
            console.log(" Error creando perfil:", perfilError);
            // No mostramos alerta al usuario para no interrumpir el flujo
          } else {
            console.log(" Perfil creado correctamente");
          }
        } else {
          console.log(" Perfil ya existe");
        }
      } catch (error) {
        console.log(" Error verificando perfil:", error);
        // Continuamos con el flujo
      }
    }

    setCargando(false);

    // Verificado correctamente -> lo mandamos al inicio
    router.replace("/preferencias");
  }

  async function reenviarCodigo() {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: correo,
    });
    if (error) {
      Alert.alert("Error", "No se pudo reenviar el código. Intenta más tarde.");
    } else {
      Alert.alert("Código reenviado", "Revisa tu correo de nuevo.");
    }
  }

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Verifica tu correo</Text>
      <Text style={styles.subtitulo}>
        Te enviamos un código de 8 dígitos a{"\n"}
        <Text style={{ fontWeight: "600" }}>{correo}</Text>
      </Text>

      <TextInput
        style={styles.inputCodigo}
        placeholder="000000"
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
    fontSize: 24,
    letterSpacing: 8,
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
