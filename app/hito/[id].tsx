import { supabase } from "@/lib/supabase";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
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

export default function DetalleHitoScreen() {
  // Recibimos el id que viene en la URL (ej: /hito/abc-123)
  const { id } = useLocalSearchParams<{ id: string }>();

  const [hito, setHito] = useState<Hito | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [imagenes, setImagenes] = useState<ImagenHito[]>([]);
  const [cargando, setCargando] = useState(true);

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

  return (
    <ScrollView style={styles.contenedor}>
      {/* Imagen principal (o placeholder si no hay imágenes aún) */}
      <Image
        source={
          imagenes.length > 0
            ? { uri: imagenes[0].url }
            : require("@/assets/images/partial-react-logo.png") // placeholder temporal
        }
        style={styles.imagenPrincipal}
      />

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
            <Text style={styles.cardTitulo}>🕘 Horarios de atención</Text>
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

        {/* Tarjeta de PRECIOS DE ENTRADA */}
        <View style={styles.card}>
          <Text style={styles.cardTitulo}>💵 Precios de entrada</Text>
          <Text style={styles.textoPrecio}>
            {hito.precio_texto
              ? hito.precio_texto
              : hito.precio && hito.precio > 0
                ? `Entrada general: $${hito.precio.toFixed(2)} por persona`
                : "Acceso gratuito"}
          </Text>
        </View>

        {/* Carrusel horizontal: Datos curiosos / Historia o Leyenda / Eventos */}
        <ScrollView
          horizontal
          style={styles.carrusel}
          showsHorizontalScrollIndicator={false}
        >
          {hito.dato_curioso && (
            <View style={styles.cardCarrusel}>
              <Text style={styles.cardTitulo}>Datos curiosos</Text>
              <Text style={styles.textoCard}>{hito.dato_curioso}</Text>
            </View>
          )}

          {(hito.historia || hito.leyenda) && (
            <View style={styles.cardCarrusel}>
              <Text style={styles.cardTitulo}>
                {hito.historia ? "Historia" : "Leyenda"}
              </Text>
              <Text style={styles.textoCard}>
                {hito.historia ?? hito.leyenda}
              </Text>
            </View>
          )}

          {hito.eventos_info && (
            <View style={styles.cardCarrusel}>
              <Text style={styles.cardTitulo}>Eventos</Text>
              <Text style={styles.textoCard}>{hito.eventos_info}</Text>
            </View>
          )}
        </ScrollView>
      </View>
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
});
