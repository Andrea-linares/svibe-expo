import SoloAdmin from "@/components/admin/SoloAdmin";
import BeforeAfterSlider from "@/components/ra/BeforeAfterSlider";
import { ESPACIADO_PANEL, useTema } from "@/contexts/ThemeContext";
import {
  BorradorFoto,
  ErroresEditor,
  uriVisible,
  useAntesDespuesAdmin,
} from "@/hooks/use-antes-despues-admin";
import { useMargenSuperior } from "@/hooks/use-margen-superior";
import { avisar, confirmar } from "@/lib/confirmar";
import { MAX_DESCRIPCION_CORTA, RADIO_MAX, RADIO_MIN, TipoFotoRA } from "@/lib/ra-servicio";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams, useNavigation, usePreventRemove } from "expo-router";
import type { NavigationAction } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Colores = ReturnType<typeof useTema>["colores"];

export default function EditorRAScreen() {
  return (
    <SoloAdmin>
      <EditorRA />
    </SoloAdmin>
  );
}

function EditorRA() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colores } = useTema();
  const margenSuperior = useMargenSuperior(50);
  const insets = useSafeAreaInsets();
  const editor = useAntesDespuesAdmin(id);
  const { datos, borrador, errores, hayCambios, guardando } = editor;
  const navigation = useNavigation();
  // Salida confirmada: la acción de navegación bloqueada (o null = volver atrás)
  const [salida, setSalida] = useState<{ accion: NavigationAction | null } | null>(null);

  // Pide confirmación si se intenta salir con cambios sin guardar
  usePreventRemove(hayCambios && !salida, ({ data }) => {
    confirmar({
      titulo: "Cambios sin guardar",
      mensaje: "Si sales ahora se descartarán los cambios. ¿Quieres salir?",
      textoConfirmar: "Salir sin guardar",
      textoCancelar: "Seguir editando",
      onConfirmar: () => setSalida({ accion: data.action }),
    });
  });

  // Se navega cuando el bloqueo ya está desactivado
  useEffect(() => {
    if (!salida) return;
    if (salida.accion) navigation.dispatch(salida.accion);
    else router.back();
  }, [salida, navigation]);

  function cancelar() {
    if (!hayCambios) {
      router.back();
      return;
    }
    confirmar({
      titulo: "Descartar cambios",
      mensaje: "Se perderán las fotos y los cambios que no has guardado.",
      textoConfirmar: "Descartar",
      onConfirmar: () => setSalida({ accion: null }),
    });
  }

  async function guardar() {
    const resultado = await editor.guardar();
    if (!resultado.ok) {
      avisar("No se pudo guardar", resultado.error);
      return;
    }
    avisar("Guardado", resultado.aviso ?? "La configuración de RA se guardó correctamente.");
  }

  async function elegir(tipo: TipoFotoRA) {
    const permitido = await editor.elegirFoto(tipo);
    if (!permitido) {
      avisar("Permiso necesario", "Necesitamos acceso a tu galería para elegir la foto.");
    }
  }

  function pedirQuitar(tipo: TipoFotoRA, foto: BorradorFoto) {
    // Si es una foto recién elegida y no hay una guardada, se quita sin preguntar
    if (!foto.original) {
      editor.cambiarFoto(tipo, { nueva: null, anio: "", pie: "" });
      return;
    }
    confirmar({
      titulo: "Eliminar foto",
      mensaje:
        "La foto se eliminará (también del almacenamiento) al presionar \"Guardar\". ¿Continuar?",
      onConfirmar: () => editor.quitarFoto(tipo),
    });
  }

  if (editor.errorCarga) {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.panelFondo }]}>
        <Ionicons name="cloud-offline-outline" size={40} color={colores.panelTextoSecundario} />
        <Text style={[styles.textoError, { color: colores.panelTexto }]}>
          No se pudo cargar el hito.
        </Text>
        <Text style={[styles.ayuda, { color: colores.panelTextoSecundario }]}>
          {editor.errorCarga}
        </Text>
        <TouchableOpacity onPress={editor.recargar} style={styles.reintentar}>
          <Text style={{ color: colores.acentoRA, fontWeight: "700" }}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!datos || !borrador) {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.panelFondo }]}>
        <ActivityIndicator size="large" color={colores.acentoRA} />
      </View>
    );
  }

  const uriAntes = uriVisible(borrador.antes);
  const uriDespues = uriVisible(borrador.despues) ?? datos.primeraGaleria;
  const largoDescripcion = Array.from(borrador.descripcion).length;
  const puedeGuardar = hayCambios && !guardando && Object.keys(errores).length === 0;
  const estiloTarjeta = {
    backgroundColor: colores.panelTarjeta,
    borderColor: colores.panelBorde,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colores.panelFondo }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Encabezado */}
      <View style={[styles.encabezado, { paddingTop: margenSuperior }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.botonVolver}
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={22} color={colores.panelTexto} />
        </TouchableOpacity>
        <Text style={[styles.titulo, { color: colores.panelTexto }]} numberOfLines={2}>
          Editor de RA – {datos.nombre}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.cuerpo}
        keyboardShouldPersistTaps="handled"
        pointerEvents={guardando ? "none" : "auto"}
      >
        <SeccionFoto
          titulo="Foto histórica (antes)"
          foto={borrador.antes}
          uri={uriAntes}
          errorAnio={errores.anioAntes}
          colores={colores}
          estiloTarjeta={estiloTarjeta}
          onElegir={() => elegir("antes")}
          onQuitar={() => pedirQuitar("antes", borrador.antes)}
          onDeshacer={() => editor.restaurarFoto("antes")}
          onCambiarAnio={(v) => editor.cambiarFoto("antes", { anio: v })}
          onCambiarPie={(v) => editor.cambiarFoto("antes", { pie: v })}
        />

        <SeccionFoto
          titulo="Foto actual (después)"
          ayuda="Opcional. Si no hay foto actual, la app usa la primera foto de la galería como “ahora”."
          foto={borrador.despues}
          uri={uriVisible(borrador.despues)}
          errorAnio={errores.anioDespues}
          colores={colores}
          estiloTarjeta={estiloTarjeta}
          onElegir={() => elegir("despues")}
          onQuitar={() => pedirQuitar("despues", borrador.despues)}
          onDeshacer={() => editor.restaurarFoto("despues")}
          onCambiarAnio={(v) => editor.cambiarFoto("despues", { anio: v })}
          onCambiarPie={(v) => editor.cambiarFoto("despues", { pie: v })}
        />

        {/* Vista previa */}
        <View style={[styles.tarjeta, estiloTarjeta]}>
          <Text style={[styles.tituloSeccion, { color: colores.panelTexto }]}>
            Vista previa antes/después
          </Text>
          {uriAntes && uriDespues ? (
            <BeforeAfterSlider
              key={`${uriAntes}|${uriDespues}`}
              antesUri={uriAntes}
              despuesUri={uriDespues}
              style={styles.vistaPrevia}
            />
          ) : (
            <Text style={[styles.ayuda, { color: colores.panelTextoSecundario }]}>
              {uriAntes
                ? "Agrega una foto actual o fotos de galería al hito para comparar."
                : "Agrega una foto histórica para ver la vista previa."}
            </Text>
          )}
        </View>

        {/* Configuración */}
        <View style={[styles.tarjeta, estiloTarjeta]}>
          <Text style={[styles.tituloSeccion, { color: colores.panelTexto }]}>
            Configuración de RA
          </Text>

          <View style={styles.filaConfig}>
            <Ionicons name="scan-outline" size={20} color={colores.panelTextoSecundario} />
            <Text style={[styles.textoConfig, { color: colores.panelTexto }]}>Activar en AR</Text>
            <Switch
              value={borrador.arActivo}
              onValueChange={(v) => editor.cambiar({ arActivo: v })}
              trackColor={{ true: colores.acentoRA, false: colores.panelIconoNeutro }}
              accessibilityLabel="Activar en AR"
            />
          </View>

          <View style={styles.filaConfig}>
            <Ionicons name="radio-outline" size={20} color={colores.panelTextoSecundario} />
            <Text style={[styles.textoConfig, { color: colores.panelTexto }]}>
              Radio de detección (m)
            </Text>
            <TextInput
              value={borrador.radio}
              onChangeText={(v) => editor.cambiar({ radio: v.replace(/\D/g, "") })}
              keyboardType="number-pad"
              maxLength={4}
              style={[
                styles.input,
                styles.inputRadio,
                campoEstilo(colores, !!errores.radio),
              ]}
              accessibilityLabel="Radio de detección en metros"
            />
            <Text style={[styles.rango, { color: colores.panelTextoSecundario }]}>
              ({RADIO_MIN} - {RADIO_MAX})
            </Text>
          </View>
          <MensajeError texto={errores.radio} colores={colores} />

          <Text style={[styles.etiqueta, { color: colores.panelTextoSecundario }]}>
            Descripción corta (máx. {MAX_DESCRIPCION_CORTA})
          </Text>
          <TextInput
            value={borrador.descripcion}
            onChangeText={(v) => editor.cambiar({ descripcion: v })}
            maxLength={MAX_DESCRIPCION_CORTA}
            multiline
            placeholder="Ej.: La Catedral Metropolitana, un ícono de la ciudad."
            placeholderTextColor={colores.panelTextoSecundario}
            style={[
              styles.input,
              styles.inputMultilinea,
              campoEstilo(colores, !!errores.descripcion),
            ]}
          />
          <Text style={[styles.contador, { color: colores.panelTextoSecundario }]}>
            {largoDescripcion}/{MAX_DESCRIPCION_CORTA}
          </Text>
          <MensajeError texto={errores.descripcion} colores={colores} />
        </View>
      </ScrollView>

      {/* Botones */}
      <View
        style={[
          styles.barraBotones,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: colores.panelBarra,
            borderTopColor: colores.panelBorde,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.boton, { borderColor: colores.panelBorde, borderWidth: 1 }]}
          onPress={cancelar}
          disabled={guardando}
        >
          <Text style={[styles.textoBoton, { color: colores.panelTexto }]}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.boton,
            { backgroundColor: colores.acentoRA, opacity: puedeGuardar ? 1 : 0.5 },
          ]}
          onPress={guardar}
          disabled={!puedeGuardar}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.textoBoton, { color: "#fff" }]}>Guardar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function campoEstilo(colores: Colores, conError: boolean) {
  return {
    color: colores.panelTexto,
    backgroundColor: colores.panelFondo,
    borderColor: conError ? colores.peligro : colores.panelBorde,
  };
}

function MensajeError({ texto, colores }: { texto?: string; colores: Colores }) {
  if (!texto) return null;
  return <Text style={[styles.error, { color: colores.peligro }]}>{texto}</Text>;
}

function SeccionFoto({
  titulo,
  ayuda,
  foto,
  uri,
  errorAnio,
  colores,
  estiloTarjeta,
  onElegir,
  onQuitar,
  onDeshacer,
  onCambiarAnio,
  onCambiarPie,
}: {
  titulo: string;
  ayuda?: string;
  foto: BorradorFoto;
  uri: string | null;
  errorAnio: ErroresEditor["anioAntes"];
  colores: Colores;
  estiloTarjeta: object;
  onElegir: () => void;
  onQuitar: () => void;
  onDeshacer: () => void;
  onCambiarAnio: (v: string) => void;
  onCambiarPie: (v: string) => void;
}) {
  let pendiente: string | null = null;
  if (foto.nueva) pendiente = "Nueva (sin guardar)";
  else if (foto.eliminar && foto.original) pendiente = "Se eliminará al guardar";

  return (
    <View style={[styles.tarjeta, estiloTarjeta]}>
      <Text style={[styles.tituloSeccion, { color: colores.panelTexto }]}>{titulo}</Text>
      {ayuda && (
        <Text style={[styles.ayuda, { color: colores.panelTextoSecundario, marginBottom: 10 }]}>
          {ayuda}
        </Text>
      )}

      <View style={styles.filaFoto}>
        <TouchableOpacity
          style={[styles.marcoFoto, { borderColor: colores.panelBorde }]}
          onPress={onElegir}
          accessibilityLabel={uri ? `Cambiar ${titulo}` : `Elegir ${titulo}`}
        >
          {uri ? (
            <>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={[styles.pildoraCambiar, { backgroundColor: colores.panelTarjeta }]}>
                <Text style={[styles.textoPildora, { color: colores.panelTexto }]}>Cambiar</Text>
              </View>
            </>
          ) : (
            <View style={styles.vacioFoto}>
              <Ionicons name="image-outline" size={28} color={colores.panelTextoSecundario} />
              <Text style={[styles.ayuda, { color: colores.panelTextoSecundario }]}>
                Elegir foto
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.camposFoto}>
          <Text style={[styles.etiqueta, { color: colores.panelTextoSecundario }]}>
            Año aproximado (opcional)
          </Text>
          <TextInput
            value={foto.anio}
            onChangeText={(v) => onCambiarAnio(v.replace(/\D/g, ""))}
            keyboardType="number-pad"
            maxLength={4}
            editable={!!uri}
            placeholder="Ej.: 1950"
            placeholderTextColor={colores.panelTextoSecundario}
            style={[styles.input, campoEstilo(colores, !!errorAnio), !uri && styles.deshabilitado]}
          />
          <MensajeError texto={errorAnio} colores={colores} />

          <Text style={[styles.etiqueta, { color: colores.panelTextoSecundario }]}>
            Pie de foto (opcional)
          </Text>
          <TextInput
            value={foto.pie}
            onChangeText={onCambiarPie}
            editable={!!uri}
            maxLength={120}
            placeholder="Ej.: Vista desde la plaza"
            placeholderTextColor={colores.panelTextoSecundario}
            style={[styles.input, campoEstilo(colores, false), !uri && styles.deshabilitado]}
          />
        </View>
      </View>

      <View style={styles.filaAcciones}>
        {pendiente ? (
          <Text style={[styles.ayuda, { color: colores.acentoRA }]}>{pendiente}</Text>
        ) : (
          <View />
        )}
        {(foto.nueva || foto.eliminar) && foto.original ? (
          <TouchableOpacity onPress={onDeshacer} hitSlop={8}>
            <Text style={[styles.textoEliminar, { color: colores.panelTexto }]}>Deshacer</Text>
          </TouchableOpacity>
        ) : (
          uri && (
            <TouchableOpacity onPress={onQuitar} hitSlop={8}>
              <Text style={[styles.textoEliminar, { color: colores.peligro }]}>
                {foto.nueva ? "Quitar foto" : "Eliminar foto"}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>
    </View>
  );
}

const E = ESPACIADO_PANEL;

const styles = StyleSheet.create({
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 8 },
  textoError: { fontSize: 16, fontWeight: "700" },
  reintentar: { marginTop: 8, padding: 8 },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: E.margen,
    paddingBottom: 12,
    gap: 8,
  },
  botonVolver: { width: 36, height: 36, justifyContent: "center", marginLeft: -6 },
  titulo: { flex: 1, fontSize: 19, fontWeight: "700" },
  cuerpo: { paddingHorizontal: E.margen, paddingBottom: 24, gap: E.separacion },
  tarjeta: { borderWidth: 1, borderRadius: E.radioTarjeta, padding: 14 },
  tituloSeccion: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  ayuda: { fontSize: 12.5, lineHeight: 17 },
  filaFoto: { flexDirection: "row", gap: 12 },
  marcoFoto: {
    width: "44%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    overflow: "hidden",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  vacioFoto: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  pildoraCambiar: {
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    opacity: 0.92,
  },
  textoPildora: { fontSize: 12.5, fontWeight: "700" },
  camposFoto: { flex: 1 },
  etiqueta: { fontSize: 12, marginBottom: 4, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 8 : 5,
    fontSize: 14,
    marginBottom: 6,
  },
  deshabilitado: { opacity: 0.5 },
  filaAcciones: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  textoEliminar: { fontSize: 13, fontWeight: "600" },
  vistaPrevia: { aspectRatio: 16 / 9, borderRadius: 12 },
  filaConfig: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  textoConfig: { flex: 1, fontSize: 14 },
  inputRadio: { width: 72, textAlign: "center", marginBottom: 0 },
  rango: { fontSize: 12 },
  inputMultilinea: { minHeight: 70, textAlignVertical: "top" },
  contador: { fontSize: 12, alignSelf: "flex-end" },
  error: { fontSize: 12, marginBottom: 6 },
  barraBotones: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: E.margen,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  boton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBoton: { fontSize: 15, fontWeight: "700" },
});
