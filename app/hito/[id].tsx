import InfoModal from "@/components/InfoModal";
import { supabase } from "@/lib/supabase";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

// ---- Tipos de los datos que vienen de Supabase ----
type Hito = {
  id: string;
  nombre: string;
  descripcion: string | null;
  dato_curioso: string | null;
  leyenda: string | null;
  historia: string | null;
  eventos_info: string | null;
  direccion_referencia: string | null;
  precio: number | null;
  precio_texto: string | null;
};

type Horario = {
  dia_semana: number; // 0=domingo ... 6=sábado
  hora_apertura: string; // "08:00:00"
  hora_cierre: string;
};

type ImagenHito = {
  url: string;
  orden: number;
};

const { width: ANCHO_PANTALLA } = Dimensions.get("window");
const ALTURA_CARRUSEL = 260;
const MAX_IMAGENES_CARRUSEL = 5;

export default function DetalleHitoScreen() {
  // Recibimos el id que viene en la URL (ej: /hito/abc-123)
  const { id } = useLocalSearchParams<{ id: string }>();

  const [hito, setHito] = useState<Hito | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [imagenes, setImagenes] = useState<ImagenHito[]>([]);
  const [cargando, setCargando] = useState(true);

  const [indiceActual, setIndiceActual] = useState(0);
  const [galeriaAbierta, setGaleriaAbierta] = useState(false);

const [modalVisible, setModalVisible] = useState(false);
const [tituloModal, setTituloModal] = useState("");
const [textoModal, setTextoModal] = useState("");

  useEffect(() => {
    async function cargarDatos() {
      if (!id) return;

      // 1. Datos principales del hito
      const { data: hitoData } = await supabase
        .from("hitos")
        .select("*")
        .eq("id", id)
        .single();

      // 2. Horarios de ese hito
      const { data: horariosData } = await supabase
        .from("horarios_hito")
        .select("dia_semana, hora_apertura, hora_cierre")
        .eq("hito_id", id);

      // 3. Imágenes de ese hito (carrusel)
      const { data: imagenesData } = await supabase
        .from("hito_imagenes")
        .select("url, orden")
        .eq("hito_id", id)
        .order("orden", { ascending: true });

      setHito(hitoData);
      setHorarios(horariosData ?? []);
      setImagenes(imagenesData ?? []);
      setCargando(false);
    }

    cargarDatos();
  }, [id]);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#5B8DB8" />
      </View>
    );
  }

  if (!hito) {
    return (
      <View style={styles.centrado}>
        <Text>No se encontró este lugar.</Text>
      </View>
    );
  }

  const estado = calcularEstado(horarios);

  const imagenesCarrusel = imagenes.slice(0, MAX_IMAGENES_CARRUSEL);

  return (
    <ScrollView style={styles.contenedor}>
      {/* 🔧 CAMBIO: bloque completo de imagen principal reemplazado por carrusel + botón de galería */}
      {imagenes.length > 0 ? (
        <View>
          <FlatList
            data={imagenesCarrusel}
            keyExtractor={(item, i) => `${item.url}-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const nuevoIndice = Math.round(
                e.nativeEvent.contentOffset.x / ANCHO_PANTALLA,
              );
              setIndiceActual(nuevoIndice);
            }}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item.url }}
                style={[styles.imagenPrincipal, { width: ANCHO_PANTALLA }]}
              />
            )}
          />

          {/* Puntos indicadores del carrusel */}
          {imagenesCarrusel.length > 1 && (
            <View style={styles.puntosContenedor}>
              {imagenesCarrusel.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.punto,
                    i === indiceActual && styles.puntoActivo,
                  ]}
                />
              ))}
            </View>
          )}

          {/* Botón flotante: aparece al llegar a la última imagen del carrusel */}
          {indiceActual === imagenesCarrusel.length - 1 && (
            <TouchableOpacity
              style={styles.botonGaleria}
              onPress={() => setGaleriaAbierta(true)}
            >
              <Text style={styles.textoBotonGaleria}>
                Ver galería completa
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        // Placeholder si no hay imágenes aún
        <Image
          source={require("@/assets/images/partial-react-logo.png")}
          style={styles.imagenPrincipal}
        />
      )}

      <View style={styles.contenido}>
        {/* Título */}
        <Text style={styles.titulo}>{hito.nombre}</Text>

        {/* Ubicación */}
        {hito.direccion_referencia && (
          <Text style={styles.ubicacion}>📍 {hito.direccion_referencia}</Text>
        )}

        {/* Descripción */}
        {hito.descripcion && (
          <Text style={styles.descripcion}>{hito.descripcion}</Text>
        )}

        {/* Tarjeta de ESTADO (abierto/cerrado, calculado en tiempo real) */}
        <View style={[styles.card, styles.cardEstado]}>
          <Text
            style={[
              styles.textoEstado,
              { color: estado.abierto ? "#2E7D32" : "#D32F2F" },
            ]}
          >
            {estado.abierto ? "Abierto hoy" : "Cerrado ahora"}
          </Text>
          <Text style={styles.textoHora}>{estado.mensajeHora}</Text>
        </View>

        {/* Tarjeta de HORARIOS */}
        {horarios.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Horarios de atención</Text>
            {horarios
              .sort((a, b) => a.dia_semana - b.dia_semana)
              .map((h, i) => (
                <View key={i} style={styles.filaHorario}>
                  <Text>{nombreDia(h.dia_semana)}</Text>
                  <Text style={{ fontWeight: "bold" }}>
                    {formatearHora(h.hora_apertura)} -{" "}
                    {formatearHora(h.hora_cierre)}
                  </Text>
                </View>
              ))}
          </View>
        )}

       {/* PRECIOS */}

<TouchableOpacity
    style={styles.card}
    onPress={()=>{
        setTituloModal("Precios");

        setTextoModal(
            hito.precio_texto
            ? hito.precio_texto
            : hito.precio && hito.precio>0
            ? `Entrada general: $${hito.precio.toFixed(2)} por persona`
            : "Acceso gratuito."
        );

        setModalVisible(true);
    }}
>

<View style={styles.opcion}>

<Text style={styles.opcionTitulo}>
Precios de entrada
</Text>

<Text style={styles.flecha}>›</Text>

</View>

</TouchableOpacity>



<Text
style={styles.subtitulo}
>

Información

</Text>



<ScrollView
horizontal
showsHorizontalScrollIndicator={false}
contentContainerStyle={styles.carruselInfo}
>

{/* LEYENDA */}

<TouchableOpacity

style={styles.cardInfo}

onPress={()=>{

setTituloModal("Leyenda");

setTextoModal(hito.historia || hito.leyenda || "No disponible.");

setModalVisible(true);

}}

>

<Text style={styles.tituloCard}>
Leyenda
</Text>

<Text
numberOfLines={2}
style={styles.descripcionCard}
>

Descubre la historia de este lugar.

</Text>

<Text style={styles.flechaCard}>
›
</Text>

</TouchableOpacity>



{/* DATO CURIOSO */}

<TouchableOpacity

style={styles.cardInfo}

onPress={()=>{

setTituloModal("Dato curioso");

setTextoModal(hito.dato_curioso || "No disponible.");

setModalVisible(true);

}}

>

<Text style={styles.tituloCard}>
Dato curioso
</Text>

<Text
numberOfLines={2}
style={styles.descripcionCard}
>

Conoce algo interesante.

</Text>

<Text style={styles.flechaCard}>
›
</Text>

</TouchableOpacity>



{/* EVENTOS */}

<TouchableOpacity

style={styles.cardInfo}

onPress={()=>{

setTituloModal("Eventos");

setTextoModal(hito.eventos_info || "No disponible.");

setModalVisible(true);

}}

>

<Text style={styles.tituloCard}>
Eventos
</Text>

<Text
numberOfLines={2}
style={styles.descripcionCard}
>

Actividades del lugar.

</Text>

<Text style={styles.flechaCard}>
›
</Text>

</TouchableOpacity>

</ScrollView>
      </View>

       <Modal
        visible={galeriaAbierta}
        animationType="slide"
        onRequestClose={() => setGaleriaAbierta(false)}
      >
        <View style={styles.galeriaContenedor}>
          <View style={styles.galeriaEncabezado}>
            <TouchableOpacity onPress={() => setGaleriaAbierta(false)}>
              <Text style={styles.galeriaVolver}>← Volver</Text>
            </TouchableOpacity>
            <Text style={styles.galeriaTitulo} numberOfLines={1}>
              {hito.nombre}
            </Text>
            <View style={{ width: 50 }} />
          </View>

          <FlatList
            data={imagenes}
            keyExtractor={(item, i) => `${item.url}-${i}`}
            numColumns={2}
            contentContainerStyle={styles.galeriaGrid}
            renderItem={({ item }) => (
              <Image source={{ uri: item.url }} style={styles.galeriaImagen} />
            )}
          />
        </View>
      </Modal>

            <InfoModal
        visible={modalVisible}
        titulo={tituloModal}
        texto={textoModal}
        onClose={() => setModalVisible(false)}
      />

    </ScrollView>
  );
}


// ---- Lógica de abierto/cerrado (equivalente a tu Calendar.getInstance() de Kotlin) ----
function calcularEstado(horarios: Horario[]) {
  const ahora = new Date();
  const diaActual = ahora.getDay(); // 0=domingo ... 6=sábado (igual que en tu BD)
  const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();

  const horarioHoy = horarios.find((h) => h.dia_semana === diaActual);

  if (!horarioHoy) {
    return { abierto: false, mensajeHora: "Cerrado hoy" };
  }

  const [horaA, minA] = horarioHoy.hora_apertura.split(":").map(Number);
  const [horaC, minC] = horarioHoy.hora_cierre.split(":").map(Number);
  const apertura = horaA * 60 + minA;
  const cierre = horaC * 60 + minC;

  const abierto = minutosActuales >= apertura && minutosActuales < cierre;

  return {
    abierto,
    mensajeHora: abierto
      ? `Cierra a las ${formatearHora(horarioHoy.hora_cierre)}`
      : `Abre a las ${formatearHora(horarioHoy.hora_apertura)}`,
  };
}

function nombreDia(dia: number) {
  const dias = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  return dias[dia];
}

function formatearHora(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  const periodo = h >= 12 ? "PM" : "AM";
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${m.toString().padStart(2, "0")} ${periodo}`;
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#F3F3F3" },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  imagenPrincipal: { width: "100%", height: 220 },
  contenido: { padding: 16 },
  titulo: { fontSize: 26, fontWeight: "bold", color: "#000" },
  ubicacion: { fontSize: 14, color: "#444", marginTop: 8 },
  descripcion: { fontSize: 15, color: "#333", marginTop: 12, lineHeight: 22 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    elevation: 3,
  },
  cardEstado: { backgroundColor: "#F1F8F1" },
  cardTitulo: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  textoEstado: { fontSize: 16, fontWeight: "bold" },
  textoHora: { fontSize: 14, color: "#555", marginTop: 4 },
  textoPrecio: { fontSize: 15, color: "#333", marginTop: 4 },
  filaHorario: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  carrusel: { marginTop: 20 },
  cardCarrusel: {
    width: 220,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    elevation: 3,
  },
  textoCard: { fontSize: 14, color: "#333", marginTop: 8 },

  // 🔧 CAMBIO: estilos nuevos para el carrusel de imágenes principal
  puntosContenedor: {
    flexDirection: "row",
    justifyContent: "center",
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
  },
  punto: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.5)",
    marginHorizontal: 3,
  },
  puntoActivo: {
    backgroundColor: "#fff",
    width: 18,
  },
  botonGaleria: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  textoBotonGaleria: { color: "#fff", fontWeight: "600" },

  // 🔧 CAMBIO: estilos nuevos para el Modal de galería completa
  galeriaContenedor: { flex: 1, backgroundColor: "#fff" },
  galeriaEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  galeriaVolver: { fontSize: 15, color: "#5B8DB8", fontWeight: "600" },
  galeriaTitulo: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  galeriaGrid: { padding: 8 },
  galeriaImagen: {
    width: "48%",
    aspectRatio: 1,
    margin: "1%",
    borderRadius: 8,
  },
  subtitulo:{
    fontSize:20,
    fontWeight:"bold",
    marginTop:20,
    marginBottom:10
},

opcion:{
    flexDirection:"row",
    justifyContent:"space-between",
    alignItems:"center"
},

opcionTitulo:{
    fontSize:17,
    fontWeight:"600"
},

flecha:{
    fontSize:30,
    color:"#999"
},

carruselInfo:{
    paddingBottom:10
},

cardInfo:{
    width:230,
    height:120,
    backgroundColor:"#fff",
    borderRadius:18,
    padding:18,
    marginRight:15,
    elevation:4,
    justifyContent:"space-between"
},

tituloCard:{
    fontSize:18,
    fontWeight:"bold"
},

descripcionCard:{
    color:"#666",
    fontSize:14,
    marginTop:8
},

flechaCard:{
    alignSelf:"flex-end",
    fontSize:28,
    color:"#888"
},
});
