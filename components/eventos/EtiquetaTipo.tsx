import { infoTipo } from "@/lib/eventos";
import { StyleSheet, Text, View } from "react-native";

// Píldora con el tipo de evento ("Cultural", "Religioso", ...)
export default function EtiquetaTipo({ tipo }: { tipo: string }) {
  const { etiqueta, color } = infoTipo(tipo);
  return (
    <View style={[styles.pildora, { backgroundColor: `${color}1F` }]}>
      <Text style={[styles.texto, { color }]}>{etiqueta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pildora: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  texto: { fontSize: 11, fontWeight: "600" },
});
