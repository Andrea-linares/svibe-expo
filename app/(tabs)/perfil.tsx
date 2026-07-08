import { StyleSheet, Text, View } from "react-native";

export default function PerfilScreen() {
  return (
    <View style={styles.contenedor}>
      <Text style={styles.texto}>Perfil (próximamente)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: "center", alignItems: "center" },
  texto: { fontSize: 18, color: "#666" },
});
