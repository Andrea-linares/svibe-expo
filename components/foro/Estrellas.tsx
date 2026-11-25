import { COLORES, useTema } from "@/contexts/ThemeContext";
import { etiquetaEstrellas, formasEstrellas } from "@/lib/foro-datos";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity, View } from "react-native";

/* ---------------------------------------------------------------------------
 * Estrellas de calificación (HU-019)
 * - Claro: dorado del panel (contrasta sobre blanco).
 * - Oscuro: dorado más brillante, el mismo que en Retos.
 * ------------------------------------------------------------------------- */

const DORADO_OSCURO = "#FFC83D";

export function useColorEstrella() {
  const { esOscuro } = useTema();
  return esOscuro ? DORADO_OSCURO : COLORES.claro.panelDorado;
}

const ICONO = {
  llena: "star",
  media: "star-half",
  vacia: "star-outline",
} as const;

// Estrellas de solo lectura (admite media estrella).
// colorLlena / colorVacia: opcionales, para usar otra paleta (p. ej. el panel de admin).
export function EstrellasFijas({
  valor,
  tamano = 14,
  colorLlena,
  colorVacia,
}: {
  valor: number;
  tamano?: number;
  colorLlena?: string;
  colorVacia?: string;
}) {
  const { colores } = useTema();
  const doradoTema = useColorEstrella();
  const dorado = colorLlena ?? doradoTema;
  const vacia = colorVacia ?? colores.textoSecundario;
  return (
    <View
      style={styles.fila}
      accessible
      accessibilityRole="image"
      accessibilityLabel={etiquetaEstrellas(valor)}
    >
      {formasEstrellas(valor).map((forma, i) => (
        <Ionicons
          key={i}
          name={ICONO[forma]}
          size={tamano}
          color={forma === "vacia" ? vacia : dorado}
        />
      ))}
    </View>
  );
}

// Selector de 1 a 5; tocar la estrella ya elegida quita la calificación
export function SelectorEstrellas({
  valor,
  onCambiar,
  deshabilitado,
}: {
  valor: number | null;
  onCambiar: (valor: number | null) => void;
  deshabilitado?: boolean;
}) {
  const { colores } = useTema();
  const dorado = useColorEstrella();
  return (
    <View style={styles.selector} accessibilityRole="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => {
        const activa = valor !== null && n <= valor;
        return (
          <TouchableOpacity
            key={n}
            style={styles.botonEstrella}
            onPress={() => onCambiar(valor === n ? null : n)}
            disabled={deshabilitado}
            accessibilityRole="button"
            accessibilityLabel={`Calificar con ${etiquetaEstrellas(n)}`}
            accessibilityHint={valor === n ? "Toca de nuevo para quitar la calificación" : undefined}
            accessibilityState={{ selected: valor === n, disabled: deshabilitado }}
          >
            <Ionicons
              name={activa ? "star" : "star-outline"}
              size={30}
              color={activa ? dorado : colores.textoSecundario}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: 1 },
  selector: { flexDirection: "row", alignItems: "center", marginLeft: -6 },
  botonEstrella: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
});
