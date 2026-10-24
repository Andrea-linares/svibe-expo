import { useTema } from "@/contexts/ThemeContext";
import { useMargenSuperior } from "@/hooks/use-margen-superior";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";

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
  // Tema global (el mismo que Perfil); esta pantalla solo lo lee
  const { colores, esOscuro } = useTema();
  const margenSuperior = useMargenSuperior(55);

  // Barra de estado según el tema mientras la pantalla está enfocada.
  // Se aplica en el siguiente ciclo para que no la pise el "auto" que
  // restablece Perfil al perder el foco.
  useFocusEffect(
    useCallback(() => {
      const temporizador = setTimeout(
        () => setStatusBarStyle(esOscuro ? "light" : "dark"),
        0,
      );
      return () => {
        clearTimeout(temporizador);
        setStatusBarStyle("auto");
      };
    }, [esOscuro]),
  );

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
      <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.acento} />
      </View>
    );
  }

  // Texto sobre el color de acento: blanco en claro; en oscuro el acento es
  // un azul claro, así que el texto va oscuro para mantener el contraste.
  const textoSobreAcento = esOscuro ? colores.fondo : "#fff";

  const estiloInput = [
    styles.input,
    {
      backgroundColor: colores.fondo,
      borderColor: esOscuro ? BORDE_INPUT_OSCURO : colores.borde,
      color: colores.texto,
    },
  ];

  const propsInput = {
    placeholderTextColor: colores.textoSecundario,
    cursorColor: colores.acento,
    selectionColor: colores.acento,
  };

    return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[styles.contenedor, { backgroundColor: colores.fondo }]}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View
          style={[
            styles.encabezado,
            {
              backgroundColor: colores.encabezado,
              borderBottomColor: colores.borde,
              paddingTop: margenSuperior,
            },
          ]}
        >
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colores.texto} />
        </TouchableOpacity>
        <Text style={[styles.tituloEncabezado, { color: colores.texto }]}>Editar perfil</Text>
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
            style={[styles.avatar, { backgroundColor: colores.borde, borderColor: colores.borde }]}
          />
          <View
            style={[
              styles.botonCamara,
              { backgroundColor: colores.acento, borderColor: colores.fondo },
            ]}
          >
            {subiendoFoto ? (
              <ActivityIndicator size="small" color={textoSobreAcento} />
            ) : (
              <Ionicons name="camera" size={16} color={textoSobreAcento} />
            )}
          </View>
        </TouchableOpacity>
        <Text style={[styles.textoCambiarFoto, { color: colores.acento }]}>
          Toca para cambiar tu foto
        </Text>
      </View>

      {/* Formulario: en oscuro, borde sutil en lugar de sombra */}
      <View
        style={[
          styles.formulario,
          { backgroundColor: colores.tarjeta },
          esOscuro && { borderWidth: 1, borderColor: colores.borde },
        ]}
      >
        <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>Nombre</Text>
        <TextInput
          style={estiloInput}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Tu nombre"
          {...propsInput}
        />

        <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>Apellido</Text>
        <TextInput
          style={estiloInput}
          value={apellido}
          onChangeText={setApellido}
          placeholder="Tu apellido"
          {...propsInput}
        />

        <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>Ciudad</Text>
        <TextInput
          style={estiloInput}
          value={ciudad}
          onChangeText={setCiudad}
          placeholder="Tu ciudad"
          {...propsInput}
        />
      </View>

      <TouchableOpacity
        style={[styles.botonGuardar, { backgroundColor: colores.acento }]}
        onPress={guardarCambios}
        disabled={guardando || subiendoFoto}
      >
        {guardando ? (
          <ActivityIndicator color={textoSobreAcento} />
        ) : (
          <Text style={[styles.textoBotonGuardar, { color: textoSobreAcento }]}>
            Guardar cambios
          </Text>
        )}
      </TouchableOpacity>
          </ScrollView>
    </>
  );
}

// Borde de los campos en oscuro: más visible que colores.borde (#333) sobre el fondo #121212
const BORDE_INPUT_OSCURO = "#4A4A4A";

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },

  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tituloEncabezado: { fontSize: 17, fontWeight: "bold" },

  seccionFoto: { alignItems: "center", marginTop: 28 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
  },
  botonCamara: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  textoCambiarFoto: { fontSize: 13, marginTop: 10 },

  formulario: {
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 28,
    padding: 20,
  },
  etiqueta: { fontSize: 13, marginBottom: 6, marginTop: 14 },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },

  botonGuardar: {
    marginHorizontal: 16,
    marginTop: 24,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonGuardar: { fontSize: 15, fontWeight: "600" },
});