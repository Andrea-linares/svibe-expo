import { ESPACIADO_PANEL, useTema } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Colores = ReturnType<typeof useTema>["colores"];

// Tarjeta de estadística del panel: círculo de color con ícono, número grande,
// etiqueta, chevron y barra inferior del mismo color.
export default function StatCard({
  icono,
  colorAcento,
  numero,
  etiqueta,
  colores,
  estiloTarjeta,
  anchoCompleto = false,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  colorAcento: string;
  numero: number;
  etiqueta: string;
  colores: Colores;
  estiloTarjeta: object;
  anchoCompleto?: boolean;
  onPress: () => void;
}) {
  const circulo = (
    <View style={[styles.circuloIcono, { backgroundColor: colorAcento }]}>
      <Ionicons name={icono} size={22} color="#fff" />
    </View>
  );
  const textoNumero = (
    <Text
      style={[styles.numero, { color: colores.panelTexto }]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {numero}
    </Text>
  );
  // Una sola línea; se achica un poco si no cabe en vez de cortarse
  const textoEtiqueta = (
    <Text
      style={[styles.etiqueta, { color: colores.panelTextoSecundario }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
    >
      {etiqueta}
    </Text>
  );
  const flecha = (
    <Ionicons name="chevron-forward" size={16} color={colores.panelTextoSecundario} />
  );

  return (
    <TouchableOpacity
      style={[styles.tarjeta, anchoCompleto && styles.tarjetaAnchoCompleto, estiloTarjeta]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${numero} ${etiqueta}`}
    >
      {anchoCompleto ? (
        <View style={styles.filaTarjeta}>
          {circulo}
          <View style={styles.textosTarjeta}>
            {textoNumero}
            {textoEtiqueta}
          </View>
          {flecha}
        </View>
      ) : (
        <>
          {/* En media tarjeta la etiqueta usa todo el ancho para caber en una línea */}
          <View style={styles.filaTarjeta}>
            {circulo}
            <View style={styles.textosTarjeta}>{textoNumero}</View>
            {flecha}
          </View>
          {textoEtiqueta}
        </>
      )}
      <View style={[styles.lineaInferior, { backgroundColor: colorAcento }]} />
    </TouchableOpacity>
  );
}

const E = ESPACIADO_PANEL;

const styles = StyleSheet.create({
  tarjeta: {
    width: "48.5%",
    gap: 8,
    borderRadius: E.radioTarjeta,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 16 + E.grosorLinea,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  tarjetaAnchoCompleto: { width: "100%" },
  lineaInferior: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: E.grosorLinea,
  },
  circuloIcono: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  filaTarjeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  textosTarjeta: { flex: 1 },
  numero: { fontSize: 24, fontWeight: "bold" },
  etiqueta: { fontSize: 13 },
});
