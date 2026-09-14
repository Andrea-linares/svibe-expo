import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
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

type Categoria = { id: number; nombre: string };

export default function HitoFormularioScreen() {
  const { colores } = useTema();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const esEdicion = !!id;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [datoCurioso, setDatoCurioso] = useState("");
  const [leyenda, setLeyenda] = useState("");
  const [historia, setHistoria] = useState("");
  const [eventosInfo, setEventosInfo] = useState("");
  const [direccionReferencia, setDireccionReferencia] = useState("");
  const [precio, setPrecio] = useState("0");
  const [precioTexto, setPrecioTexto] = useState("");
  const [esLugarOculto, setEsLugarOculto] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [busquedaDireccion, setBusquedaDireccion] = useState("");
  const [resultadosDireccion, setResultadosDireccion] = useState<any[]>([]);
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);

  const [horaApertura, setHoraApertura] = useState("08:00");
  const [horaCierre, setHoraCierre] = useState("17:00");

  const [imagenSeleccionada, setImagenSeleccionada] = useState<string | null>(
    null,
  );
  const [subiendoImagen, setSubiendoImagen] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    async function cargar() {
      const { data: cats } = await supabase
        .from("categorias")
        .select("id, nombre");
      setCategorias(cats ?? []);

      if (esEdicion) {
        const { data: horarioExistente } = await supabase
          .from("horarios_hito")
          .select("hora_apertura, hora_cierre")
          .eq("hito_id", id)
          .limit(1)
          .maybeSingle();

        if (horarioExistente) {
          setHoraApertura(horarioExistente.hora_apertura.slice(0, 5));
          setHoraCierre(horarioExistente.hora_cierre.slice(0, 5));
        }
        const { data } = await supabase
          .from("hitos")
          .select("*")
          .eq("id", id)
          .single();
        if (data) {
          setNombre(data.nombre ?? "");
          setDescripcion(data.descripcion ?? "");
          setDatoCurioso(data.dato_curioso ?? "");
          setLeyenda(data.leyenda ?? "");
          setHistoria(data.historia ?? "");
          setEventosInfo(data.eventos_info ?? "");
          setDireccionReferencia(data.direccion_referencia ?? "");
          setPrecio(String(data.precio ?? 0));
          setPrecioTexto(data.precio_texto ?? "");
          setEsLugarOculto(data.es_lugar_oculto ?? false);
          setCategoriaId(data.categoria_id ?? null);
          setLat(data.lat ? String(data.lat) : "");
          setLng(data.lng ? String(data.lng) : "");
        }
      }
      setCargando(false);
    }
    cargar();
  }, [id]);

  // ---- Buscador de dirección (OpenStreetMap / Nominatim) ----
  async function buscarDireccion() {
    if (!busquedaDireccion.trim()) return;

    setBuscandoDireccion(true);
    setResultadosDireccion([]);

    try {
      const respuesta = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          busquedaDireccion + ", El Salvador",
        )}`,
        { headers: { "Accept-Language": "es" } },
      );
      const datos = await respuesta.json();
      setResultadosDireccion(datos);
    } catch (error) {
      Alert.alert(
        "Error",
        "No se pudo buscar la dirección. Verifica tu conexión.",
      );
    } finally {
      setBuscandoDireccion(false);
    }
  }

  function seleccionarResultado(resultado: any) {
    setLat(resultado.lat);
    setLng(resultado.lon);
    setDireccionReferencia(resultado.display_name);
    setResultadosDireccion([]);
    setBusquedaDireccion("");
  }

  // ---- Selector de imagen ----
  async function elegirImagen() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(
        "Permiso necesario",
        "Necesitamos acceso a tu galería para subir la foto.",
      );
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!resultado.canceled) {
      setImagenSeleccionada(resultado.assets[0].uri);
    }
  }

  async function subirImagenYVincular(hitoId: string) {
    if (!imagenSeleccionada) return;

    setSubiendoImagen(true);

    const base64 = await FileSystem.readAsStringAsync(imagenSeleccionada, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const nombreArchivo = `${hitoId}-${Date.now()}.jpg`;

    const { error: errorSubida } = await supabase.storage
      .from("hitos-imagenes")
      .upload(nombreArchivo, decode(base64), { contentType: "image/jpeg" });

    if (errorSubida) {
      Alert.alert("Error al subir imagen", errorSubida.message);
      setSubiendoImagen(false);
      return;
    }

    const { data: urlPublica } = supabase.storage
      .from("hitos-imagenes")
      .getPublicUrl(nombreArchivo);

    const { error: errorInsertarImagen } = await supabase
      .from("hito_imagenes")
      .insert({
        hito_id: hitoId,
        url: urlPublica.publicUrl,
        orden: 1,
      });

    if (errorInsertarImagen) {
      Alert.alert("Error al vincular imagen", errorInsertarImagen.message);
    }

    setSubiendoImagen(false);
  }

  // ---- Guardar (crear o editar) ----
  async function guardar() {
    if (!nombre.trim() || !lat.trim() || !lng.trim()) {
      Alert.alert(
        "Faltan datos",
        "Nombre, latitud y longitud son obligatorios.",
      );
      return;
    }

    setGuardando(true);

    const { data, error } = await supabase.rpc("admin_guardar_hito", {
      p_id: esEdicion ? id : null,
      p_nombre: nombre.trim(),
      p_descripcion: descripcion.trim() || null,
      p_dato_curioso: datoCurioso.trim() || null,
      p_leyenda: leyenda.trim() || null,
      p_historia: historia.trim() || null,
      p_eventos_info: eventosInfo.trim() || null,
      p_direccion_referencia: direccionReferencia.trim() || null,
      p_categoria_id: categoriaId,
      p_precio: parseFloat(precio) || 0,
      p_precio_texto: precioTexto.trim() || null,
      p_es_lugar_oculto: esLugarOculto,
      p_lat: parseFloat(lat),
      p_lng: parseFloat(lng),
    });

    if (error) {
      setGuardando(false);
      Alert.alert("Error al guardar", error.message);
      return;
    }

    // "data" trae el UUID del hito recién creado/editado (lo devuelve la función RPC)
    if (imagenSeleccionada && data) {
      await subirImagenYVincular(data as string);
    }
    if (data) {
      await supabase.from("horarios_hito").delete().eq("hito_id", data);

      const filas = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
        hito_id: data,
        dia_semana: dia,
        hora_apertura: horaApertura,
        hora_cierre: horaCierre,
      }));

      await supabase.from("horarios_hito").insert(filas);
    }
    setGuardando(false);
    Alert.alert("Listo", esEdicion ? "Lugar actualizado." : "Lugar creado.");
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
    <ScrollView
      style={[styles.contenedor, { backgroundColor: colores.fondo }]}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 60 }}
    >
      <Text style={[styles.titulo, { color: colores.texto }]}>
        {esEdicion ? "Editar lugar" : "Nuevo lugar"}
      </Text>

      {/* Selector de imagen */}
      <TouchableOpacity onPress={elegirImagen} style={{ marginBottom: 16 }}>
        {imagenSeleccionada ? (
          <Image
            source={{ uri: imagenSeleccionada }}
            style={{ width: "100%", height: 160, borderRadius: 12 }}
          />
        ) : (
          <View
            style={{
              height: 100,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colores.borde,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: colores.textoSecundario }}>
              Toca para elegir una imagen
            </Text>
          </View>
        )}
        {subiendoImagen && <ActivityIndicator style={{ marginTop: 8 }} />}
      </TouchableOpacity>

      <Campo
        etiqueta="Nombre *"
        valor={nombre}
        onCambio={setNombre}
        colores={colores}
      />
      <Campo
        etiqueta="Descripción"
        valor={descripcion}
        onCambio={setDescripcion}
        colores={colores}
        multilinea
      />
      <Campo
        etiqueta="Dato curioso"
        valor={datoCurioso}
        onCambio={setDatoCurioso}
        colores={colores}
        multilinea
      />
      <Campo
        etiqueta="Leyenda"
        valor={leyenda}
        onCambio={setLeyenda}
        colores={colores}
        multilinea
      />
      <Campo
        etiqueta="Historia"
        valor={historia}
        onCambio={setHistoria}
        colores={colores}
        multilinea
      />
      <Campo
        etiqueta="Eventos (texto general)"
        valor={eventosInfo}
        onCambio={setEventosInfo}
        colores={colores}
        multilinea
      />

      {/* Buscador de dirección */}
      <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>
        Buscar dirección
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <TextInput
          style={[
            styles.input,
            { flex: 1, color: colores.texto, borderColor: colores.borde },
          ]}
          placeholder="Ej: Catedral San Miguel, El Salvador"
          placeholderTextColor="#999"
          value={busquedaDireccion}
          onChangeText={setBusquedaDireccion}
        />
        <TouchableOpacity
          style={{
            backgroundColor: "#3B6FA0",
            borderRadius: 10,
            paddingHorizontal: 16,
            justifyContent: "center",
          }}
          onPress={buscarDireccion}
        >
          {buscandoDireccion ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "600" }}>Buscar</Text>
          )}
        </TouchableOpacity>
      </View>

      {resultadosDireccion.map((resultado, i) => (
        <TouchableOpacity
          key={i}
          style={{
            padding: 12,
            backgroundColor: colores.tarjeta,
            borderRadius: 8,
            marginBottom: 6,
          }}
          onPress={() => seleccionarResultado(resultado)}
        >
          <Text style={{ color: colores.texto, fontSize: 13 }}>
            {resultado.display_name}
          </Text>
        </TouchableOpacity>
      ))}

      <Campo
        etiqueta="Dirección de referencia (texto final)"
        valor={direccionReferencia}
        onCambio={setDireccionReferencia}
        colores={colores}
      />

      <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>
        Categoría
      </Text>
      <View style={styles.chips}>
        {categorias.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.chip, categoriaId === cat.id && styles.chipActivo]}
            onPress={() => setCategoriaId(cat.id)}
          >
            <Text
              style={
                categoriaId === cat.id
                  ? styles.chipTextoActivo
                  : styles.chipTexto
              }
            >
              {cat.nombre}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.fila2}>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Precio (número)"
            valor={precio}
            onCambio={setPrecio}
            colores={colores}
            teclado="decimal-pad"
          />
        </View>
      </View>
      <Campo
        etiqueta="Precio (texto a mostrar)"
        valor={precioTexto}
        onCambio={setPrecioTexto}
        colores={colores}
      />

      <View style={styles.fila2}>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Latitud *"
            valor={lat}
            onCambio={setLat}
            colores={colores}
            teclado="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Longitud *"
            valor={lng}
            onCambio={setLng}
            colores={colores}
            teclado="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.filaSwitch}>
        <Text
          style={[
            styles.etiqueta,
            { color: colores.textoSecundario, marginTop: 0 },
          ]}
        >
          ¿Es un lugar oculto?
        </Text>
        <Switch value={esLugarOculto} onValueChange={setEsLugarOculto} />
      </View>

      <View style={styles.fila2}>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Hora de apertura (HH:MM)"
            valor={horaApertura}
            onCambio={setHoraApertura}
            colores={colores}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Hora de cierre (HH:MM)"
            valor={horaCierre}
            onCambio={setHoraCierre}
            colores={colores}
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.botonGuardar}
        onPress={guardar}
        disabled={guardando}
      >
        {guardando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.textoBotonGuardar}>
            {esEdicion ? "Guardar cambios" : "Crear lugar"}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Campo({
  etiqueta,
  valor,
  onCambio,
  colores,
  multilinea,
  teclado,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  colores: any;
  multilinea?: boolean;
  teclado?: "default" | "decimal-pad";
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>
        {etiqueta}
      </Text>
      <TextInput
        style={[
          styles.input,
          { color: colores.texto, borderColor: colores.borde },
          multilinea && { height: 80, textAlignVertical: "top" },
        ]}
        value={valor}
        onChangeText={onCambio}
        multiline={multilinea}
        keyboardType={teclado ?? "default"}
        placeholderTextColor="#999"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  titulo: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  etiqueta: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  fila2: { flexDirection: "row", gap: 12 },
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
  filaSwitch: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 16,
  },
  botonGuardar: {
    height: 52,
    backgroundColor: "#3B6FA0",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  textoBotonGuardar: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
