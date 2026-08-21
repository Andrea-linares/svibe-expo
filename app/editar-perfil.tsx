import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function EditarPerfilScreen() {
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const { data: sesion } = await supabase.auth.getUser();
      if (!sesion?.user) {
        setCargando(false);
        return;
      }

      setUsuarioId(sesion.user.id);

      const { data } = await supabase
        .from("perfiles")
        .select("nombre, apellido, ciudad, foto_perfil_url")
        .eq("id", sesion.user.id)
        .single();

      if (data) {
        setNombre(data.nombre ?? "");
        setApellido(data.apellido ?? "");
        setCiudad(data.ciudad ?? "");
        setFotoUrl(data.foto_perfil_url);
      }

      setCargando(false);
    }

    cargar();
  }, []);

  async function elegirFoto() {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    Alert.alert(
      "Permiso necesario",
      "Necesitamos acceso a tu galería para elegir una foto.",
    );
    return;
  }

  const resultado = await ImagePicker.launchImageLibraryAsync({
    // 🔧 CAMBIO: mediaTypes actualizado (ya no usa el enum deprecado)
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (resultado.canceled || !usuarioId) return;

  const uri = resultado.assets[0].uri;
  setSubiendoFoto(true);

  try {
    // 🔧 CAMBIO: leer el archivo como base64 con expo-file-system,
    // en vez de fetch(uri).blob() que falla en Android
        const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });

    const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
    const ruta = `perfiles/${usuarioId}-${Date.now()}.${extension}`;

    const { error: errorSubida } = await supabase.storage
      .from("hitos-imagenes")
      .upload(ruta, decode(base64), {
        contentType: `image/${extension}`,
        upsert: true,
      });

    if (errorSubida) {
      Alert.alert("Error al subir la foto", errorSubida.message);
      setSubiendoFoto(false);
      return;
    }

    const { data: urlPublica } = supabase.storage
      .from("hitos-imagenes")
      .getPublicUrl(ruta);

    setFotoUrl(urlPublica.publicUrl);
    } catch (e) {
    console.log("Error real al procesar imagen:", e);
    Alert.alert("Error", `No se pudo procesar la imagen: ${String(e)}`);
  } finally {
    setSubiendoFoto(false);
  }
}

  async function guardarCambios() {
    if (!usuarioId) return;

    if (!nombre.trim()) {
      Alert.alert("Falta el nombre", "El nombre no puede estar vacío.");
      return;
    }

    setGuardando(true);

    const { error } = await supabase
      .from("perfiles")
      .update({
        nombre: nombre.trim(),
        apellido: apellido.trim() || null,
        ciudad: ciudad.trim() || null,
        foto_perfil_url: fotoUrl,
      })
      .eq("id", usuarioId);

    setGuardando(false);

    if (error) {
      Alert.alert("Error al guardar", error.message);
      return;
    }

    router.back();
  }

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#3B6FA0" />
      </View>
    );
  }

    return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.contenedor} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.encabezado}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A2A3A" />
        </TouchableOpacity>
        <Text style={styles.tituloEncabezado}>Editar perfil</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Foto de perfil */}
      <View style={styles.seccionFoto}>
        <TouchableOpacity onPress={elegirFoto} disabled={subiendoFoto}>
          <Image
            source={
              fotoUrl
                ? { uri: fotoUrl }
                : require("@/assets/images/partial-react-logo.png")
            }
            style={styles.avatar}
          />
          <View style={styles.botonCamara}>
            {subiendoFoto ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.textoCambiarFoto}>Toca para cambiar tu foto</Text>
      </View>

      {/* Formulario */}
      <View style={styles.formulario}>
        <Text style={styles.etiqueta}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Tu nombre"
          placeholderTextColor="#999"
        />

        <Text style={styles.etiqueta}>Apellido</Text>
        <TextInput
          style={styles.input}
          value={apellido}
          onChangeText={setApellido}
          placeholder="Tu apellido"
          placeholderTextColor="#999"
        />

        <Text style={styles.etiqueta}>Ciudad</Text>
        <TextInput
          style={styles.input}
          value={ciudad}
          onChangeText={setCiudad}
          placeholder="Tu ciudad"
          placeholderTextColor="#999"
        />
      </View>

      <TouchableOpacity
        style={styles.botonGuardar}
        onPress={guardarCambios}
        disabled={guardando || subiendoFoto}
      >
        {guardando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.textoBotonGuardar}>Guardar cambios</Text>
        )}
      </TouchableOpacity>
          </ScrollView>
    </>
  );
}
const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#F5F6F8" },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },

  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#fff",
  },
  tituloEncabezado: { fontSize: 17, fontWeight: "bold", color: "#1A2A3A" },

  seccionFoto: { alignItems: "center", marginTop: 28 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#EEE",
  },
  botonCamara: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#3B6FA0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#F5F6F8",
  },
  textoCambiarFoto: { fontSize: 13, color: "#3B6FA0", marginTop: 10 },

  formulario: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 28,
    padding: 20,
  },
  etiqueta: { fontSize: 13, color: "#777", marginBottom: 6, marginTop: 14 },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 14,
    color: "#1A2A3A",
    fontSize: 15,
  },

  botonGuardar: {
    marginHorizontal: 16,
    marginTop: 24,
    height: 52,
    backgroundColor: "#3B6FA0",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonGuardar: { color: "#fff", fontSize: 15, fontWeight: "600" },
});