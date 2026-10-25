import { useTema } from "@/contexts/ThemeContext";
import { LugarAR } from "@/hooks/use-ar-places";
import { formatearDistancia } from "@/lib/geo";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { SharedValue } from "react-native-reanimated";
import FlechaRumbo from "./FlechaRumbo";
import PanelRA from "./PanelRA";

// Estado sin lugares en rango; si hay uno fuera de rango, su distancia y una
// flecha hacia él
export default function SinLugares({
  masCercano,
  heading,
}: {
  masCercano: LugarAR | null;
  heading: SharedValue<number>;
}) {
  const { colores } = useTema();

  return (
    <View pointerEvents="none" style={styles.contenedor}>
      <PanelRA style={styles.panel}>
        <View style={[styles.circulo, { borderColor: colores.acentoRA }]}>
          <Ionicons name="location-outline" size={30} color={colores.acentoRA} />
        </View>
        <Text style={[styles.titulo, { color: colores.texto }]}>
          No hay lugares cercanos en este momento.
        </Text>
        <Text style={[styles.texto, { color: colores.textoSecundario }]}>
          Sigue explorando y acércate a un hito para ver su información.
        </Text>

        {masCercano && (
          <View style={[styles.cercano, { borderTopColor: colores.borde }]}>
            <FlechaRumbo heading={heading} rumbo={masCercano.rumbo} color={colores.acentoRA} />
            <Text style={[styles.textoCercano, { color: colores.texto }]} numberOfLines={2}>
              {masCercano.nombre} está a {formatearDistancia(masCercano.distancia)}
            </Text>
          </View>
        )}
      </PanelRA>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  panel: { borderRadius: 20, padding: 20, alignItems: "center", gap: 8, maxWidth: 340 },
  circulo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  titulo: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  texto: { fontSize: 13.5, lineHeight: 19, textAlign: "center" },
  cercano: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  textoCercano: { fontSize: 13.5, fontWeight: "600", flexShrink: 1 },
});
