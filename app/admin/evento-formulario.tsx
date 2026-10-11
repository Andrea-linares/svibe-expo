import AccesoRestringido from "@/components/admin/acceso-restringido";
import AdminHeader from "@/components/admin/admin-header";
import CalendarioMensual from "@/components/eventos/CalendarioMensual";
import { COLOR_ACENTO } from "@/constants/theme";
import { useTema } from "@/contexts/ThemeContext";
import { useEsAdmin } from "@/hooks/use-es-admin";
import {
  DatosEvento,
  guardarEvento,
  obtenerEventoAdmin,
  obtenerHitosParaSelector,
  TipoEvento,
  TIPOS_EVENTO,
} from "@/lib/eventos";
import { formatearFechaCorta, hoyLocal, normalizarHora } from "@/lib/fechas";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ---------------------------------------------------------------------------
 * Crear / editar evento (admin)
 * "Publicar evento" desmarcado = borrador (solo visible para el admin).
 * ------------------------------------------------------------------------- */

type HitoOpcion = { id: string; nombre: string; direccion_referencia: string | null };

export default function EventoFormularioScreen() {
  const estadoAdmin = useEsAdmin();
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const esEdicion = !!id;

  const [hitos, setHitos] = useState<HitoOpcion[]>([]);
  const [titulo, setTitulo] = useState("");
  const [hitoId, setHitoId] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [tipo, setTipo] = useState<TipoEvento>("cultural");
  const [descripcion, setDescripcion] = useState("");
  const [publicado, setPublicado] = useState(true);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [selectorHitoAbierto, setSelectorHitoAbierto] = useState(false);
  const [selectorFechaAbierto, setSelectorFechaAbierto] = useState(false);
  const [busquedaHito, setBusquedaHito] = useState("");

  useEffect(() => {
    if (estadoAdmin !== "admin") return;
    let cancelado = false;

    async function cargar() {
      try {
        const [listaHitos, evento] = await Promise.all([
          obtenerHitosParaSelector(),
          id ? obtenerEventoAdmin(id) : Promise.resolve(null),
        ]);
        if (cancelado) return;
        setHitos(listaHitos);
        if (id && !evento) {
          Alert.alert("Evento no encontrado", "Es posible que se haya eliminado.");
          router.back();
          return;
        }
        if (evento) {
          setTitulo(evento.titulo);
          setHitoId(evento.hito_id);
          setFecha(evento.fecha);
          setHora(evento.hora?.slice(0, 5) ?? "");
          setHoraFin(evento.hora_fin?.slice(0, 5) ?? "");
          setTipo(evento.tipo);
          setDescripcion(evento.descripcion ?? "");
          setPublicado(evento.publicado);
        }
      } catch (e: any) {
        if (!cancelado) Alert.alert("Error al cargar", e?.message ?? "Inténtalo de nuevo.");
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [estadoAdmin, id]);

  const hitoSeleccionado = hitos.find((h) => h.id === hitoId) ?? null;

  const hitosFiltrados = useMemo(() => {
    const texto = busquedaHito.trim().toLowerCase();
    if (!texto) return hitos;
    return hitos.filter(
      (h) =>
        h.nombre.toLowerCase().includes(texto) ||
        h.direccion_referencia?.toLowerCase().includes(texto),
    );
  }, [hitos, busquedaHito]);

  async function guardar() {
    // ---- Validaciones ----
    if (!titulo.trim()) {
      Alert.alert("Faltan datos", "El nombre del evento es obligatorio.");
      return;
    }
    if (!fecha) {
      Alert.alert("Faltan datos", "Selecciona la fecha del evento.");
      return;
    }
    const horaNormalizada = hora.trim() ? normalizarHora(hora) : null;
    const horaFinNormalizada = horaFin.trim() ? normalizarHora(horaFin) : null;
    if (hora.trim() && !horaNormalizada) {
      Alert.alert("Hora no válida", "Escribe la hora en formato 24 h, por ejemplo 18:00.");
      return;
    }
    if (horaFin.trim() && !horaFinNormalizada) {
      Alert.alert("Hora de fin no válida", "Escribe la hora en formato 24 h, por ejemplo 21:00.");
      return;
    }
    if (horaFinNormalizada && !horaNormalizada) {
      Alert.alert("Falta la hora", "Para indicar la hora de fin, primero indica la hora de inicio.");
      return;
    }
    if (horaNormalizada && horaFinNormalizada && horaFinNormalizada <= horaNormalizada) {
      Alert.alert("Horario no válido", "La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }

    const datos: DatosEvento = {
      titulo: titulo.trim(),
      hito_id: hitoId,
      fecha,
      hora: horaNormalizada,
      hora_fin: horaFinNormalizada,
      tipo,
      descripcion: descripcion.trim() || null,
      publicado,
    };

    async function ejecutar() {
      setGuardando(true);
      try {
        await guardarEvento(datos, id);
        Alert.alert("Listo", esEdicion ? "Evento actualizado." : "Evento creado.");
        router.back();
      } catch (e: any) {
        Alert.alert("Error al guardar", e?.message ?? "Inténtalo de nuevo.");
      } finally {
        setGuardando(false);
      }
    }

    if (fecha < hoyLocal()) {
      Alert.alert(
        "La fecha ya pasó",
        "Los usuarios no verán este evento porque su fecha es anterior a hoy. ¿Guardar de todos modos?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Guardar", onPress: ejecutar },
        ],
      );
      return;
    }

    ejecutar();
  }

  if (estadoAdmin !== "admin") {
    return <AccesoRestringido verificando={estadoAdmin === "cargando"} />;
  }

  if (cargando) {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={COLOR_ACENTO} />
      </View>
    );
  }

  const estiloInput = [styles.input, { color: colores.texto, borderColor: colores.borde, backgroundColor: colores.tarjeta }];

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <AdminHeader titulo={esEdicion ? "Editar evento" : "Nuevo evento"} mostrarVolver />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Nombre */}
        <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>Nombre del evento *</Text>
        <TextInput
          style={estiloInput}
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Ej: Festival Cultural"
          placeholderTextColor="#999"
        />

        {/* Hito relacionado */}
        <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>Hito relacionado</Text>
        <TouchableOpacity style={[estiloInput, styles.selector]} onPress={() => setSelectorHitoAbierto(true)}>
          <Text
            style={{ color: hitoSeleccionado ? colores.texto : "#999", flex: 1 }}
            numberOfLines={1}
          >
            {hitoSeleccionado?.nombre ?? "Sin hito relacionado"}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colores.textoSecundario} />
        </TouchableOpacity>

        {/* Fecha */}
        <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>Fecha *</Text>
        <TouchableOpacity style={[estiloInput, styles.selector]} onPress={() => setSelectorFechaAbierto(true)}>
          <Text style={{ color: fecha ? colores.texto : "#999", flex: 1 }}>
            {fecha ? formatearFechaCorta(fecha) : "Seleccionar fecha"}
          </Text>
          <Ionicons name="calendar-outline" size={18} color={colores.textoSecundario} />
        </TouchableOpacity>

        {/* Horas */}
        <View style={styles.fila2}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>Hora</Text>
            <TextInput
              style={estiloInput}
              value={hora}
              onChangeText={setHora}
              placeholder="18:00"
              placeholderTextColor="#999"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>Hora de fin</Text>
            <TextInput
              style={estiloInput}
              value={horaFin}
              onChangeText={setHoraFin}
              placeholder="21:00"
              placeholderTextColor="#999"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
        </View>
        <Text style={[styles.ayuda, { color: colores.textoSecundario }]}>
          Formato 24 h. Ambas son opcionales.
        </Text>

        {/* Tipo */}
        <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>Tipo de evento *</Text>
        <View style={styles.chips}>
          {TIPOS_EVENTO.map((t) => {
            const activo = tipo === t.valor;
            return (
              <TouchableOpacity
                key={t.valor}
                style={[styles.chip, activo && { backgroundColor: t.color }]}
                onPress={() => setTipo(t.valor)}
              >
                <Text style={activo ? styles.chipTextoActivo : styles.chipTexto}>{t.etiqueta}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Descripción */}
        <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>Descripción</Text>
        <TextInput
          style={[estiloInput, { minHeight: 100, textAlignVertical: "top" }]}
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Describe el evento..."
          placeholderTextColor="#999"
          multiline
        />

        {/* Publicar */}
        <TouchableOpacity
          style={styles.filaCheckbox}
          onPress={() => setPublicado((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: publicado }}
        >
          <Ionicons
            name={publicado ? "checkbox" : "square-outline"}
            size={22}
            color={publicado ? COLOR_ACENTO : colores.textoSecundario}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.textoCheckbox, { color: colores.texto }]}>Publicar evento</Text>
            <Text style={[styles.ayuda, { color: colores.textoSecundario, marginTop: 2 }]}>
              Si no está marcado, se guarda como borrador y solo lo ven los administradores.
            </Text>
          </View>
        </TouchableOpacity>

        {/* Botones */}
        <View style={styles.fila2}>
          <TouchableOpacity
            style={[styles.botonCancelar, { borderColor: colores.borde }]}
            onPress={() => router.back()}
            disabled={guardando}
          >
            <Text style={[styles.textoCancelar, { color: colores.texto }]}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonGuardar} onPress={guardar} disabled={guardando}>
            {guardando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.textoBotonGuardar}>Guardar</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Selector de hito */}
      <Modal
        visible={selectorHitoAbierto}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectorHitoAbierto(false)}
      >
        <View style={styles.fondoModal}>
          <View style={[styles.panelModal, { backgroundColor: colores.tarjeta, maxHeight: "80%" }]}>
            <View style={styles.cabeceraModal}>
              <Text style={[styles.tituloModal, { color: colores.texto }]}>Hito relacionado</Text>
              <TouchableOpacity onPress={() => setSelectorHitoAbierto(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colores.textoSecundario} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[estiloInput, { marginBottom: 8 }]}
              value={busquedaHito}
              onChangeText={setBusquedaHito}
              placeholder="Buscar hito..."
              placeholderTextColor="#999"
            />
            <FlatList
              data={[null, ...hitosFiltrados]}
              keyExtractor={(item) => item?.id ?? "ninguno"}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const activo = (item?.id ?? null) === hitoId;
                return (
                  <TouchableOpacity
                    style={[styles.opcionHito, { borderBottomColor: colores.borde }]}
                    onPress={() => {
                      setHitoId(item?.id ?? null);
                      setSelectorHitoAbierto(false);
                      setBusquedaHito("");
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: item ? colores.texto : colores.textoSecundario,
                          fontWeight: activo ? "700" : "400",
                        }}
                      >
                        {item?.nombre ?? "Sin hito relacionado"}
                      </Text>
                      {item?.direccion_referencia && (
                        <Text style={[styles.ayuda, { color: colores.textoSecundario }]} numberOfLines={1}>
                          {item.direccion_referencia}
                        </Text>
                      )}
                    </View>
                    {activo && <Ionicons name="checkmark" size={20} color={COLOR_ACENTO} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Selector de fecha: permite cualquier mes */}
      <Modal
        visible={selectorFechaAbierto}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectorFechaAbierto(false)}
      >
        <View style={styles.fondoModal}>
          <View style={[styles.panelModal, { backgroundColor: colores.tarjeta }]}>
            <View style={styles.cabeceraModal}>
              <Text style={[styles.tituloModal, { color: colores.texto }]}>Fecha del evento</Text>
              <TouchableOpacity onPress={() => setSelectorFechaAbierto(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colores.textoSecundario} />
              </TouchableOpacity>
            </View>
            <CalendarioMensual
              seleccionado={fecha}
              onSeleccionar={(f) => {
                setFecha(f);
                setSelectorFechaAbierto(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  etiqueta: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  selector: { flexDirection: "row", alignItems: "center", gap: 8 },
  fila2: { flexDirection: "row", gap: 12 },
  ayuda: { fontSize: 12, marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  chipTexto: { color: "#333" },
  chipTextoActivo: { color: "#fff", fontWeight: "600" },
  filaCheckbox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 20,
    marginBottom: 24,
  },
  textoCheckbox: { fontSize: 15, fontWeight: "600" },
  botonCancelar: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textoCancelar: { fontSize: 15, fontWeight: "600" },
  botonGuardar: {
    flex: 1,
    height: 52,
    backgroundColor: COLOR_ACENTO,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonGuardar: { color: "#fff", fontSize: 15, fontWeight: "600" },
  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  panelModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  cabeceraModal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  tituloModal: { fontSize: 18, fontWeight: "bold" },
  opcionHito: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
});
