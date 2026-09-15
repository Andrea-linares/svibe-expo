import AdminHeader from "@/components/admin/admin-header";
import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

type PerfilDetalle = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  ciudad: string | null;
  foto_perfil_url: string | null;
  rol: string;
  fecha_registro: string;
};

export default function DetalleUsuarioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colores } = useTema();
  const [perfil, setPerfil] = useState<PerfilDetalle | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from("perfiles")
        .select(
          "id, nombre, apellido, ciudad, foto_perfil_url, rol, fecha_registro",
        )
        .eq("id", id)
        .single();
      setPerfil(data);
      setCargando(false);
    }
    if (id) cargar();
  }, [id]);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#3B6FA0" />
      </View>
    );
  }

  if (!perfil) {
    return (
      <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
        <AdminHeader titulo="Detalle de usuario" mostrarVolver />
        <View style={styles.centrado}>
          <Text style={{ color: colores.textoSecundario }}>
            No se encontró este usuario.
          </Text>
        </View>
      </View>
    );
  }

  const nombreCompleto = perfil.nombre?.trim()
    ? `${perfil.nombre}${perfil.apellido ? ` ${perfil.apellido}` : ""}`
    : "Usuario";
  const esAdmin = perfil.rol === "administrador";

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <AdminHeader titulo="Detalle de usuario" mostrarVolver />

      <View style={styles.cuerpo}>
        <View
          style={[styles.tarjetaPerfil, { backgroundColor: colores.tarjeta }]}
        >
          <Image
            source={
              perfil.foto_perfil_url
                ? { uri: perfil.foto_perfil_url }
                : require("@/assets/images/partial-react-logo.png")
            }
            style={styles.avatar}
          />
          <Text style={[styles.nombre, { color: colores.texto }]}>
            {nombreCompleto}
          </Text>
          {perfil.ciudad && (
            <View style={styles.filaUbicacion}>
              <Ionicons
                name="location-sharp"
                size={13}
                color={colores.textoSecundario}
              />
              <Text style={[styles.ciudad, { color: colores.textoSecundario }]}>
                {perfil.ciudad}
              </Text>
            </View>
          )}

          <View
            style={[
              styles.badge,
              { backgroundColor: esAdmin ? "#EAF2FA" : "#F0F0F0" },
            ]}
          >
            <Text
              style={{
                color: esAdmin ? "#3B6FA0" : "#666",
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {esAdmin ? "Administrador" : "Usuario"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  cuerpo: { flex: 1, paddingHorizontal: 20 },
  tarjetaPerfil: {
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    elevation: 2,
    marginTop: 10,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#EEE",
    marginBottom: 14,
  },
  nombre: { fontSize: 19, fontWeight: "bold" },
  filaUbicacion: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    gap: 4,
  },
  ciudad: { fontSize: 13 },
  badge: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
});
