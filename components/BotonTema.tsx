import { useTema } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";

export function BotonTema() {
  const { esOscuro, colores, alternarTema } = useTema();

  return (
    <TouchableOpacity onPress={alternarTema} style={{ padding: 6 }}>
      <Ionicons
        name={esOscuro ? "moon" : "sunny"}
        size={22}
        color={esOscuro ? colores.texto : "#F5A623"}
      />
    </TouchableOpacity>
  );
}
