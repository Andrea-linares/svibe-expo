import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Hito = { id: string; nombre: string };

const TIPOS = [
  { valor: "sitio", etiqueta: "Problema con un sitio" },
  { valor: "app", etiqueta: "Problema con la app" },
  { valor: "cuenta", etiqueta: "Problema con mi cuenta" },
  { valor: "otro", etiqueta: "Otro" },
];

export default function ReportarProblemaScreen() {
  const { colores } = useTema();
  const [verificandoSesion, setVerificandoSesion] = useState(true);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  const [tipo, setTipo] = useState("otro");
  const [descripcion, setDescripcion] = useState("");
  const [esAnonimo, setEsAnonimo] = useState(false);

  const [busquedaHito, setBusquedaHito] = useState("");
  const [hitosEncontrados, setHitosEncontrados] = useState<Hito[]>([]);
  const [hitoSeleccionado, setHitoSeleccionado] = useState<Hito | null>(null);

  const [imagenSeleccionada, setImagenSeleccionada] = useState<string | null>(
    null,
  );
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    async function verificar() {
      const { data } = await supabase.auth.getUser();
      setUsuarioId(data.user?.id ?? null);
      setVerificandoSesion(false);
    }
    verificar();
  }, []);

  useEffect(() => {
    if (tipo !== "sitio" || busquedaHito.trim().length < 2) {
      setHitosEncontrados([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("hitos")
        .select("id, nombre")
        .ilike("nombre", `%${busquedaHito.trim()}%`)
        .limit(6);
      setHitosEncontrados(data ?? []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [busquedaHito, tipo]);

  async function elegirImagen() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(
        "Permiso necesario",
        "Necesitamos acceso a tu galería para adjuntar la captura.",
      );
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });

    if (!resultado.canceled) {
      setImagenSeleccionada(resultado.assets[0].uri);
    }
  }

  async function subirImagenYObtenerUrl(): Promise<string | null> {
    if (!imagenSeleccionada) return null;

    const base64 = await FileSystem.readAsStringAsync(imagenSeleccionada, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const nombreArchivo = `reporte-${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("reportes-imagenes")
      .upload(nombreArchivo, decode(base64), { contentType: "image/jpeg" });

    if (error) {
      Alert.alert("Error al subir la imagen", error.message);
      return null;
    }

    const { data } = supabase.storage
      .from("reportes-imagenes")
      .getPublicUrl(nombreArchivo);
    return data.publicUrl;
  }

  async function enviarReporte() {
    if (!descripcion.trim()) {
      Alert.alert("Falta la descripción", "Cuéntanos qué pasó.");
      return;
    }
    if (tipo === "sitio" && !hitoSeleccionado) {
      Alert.alert(
        "Falta el lugar",
        "Selecciona a qué sitio se refiere el problema.",
      );
      return;
    }

    setEnviando(true);

    const urlImagen = await subirImagenYObtenerUrl();

    const { error } = await supabase.from("reportes_problemas").insert({
      usuario_id: esAnonimo ? null : usuarioId,
      hito_id: tipo === "sitio" ? hitoSeleccionado?.id : null,
      tipo,
      descripcion: descripcion.trim(),
      es_anonimo: esAnonimo,
      imagen_url: urlImagen,
    });

    setEnviando(false);

    if (error) {
      Alert.alert("Error al enviar", error.message);
      return;
    }

    Alert.alert("Gracias", "Tu reporte fue enviado. Lo revisaremos pronto.");
    router.back();
  }

  if (verificandoSesion) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#3B6FA0" />
      </View>
    );
  }

  if (!usuarioId) {
    return (
      <View
        style={[
          styles.centrado,
          { backgroundColor: colores.fondo, paddingHorizontal: 32 },
        ]}
      >
        <Text style={[styles.tituloInvitado, { color: colores.texto }]}>
          Inicia sesión para reportar
        </Text>
        <Text
          style={[styles.textoInvitado, { color: colores.textoSecundario }]}
        >
          Necesitas una cuenta para enviar un reporte, aunque puedas elegir que
          sea anónimo.
        </Text>
        <TouchableOpacity
          style={styles.botonLogin}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.textoBotonLogin}>Iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.contenedor, { backgroundColor: colores.fondo }]}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 60 }}
    >
      <Text style={[styles.titulo, { color: colores.texto }]}>
        Reportar un problema
      </Text>

      <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>
        ¿De qué se trata?
      </Text>
      <View style={styles.chips}>
        {TIPOS.map((t) => (
          <TouchableOpacity
            key={t.valor}
            style={[styles.chip, tipo === t.valor && styles.chipActivo]}
            onPress={() => {
              setTipo(t.valor);
              setHitoSeleccionado(null);
            }}
          >
            <Text
              style={
                tipo === t.valor ? styles.chipTextoActivo : styles.chipTexto
              }
            >
              {t.etiqueta}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tipo === "sitio" && (
        <View style={{ marginBottom: 14 }}>
          <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>
            Selecciona el lugar
          </Text>

          {hitoSeleccionado ? (
            <TouchableOpacity
              style={[styles.hitoSeleccionado, { borderColor: colores.borde }]}
              onPress={() => setHitoSeleccionado(null)}
            >
              <Text style={{ color: colores.texto }}>
                {hitoSeleccionado.nombre}
              </Text>
              <Text style={{ color: "#3B6FA0", fontSize: 12 }}>Cambiar</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TextInput
                style={[
                  styles.input,
                  { color: colores.texto, borderColor: colores.borde },
                ]}
                placeholder="Escribe el nombre del lugar..."
                placeholderTextColor="#999"
                value={busquedaHito}
                onChangeText={setBusquedaHito}
              />
              {hitosEncontrados.map((h) => (
                <TouchableOpacity
                  key={h.id}
                  style={[
                    styles.resultadoHito,
                    { backgroundColor: colores.tarjeta },
                  ]}
                  onPress={() => {
                    setHitoSeleccionado(h);
                    setBusquedaHito("");
                    setHitosEncontrados([]);
                  }}
                >
                  <Text style={{ color: colores.texto }}>{h.nombre}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}

      <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>
        Describe el problema *
      </Text>
      <TextInput
        style={[
          styles.input,
          styles.inputMultilinea,
          { color: colores.texto, borderColor: colores.borde },
        ]}
        placeholder="Cuéntanos qué pasó..."
        placeholderTextColor="#999"
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
      />

      {/* Adjuntar imagen (opcional) */}
      <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>
        Adjuntar captura o foto (opcional)
      </Text>
      <TouchableOpacity onPress={elegirImagen} style={{ marginBottom: 14 }}>
        {imagenSeleccionada ? (
          <View>
            <Image
              source={{ uri: imagenSeleccionada }}
              style={{ width: "100%", height: 160, borderRadius: 12 }}
            />
            <TouchableOpacity
              style={styles.botonQuitarImagen}
              onPress={() => setImagenSeleccionada(null)}
            >
              <Ionicons name="close-circle" size={26} color="#D32F2F" />
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={[styles.cajaImagenVacia, { borderColor: colores.borde }]}
          >
            <Ionicons
              name="camera-outline"
              size={22}
              color={colores.textoSecundario}
            />
            <Text
              style={{
                color: colores.textoSecundario,
                marginTop: 4,
                fontSize: 13,
              }}
            >
              Toca para adjuntar una imagen
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.filaSwitch}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.etiqueta,
              { color: colores.texto, marginTop: 0, fontSize: 14 },
            ]}
          >
            Enviar de forma anónima
          </Text>
          <Text
            style={[styles.subtextoSwitch, { color: colores.textoSecundario }]}
          >
            Tu nombre no aparecerá en el reporte
          </Text>
        </View>
        <Switch value={esAnonimo} onValueChange={setEsAnonimo} />
      </View>

      <TouchableOpacity
        style={styles.botonEnviar}
        onPress={enviarReporte}
        disabled={enviando}
      >
        {enviando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.textoBotonEnviar}>Enviar reporte</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.botonMisReportes}
        onPress={() => router.push("/mis-reportes")}
      >
        <Ionicons
          name="document-text-outline"
          size={18}
          color="#3B6FA0"
          style={{ marginRight: 8 }}
        />
        <Text style={styles.textoBotonMisReportes}>Ver mis reportes</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  tituloInvitado: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  textoInvitado: { fontSize: 14, textAlign: "center", marginBottom: 20 },
  botonLogin: {
    backgroundColor: "#3B6FA0",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  textoBotonLogin: { color: "#fff", fontWeight: "600" },
  titulo: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  etiqueta: { fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  chipActivo: { backgroundColor: "#3B6FA0" },
  chipTexto: { color: "#333" },
  chipTextoActivo: { color: "#fff", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  inputMultilinea: { height: 100, textAlignVertical: "top", marginBottom: 14 },
  resultadoHito: { padding: 12, borderRadius: 8, marginBottom: 6 },
  hitoSeleccionado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  cajaImagenVacia: {
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  botonQuitarImagen: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 13,
  },
  filaSwitch: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 10,
  },
  subtextoSwitch: { fontSize: 12, marginTop: 2 },
  botonEnviar: {
    height: 52,
    backgroundColor: "#3B6FA0",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonEnviar: { color: "#fff", fontSize: 15, fontWeight: "600" },
  botonMisReportes: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    height: 50,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "#3B6FA0",
    marginTop: 14,
  },
  textoBotonMisReportes: { color: "#3B6FA0", fontWeight: "600", fontSize: 14 },
});
