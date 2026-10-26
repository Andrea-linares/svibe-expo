import SoloAdmin from "@/components/admin/SoloAdmin";
import Visor360 from "@/components/vista360/Visor360";
import { ESPACIADO_PANEL, useTema } from "@/contexts/ThemeContext";
import { useMargenSuperior } from "@/hooks/use-margen-superior";
import { uriFoto, useVista360Admin } from "@/hooks/use-vista360-admin";
import { avisar, confirmar } from "@/lib/confirmar";
import {
  esUnaSolaFoto,
  MAX_FOTOS_COLLAGE,
  MIN_FOTOS_COLLAGE,
  TIPOS_VISTA_360,
  TipoVista360,
} from "@/lib/vista360-reglas";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams, useNavigation, usePreventRemove } from "expo-router";
import type { NavigationAction } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Colores = ReturnType<typeof useTema>["colores"];

const INFO_TIPOS: Record<TipoVista360, { titulo: string; ayuda: string; icono: string }> = {
  esfera: {
    titulo: "Esfera 360",
    ayuda: "1 foto equirectangular (2:1), por ejemplo de la app 360 Photo Cam.",
    icono: "globe-outline",
  },
  panoramica: {
    titulo: "Panorámica",
    ayuda: "1 foto ancha del modo Panorama del celular (no cubre arriba ni abajo).",
    icono: "resize-outline",
  },
  collage: {
    titulo: "Collage",
    ayuda: `De ${MIN_FOTOS_COLLAGE} a ${MAX_FOTOS_COLLAGE} fotos normales en anillo, en el orden en que giras.`,
    icono: "apps-outline",
  },
};

export default function EditorVista360Screen() {
  return (
    <SoloAdmin>
      <EditorVista360 />
    </SoloAdmin>
  );
}

function EditorVista360() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colores } = useTema();
  const margenSuperior = useMargenSuperior(50);
  const insets = useSafeAreaInsets();
  const editor = useVista360Admin(id);
  const { datos, borrador, errorFotos, avisoProporcion, hayCambios, guardando } = editor;
  const navigation = useNavigation();
  const [vistaPrevia, setVistaPrevia] = useState(false);
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
    avisar("Guardado", resultado.aviso ?? "La vista 360 se guardó correctamente.");
  }

  function pedirEliminar() {
    confirmar({
      titulo: "Eliminar vista 360",
      mensaje: "Se borrará la vista 360 de este hito y todas sus fotos. ¿Continuar?",
      onConfirmar: async () => {
        const resultado = await editor.eliminar();
        if (!resultado.ok) {
          avisar("No se pudo eliminar", resultado.error);
          return;
        }
        avisar("Eliminada", resultado.aviso ?? "La vista 360 se eliminó.");
      },
    });
  }

  async function elegir() {
    const resultado = await editor.elegirFotos();
    if (resultado === "sin-permiso") {
      avisar("Permiso necesario", "Necesitamos acceso a tu galería para elegir las fotos.");
    } else if (resultado === "lleno") {
      avisar("Límite alcanzado", `El collage admite como máximo ${MAX_FOTOS_COLLAGE} fotos.`);
    } else if (resultado === "proporcion") {
      avisar(
        "Revisa la foto",
        "La foto no tiene proporción 2:1. Una esfera 360 debe ser equirectangular; puedes guardarla igual, pero se verá deformada.",
      );
    }
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

  const unaSola = esUnaSolaFoto(borrador.tipo);
  const puedeGuardar = hayCambios && !guardando && !errorFotos;
  const estiloTarjeta = {
    backgroundColor: colores.panelTarjeta,
    borderColor: colores.panelBorde,
  };

  let textoElegir = "Agregar fotos";
  if (unaSola) textoElegir = borrador.fotos.length > 0 ? "Cambiar foto" : "Elegir foto";

  return (
    <View style={{ flex: 1, backgroundColor: colores.panelFondo }}>
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
          Vista 360 – {datos.nombre}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.cuerpo} pointerEvents={guardando ? "none" : "auto"}>
        {/* Configuración */}
        <View style={[styles.tarjeta, estiloTarjeta]}>
          <View style={styles.filaConfig}>
            <Ionicons name="sync-outline" size={20} color={colores.panelTextoSecundario} />
            <Text style={[styles.textoConfig, { color: colores.panelTexto }]}>
              Activar vista 360
            </Text>
            <Switch
              value={borrador.activa}
              onValueChange={(v) => editor.cambiar({ activa: v })}
              trackColor={{ true: colores.acentoRA, false: colores.panelIconoNeutro }}
              accessibilityLabel="Activar vista 360"
            />
          </View>

          <Text style={[styles.etiqueta, { color: colores.panelTextoSecundario }]}>Tipo</Text>
          {TIPOS_VISTA_360.map((tipo) => {
            const info = INFO_TIPOS[tipo];
            const elegido = borrador.tipo === tipo;
            return (
              <TouchableOpacity
                key={tipo}
                style={[
                  styles.opcionTipo,
                  { borderColor: elegido ? colores.acentoRA : colores.panelBorde },
                ]}
                onPress={() => editor.cambiar({ tipo })}
                accessibilityRole="radio"
                accessibilityState={{ selected: elegido }}
              >
                <Ionicons
                  name={info.icono as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={elegido ? colores.acentoRA : colores.panelTextoSecundario}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tituloTipo, { color: colores.panelTexto }]}>
                    {info.titulo}
                  </Text>
                  <Text style={[styles.ayuda, { color: colores.panelTextoSecundario }]}>
                    {info.ayuda}
                  </Text>
                </View>
                <Ionicons
                  name={elegido ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={elegido ? colores.acentoRA : colores.panelTextoSecundario}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Fotos */}
        <View style={[styles.tarjeta, estiloTarjeta]}>
          <Text style={[styles.tituloSeccion, { color: colores.panelTexto }]}>
            {unaSola
              ? "Foto"
              : `Fotos (${borrador.fotos.length}/${MAX_FOTOS_COLLAGE})`}
          </Text>
          {!unaSola && borrador.fotos.length > 0 && (
            <Text style={[styles.ayuda, { color: colores.panelTextoSecundario, marginBottom: 10 }]}>
              Ordénalas como si giraras sobre ti mismo, de izquierda a derecha.
            </Text>
          )}

          {borrador.fotos.length > 0 && (
            <View style={styles.rejilla}>
              {borrador.fotos.map((foto, i) => (
                <MiniaturaFoto
                  key={foto.clave}
                  uri={uriFoto(foto)}
                  numero={unaSola ? null : i + 1}
                  ancha={unaSola}
                  nueva={!!foto.nueva}
                  colores={colores}
                  onQuitar={() => editor.quitarFoto(i)}
                  onIzquierda={i > 0 && !unaSola ? () => editor.moverFoto(i, -1) : undefined}
                  onDerecha={
                    i < borrador.fotos.length - 1 && !unaSola
                      ? () => editor.moverFoto(i, 1)
                      : undefined
                  }
                />
              ))}
            </View>
          )}

          {errorFotos && (
            <Text style={[styles.error, { color: colores.peligro }]}>{errorFotos}</Text>
          )}
          {avisoProporcion && (
            <Text style={[styles.error, { color: colores.panelDorado }]}>{avisoProporcion}</Text>
          )}

          <TouchableOpacity
            style={[styles.botonContorno, { borderColor: colores.acentoRA }]}
            onPress={elegir}
          >
            <Ionicons name="images-outline" size={18} color={colores.acentoRA} />
            <Text style={[styles.textoContorno, { color: colores.acentoRA }]}>{textoElegir}</Text>
          </TouchableOpacity>
        </View>

        {/* Vista previa */}
        <View style={[styles.tarjeta, estiloTarjeta]}>
          <Text style={[styles.tituloSeccion, { color: colores.panelTexto }]}>Vista previa</Text>
          <Text style={[styles.ayuda, { color: colores.panelTextoSecundario, marginBottom: 10 }]}>
            {errorFotos
              ? "Completa las fotos para ver la vista previa."
              : "Revisa cómo la verán los usuarios antes de guardar."}
          </Text>
          <TouchableOpacity
            style={[
              styles.botonContorno,
              { borderColor: colores.acentoRA, opacity: errorFotos ? 0.5 : 1 },
            ]}
            onPress={() => setVistaPrevia(true)}
            disabled={!!errorFotos}
          >
            <Ionicons name="eye-outline" size={18} color={colores.acentoRA} />
            <Text style={[styles.textoContorno, { color: colores.acentoRA }]}>
              Ver vista previa
            </Text>
          </TouchableOpacity>
        </View>

        {datos.vista && (
          <TouchableOpacity
            style={[styles.tarjeta, styles.filaEliminar, estiloTarjeta]}
            onPress={pedirEliminar}
          >
            <Ionicons name="trash-outline" size={18} color={colores.peligro} />
            <Text style={[styles.textoContorno, { color: colores.peligro }]}>
              Eliminar vista 360
            </Text>
          </TouchableOpacity>
        )}
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
            <ActivityIndicator color={colores.panelTarjeta} />
          ) : (
            <Text style={[styles.textoBoton, { color: colores.panelTarjeta }]}>Guardar</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={vistaPrevia}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setVistaPrevia(false)}
      >
        {vistaPrevia && (
          <Visor360
            tipo={borrador.tipo}
            imagenes={borrador.fotos.map(uriFoto)}
            onCerrar={() => setVistaPrevia(false)}
          />
        )}
      </Modal>
    </View>
  );
}

function MiniaturaFoto({
  uri,
  numero,
  ancha,
  nueva,
  colores,
  onQuitar,
  onIzquierda,
  onDerecha,
}: {
  uri: string;
  numero: number | null;
  ancha: boolean;
  nueva: boolean;
  colores: Colores;
  onQuitar: () => void;
  onIzquierda?: () => void;
  onDerecha?: () => void;
}) {
  const fondoBoton = { backgroundColor: colores.panelTarjeta };
  return (
    <View
      style={[
        ancha ? styles.miniaturaAncha : styles.miniatura,
        { borderColor: colores.panelBorde },
      ]}
    >
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />

      {numero !== null && (
        <View style={[styles.numero, fondoBoton]}>
          <Text style={[styles.textoNumero, { color: colores.panelTexto }]}>{numero}</Text>
        </View>
      )}
      {nueva && (
        <View style={[styles.etiquetaNueva, { backgroundColor: colores.acentoRA }]}>
          <Text style={[styles.textoNumero, { color: colores.panelTarjeta }]}>Nueva</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.botonQuitar, fondoBoton]}
        onPress={onQuitar}
        hitSlop={6}
        accessibilityLabel={numero ? `Quitar foto ${numero}` : "Quitar foto"}
      >
        <Ionicons name="close" size={14} color={colores.peligro} />
      </TouchableOpacity>

      {(onIzquierda || onDerecha) && (
        <View style={styles.filaMover}>
          <BotonMover icono="chevron-back" onPress={onIzquierda} colores={colores} />
          <BotonMover icono="chevron-forward" onPress={onDerecha} colores={colores} />
        </View>
      )}
    </View>
  );
}

function BotonMover({
  icono,
  onPress,
  colores,
}: {
  icono: "chevron-back" | "chevron-forward";
  onPress?: () => void;
  colores: Colores;
}) {
  return (
    <TouchableOpacity
      style={[styles.botonMover, { backgroundColor: colores.panelTarjeta, opacity: onPress ? 1 : 0 }]}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={4}
      accessibilityLabel={icono === "chevron-back" ? "Mover antes" : "Mover después"}
    >
      <Ionicons name={icono} size={14} color={colores.panelTexto} />
    </TouchableOpacity>
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
  etiqueta: { fontSize: 12, marginBottom: 6, marginTop: 4 },
  filaConfig: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  textoConfig: { flex: 1, fontSize: 14 },
  opcionTipo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  tituloTipo: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  rejilla: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  miniatura: {
    width: "31.5%",
    aspectRatio: 3 / 4,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  miniaturaAncha: {
    width: "100%",
    aspectRatio: 2,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  numero: {
    position: "absolute",
    top: 6,
    left: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  etiquetaNueva: {
    position: "absolute",
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  textoNumero: { fontSize: 11, fontWeight: "700" },
  botonQuitar: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  filaMover: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    gap: 4,
  },
  botonMover: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  error: { fontSize: 12.5, marginBottom: 8 },
  botonContorno: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 11,
  },
  textoContorno: { fontSize: 14, fontWeight: "700" },
  filaEliminar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
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
