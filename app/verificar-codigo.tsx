import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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

export default function VerificarCodigoScreen() {
  const { correo, nombre } = useLocalSearchParams<{
    correo: string;
    nombre: string;
  }>();
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
          const { error: perfilError } = await supabase
            .from("perfiles")
            .insert({
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
    router.replace("/home");
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
    <ImageBackground
      source={{
        uri: "https://gdrrajvafwzgnbvjmqtw.supabase.co/storage/v1/object/public/hitos-imagenes/fondo.png",
      }}
      style={styles.fondo}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      {/* Flecha para volver y corregir el correo, si se equivocó */}
      <TouchableOpacity style={styles.botonAtras} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={26} color="#fff" />
      </TouchableOpacity>

      <View style={styles.contenido}>
        <Text style={styles.titulo}>Verifica tu correo</Text>
        <Text style={styles.subtitulo}>
          Te enviamos un código de 8 dígitos a{"\n"}
          <Text style={{ fontWeight: "700" }}>{correo}</Text>
        </Text>

        <TextInput
          style={styles.inputCodigo}
          placeholder="00000000"
          placeholderTextColor="rgba(255,255,255,0.5)"
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
  inputCodigo: {
    height: 60,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: 12,
    fontSize: 24,
    letterSpacing: 8,
    marginBottom: 24,
    color: "#fff",
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
  reenviar: { textAlign: "center", color: "#9DBEE0", fontWeight: "600" },
});
