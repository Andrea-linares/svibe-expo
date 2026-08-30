import InfoModal from "@/components/InfoModal";
import { verificarYDesbloquearInsignias } from "@/hooks/use-insignias";
import { revisarYCompletarRetos } from "@/hooks/use-retos";
import { supabase } from "@/lib/supabase";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Dimensions,
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
  anio: number | null;
  descripcion: string | null;
};

const { width: ANCHO_PANTALLA, height: ALTO_PANTALLA } = Dimensions.get("window");
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
  const [indiceFullscreen, setIndiceFullscreen] = useState<number | null>(null);

const [modalVisible, setModalVisible] = useState(false);
const [tituloModal, setTituloModal] = useState("");
const [textoModal, setTextoModal] = useState("");
const [descripcionExpandida, setDescripcionExpandida] = useState(false);

const [usuarioId, setUsuarioId] = useState<string | null>(null);
const [mostrarFeedback, setMostrarFeedback] = useState(false);
const [feedbackEnviado, setFeedbackEnviado] = useState<
  "interesado" | "no_interesado" | null
>(null);

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
        .select("url, orden, anio, descripcion")
        .eq("hito_id", id)
        .order("orden", { ascending: true });

      setHito(hitoData);
      setHorarios(horariosData ?? []);
      setImagenes(imagenesData ?? []);
      setCargando(false);
      
      const { data: sesion } = await supabase.auth.getUser();
      if (sesion?.user && hitoData) {
        setUsuarioId(sesion.user.id);

        const { error: errorVisita } = await supabase
        .from("interacciones_usuario")
        .insert({
          usuario_id: sesion.user.id,
          hito_id: id,
          tipo_interaccion: "visita",
        });

        if (errorVisita) {
        console.log("ERROR AL REGISTRAR VISITA:", JSON.stringify(errorVisita));
        }

        const nuevasInsignias = await verificarYDesbloquearInsignias(sesion.user.id);
        if (nuevasInsignias.length > 0) {
          Alert.alert(
            "¡Nueva insignia desbloqueada! 🎉",
            nuevasInsignias.map((i) => `${i.icono ?? "🏅"} ${i.nombre}`).join("\n"),
          );
        }

        const retosCompletados = await revisarYCompletarRetos(sesion.user.id);
        if (retosCompletados.length > 0) {
          Alert.alert(
            "¡Reto completado! 🏆",
              retosCompletados.map((r) => `${r.icono ?? "🏆"} ${r.nombre} (+${r.recompensa_puntos} pts)`).join("\n"),
          );
        }
        
          const { data: feedbackPrevio } = await supabase
          .from("interacciones_usuario")
          .select("tipo_interaccion")
          .eq("usuario_id", sesion.user.id)
          .eq("hito_id", id)
          .in("tipo_interaccion", ["interesado", "no_interesado"])
          .order("creado_en", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (feedbackPrevio) {
          setFeedbackEnviado(
            feedbackPrevio.tipo_interaccion as "interesado" | "no_interesado",
          );
        } else {
          setMostrarFeedback(true);
        }
      }
    }

    cargarDatos();
  }, [id]);

   async function enviarFeedback(tipo: "interesado" | "no_interesado") {
    if (!usuarioId || !id) return;

    setFeedbackEnviado(tipo);

    await supabase.from("interacciones_usuario").insert({
      usuario_id: usuarioId,
      hito_id: id,
      tipo_interaccion: tipo,
    });
  }

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
      {/* bloque completo de imagen principal reemplazado por carrusel + botón de galería */}
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
  <>
    <Text
      style={styles.descripcion}
      numberOfLines={descripcionExpandida ? undefined : 4}
    >
      {hito.descripcion}
    </Text>

    {hito.descripcion.length > 180 && (
      <TouchableOpacity
        onPress={() =>
          setDescripcionExpandida(!descripcionExpandida)
        }
      >
        <Text style={styles.leerMas}>
          {descripcionExpandida ? "Leer menos" : "Leer más"}
        </Text>
      </TouchableOpacity>
    )}
  </>
)}

{/* 🆕 CAMBIO: tarjeta de feedback contextual "¿Te interesó este hito?" */}
        {mostrarFeedback && !feedbackEnviado && (
          <View style={styles.cardFeedback}>
            <View style={styles.filaFeedbackEncabezado}>
              <Text style={styles.iconoFeedback}>🌱</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.tituloFeedback}>
                  ¿Te interesó este hito?
                </Text>
                <Text style={styles.textoFeedback}>
                  Tu opinión nos ayuda a mostrarte contenido que te guste más.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setMostrarFeedback(false)}>
                <Text style={styles.cerrarFeedback}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filaBotonesFeedback}>
              <TouchableOpacity
                style={styles.botonFeedbackSi}
                onPress={() => enviarFeedback("interesado")}
              >
                <Text style={styles.textoBotonFeedbackSi}>
                  👍 Sí, me interesó
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.botonFeedbackNo}
                onPress={() => enviarFeedback("no_interesado")}
              >
                <Text style={styles.textoBotonFeedbackNo}>👎 No tanto</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {feedbackEnviado && (
          <View style={styles.cardFeedbackEnviado}>
            <Text style={styles.textoFeedbackEnviado}>
              {feedbackEnviado === "interesado"
                ? "✅ Gracias, tomamos nota de tu interés."
                : "Gracias por tu opinión."}
            </Text>
          </View>
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
          {formatearHorarios(horarios).map((item, index) => (
        <View key={index} style={styles.filaHorario}>
          <Text style={styles.horarioDia}>{item.rango}</Text>
          <Text style={styles.horarioHora}>{item.horario}</Text>
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
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={styles.galeriaCelda}
                onPress={() => setIndiceFullscreen(index)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: item.url }} style={styles.galeriaImagen} />
                {/* 🔧 CAMBIO: overlay con año y descripción */}
                {(item.anio || item.descripcion) && (
                  <View style={styles.galeriaOverlay}>
                    {item.anio && (
                      <Text style={styles.galeriaAnio}>{item.anio}</Text>
                    )}
                    {item.descripcion && (
                      <Text style={styles.galeriaDescripcion} numberOfLines={1}>
                        {item.descripcion}
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      <Modal
        visible={indiceFullscreen !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setIndiceFullscreen(null)}
      >
        <View style={styles.fullscreenFondo}>
          <TouchableOpacity
            style={styles.fullscreenCerrar}
            onPress={() => setIndiceFullscreen(null)}
          >
            <Text style={styles.fullscreenCerrarTexto}>✕</Text>
          </TouchableOpacity>

          {indiceFullscreen !== null && (
            <FlatList
              data={imagenes}
              keyExtractor={(item, i) => `${item.url}-fs-${i}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={indiceFullscreen}
              getItemLayout={(_, i) => ({
                length: ANCHO_PANTALLA,
                offset: ANCHO_PANTALLA * i,
                index: i,
              })}
              renderItem={({ item }) => (
                <View style={styles.fullscreenSlide}>
                  <Image
                    source={{ uri: item.url }}
                    style={styles.fullscreenImagen}
                    resizeMode="contain"
                  />
                  {(item.anio || item.descripcion) && (
                    <View style={styles.fullscreenInfo}>
                      {item.anio && (
                        <Text style={styles.fullscreenAnio}>{item.anio}</Text>
                      )}
                      {item.descripcion && (
                        <Text style={styles.fullscreenDescripcion}>
                          {item.descripcion}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            />
          )}
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

// ===== FUNCIÓN NUEVA PARA AGRUPAR HORARIOS =====
function formatearHorarios(horarios: Horario[]) {
  if (!horarios || horarios.length === 0) {
    return [{ rango: "Horario no disponible", horario: "" }];
  }

  // Verificar si es 24/7
  const es24Horas = horarios.every(h => 
    h.hora_apertura === "00:00:00" && h.hora_cierre === "23:59:00"
  );

  if (es24Horas) {
    return [{ rango: "Todos los días", horario: "24 horas" }];
  }

  // Agrupar por horario
  const grupos = new Map<string, number[]>();
  
  horarios.forEach(h => {
    const clave = `${h.hora_apertura}-${h.hora_cierre}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, []);
    }
    grupos.get(clave)!.push(h.dia_semana);
  });

  const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const resultado: { rango: string; horario: string }[] = [];

  grupos.forEach((dias, clave) => {
    const [horaApertura, horaCierre] = clave.split("-");
    const diasOrdenados = dias.sort((a, b) => a - b);
    
    // Encontrar rangos consecutivos
    const rangos: number[][] = [];
    let inicio = 0;
    for (let i = 0; i < diasOrdenados.length; i++) {
      if (i === diasOrdenados.length - 1 || diasOrdenados[i + 1] !== diasOrdenados[i] + 1) {
        rangos.push(diasOrdenados.slice(inicio, i + 1));
        inicio = i + 1;
      }
    }
    
    rangos.forEach(rango => {
      let rangoTexto = rango.length === 1 
        ? DIAS[rango[0]]
        : `${DIAS[rango[0]]} - ${DIAS[rango[rango.length - 1]]}`;
      
      // Si cubre todos los días (0-6)
      if (rango[0] === 0 && rango[rango.length - 1] === 6 && rango.length === 7) {
        rangoTexto = "Todos los días";
      }
      
      resultado.push({
        rango: rangoTexto,
        horario: `${formatearHora(horaApertura)} - ${formatearHora(horaCierre)}`
      });
    });
  });

  return resultado;
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#F3F3F3" },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  imagenPrincipal: { width: "100%", height: 220 },
  contenido: { padding: 16 },
  titulo: { fontSize: 26, fontWeight: "bold", color: "#000" },
  ubicacion: { fontSize: 14, color: "#444", marginTop: 8 },
  descripcion: { fontSize: 15, color: "#333", marginTop: 12, lineHeight: 22 },
  leerMas: {
    color: "#2E7D32",
    fontWeight: "bold",
    marginTop: 6,
    fontSize: 15,
},
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
  galeriaCelda: {
    width: "48%",
    aspectRatio: 1,
    margin: "1%",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  galeriaImagen: {
    width: "100%",
    height: "100%",
  },
  // 🔧 CAMBIO: nuevos estilos — overlay de año/descripción sobre cada miniatura
  galeriaOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  galeriaAnio: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  galeriaDescripcion: { color: "#fff", fontSize: 11, marginTop: 1 },

  // 🔧 CAMBIO: nuevos estilos — visor de pantalla completa
  fullscreenFondo: { flex: 1, backgroundColor: "#000" },
  fullscreenCerrar: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenCerrarTexto: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  fullscreenSlide: {
    width: ANCHO_PANTALLA,
    height: ALTO_PANTALLA,
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImagen: { width: "100%", height: "80%" },
  fullscreenInfo: {
    position: "absolute",
    bottom: 60,
    left: 20,
    right: 20,
  },
  fullscreenAnio: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  fullscreenDescripcion: { color: "#eee", fontSize: 14, marginTop: 2 },
  
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

horarioDia: {
  fontSize: 14,
  color: "#333",
  flex: 1, // Esto hace que el día ocupe espacio y el horario vaya a la derecha
},
horarioHora: {
  fontSize: 14,
  fontWeight: "bold",
  color: "#333",
},

// 🆕 CAMBIO: estilos nuevos para la tarjeta de feedback contextual
cardFeedback: {
  backgroundColor: "#F1F8F1",
  borderRadius: 16,
  padding: 16,
  marginTop: 16,
},
filaFeedbackEncabezado: {
  flexDirection: "row",
  alignItems: "flex-start",
},
iconoFeedback: { fontSize: 22, marginRight: 10 },
tituloFeedback: { fontSize: 15, fontWeight: "bold", color: "#1A2A3A" },
textoFeedback: { fontSize: 12.5, color: "#666", marginTop: 3, lineHeight: 17 },
cerrarFeedback: { fontSize: 16, color: "#999", paddingLeft: 8 },
filaBotonesFeedback: {
  flexDirection: "row",
  gap: 10,
  marginTop: 14,
},
botonFeedbackSi: {
  flex: 1,
  backgroundColor: "#2E7D32",
  borderRadius: 20,
  paddingVertical: 10,
  alignItems: "center",
},
textoBotonFeedbackSi: { color: "#fff", fontWeight: "600", fontSize: 13 },
botonFeedbackNo: {
  flex: 1,
  backgroundColor: "#fff",
  borderWidth: 1,
  borderColor: "#CCC",
  borderRadius: 20,
  paddingVertical: 10,
  alignItems: "center",
},
textoBotonFeedbackNo: { color: "#555", fontWeight: "600", fontSize: 13 },
cardFeedbackEnviado: {
  backgroundColor: "#F5F5F5",
  borderRadius: 16,
  padding: 14,
  marginTop: 16,
  alignItems: "center",
},
textoFeedbackEnviado: { fontSize: 13, color: "#666" },
});
