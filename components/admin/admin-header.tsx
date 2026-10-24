import { useTema } from "@/contexts/ThemeContext";
import { useMargenSuperior } from "@/hooks/use-margen-superior";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function AdminHeader({
  titulo,
  subtitulo,
  mostrarVolver = false,
  accion,
}: {
  titulo: string;
  subtitulo?: string;
  mostrarVolver?: boolean;
  accion?: React.ReactNode;
}) {
  const { colores } = useTema();
  const margenSuperior = useMargenSuperior(60);

  return (
    <View style={[styles.contenedor, { paddingTop: margenSuperior }]}>
      <View style={styles.filaSuperior}>
        <View style={styles.filaTitulo}>
          {mostrarVolver && (
            <TouchableOpacity
              style={styles.botonVolver}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={22} color={colores.texto} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={[styles.titulo, { color: colores.texto }]}>
              {titulo}
            </Text>
            {subtitulo && (
              <Text
                style={[styles.subtitulo, { color: colores.textoSecundario }]}
              >
                {subtitulo}
              </Text>
            )}
          </View>
        </View>

        {accion}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { paddingHorizontal: 20, paddingBottom: 12 },
  filaSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filaTitulo: { flexDirection: "row", alignItems: "center", flex: 1 },
  botonVolver: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginLeft: -8,
  },
  titulo: { fontSize: 24, fontWeight: "bold" },
  subtitulo: { fontSize: 14, marginTop: 2 },
});
