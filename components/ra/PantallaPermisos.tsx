import { useTema } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Se muestra solo si el usuario negó o bloqueó la cámara o la ubicación
export default function PantallaPermisos({
  camara,
  ubicacion,
}: {
  camara: boolean;
  ubicacion: boolean;
}) {
  const { colores } = useTema();

  const filas = [
    {
      icono: "camera" as const,
      titulo: "Cámara",
      texto: "Para ver la realidad aumentada.",
      concedido: camara,
    },
    {
      icono: "location" as const,
      titulo: "Ubicación",
      texto: "Para encontrar lugares cercanos.",
      concedido: ubicacion,
    },
  ];

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <View style={[styles.tarjeta, { backgroundColor: colores.tarjeta, borderColor: colores.borde }]}>
        <Text style={[styles.titulo, { color: colores.texto }]}>Permisos necesarios</Text>

        {filas.map((fila, i) => (
          <View
            key={fila.titulo}
            style={[
              styles.fila,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colores.borde },
            ]}
          >
            <View
              style={[
                styles.circulo,
                { backgroundColor: i === 0 ? colores.acento : colores.acentoRA },
              ]}
            >
              <Ionicons name={fila.icono} size={22} color="#fff" />
            </View>
            <View style={styles.textos}>
              <Text style={[styles.tituloFila, { color: colores.texto }]}>{fila.titulo}</Text>
              <Text style={[styles.textoFila, { color: colores.textoSecundario }]}>
                {fila.texto}
              </Text>
            </View>
            <Ionicons
              name={fila.concedido ? "checkmark-circle" : "alert-circle"}
              size={22}
              color={fila.concedido ? colores.acentoRA : colores.peligro}
              accessibilityLabel={fila.concedido ? "Permitido" : "No permitido"}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.boton, { backgroundColor: colores.acento }]}
          onPress={() => Linking.openSettings()}
        >
          <Text style={[styles.textoBoton, { color: colores.tarjeta }]}>Ir a ajustes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.boton, styles.botonSecundario, { borderColor: colores.borde }]}
          onPress={() => router.navigate("/(tabs)/home")}
        >
          <Text style={[styles.textoBoton, { color: colores.texto }]}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: "center", padding: 20 },
  tarjeta: { borderRadius: 20, borderWidth: 1, padding: 20 },
  titulo: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  fila: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  circulo: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center" },
  textos: { flex: 1 },
  tituloFila: { fontSize: 16, fontWeight: "700" },
  textoFila: { fontSize: 13.5, marginTop: 2 },
  boton: {
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
  },
  botonSecundario: { borderWidth: 1, marginTop: 10 },
  textoBoton: { fontSize: 15, fontWeight: "700" },
});
