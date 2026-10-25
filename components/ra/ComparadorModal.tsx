import { useTema } from "@/contexts/ThemeContext";
import { LugarAR } from "@/hooks/use-ar-places";
import { Ionicons } from "@expo/vector-icons";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BeforeAfterSlider from "./BeforeAfterSlider";
import PanelRA from "./PanelRA";

// Comparador "Antes y después" a casi pantalla completa
export default function ComparadorModal({
  lugar,
  onCerrar,
}: {
  lugar: LugarAR | null;
  onCerrar: () => void;
}) {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const antes = lugar?.antes;
  const ahoraUri = lugar?.ahoraUri;

  const etiquetaAntes = antes?.anio_aproximado ? `${antes.anio_aproximado} (aprox.)` : "Antes";
  const anioDespues = lugar?.despues?.anio_aproximado;
  const etiquetaAhora = anioDespues ? `Ahora (${anioDespues})` : "Ahora";
  const pies = [antes?.pie_foto, lugar?.despues?.pie_foto].filter(Boolean);

  return (
    <Modal
      visible={!!(lugar && antes && ahoraUri)}
      animationType="fade"
      onRequestClose={onCerrar}
      statusBarTranslucent
    >
      {/* Un Modal es otra raíz: el arrastre necesita su propio GestureHandlerRootView */}
      <GestureHandlerRootView
        style={[
          styles.contenedor,
          {
            backgroundColor: colores.fondo,
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={styles.encabezado}>
          <View style={styles.textosEncabezado}>
            <Text style={[styles.titulo, { color: colores.texto }]}>Antes y después</Text>
            {lugar && (
              <Text style={[styles.subtitulo, { color: colores.textoSecundario }]} numberOfLines={1}>
                {lugar.nombre}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={onCerrar}
            style={[styles.cerrar, { backgroundColor: colores.tarjeta, borderColor: colores.borde }]}
            accessibilityLabel="Cerrar comparador"
          >
            <Ionicons name="close" size={22} color={colores.texto} />
          </TouchableOpacity>
        </View>

        {antes && ahoraUri && (
          <BeforeAfterSlider antesUri={antes.url} despuesUri={ahoraUri} style={styles.slider}>
            <PanelRA style={[styles.chip, styles.chipIzquierdo]}>
              <Text style={[styles.textoChip, { color: colores.texto }]}>{etiquetaAntes}</Text>
            </PanelRA>
            <PanelRA style={[styles.chip, styles.chipDerecho]}>
              <Text style={[styles.textoChip, { color: colores.texto }]}>{etiquetaAhora}</Text>
            </PanelRA>
          </BeforeAfterSlider>
        )}

        {pies.length > 0 && (
          <View style={styles.pies}>
            {pies.map((pie) => (
              <Text key={pie} style={[styles.pie, { color: colores.textoSecundario }]}>
                {pie}
              </Text>
            ))}
          </View>
        )}
        <Text style={[styles.ayuda, { color: colores.textoSecundario }]}>
          Desliza para comparar
        </Text>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, paddingHorizontal: 12 },
  encabezado: { flexDirection: "row", alignItems: "center", marginBottom: 12, paddingHorizontal: 4 },
  textosEncabezado: { flex: 1 },
  titulo: { fontSize: 20, fontWeight: "800" },
  subtitulo: { fontSize: 13.5, marginTop: 2 },
  cerrar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  slider: { flex: 1, borderRadius: 18 },
  chip: { position: "absolute", bottom: 14, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  chipIzquierdo: { left: 14 },
  chipDerecho: { right: 14 },
  textoChip: { fontSize: 13.5, fontWeight: "700" },
  pies: { marginTop: 10, gap: 2, paddingHorizontal: 4 },
  pie: { fontSize: 13.5, lineHeight: 19 },
  ayuda: { fontSize: 12, textAlign: "center", marginTop: 8 },
});
