import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Reporte = {
  id: string;
  tipo: string | null;
  descripcion: string;
  estado: string;
  creado_en: string;
  imagen_url: string | null;
  hitos: { nombre: string } | null;
};

const ETIQUETAS_TIPO: Record<string, string> = {
  sitio: "Problema con un sitio",
  app: "Problema con la app",
  cuenta: "Problema con la cuenta",
  otro: "Otro",
};

const MENSAJES_ESTADO: Record<string, string> = {
  pendiente: "Tu reporte fue recibido. Aún no ha sido revisado.",
  revisando:
    "Nuestro equipo está revisando tu reporte. Te avisaremos cuando haya una actualización.",
  resuelto: "¡Tu reporte fue atendido! Gracias por ayudarnos a mejorar la app.",
};

export default function ReporteDetalleScreen() {
  const { colores } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [imagenAmpliada, setImagenAmpliada] = useState(false);

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from("reportes_problemas")
        .select(
          "id, tipo, descripcion, estado, creado_en, imagen_url, hitos(nombre)",
        )
        .eq("id", id)
        .single();
      setReporte(data as unknown as Reporte);
      setCargando(false);
    }
    cargar();
  }, [id]);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#3B6FA0" />
      </View>
    );
  }

  if (!reporte) {
    return (
      <View style={styles.centrado}>
        <Text>No se encontró el reporte.</Text>
      </View>
    );
  }

  const resuelto = reporte.estado === "resuelto";
  const colorEstado =
    reporte.estado === "pendiente"
      ? "#D9587A"
      : reporte.estado === "revisando"
        ? "#D9A62A"
        : "#2E9E5B";
  const fondoEstado =
    reporte.estado === "pendiente"
      ? "#FCEBEE"
      : reporte.estado === "revisando"
        ? "#FBF2DD"
        : "#E3F5E9";

  return (
    <ScrollView
      style={[styles.contenedor, { backgroundColor: colores.fondo }]}
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      <TouchableOpacity style={styles.botonAtras} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={colores.texto} />
      </TouchableOpacity>

      {resuelto && (
        <View style={styles.centroResuelto}>
          <View style={styles.circuloResuelto}>
            <Ionicons name="checkmark" size={38} color="#fff" />
          </View>
          <Text style={[styles.tituloResuelto, { color: colores.texto }]}>
            ¡Reporte resuelto!
          </Text>
        </View>
      )}

      <View style={styles.contenido}>
        {!resuelto && (
          <Text style={[styles.titulo, { color: colores.texto }]}>
            Detalle del reporte
          </Text>
        )}

        <View
          style={[
            styles.badgeEstado,
            { backgroundColor: fondoEstado, alignSelf: "flex-start" },
          ]}
        >
          <Text style={{ color: colorEstado, fontWeight: "700", fontSize: 13 }}>
            {reporte.estado.charAt(0).toUpperCase() + reporte.estado.slice(1)}
          </Text>
        </View>

        <Text
          style={[styles.mensajeEstado, { color: colores.textoSecundario }]}
        >
          {MENSAJES_ESTADO[reporte.estado]}
        </Text>

        <View style={[styles.tarjeta, { backgroundColor: colores.tarjeta }]}>
          <FilaInfo
            icono="alert-circle-outline"
            etiqueta="Tipo de problema"
            valor={ETIQUETAS_TIPO[reporte.tipo ?? "otro"]}
            colores={colores}
          />
          {reporte.hitos?.nombre && (
            <FilaInfo
              icono="location-outline"
              etiqueta="Lugar"
              valor={reporte.hitos.nombre}
              colores={colores}
            />
          )}
          <FilaInfo
            icono="calendar-outline"
            etiqueta="Fecha de envío"
            valor={new Date(reporte.creado_en).toLocaleString()}
            colores={colores}
          />
        </View>

        <View style={[styles.tarjeta, { backgroundColor: colores.tarjeta }]}>
          <Text
            style={[styles.etiquetaSeccion, { color: colores.textoSecundario }]}
          >
            Descripción
          </Text>
          <Text style={[styles.descripcion, { color: colores.texto }]}>
            {reporte.descripcion}
          </Text>
        </View>

        {reporte.imagen_url && (
          <View style={[styles.tarjeta, { backgroundColor: colores.tarjeta }]}>
            <Text
              style={[
                styles.etiquetaSeccion,
                { color: colores.textoSecundario },
              ]}
            >
              {resuelto ? "Imagen enviada" : "Evidencia adjunta"}
            </Text>
            <TouchableOpacity onPress={() => setImagenAmpliada(true)}>
              <Image
                source={{ uri: reporte.imagen_url }}
                style={styles.imagenGrande}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {reporte.imagen_url && (
        <Modal visible={imagenAmpliada} transparent animationType="fade">
          <TouchableOpacity
            style={styles.fondoImagenCompleta}
            activeOpacity={1}
            onPress={() => setImagenAmpliada(false)}
          >
            <Image
              source={{ uri: reporte.imagen_url }}
              style={styles.imagenCompleta}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Modal>
      )}
    </ScrollView>
  );
}

function FilaInfo({
  icono,
  etiqueta,
  valor,
  colores,
}: {
  icono: any;
  etiqueta: string;
  valor: string;
  colores: any;
}) {
  return (
    <View style={styles.filaInfo}>
      <Ionicons
        name={icono}
        size={18}
        color="#3B6FA0"
        style={{ marginTop: 2 }}
      />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={[styles.etiquetaInfo, { color: colores.textoSecundario }]}>
          {etiqueta}
        </Text>
        <Text style={[styles.valorInfo, { color: colores.texto }]}>
          {valor}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  botonAtras: { marginTop: 55, marginLeft: 16, marginBottom: 8 },
  centroResuelto: { alignItems: "center", marginBottom: 10 },
  circuloResuelto: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#2E9E5B",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  tituloResuelto: { fontSize: 20, fontWeight: "bold" },
  contenido: { paddingHorizontal: 20 },
  titulo: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  badgeEstado: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 10,
  },
  mensajeEstado: { fontSize: 13, lineHeight: 19, marginBottom: 16 },
  tarjeta: { borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2 },
  filaInfo: { flexDirection: "row", marginBottom: 14 },
  etiquetaInfo: { fontSize: 12 },
  valorInfo: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  etiquetaSeccion: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  descripcion: { fontSize: 14, lineHeight: 20 },
  imagenGrande: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#000",
  },
  fondoImagenCompleta: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imagenCompleta: { width: "100%", height: "80%" },
});
