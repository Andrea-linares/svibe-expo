import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
  es_anonimo: boolean;
  estado: string;
  creado_en: string;
  imagen_url: string | null;
  hitos: { nombre: string } | null;
  perfiles: { nombre: string | null } | null;
};

const ETIQUETAS_TIPO: Record<string, string> = {
  sitio: "Problema con un sitio",
  app: "Problema con la app",
  cuenta: "Problema con la cuenta",
  otro: "Otro",
};

export default function AdminReporteDetalleScreen() {
  const { colores } = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [imagenAmpliada, setImagenAmpliada] = useState(false);

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from("reportes_problemas")
        .select(
          "id, tipo, descripcion, es_anonimo, estado, creado_en, imagen_url, hitos(nombre), perfiles(nombre)",
        )
        .eq("id", id)
        .single();
      setReporte(data as unknown as Reporte);
      setCargando(false);
    }
    cargar();
  }, [id]);

  async function cambiarEstado(nuevoEstado: string) {
    setActualizando(true);
    const { error } = await supabase
      .from("reportes_problemas")
      .update({ estado: nuevoEstado })
      .eq("id", id);
    setActualizando(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setReporte((actual) =>
      actual ? { ...actual, estado: nuevoEstado } : actual,
    );
  }

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

      <View style={styles.contenido}>
        <Text style={[styles.titulo, { color: colores.texto }]}>
          Detalle del reporte
        </Text>

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
          <FilaInfo
            icono="person-outline"
            etiqueta="Enviado por"
            valor={
              reporte.es_anonimo
                ? "Anónimo"
                : (reporte.perfiles?.nombre ?? "Usuario")
            }
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
              Evidencia adjunta
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

        <Text
          style={[
            styles.etiquetaSeccion,
            { color: colores.textoSecundario, marginTop: 20 },
          ]}
        >
          Cambiar estado
        </Text>
        <View style={styles.filaBotones}>
          <BotonEstado
            texto="Pendiente"
            activo={reporte.estado === "pendiente"}
            onPress={() => cambiarEstado("pendiente")}
          />
          <BotonEstado
            texto="En revisión"
            activo={reporte.estado === "revisando"}
            onPress={() => cambiarEstado("revisando")}
          />
          <BotonEstado
            texto="Resuelto"
            activo={reporte.estado === "resuelto"}
            onPress={() => cambiarEstado("resuelto")}
          />
        </View>
        {actualizando && <ActivityIndicator style={{ marginTop: 10 }} />}
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

function BotonEstado({
  texto,
  activo,
  onPress,
}: {
  texto: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.botonEstado, activo && styles.botonEstadoActivo]}
      onPress={onPress}
    >
      <Text
        style={activo ? styles.textoBotonEstadoActivo : styles.textoBotonEstado}
      >
        {texto}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  botonAtras: { marginTop: 55, marginLeft: 16, marginBottom: 8 },
  contenido: { paddingHorizontal: 20 },
  titulo: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  badgeEstado: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 16,
  },
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
    height: 220,
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
  filaBotones: { flexDirection: "row", gap: 8, marginTop: 8 },
  botonEstado: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
  },
  botonEstadoActivo: { backgroundColor: "#3B6FA0" },
  textoBotonEstado: { fontSize: 12, fontWeight: "600", color: "#555" },
  textoBotonEstadoActivo: { fontSize: 12, fontWeight: "600", color: "#fff" },
});
