import EtiquetaTipo from "@/components/eventos/EtiquetaTipo";
import { COLOR_ACENTO } from "@/constants/theme";
import { useTema } from "@/contexts/ThemeContext";
import { Evento, imagenDeEvento } from "@/lib/eventos";
import { formatearHorario, partesFecha } from "@/lib/fechas";
import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  evento: Evento;
  onPress: () => void;
  // En la lista de un hito no hace falta repetir el nombre del lugar
  mostrarLugar?: boolean;
};

// Tarjeta de evento: imagen del hito, fecha, título, lugar, horario y tipo
export default function TarjetaEvento({ evento, onPress, mostrarLugar = true }: Props) {
  const { colores } = useTema();
  const { dia, mesCorto } = partesFecha(evento.fecha);
  const horario = formatearHorario(evento.hora, evento.hora_fin);

  return (
    <TouchableOpacity
      style={[styles.tarjeta, { backgroundColor: colores.tarjeta }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image source={imagenDeEvento(evento)} style={styles.imagen} />

      <View style={styles.bloqueFecha}>
        <Text style={styles.dia}>{dia}</Text>
        <Text style={styles.mes}>{mesCorto}</Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.titulo, { color: colores.texto }]} numberOfLines={2}>
          {evento.titulo}
        </Text>
        {mostrarLugar && evento.hito && (
          <Text style={[styles.secundario, { color: colores.textoSecundario }]} numberOfLines={1}>
            {evento.hito.nombre}
          </Text>
        )}
        {horario && (
          <View style={styles.filaHora}>
            <Ionicons name="time-outline" size={13} color={colores.textoSecundario} />
            <Text style={[styles.secundario, { color: colores.textoSecundario, marginTop: 0 }]}>
              {horario}
            </Text>
          </View>
        )}
        <View style={{ marginTop: 6 }}>
          <EtiquetaTipo tipo={evento.tipo} />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#C4C4C4" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
    gap: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  imagen: { width: 64, height: 64, borderRadius: 12 },
  bloqueFecha: { width: 36, alignItems: "center" },
  dia: { fontSize: 20, fontWeight: "bold", color: COLOR_ACENTO },
  mes: { fontSize: 11, fontWeight: "600", color: COLOR_ACENTO },
  info: { flex: 1 },
  titulo: { fontSize: 14, fontWeight: "bold" },
  secundario: { fontSize: 12, marginTop: 2 },
  filaHora: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
});
