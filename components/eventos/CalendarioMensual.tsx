import { COLOR_ACENTO } from "@/constants/theme";
import { useTema } from "@/contexts/ThemeContext";
import { aFechaISO, DIAS_SEMANA_CORTOS, desdeFechaISO, hoyLocal, nombreMes } from "@/lib/fechas";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  // Día seleccionado ("YYYY-MM-DD") o null
  seleccionado: string | null;
  onSeleccionar: (fecha: string) => void;
  // Colores de los puntos por día: { "2026-09-18": ["#3B6FA0", ...] }
  marcas?: Record<string, string[]>;
  // Si se indica, no se puede retroceder a meses anteriores ni elegir días previos
  fechaMinima?: string;
  // Mes que se muestra al abrir ("YYYY-MM-DD"); por defecto, el seleccionado o hoy
  fechaInicial?: string;
};

const MAX_PUNTOS = 3;

// Calendario mensual propio (semana de lunes a domingo), sin dependencias.
export default function CalendarioMensual({
  seleccionado,
  onSeleccionar,
  marcas = {},
  fechaMinima,
  fechaInicial,
}: Props) {
  const { colores } = useTema();
  const hoy = hoyLocal();

  const [mesVisible, setMesVisible] = useState(() => {
    const base = desdeFechaISO(fechaInicial ?? seleccionado ?? hoy);
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const anio = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();

  const minimo = fechaMinima ? desdeFechaISO(fechaMinima) : null;
  const puedeRetroceder =
    !minimo ||
    anio > minimo.getFullYear() ||
    (anio === minimo.getFullYear() && mes > minimo.getMonth());

  function cambiarMes(delta: number) {
    setMesVisible(new Date(anio, mes + delta, 1));
  }

  // Celdas: huecos iniciales (lunes = 0) + días del mes, en filas de 7
  const desplazamiento = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const celdas: (string | null)[] = [
    ...Array<null>(desplazamiento).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => aFechaISO(new Date(anio, mes, i + 1))),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);
  const filas: (string | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) filas.push(celdas.slice(i, i + 7));

  return (
    <View>
      {/* Mes y flechas */}
      <View style={styles.cabecera}>
        <TouchableOpacity
          onPress={() => cambiarMes(-1)}
          disabled={!puedeRetroceder}
          hitSlop={10}
          accessibilityLabel="Mes anterior"
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={puedeRetroceder ? colores.texto : colores.borde}
          />
        </TouchableOpacity>
        <Text style={[styles.nombreMes, { color: colores.texto }]}>{nombreMes(mes, anio)}</Text>
        <TouchableOpacity onPress={() => cambiarMes(1)} hitSlop={10} accessibilityLabel="Mes siguiente">
          <Ionicons name="chevron-forward" size={20} color={colores.texto} />
        </TouchableOpacity>
      </View>

      {/* Días de la semana */}
      <View style={styles.fila}>
        {DIAS_SEMANA_CORTOS.map((d) => (
          <Text key={d} style={[styles.diaSemana, { color: colores.textoSecundario }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* Días del mes */}
      {filas.map((fila, i) => (
        <View key={i} style={styles.fila}>
          {fila.map((fecha, j) => {
            if (!fecha) return <View key={j} style={styles.celda} />;

            const deshabilitado = !!fechaMinima && fecha < fechaMinima;
            const esSeleccionado = fecha === seleccionado;
            const esHoy = fecha === hoy;
            const puntos = (marcas[fecha] ?? []).slice(0, MAX_PUNTOS);

            return (
              <TouchableOpacity
                key={j}
                style={styles.celda}
                disabled={deshabilitado}
                onPress={() => onSeleccionar(fecha)}
              >
                <View
                  style={[
                    styles.circuloDia,
                    esSeleccionado && { backgroundColor: COLOR_ACENTO },
                    !esSeleccionado && esHoy && { borderWidth: 1.5, borderColor: COLOR_ACENTO },
                  ]}
                >
                  <Text
                    style={[
                      styles.numeroDia,
                      { color: deshabilitado ? colores.borde : colores.texto },
                      esHoy && { color: COLOR_ACENTO, fontWeight: "700" },
                      esSeleccionado && { color: "#fff", fontWeight: "700" },
                    ]}
                  >
                    {Number(fecha.slice(8))}
                  </Text>
                </View>
                <View style={styles.filaPuntos}>
                  {puntos.map((color, k) => (
                    <View key={k} style={[styles.punto, { backgroundColor: color }]} />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  nombreMes: { fontSize: 16, fontWeight: "bold" },
  fila: { flexDirection: "row" },
  diaSemana: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  celda: { flex: 1, alignItems: "center", paddingVertical: 3 },
  circuloDia: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  numeroDia: { fontSize: 14 },
  filaPuntos: { flexDirection: "row", gap: 2, height: 6, marginTop: 2 },
  punto: { width: 5, height: 5, borderRadius: 2.5 },
});
