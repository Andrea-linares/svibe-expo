import { useTema } from "@/contexts/ThemeContext";
import { useEsAdmin } from "@/hooks/use-es-admin";
import { ReactNode } from "react";
import { View } from "react-native";

// Muestra el contenido solo a administradores. Mientras se verifica, o si el
// usuario no es admin, deja solo el fondo del panel, sin ningún mensaje.
// La protección real de los datos la hace la RLS con es_admin().
export default function SoloAdmin({ children }: { children: ReactNode }) {
  const { colores } = useTema();
  const estado = useEsAdmin();

  if (estado !== "admin") {
    return <View style={{ flex: 1, backgroundColor: colores.panelFondo }} />;
  }
  return <>{children}</>;
}
