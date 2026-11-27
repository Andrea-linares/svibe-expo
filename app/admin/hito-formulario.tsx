import { useTema } from "@/contexts/ThemeContext";
import { useMargenSuperior } from "@/hooks/use-margen-superior";
import { normalizarHora } from "@/lib/fechas";
import {
  alternarDia,
  ATAJOS_DIAS,
  BloqueHorario,
  expandirAFilas,
  FilaHorario,
  FormHorario,
  formDesdeFilas,
  formNuevo,
  hayCambios,
  NOMBRE_CORTO_DIA,
  nuevoBloque,
  ORDEN_DIAS,
  validarForm,
} from "@/lib/horarios-bloques";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
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

type ImagenExistente = { id: number; url: string; orden: number };


export default function HitoFormularioScreen() {
  const { colores } = useTema();
  const margenSuperior = useMargenSuperior(60);
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

  // Horario en el formulario y filas tal como se cargaron de la BD
  // (null: lugar nuevo o no se pudieron cargar)
  const [formHorario, setFormHorario] = useState<FormHorario>(formNuevo);
  const [filasCargadas, setFilasCargadas] = useState<FilaHorario[] | null>(
    null,
  );

  function actualizarHorario(cambios: Partial<FormHorario>) {
    setFormHorario((actual) => ({ ...actual, ...cambios }));
  }

  function cambiarPorDia(porDia: boolean) {
    setFormHorario((actual) => {
      // Al activarlo con 0 o 1 bloque, empieza con el par actual en todos los días
      if (porDia && actual.bloques.length <= 1) {
        return {
          ...actual,
          porDia,
          bloques: [nuevoBloque(ORDEN_DIAS, actual.apertura, actual.cierre)],
        };
      }
      return { ...actual, porDia };
    });
  }

  function cambiarBloque(bloque: BloqueHorario) {
    setFormHorario((actual) => ({
      ...actual,
      bloques: actual.bloques.map((b) => (b.id === bloque.id ? bloque : b)),
    }));
  }

  function eliminarBloque(id: string) {
    setFormHorario((actual) => ({
      ...actual,
      bloques: actual.bloques.filter((b) => b.id !== id),
    }));
  }

  // El bloque nuevo lleva los días que aún no están en ningún bloque
  function agregarBloque() {
    setFormHorario((actual) => {
      const usados = new Set(actual.bloques.flatMap((b) => b.dias));
      const libres = ORDEN_DIAS.filter((d) => !usados.has(d));
      return { ...actual, bloques: [...actual.bloques, nuevoBloque(libres)] };
    });
  }

  // ---- Imágenes ----
  const [imagenesExistentes, setImagenesExistentes] = useState<
    ImagenExistente[]
  >([]);
  const [imagenesNuevas, setImagenesNuevas] = useState<string[]>([]);
  const [subiendoImagenes, setSubiendoImagenes] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    async function cargar() {
      const { data: cats } = await supabase
        .from("categorias")
        .select("id, nombre");
      setCategorias(cats ?? []);

      if (esEdicion) {
        // Todas las filas, en orden de día (antes: una fila cualquiera)
        const { data: horariosExistentes, error: errorHorarios } =
          await supabase
            .from("horarios_hito")
            .select("dia_semana, hora_apertura, hora_cierre")
            .eq("hito_id", id)
            .order("dia_semana", { ascending: true });

        if (errorHorarios) {
          // filasCargadas queda en null: al guardar no se toca el horario
          console.error("Error cargando horarios:", errorHorarios);
        } else {
          const filas = (horariosExistentes ?? []) as FilaHorario[];
          setFilasCargadas(filas);
          setFormHorario(formDesdeFilas(filas));
        }

        const { data: imagenesData } = await supabase
          .from("hito_imagenes")
          .select("id, url, orden")
          .eq("hito_id", id)
          .order("orden", { ascending: true });
        setImagenesExistentes(imagenesData ?? []);

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
        {
          headers: {
            "Accept-Language": "es",
            "User-Agent": "SVibeApp/1.0 (contacto@svibe.app)",
          },
        },
      );

      if (!respuesta.ok) {
        const textoError = await respuesta.text();
        console.log(
          "Nominatim respondió con error:",
          respuesta.status,
          textoError,
        );
        Alert.alert(
          "Error del servidor de mapas",
          `El buscador de direcciones respondió con un error (código ${respuesta.status}). Intenta de nuevo en unos segundos.`,
        );
        return;
      }

      const datos = await respuesta.json();
      setResultadosDireccion(datos);
    } catch (error: any) {
      console.log("Error real al buscar dirección:", error);
      Alert.alert(
        "No se pudo buscar",
        `Detalle técnico: ${error?.message ?? "desconocido"}`,
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

  // ---- Selector de imágenes (ahora permite elegir varias) ----
  async function elegirImagenes() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(
        "Permiso necesario",
        "Necesitamos acceso a tu galería para subir fotos.",
      );
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
    });

    if (!resultado.canceled) {
      const nuevasUris = resultado.assets.map((a) => a.uri);
      setImagenesNuevas((actual) => [...actual, ...nuevasUris]);
    }
  }

  // Quita una imagen recién elegida (todavía no se ha subido)
  function quitarImagenNueva(uri: string) {
    setImagenesNuevas((actual) => actual.filter((u) => u !== uri));
  }

  // Elimina una imagen que YA está guardada en la base de datos
  function confirmarEliminarImagenExistente(imagen: ImagenExistente) {
    Alert.alert(
      "Eliminar foto",
      "¿Seguro que quieres eliminar esta foto? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("hito_imagenes")
              .delete()
              .eq("id", imagen.id);

            if (error) {
              Alert.alert("Error al eliminar", error.message);
              return;
            }

            setImagenesExistentes((actual) =>
              actual.filter((img) => img.id !== imagen.id),
            );
          },
        },
      ],
    );
  }

  // Sube todas las imágenes nuevas y las vincula al hito
  async function subirImagenesYVincular(hitoId: string) {
    if (imagenesNuevas.length === 0) return;

    setSubiendoImagenes(true);

    const ordenBase = imagenesExistentes.length;

    for (let i = 0; i < imagenesNuevas.length; i++) {
      const uri = imagenesNuevas[i];

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const nombreArchivo = `${hitoId}-${Date.now()}-${i}.jpg`;

      const { error: errorSubida } = await supabase.storage
        .from("hitos-imagenes")
        .upload(nombreArchivo, decode(base64), { contentType: "image/jpeg" });

      if (errorSubida) {
        Alert.alert("Error al subir imagen", errorSubida.message);
        continue;
      }

      const { data: urlPublica } = supabase.storage
        .from("hitos-imagenes")
        .getPublicUrl(nombreArchivo);

      const { error: errorInsertarImagen } = await supabase
        .from("hito_imagenes")
        .insert({
          hito_id: hitoId,
          url: urlPublica.publicUrl,
          orden: ordenBase + i + 1,
        });

      if (errorInsertarImagen) {
        Alert.alert("Error al vincular imagen", errorInsertarImagen.message);
      }
    }

    setSubiendoImagenes(false);
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

    const errorValidacion = validarForm(formHorario, normalizarHora);
    if (errorValidacion) {
      Alert.alert("Horario inválido", errorValidacion);
      return;
    }

    // Una fila por día abierto. En edición solo se guarda si el admin cambió
    // el horario respecto a lo cargado (para no pisar horarios existentes);
    // si no se pudo cargar, no se toca.
    const filasNuevas = expandirAFilas(formHorario, normalizarHora);
    const horarioNoCargado = esEdicion && filasCargadas === null;
    const guardarHorario =
      !esEdicion ||
      (filasCargadas !== null && hayCambios(filasCargadas, filasNuevas));

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
      p_precio: Number.parseFloat(precio) || 0,
      p_precio_texto: precioTexto.trim() || null,
      p_es_lugar_oculto: esLugarOculto,
      p_lat: Number.parseFloat(lat),
      p_lng: Number.parseFloat(lng),
    });

    if (error) {
      setGuardando(false);
      Alert.alert("Error al guardar", error.message);
      return;
    }

    // "data" trae el UUID del hito recién creado/editado (lo devuelve la función RPC).
    // Si viene vacío, el update no afectó ninguna fila (el lugar no existe).
    if (!data) {
      setGuardando(false);
      Alert.alert(
        "Error al guardar",
        esEdicion
          ? "No se encontró el lugar; no se guardó ningún cambio."
          : "No se pudo crear el lugar.",
      );
      return;
    }
    const hitoId = data as string;

    if (imagenesNuevas.length > 0) {
      await subirImagenesYVincular(hitoId);
    }

    // Horario: se guarda en el servidor (solo admin) y se vuelve a leer
    let horarioOk = true;
    let errorHorario: { message: string } | null = null;

    if (guardarHorario) {
      const respuesta = await supabase.rpc("admin_guardar_horarios", {
        p_hito_id: hitoId,
        p_horarios: filasNuevas,
      });
      errorHorario = respuesta.error;
      horarioOk = !respuesta.error && respuesta.data === filasNuevas.length;

      if (horarioOk) {
        const { data: releidos, error: errorRelectura } = await supabase
          .from("horarios_hito")
          .select("dia_semana, hora_apertura, hora_cierre")
          .eq("hito_id", hitoId);
        horarioOk =
          !errorRelectura &&
          !hayCambios((releidos ?? []) as FilaHorario[], filasNuevas);
      }
    }

    setGuardando(false);

    if (!horarioOk) {
      console.error("Error guardando horario:", errorHorario);
      if (esEdicion) {
        // Se queda en el formulario para reintentar
        Alert.alert(
          "Horario no guardado",
          `Los demás datos del lugar se guardaron, pero el horario no.${
            errorHorario ? `\n\n${errorHorario.message}` : ""
          }`,
        );
      } else {
        // No se queda aquí: reintentar crearía el lugar dos veces
        Alert.alert(
          "Horario no guardado",
          "El lugar se creó, pero el horario no. Ábrelo desde la lista para editarlo.",
        );
        router.back();
      }
      return;
    }

    Alert.alert(
      "Listo",
      horarioNoCargado
        ? "Lugar actualizado. El horario no se modificó porque no se pudo cargar."
        : esEdicion
          ? "Lugar actualizado."
          : "Lugar creado.",
    );
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
      contentContainerStyle={{ padding: 20, paddingTop: margenSuperior, paddingBottom: 60 }}
    >
      <Text style={[styles.titulo, { color: colores.texto }]}>
        {esEdicion ? "Editar lugar" : "Nuevo lugar"}
      </Text>

      {esEdicion && (
        <TouchableOpacity
          style={[styles.botonRA, { borderColor: colores.acentoRA }]}
          onPress={() => router.push(`/admin/vista-360/${id}`)}
        >
          <Ionicons name="sync-outline" size={20} color={colores.acentoRA} />
          <Text style={[styles.textoBotonRA, { color: colores.acentoRA }]}>
            Configurar vista 360
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colores.acentoRA} />
        </TouchableOpacity>
      )}

      {/* Selector de imágenes múltiple */}
      <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>
        Fotos
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 16 }}
        contentContainerStyle={{ gap: 10 }}
      >
        {imagenesExistentes.map((img) => (
          <View key={`existente-${img.id}`} style={styles.miniaturaContenedor}>
            <Image source={{ uri: img.url }} style={styles.miniatura} />
            <TouchableOpacity
              style={styles.botonQuitar}
              onPress={() => confirmarEliminarImagenExistente(img)}
            >
              <Ionicons name="close" size={13} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {imagenesNuevas.map((uri, index) => (
          <View key={`nueva-${index}`} style={styles.miniaturaContenedor}>
            <Image source={{ uri }} style={styles.miniatura} />
            <TouchableOpacity
              style={styles.botonQuitar}
              onPress={() => quitarImagenNueva(uri)}
            >
              <Ionicons name="close" size={13} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.botonAgregarImagen, { borderColor: colores.borde }]}
          onPress={elegirImagenes}
        >
          <Ionicons name="add" size={26} color={colores.textoSecundario} />
        </TouchableOpacity>
      </ScrollView>
      {subiendoImagenes && (
        <ActivityIndicator style={{ marginBottom: 12 }} color="#3B6FA0" />
      )}

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

      {/* ---- Horario ---- */}
      <Text style={[styles.tituloSeccion, { color: colores.texto }]}>
        Horario
      </Text>

      <View style={[styles.filaSwitch, { marginVertical: 8 }]}>
        <Text
          style={[
            styles.etiqueta,
            { color: colores.textoSecundario, marginTop: 0 },
          ]}
        >
          Abierto las 24 horas
        </Text>
        <Switch
          value={formHorario.veinticuatro}
          onValueChange={(valor) => actualizarHorario({ veinticuatro: valor })}
        />
      </View>

      {!formHorario.veinticuatro && (
        <>
          <View style={[styles.filaSwitch, { marginVertical: 8 }]}>
            <Text
              style={[
                styles.etiqueta,
                { color: colores.textoSecundario, marginTop: 0 },
              ]}
            >
              Horarios diferentes según el día
            </Text>
            <Switch value={formHorario.porDia} onValueChange={cambiarPorDia} />
          </View>

          {formHorario.porDia ? (
            <>
              {formHorario.bloques.length === 0 && (
                <Text
                  style={[styles.ayuda, { color: colores.textoSecundario }]}
                >
                  Este lugar no tiene horario: en el detalle no se muestra.
                  Agrega un horario para definirlo.
                </Text>
              )}

              {formHorario.bloques.map((bloque, indice) => (
                <EditorBloque
                  key={bloque.id}
                  bloque={bloque}
                  indice={indice}
                  colores={colores}
                  onCambio={cambiarBloque}
                  onEliminar={() => eliminarBloque(bloque.id)}
                />
              ))}

              <TouchableOpacity
                style={[styles.botonAgregarBloque, { borderColor: colores.acento }]}
                onPress={agregarBloque}
              >
                <Ionicons name="add" size={18} color={colores.acento} />
                <Text style={[styles.textoAgregarBloque, { color: colores.acento }]}>
                  Agregar otro horario
                </Text>
              </TouchableOpacity>

              <Text style={[styles.ayuda, { color: colores.textoSecundario }]}>
                Los días que no estén en ningún horario se muestran como
                cerrados.
              </Text>
            </>
          ) : (
            <View style={styles.fila2}>
              <View style={{ flex: 1 }}>
                <Campo
                  etiqueta="Hora de apertura (HH:MM)"
                  valor={formHorario.apertura}
                  onCambio={(valor) => actualizarHorario({ apertura: valor })}
                  colores={colores}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Campo
                  etiqueta="Hora de cierre (HH:MM)"
                  valor={formHorario.cierre}
                  onCambio={(valor) => actualizarHorario({ cierre: valor })}
                  colores={colores}
                />
              </View>
            </View>
          )}
        </>
      )}

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

// Un bloque de horario: días, horas y "Cerrado"
function EditorBloque({
  bloque,
  indice,
  colores,
  onCambio,
  onEliminar,
}: {
  bloque: BloqueHorario;
  indice: number;
  colores: any;
  onCambio: (bloque: BloqueHorario) => void;
  onEliminar: () => void;
}) {
  return (
    <View style={[styles.bloque, { borderColor: colores.borde, backgroundColor: colores.tarjeta }]}>
      <View style={styles.encabezadoBloque}>
        <Text style={[styles.tituloBloque, { color: colores.texto }]}>
          Horario {indice + 1}
        </Text>
        <TouchableOpacity
          onPress={onEliminar}
          hitSlop={10}
          accessibilityLabel={`Eliminar horario ${indice + 1}`}
        >
          <Ionicons name="trash-outline" size={20} color={colores.peligro} />
        </TouchableOpacity>
      </View>

      {/* Atajos rápidos: reemplazan los días del bloque */}
      <View style={styles.atajos}>
        {ATAJOS_DIAS.map((atajo) => (
          <TouchableOpacity
            key={atajo.etiqueta}
            style={[styles.atajo, { borderColor: colores.acento }]}
            onPress={() =>
              onCambio({ ...bloque, dias: ORDEN_DIAS.filter((d) => atajo.dias.includes(d)) })
            }
          >
            <Text style={[styles.textoAtajo, { color: colores.acento }]}>
              {atajo.etiqueta}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.chips}>
        {ORDEN_DIAS.map((dia) => {
          const activo = bloque.dias.includes(dia);
          return (
            <TouchableOpacity
              key={dia}
              style={[styles.chip, activo && styles.chipActivo]}
              onPress={() => onCambio(alternarDia(bloque, dia))}
            >
              <Text style={activo ? styles.chipTextoActivo : styles.chipTexto}>
                {NOMBRE_CORTO_DIA[dia]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.filaSwitch, { marginVertical: 4 }]}>
        <Text
          style={[
            styles.etiqueta,
            { color: colores.textoSecundario, marginTop: 0 },
          ]}
        >
          Cerrado
        </Text>
        <Switch
          value={bloque.cerrado}
          onValueChange={(valor) => onCambio({ ...bloque, cerrado: valor })}
        />
      </View>

      {!bloque.cerrado && (
        <View style={styles.fila2}>
          <View style={{ flex: 1 }}>
            <Campo
              etiqueta="Apertura (HH:MM)"
              valor={bloque.apertura}
              onCambio={(valor) => onCambio({ ...bloque, apertura: valor })}
              colores={colores}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Campo
              etiqueta="Cierre (HH:MM)"
              valor={bloque.cierre}
              onCambio={(valor) => onCambio({ ...bloque, cierre: valor })}
              colores={colores}
            />
          </View>
        </View>
      )}
    </View>
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
  botonRA: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  textoBotonRA: { flex: 1, fontSize: 15, fontWeight: "600" },
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
  // Horario
  tituloSeccion: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  ayuda: { fontSize: 12, marginBottom: 12 },
  bloque: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  encabezadoBloque: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  tituloBloque: { fontSize: 14, fontWeight: "700" },
  atajos: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  atajo: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  textoAtajo: { fontSize: 12, fontWeight: "600" },
  botonAgregarBloque: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  textoAgregarBloque: { fontSize: 14, fontWeight: "600" },
  botonGuardar: {
    height: 52,
    backgroundColor: "#3B6FA0",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  textoBotonGuardar: { color: "#fff", fontSize: 15, fontWeight: "600" },
  miniaturaContenedor: {
    width: 84,
    height: 84,
    borderRadius: 12,
    overflow: "visible",
  },
  miniatura: {
    width: 84,
    height: 84,
    borderRadius: 12,
  },
  botonQuitar: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#D32F2F",
    justifyContent: "center",
    alignItems: "center",
  },
  botonAgregarImagen: {
    width: 84,
    height: 84,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
});
