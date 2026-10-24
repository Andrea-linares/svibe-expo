import { useSafeAreaInsets } from "react-native-safe-area-context";

// Separación extra entre la barra de estado (o el notch / Dynamic Island)
// y el contenido.
const SEPARACION = 8;

// Margen superior seguro: respeta la barra de estado en iPhone sin cambiar
// el diseño en Android. Devuelve el mayor entre el margen fijo que ya usaba
// la pantalla y el inset superior + 8, así que en Android (barra de estado
// más baja que esos márgenes) el valor queda igual que antes.
export function useMargenSuperior(minimo: number): number {
  const insets = useSafeAreaInsets();
  return Math.max(minimo, insets.top + SEPARACION);
}
