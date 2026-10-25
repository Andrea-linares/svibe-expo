import { conAlfa, useTema } from "@/contexts/ThemeContext";
import { LugarAR } from "@/hooks/use-ar-places";
import { formatearDistancia } from "@/lib/geo";
import { Ionicons } from "@expo/vector-icons";
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_LUGARES = 20;

// Hoja inferior con los lugares ordenados por distancia
export default function ListaCercanos({
  visible,
  lugares,
  onElegir,
  onCerrar,
}: {
  visible: boolean;
  lugares: LugarAR[];
  onElegir: (lugar: LugarAR) => void;
  onCerrar: () => void;
}) {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable
        style={[styles.fondo, { backgroundColor: conAlfa(colores.fondo, 0.35) }]}
        onPress={onCerrar}
        accessibilityLabel="Cerrar lista"
      />
      <View
        style={[
          styles.hoja,
          {
            backgroundColor: colores.tarjeta,
            borderColor: colores.borde,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={[styles.agarre, { backgroundColor: colores.borde }]} />
        <View style={styles.encabezado}>
          <Text style={[styles.titulo, { color: colores.texto }]}>Lugares cercanos</Text>
          <TouchableOpacity onPress={onCerrar} hitSlop={10} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={22} color={colores.textoSecundario} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={lugares.slice(0, MAX_LUGARES)}
          keyExtractor={(l) => l.id}
          ItemSeparatorComponent={() => (
            <View style={[styles.separador, { backgroundColor: colores.borde }]} />
          )}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.fila} onPress={() => onElegir(item)}>
              <View
                style={[
                  styles.pin,
                  { backgroundColor: item.enRango ? colores.acentoRA : colores.borde },
                ]}
              >
                <Ionicons name="location" size={16} color="#fff" />
              </View>
              <View style={styles.textos}>
                <Text style={[styles.nombre, { color: colores.texto }]} numberOfLines={1}>
                  {item.nombre}
                </Text>
                <Text style={[styles.detalle, { color: colores.textoSecundario }]}>
                  {formatearDistancia(item.distancia)}
                  {item.enRango ? " · En rango" : " · Ver dirección"}
                </Text>
              </View>
              <Ionicons
                name={item.enRango ? "information-circle-outline" : "navigate-outline"}
                size={20}
                color={colores.acentoRA}
              />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={[styles.vacio, { color: colores.textoSecundario }]}>
              No hay lugares con realidad aumentada todavía.
            </Text>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1 },
  hoja: {
    maxHeight: "60%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  agarre: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginTop: 8 },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  titulo: { fontSize: 17, fontWeight: "800" },
  fila: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  pin: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  textos: { flex: 1 },
  nombre: { fontSize: 15, fontWeight: "600" },
  detalle: { fontSize: 12.5, marginTop: 2 },
  separador: { height: StyleSheet.hairlineWidth },
  vacio: { textAlign: "center", paddingVertical: 24 },
});
