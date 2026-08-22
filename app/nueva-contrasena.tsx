import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
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

export default function NuevaContrasenaScreen() {
  const [contrasena, setContrasena] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function guardarContrasena() {
    if (contrasena.length < 6) {
      Alert.alert("Contraseña muy corta", "Debe tener al menos 6 caracteres.");
      return;
    }
    if (contrasena !== confirmar) {
      Alert.alert("No coinciden", "Ambas contraseñas deben ser iguales.");
      return;
    }

    setCargando(true);

    const { error } = await supabase.auth.updateUser({ password: contrasena });

    setCargando(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    Alert.alert("Listo", "Tu contraseña se actualizó correctamente.");
    router.replace("/(tabs)/home");
  }

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Crea tu nueva contraseña</Text>

      <View style={styles.inputConIcono}>
        <TextInput
          style={styles.inputTexto}
          placeholder="Nueva contraseña"
          placeholderTextColor="#999"
          value={contrasena}
          onChangeText={setContrasena}
          secureTextEntry={!mostrar}
        />
        <TouchableOpacity onPress={() => setMostrar(!mostrar)}>
          <Ionicons
            name={mostrar ? "eye-off-outline" : "eye-outline"}
            size={18}
            color="#999"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.inputConIcono}>
        <TextInput
          style={styles.inputTexto}
          placeholder="Confirmar contraseña"
          placeholderTextColor="#999"
          value={confirmar}
          onChangeText={setConfirmar}
          secureTextEntry={!mostrar}
        />
      </View>

      <TouchableOpacity
        style={styles.boton}
        onPress={guardarContrasena}
        disabled={cargando}
      >
        {cargando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.textoBoton}>Guardar contraseña</Text>
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
  titulo: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
  },
  inputConIcono: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  inputTexto: { flex: 1, color: "#222" },
  boton: {
    height: 52,
    backgroundColor: "#3B6FA0",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  textoBoton: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
