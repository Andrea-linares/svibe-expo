import { useTema } from "@/contexts/ThemeContext";
import { HitoRA } from "@/lib/ra-servicio";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { DISTANCIA_PRUEBA_M } from "./constantes";
import PanelRA from "./PanelRA";

// Modo prueba: simula estar junto a un hito y girar el rumbo a mano,
// para probar etiquetas, tarjetas y el comparador desde casa.
export default function PanelPrueba({
  hitos,
  hitoId,
  onElegirHito,
  rumboManual,
  onRumboManual,
  onGirar,
  onCerrar,
}: {
  hitos: HitoRA[];
  hitoId: string | null;
  onElegirHito: (id: string | null) => void;
  rumboManual: boolean;
  onRumboManual: (manual: boolean) => void;
  onGirar: (delta: number) => void;
  onCerrar: () => void;
}) {
  const { colores } = useTema();
  const ordenados = [...hitos].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <PanelRA style={styles.panel}>
      <View style={styles.encabezado}>
        <Ionicons name="flask-outline" size={18} color={colores.acentoRA} />
        <Text style={[styles.titulo, { color: colores.texto }]}>Modo prueba</Text>
        <TouchableOpacity onPress={onCerrar} hitSlop={10} accessibilityLabel="Salir del modo prueba">
          <Ionicons name="close" size={20} color={colores.textoSecundario} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>
        Simular ubicación ({DISTANCIA_PRUEBA_M} m al sur del hito, mirando al norte)
      </Text>
      {ordenados.length === 0 ? (
        <Text style={[styles.etiqueta, { color: colores.texto }]}>
          No hay hitos con RA activa. Actívalos desde el panel de administración.
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip texto="GPS real" activo={hitoId === null} onPress={() => onElegirHito(null)} />
          {ordenados.map((h) => (
            <Chip
              key={h.id}
              texto={h.nombre}
              activo={h.id === hitoId}
              onPress={() => onElegirHito(h.id)}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.filaRumbo}>
        <Text style={[styles.etiqueta, styles.flex, { color: colores.texto }]}>Rumbo manual</Text>
        <Switch
          value={rumboManual}
          onValueChange={onRumboManual}
          trackColor={{ true: colores.acentoRA, false: colores.borde }}
        />
      </View>
      {rumboManual && (
        <>
          <View style={styles.botonesGiro}>
            {[-10, -1, 1, 10].map((delta) => (
              <TouchableOpacity
                key={delta}
                style={[styles.botonGiro, { borderColor: colores.acentoRA }]}
                onPress={() => onGirar(delta)}
              >
                <Text style={[styles.textoGiro, { color: colores.acentoRA }]}>
                  {delta > 0 ? `+${delta}°` : `${delta}°`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.ayuda, { color: colores.textoSecundario }]}>
            También puedes arrastrar la pantalla de lado a lado para girar.
          </Text>
        </>
      )}
    </PanelRA>
  );
}

function Chip({ texto, activo, onPress }: { texto: string; activo: boolean; onPress: () => void }) {
  const { colores } = useTema();
  return (
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.chip,
          {
            borderColor: activo ? colores.acentoRA : colores.borde,
            backgroundColor: activo ? colores.acentoRA : "transparent",
          },
        ]}
      >
        <Text style={[styles.textoChip, { color: activo ? "#fff" : colores.texto }]} numberOfLines={1}>
          {texto}
        </Text>
      </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 16, padding: 12, gap: 8 },
  encabezado: { flexDirection: "row", alignItems: "center", gap: 6 },
  titulo: { flex: 1, fontSize: 15, fontWeight: "800" },
  etiqueta: { fontSize: 12.5 },
  flex: { flex: 1 },
  chips: { gap: 6 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 180 },
  textoChip: { fontSize: 12.5, fontWeight: "600" },
  filaRumbo: { flexDirection: "row", alignItems: "center" },
  botonesGiro: { flexDirection: "row", gap: 8 },
  botonGiro: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 6, alignItems: "center" },
  textoGiro: { fontSize: 14, fontWeight: "700" },
  ayuda: { fontSize: 11.5 },
});
