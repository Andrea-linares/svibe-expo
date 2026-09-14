import AdminHeader from "@/components/admin/admin-header";
import { useTema } from "@/contexts/ThemeContext";
import { StyleSheet, Text, View } from "react-native";

export default function AdminEventosScreen() {
  const { colores } = useTema();
  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <AdminHeader titulo="Eventos" />
      <View style={styles.centrado}>
        <Text style={[styles.texto, { color: colores.textoSecundario }]}>
          Gestión de eventos (próximamente)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  texto: { fontSize: 16 },
});
