import { EstrellasFijas, SelectorEstrellas, useColorEstrella } from "@/components/foro/Estrellas";
import { COLOR_ACENTO } from "@/constants/theme";
import { useTema } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import {
  contarCaracteres,
  MAX_CARACTERES_RESENA,
  MIN_CARACTERES_RESENA,
  normalizarResena,
  validarResena,
} from "@/lib/validacion-resena";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  titulo: string;
  subtitulo?: string;
  textoInicial?: string;
  textoBoton: string;
  placeholder?: string;
  // Solo en reseñas (HU-019): "editable" muestra el selector; "fija" muestra la
  // calificación que el usuario ya dio en este hito. Sin esta prop no hay estrellas.
  calificacion?: { modo: "editable" | "fija"; valor: number | null };
  // Debe lanzar un Error con mensaje si no se pudo guardar.
  // `calificacion` solo se envía en modo "editable".
  onGuardar: (texto: string, calificacion?: number | null) => Promise<void>;
  onCerrar: () => void;
};

// Hoja inferior para escribir o editar una reseña o un comentario (10–500 caracteres).
// El padre la monta solo cuando está abierta, así el texto inicial se carga al abrir.
export default function FormularioResena({
  titulo,
  subtitulo,
  textoInicial = "",
  textoBoton,
  placeholder = "Cuenta tu experiencia en este lugar...",
  calificacion,
  onGuardar,
  onCerrar,
}: Props) {
  const { colores } = useTema();
  const dorado = useColorEstrella();
  const [texto, setTexto] = useState(textoInicial);
  const [estrellas, setEstrellas] = useState<number | null>(calificacion?.valor ?? null);
  const [tocado, setTocado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const editable = calificacion?.modo === "editable";
  const cantidad = contarCaracteres(normalizarResena(texto));
  const errorValidacion = validarResena(texto);
  const cambioCalificacion = editable && estrellas !== (calificacion?.valor ?? null);
  const sinCambios = normalizarResena(texto) === normalizarResena(textoInicial) && !cambioCalificacion;
  const deshabilitado = guardando || errorValidacion !== null || (textoInicial !== "" && sinCambios);
  const mensajeError = errorServidor ?? (tocado ? errorValidacion : null);
  const colorContador = cantidad > MAX_CARACTERES_RESENA ? colores.peligro : colores.textoSecundario;

  async function guardar() {
    setTocado(true);
    if (errorValidacion) return;
    setGuardando(true);
    setErrorServidor(null);
    try {
      await onGuardar(normalizarResena(texto), editable ? estrellas : undefined);
    } catch (e: any) {
      setErrorServidor(e?.message ?? "No se pudo guardar la reseña. Inténtalo de nuevo.");
      setGuardando(false);
    }
  }

  function cerrar() {
    if (!guardando) onCerrar();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={cerrar}>
      <KeyboardAvoidingView
        style={styles.fondo}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={cerrar} />

        <View style={[styles.hoja, { backgroundColor: colores.tarjeta }]}>
          <View style={[styles.linea, { backgroundColor: colores.borde }]} />

          <Text style={[styles.titulo, { color: colores.texto }]}>{titulo}</Text>
          {subtitulo && (
            <Text style={[styles.subtitulo, { color: colores.textoSecundario }]}>{subtitulo}</Text>
          )}

          {calificacion && (
            <View style={styles.bloqueCalificacion}>
              <View style={styles.filaEtiqueta}>
                <Ionicons name="star" size={16} color={dorado} />
                <Text style={[styles.etiqueta, { color: colores.texto }]}>Calificación (opcional)</Text>
              </View>
              {editable ? (
                <SelectorEstrellas
                  valor={estrellas}
                  onCambiar={(valor) => {
                    setEstrellas(valor);
                    setErrorServidor(null);
                  }}
                  deshabilitado={guardando}
                />
              ) : (
                <View style={styles.filaFija}>
                  {calificacion.valor !== null && <EstrellasFijas valor={calificacion.valor} tamano={22} />}
                  <Text style={[styles.yaCalificaste, { color: colores.textoSecundario }]}>
                    Ya calificaste este hito
                  </Text>
                </View>
              )}
            </View>
          )}

          <TextInput
            style={[
              styles.campo,
              {
                color: colores.texto,
                borderColor: mensajeError ? colores.peligro : colores.borde,
                backgroundColor: colores.fondo,
              },
            ]}
            value={texto}
            onChangeText={(valor) => {
              setTexto(valor);
              setErrorServidor(null);
            }}
            onBlur={() => setTocado(true)}
            placeholder={placeholder}
            placeholderTextColor={colores.textoSecundario}
            multiline
            textAlignVertical="top"
            editable={!guardando}
            autoFocus
            accessibilityLabel="Texto de la reseña"
          />

          <View style={styles.filaInfo}>
            <Text style={[styles.error, { color: colores.peligro }]}>{mensajeError ?? ""}</Text>
            <Text style={[styles.contador, { color: colorContador }]}>
              {cantidad}/{MAX_CARACTERES_RESENA}
            </Text>
          </View>
          <Text style={[styles.ayuda, { color: colores.textoSecundario }]}>
            Entre {MIN_CARACTERES_RESENA} y {MAX_CARACTERES_RESENA} caracteres.
          </Text>

          <View style={styles.botones}>
            <TouchableOpacity
              style={[styles.boton, styles.botonCancelar, { borderColor: colores.borde }]}
              onPress={cerrar}
              disabled={guardando}
            >
              <Text style={[styles.textoCancelar, { color: colores.texto }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.boton, styles.botonGuardar, deshabilitado && styles.botonDeshabilitado]}
              onPress={guardar}
              disabled={deshabilitado}
            >
              {guardando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.textoGuardar}>{textoBoton}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  hoja: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 32,
  },
  linea: {
    width: 55,
    height: 5,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 18,
  },
  titulo: { fontSize: 20, fontWeight: "bold" },
  subtitulo: { fontSize: 14, marginTop: 4 },
  bloqueCalificacion: { marginTop: 16 },
  filaEtiqueta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  etiqueta: { fontSize: 14, fontWeight: "600" },
  filaFija: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  yaCalificaste: { fontSize: 13 },
  campo: {
    marginTop: 16,
    minHeight: 130,
    maxHeight: 220,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    lineHeight: 21,
  },
  filaInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 6,
    gap: 12,
  },
  error: { flex: 1, fontSize: 12.5 },
  contador: { fontSize: 12.5, fontVariant: ["tabular-nums"] },
  ayuda: { fontSize: 12, marginTop: 2 },
  botones: { flexDirection: "row", gap: 12, marginTop: 20 },
  boton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  botonCancelar: { borderWidth: 1.3 },
  botonGuardar: { backgroundColor: COLOR_ACENTO },
  botonDeshabilitado: { opacity: 0.5 },
  textoCancelar: { fontSize: 15, fontWeight: "600" },
  textoGuardar: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
