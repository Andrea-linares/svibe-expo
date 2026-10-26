import { crearHtmlVisor } from "@/components/vista360/html-visor";
import { conAlfa, useTema } from "@/contexts/ThemeContext";
import { campoPanoramica, TipoVista360 } from "@/lib/vista360-reglas";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";

/* ---------------------------------------------------------------------------
 * Visor 360 (Pannellum dentro de un WebView)
 * Las URLs remotas se cargan directo con crossOrigin="anonymous". Las fotos
 * locales (vista previa del admin) se pasan como data URI, y si una remota
 * falla se reintenta una vez descargándolas con expo-file-system.
 * ------------------------------------------------------------------------- */

type Props = {
  tipo: TipoVista360;
  // URLs públicas o URIs locales, en orden
  imagenes: string[];
  // Si se pasa, se muestra el botón X para cerrar
  onCerrar?: () => void;
  style?: StyleProp<ViewStyle>;
};

type Fase = "preparando" | "cargando" | "listo" | "error";

const LIMITE_CARGA_MS = 45000;

const esRemota = (uri: string) => /^https?:\/\//i.test(uri);

function tipoMime(uri: string) {
  const ruta = uri.split("?")[0].toLowerCase();
  if (ruta.endsWith(".png")) return "image/png";
  if (ruta.endsWith(".heic") || ruta.endsWith(".heif")) return "image/heic";
  if (ruta.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

// Lee una imagen (local o remota) y la devuelve como data URI
async function aDataUri(uri: string, indice: number): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  let local = uri;
  if (esRemota(uri)) {
    const destino = `${FileSystem.cacheDirectory}vista360-${Date.now()}-${indice}.img`;
    const descarga = await FileSystem.downloadAsync(uri, destino);
    if (descarga.status !== 200) {
      throw new Error(`No se pudo descargar una foto (código ${descarga.status}).`);
    }
    local = descarga.uri;
  }
  const base64 = await FileSystem.readAsStringAsync(local, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (local !== uri) FileSystem.deleteAsync(local, { idempotent: true }).catch(() => {});
  return `data:${tipoMime(uri)};base64,${base64}`;
}

function medir(uri: string): Promise<{ ancho: number; alto: number }> {
  return new Promise((resolver) => {
    Image.getSize(
      uri,
      (ancho, alto) => resolver({ ancho, alto }),
      () => resolver({ ancho: 0, alto: 0 }),
    );
  });
}

export default function Visor360({ tipo, imagenes, onCerrar, style }: Props) {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const [fase, setFase] = useState<Fase>("preparando");
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  // true = todas las fotos van como data URI (local o tras fallar la remota)
  const [modoDatos, setModoDatos] = useState(false);
  const [intento, setIntento] = useState(0);
  const [interactuo, setInteractuo] = useState(false);

  // Clave estable para no rehacer el HTML si el arreglo es otro con lo mismo
  const claveImagenes = imagenes.join("|");
  const fondo = colores.fondo;

  useEffect(() => {
    let cancelado = false;
    const uris = claveImagenes ? claveImagenes.split("|") : [];

    (async () => {
      try {
        if (uris.length === 0) throw new Error("Esta vista no tiene fotos.");
        const fuentes = await Promise.all(
          uris.map((uri, i) => (!modoDatos && esRemota(uri) ? uri : aDataUri(uri, i))),
        );
        let campo;
        if (tipo === "panoramica") {
          const { ancho, alto } = await medir(uris[0]);
          campo = campoPanoramica(ancho, alto);
        }
        if (cancelado) return;
        setHtml(crearHtmlVisor({ tipo, fuentes, fondo, campo, giroAutomatico: true }));
        setFase("cargando");
      } catch (e) {
        if (cancelado) return;
        setError(e instanceof Error ? e.message : String(e));
        setFase("error");
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [tipo, claveImagenes, modoDatos, intento, fondo]);

  // Si Pannellum no responde en un tiempo razonable, se muestra el error
  useEffect(() => {
    if (fase !== "cargando") return;
    const temporizador = setTimeout(() => {
      setError("La vista 360 tardó demasiado en cargar.");
      setFase("error");
    }, LIMITE_CARGA_MS);
    return () => clearTimeout(temporizador);
  }, [fase, html]);

  // Vuelve al estado de carga antes de rehacer el HTML
  function reiniciar() {
    setFase("preparando");
    setError(null);
    setHtml(null);
  }

  function fallo(mensaje: string) {
    // Primer fallo con fotos remotas: suele ser CORS o red; se reintenta con data URI
    if (!modoDatos && imagenes.some(esRemota)) {
      reiniciar();
      setModoDatos(true);
      return;
    }
    setError(mensaje);
    setFase("error");
  }

  function alMensaje(evento: WebViewMessageEvent) {
    let mensaje: { tipo?: string; mensaje?: string };
    try {
      mensaje = JSON.parse(evento.nativeEvent.data);
    } catch {
      return;
    }
    if (mensaje.tipo === "listo") setFase("listo");
    else if (mensaje.tipo === "interaccion") setInteractuo(true);
    else if (mensaje.tipo === "error") fallo(mensaje.mensaje ?? "No se pudo mostrar la vista.");
  }

  function reintentar() {
    reiniciar();
    setInteractuo(false);
    setIntento((n) => n + 1);
  }

  const fuenteWeb = useMemo(
    () => (html ? { html, baseUrl: "https://localhost/" } : null),
    [html],
  );

  const fondoFlotante = conAlfa(colores.tarjeta, 0.88);

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }, style]}>
      {fuenteWeb && fase !== "error" && (
        <WebView
          key={`${intento}-${modoDatos}`}
          source={fuenteWeb}
          originWhitelist={["*"]}
          onMessage={alMensaje}
          onError={(e) => fallo(e.nativeEvent.description || "No se pudo abrir el visor.")}
          onContentProcessDidTerminate={() => fallo("El visor se cerró inesperadamente.")}
          onRenderProcessGone={() => fallo("El visor se cerró inesperadamente.")}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          style={[styles.web, { backgroundColor: colores.fondo }]}
        />
      )}

      {(fase === "preparando" || fase === "cargando") && (
        <View style={[styles.capa, { backgroundColor: colores.fondo }]} pointerEvents="none">
          <ActivityIndicator size="large" color={colores.acentoRA} />
          <Text style={[styles.textoEstado, { color: colores.textoSecundario }]}>
            Cargando vista 360…
          </Text>
        </View>
      )}

      {fase === "error" && (
        <View style={[styles.capa, { backgroundColor: colores.fondo }]}>
          <Ionicons name="alert-circle-outline" size={40} color={colores.textoSecundario} />
          <Text style={[styles.tituloError, { color: colores.texto }]}>
            No se pudo mostrar la vista 360
          </Text>
          {error && (
            <Text style={[styles.textoEstado, { color: colores.textoSecundario }]}>{error}</Text>
          )}
          <TouchableOpacity
            style={[styles.botonReintentar, { backgroundColor: colores.acentoRA }]}
            onPress={reintentar}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={18} color={colores.tarjeta} />
            <Text style={[styles.textoReintentar, { color: colores.tarjeta }]}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {fase === "listo" && !interactuo && (
        <View
          style={[styles.ayuda, { bottom: insets.bottom + 32, backgroundColor: fondoFlotante }]}
          pointerEvents="none"
        >
          <Ionicons name="hand-left-outline" size={18} color={colores.texto} />
          <Text style={[styles.textoAyuda, { color: colores.texto }]}>Arrastra para explorar</Text>
        </View>
      )}

      {onCerrar && (
        <TouchableOpacity
          style={[styles.cerrar, { top: insets.top + 12, backgroundColor: fondoFlotante }]}
          onPress={onCerrar}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cerrar vista 360"
        >
          <Ionicons name="close" size={24} color={colores.texto} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, overflow: "hidden" },
  web: { flex: 1 },
  capa: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 10,
  },
  textoEstado: { fontSize: 14, textAlign: "center" },
  tituloError: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  botonReintentar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
  },
  textoReintentar: { fontSize: 15, fontWeight: "700" },
  ayuda: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  textoAyuda: { fontSize: 14, fontWeight: "600" },
  cerrar: {
    position: "absolute",
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
});
