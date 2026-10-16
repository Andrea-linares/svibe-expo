import { Alert, Platform } from "react-native";

/* ---------------------------------------------------------------------------
 * Confirmaciones y avisos que también funcionan en web
 * En react-native-web Alert.alert no hace nada, así que en web se usan
 * window.confirm y window.alert.
 * ------------------------------------------------------------------------- */

type OpcionesConfirmar = {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  destructivo?: boolean;
  onConfirmar: () => void;
};

export function confirmar({
  titulo,
  mensaje,
  textoConfirmar = "Eliminar",
  textoCancelar = "Cancelar",
  destructivo = true,
  onConfirmar,
}: OpcionesConfirmar) {
  if (Platform.OS === "web") {
    if ((globalThis as any).confirm?.(`${titulo}\n\n${mensaje}`)) onConfirmar();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: textoCancelar, style: "cancel" },
    { text: textoConfirmar, style: destructivo ? "destructive" : "default", onPress: onConfirmar },
  ]);
}

export function avisar(titulo: string, mensaje: string) {
  if (Platform.OS === "web") {
    (globalThis as any).alert?.(`${titulo}\n\n${mensaje}`);
    return;
  }
  Alert.alert(titulo, mensaje);
}
