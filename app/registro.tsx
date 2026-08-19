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

export default function RegistroScreen() {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function registrarse() {
    if (!nombre.trim() || !correo.trim() || !contrasena) {
      Alert.alert("Faltan datos", "Completa todos los campos.");
      return;
    }
    if (contrasena !== confirmarContrasena) {
      Alert.alert(
        "Las contraseñas no coinciden",
        "Verifica que ambas contraseñas sean iguales.",
      );
      return;
    }
    if (contrasena.length < 6) {
      Alert.alert("Contraseña muy corta", "Debe tener al menos 6 caracteres.");
      return;
    }
    if (!aceptaTerminos) {
      Alert.alert(
        "Términos y condiciones",
        "Debes aceptar los términos para continuar.",
      );
      return;
    }

    setCargando(true);

    const { data, error } = await supabase.auth.signUp({
      email: correo.trim(),
      password: contrasena,
    });

    if (error) {
      setCargando(false);
      Alert.alert("Error al registrarse", error.message);
      return;
    }

    // Creamos su fila en "perfiles" con el nombre que puso
    if (data.user) {
      await supabase.from("perfiles").insert({
        id: data.user.id,
        nombre: nombre.trim(),
      });
    }

    setCargando(false);

    // Lo mandamos a la pantalla de verificación con el correo como parámetro
    router.push({
      pathname: "/verificar-codigo",
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

      <View style={styles.contenidoArriba}>
        <Text style={styles.logo}>
          S<Text style={styles.logoAcento}>V</Text>ibe
        </Text>
        <Text style={styles.subtitulo}>
          Crea tu cuenta{"\n"}y empieza tu aventura
        </Text>
      </View>

      <View style={styles.panelFormulario}>
        <View style={styles.inputConIcono}>
          <Ionicons
            name="person-outline"
            size={18}
            color="#999"
            style={{ marginRight: 10 }}
          />
          <TextInput
            style={styles.inputTexto}
            placeholder="Nombre completo"
            placeholderTextColor="#999"
            value={nombre}
            onChangeText={setNombre}
          />
        </View>

        <View style={styles.inputConIcono}>
          <Ionicons
            name="mail-outline"
            size={18}
            color="#999"
            style={{ marginRight: 10 }}
          />
          <TextInput
            style={styles.inputTexto}
            placeholder="Correo electrónico"
            placeholderTextColor="#999"
            value={correo}
            onChangeText={setCorreo}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputConIcono}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color="#999"
            style={{ marginRight: 10 }}
          />
          <TextInput
            style={styles.inputTexto}
            placeholder="Contraseña"
            placeholderTextColor="#999"
            value={contrasena}
            onChangeText={setContrasena}
            secureTextEntry={!mostrarContrasena}
          />
          <TouchableOpacity
            onPress={() => setMostrarContrasena(!mostrarContrasena)}
          >
            <Ionicons
              name={mostrarContrasena ? "eye-off-outline" : "eye-outline"}
              size={18}
              color="#999"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.inputConIcono}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color="#999"
            style={{ marginRight: 10 }}
          />
          <TextInput
            style={styles.inputTexto}
            placeholder="Confirmar contraseña"
            placeholderTextColor="#999"
            value={confirmarContrasena}
            onChangeText={setConfirmarContrasena}
            secureTextEntry={!mostrarConfirmar}
          />
          <TouchableOpacity
            onPress={() => setMostrarConfirmar(!mostrarConfirmar)}
          >
            <Ionicons
              name={mostrarConfirmar ? "eye-off-outline" : "eye-outline"}
              size={18}
              color="#999"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.filaTerminos}
          onPress={() => setAceptaTerminos(!aceptaTerminos)}
        >
          <View
            style={[styles.checkbox, aceptaTerminos && styles.checkboxActivo]}
          >
            {aceptaTerminos && (
              <Ionicons name="checkmark" size={14} color="#fff" />
            )}
          </View>
          <Text style={styles.textoTerminos}>
            Acepto los <Text style={styles.link}>Términos y Condiciones</Text> y
            la <Text style={styles.link}>Política de Privacidad</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botonRegistrar}
          onPress={registrarse}
          disabled={cargando}
        >
          {cargando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.textoBotonRegistrar}>Registrarme</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/login")}>
          <Text style={styles.yaTienesCuenta}>
            ¿Ya tienes cuenta? <Text style={styles.link}>Inicia sesión</Text>
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
    backgroundColor: "rgba(10, 10, 30, 0.35)",
  },
  botonAtras: { position: "absolute", top: 55, left: 20, zIndex: 1 },
  contenidoArriba: { paddingTop: 90, alignItems: "center", paddingBottom: 30 },
  logo: { fontSize: 34, fontWeight: "bold", color: "#fff" },
  logoAcento: { color: "#5B9BD5" },
  subtitulo: {
    fontSize: 15,
    color: "#EAEAEA",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  panelFormulario: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingTop: 28,
  },
  inputConIcono: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  inputTexto: { flex: 1, color: "#222" },
  filaTerminos: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#999",
    marginRight: 10,
    marginTop: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActivo: { backgroundColor: "#3B6FA0", borderColor: "#3B6FA0" },
  textoTerminos: { flex: 1, fontSize: 13, color: "#555", lineHeight: 18 },
  link: { color: "#3B6FA0", fontWeight: "600" },
  botonRegistrar: {
    height: 52,
    backgroundColor: "#3B6FA0",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonRegistrar: { color: "#fff", fontSize: 15, fontWeight: "600" },
  yaTienesCuenta: {
    textAlign: "center",
    color: "#555",
    marginTop: 18,
    fontSize: 13,
  },
});
