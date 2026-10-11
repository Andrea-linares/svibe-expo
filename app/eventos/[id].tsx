import EtiquetaTipo from "@/components/eventos/EtiquetaTipo";
import { COLOR_ACENTO } from "@/constants/theme";
import { useTema } from "@/contexts/ThemeContext";
import { Evento, imagenDeEvento, obtenerEventoPublico } from "@/lib/eventos";
import { formatearFechaLarga, formatearHorario, partesFecha } from "@/lib/fechas";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ---------------------------------------------------------------------------
 * Detalle de evento (usuarios)
 * Solo muestra eventos vigentes y publicados. La imagen es la principal del
 * hito relacionado; si el evento no tiene hito, no se muestra el enlace.
 * ------------------------------------------------------------------------- */

export default function DetalleEventoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colores } = useTema();
  const insets = useSafeAreaInsets();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelado = false;

    obtenerEventoPublico(id)
      .then((e) => {
        if (!cancelado) setEvento(e);
      })
      .catch((e) => {
        console.error("Error cargando evento:", e);
        if (!cancelado) setError(e?.message ?? "Inténtalo de nuevo.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [id]);

  const botonVolver = (
    <TouchableOpacity
      style={[styles.botonVolver, { top: insets.top + 8 }]}
      onPress={() => router.back()}
      accessibilityLabel="Volver"
    >
      <Ionicons name="arrow-back" size={22} color="#fff" />
    </TouchableOpacity>
  );

  if (cargando || error || !evento) {
    return (
      <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
        <View style={[styles.encabezadoSimple, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colores.texto} />
          </TouchableOpacity>
        </View>
        <View style={styles.centrado}>
          {cargando ? (
            <ActivityIndicator size="large" color={COLOR_ACENTO} />
          ) : (
            <>
              <Ionicons
                name={error ? "alert-circle-outline" : "calendar-clear-outline"}
                size={64}
                color={COLOR_ACENTO}
              />
              <Text style={[styles.tituloVacio, { color: colores.texto }]}>
                {error ? "No pudimos cargar el evento" : "Este evento ya no está disponible"}
              </Text>
              <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>
                {error ?? "Puede que ya haya pasado o que se haya retirado."}
              </Text>
            </>
          )}
        </View>
      </View>
    );
  }

  const { dia, mesCorto } = partesFecha(evento.fecha);
  const horario = formatearHorario(evento.hora, evento.hora_fin);

  return (
    <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <Image source={imagenDeEvento(evento)} style={styles.imagen} />

        {/* Tarjeta principal */}
        <View style={[styles.tarjetaPrincipal, { backgroundColor: colores.tarjeta }]}>
          <View style={styles.filaPrincipal}>
            <View style={[styles.bloqueFecha, { borderColor: colores.borde }]}>
              <Text style={styles.dia}>{dia}</Text>
              <Text style={styles.mes}>{mesCorto}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.titulo, { color: colores.texto }]}>{evento.titulo}</Text>
              {evento.hito && (
                <Text style={[styles.secundario, { color: colores.textoSecundario }]}>
                  {evento.hito.nombre}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.filaDato}>
            <Ionicons name="calendar-outline" size={16} color={colores.textoSecundario} />
            <Text style={[styles.textoDato, { color: colores.texto }]}>
              {formatearFechaLarga(evento.fecha)}
            </Text>
          </View>
          {horario && (
            <View style={styles.filaDato}>
              <Ionicons name="time-outline" size={16} color={colores.textoSecundario} />
              <Text style={[styles.textoDato, { color: colores.texto }]}>{horario}</Text>
            </View>
          )}
          <View style={{ marginTop: 12 }}>
            <EtiquetaTipo tipo={evento.tipo} />
          </View>
        </View>

        <View style={styles.cuerpo}>
          {evento.descripcion && (
            <>
              <Text style={[styles.tituloSeccion, { color: colores.texto }]}>Descripción</Text>
              <Text style={[styles.descripcion, { color: colores.textoSecundario }]}>
                {evento.descripcion}
              </Text>
            </>
          )}

          {evento.hito && (
            <>
              {/* Ubicación del hito */}
              <View style={[styles.filaDato, { marginTop: 20 }]}>
                <Ionicons name="location-outline" size={18} color={COLOR_ACENTO} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nombreLugar, { color: colores.texto }]}>
                    {evento.hito.nombre}
                  </Text>
                  {evento.hito.direccion_referencia && (
                    <Text style={[styles.secundario, { color: colores.textoSecundario }]}>
                      {evento.hito.direccion_referencia}
                    </Text>
                  )}
                </View>
              </View>

              {/* Enlace al hito relacionado */}
              <TouchableOpacity
                style={styles.tarjetaHito}
                onPress={() => router.push(`/hito/${evento.hito!.id}`)}
                activeOpacity={0.8}
              >
                <Ionicons name="business-outline" size={26} color={COLOR_ACENTO} />
                <Text style={styles.textoHito}>
                  Este evento está relacionado con el hito cultural{" "}
                  <Text style={{ fontWeight: "bold" }}>{evento.hito.nombre}</Text>.
                </Text>
                <Ionicons name="chevron-forward" size={18} color={COLOR_ACENTO} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {botonVolver}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  encabezadoSimple: { paddingHorizontal: 16, paddingBottom: 12 },
  imagen: { width: "100%", height: 260 },
  botonVolver: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  tarjetaPrincipal: {
    marginHorizontal: 16,
    marginTop: -40,
    borderRadius: 18,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  filaPrincipal: { flexDirection: "row", alignItems: "center", gap: 14 },
  bloqueFecha: {
    width: 54,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  dia: { fontSize: 22, fontWeight: "bold", color: COLOR_ACENTO },
  mes: { fontSize: 12, fontWeight: "600", color: COLOR_ACENTO },
  titulo: { fontSize: 20, fontWeight: "bold" },
  secundario: { fontSize: 13, marginTop: 2 },
  filaDato: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  textoDato: { fontSize: 14 },
  cuerpo: { paddingHorizontal: 16, paddingTop: 20 },
  tituloSeccion: { fontSize: 17, fontWeight: "bold", marginBottom: 8 },
  descripcion: { fontSize: 14.5, lineHeight: 22 },
  nombreLugar: { fontSize: 14, fontWeight: "600" },
  tarjetaHito: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#EAF2FA",
  },
  textoHito: { flex: 1, fontSize: 13.5, lineHeight: 19, color: "#1A2A3A" },
  tituloVacio: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginTop: 16 },
  textoVacio: { fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 },
});
