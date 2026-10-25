import { conAlfa, useTema } from "@/contexts/ThemeContext";
import { LugarAR, useArPlaces, useHitosRA } from "@/hooks/use-ar-places";
import { useHeading } from "@/hooks/use-heading";
import { useUserLocation } from "@/hooks/use-user-location";
import { avisar } from "@/lib/confirmar";
import { desplazarCoordenada, diferenciaAngular, formatearDistancia, normalizarAngulo } from "@/lib/geo";
import { Ionicons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { useAnimatedReaction } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { scheduleOnRN } from "react-native-worklets";
import ArPlaceCard from "./ArPlaceCard";
import ArPlaceLabel from "./ArPlaceLabel";
import ComparadorModal from "./ComparadorModal";
import {
  DISTANCIA_PRUEBA_M,
  ESPERA_AUTO_TARJETA_MS,
  FOV_HORIZONTAL,
  MAX_ETIQUETAS,
  PULSACION_MODO_PRUEBA_MS,
  UMBRAL_CENTRADO,
} from "./constantes";
import FlechaRumbo from "./FlechaRumbo";
import ListaCercanos from "./ListaCercanos";
import PanelPrueba from "./PanelPrueba";
import PanelRA from "./PanelRA";
import ScanOverlay from "./ScanOverlay";
import SinLugares from "./SinLugares";

// Separación vertical entre filas de etiquetas
const ALTO_FILA_ETIQUETA = 64;
const FILAS_ETIQUETAS = 3;
// Grados por punto al arrastrar en el modo prueba
const GRADOS_POR_PUNTO = 0.15;

// Cámara RA a pantalla completa: etiquetas, tarjeta, comparador, lista de
// cercanos, captura y modo prueba. "activo" = pestaña enfocada y app en primer plano.
export default function ArCamera({ activo }: { activo: boolean }) {
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const camaraRef = useRef<CameraView>(null);
  const capturaRef = useRef<ComponentRef<typeof View>>(null);

  // ---- Modo prueba ----
  const [modoPrueba, setModoPrueba] = useState(false);
  const [hitoPruebaId, setHitoPruebaId] = useState<string | null>(null);

  // ---- Datos, ubicación y brújula ----
  const datos = useHitosRA();
  const hitoPrueba = modoPrueba ? datos.hitos.find((h) => h.id === hitoPruebaId) : undefined;
  const latPrueba = hitoPrueba?.lat;
  const lngPrueba = hitoPrueba?.lng;
  const simulada = useMemo(
    () =>
      latPrueba !== undefined && lngPrueba !== undefined
        ? desplazarCoordenada({ lat: latPrueba, lng: lngPrueba }, DISTANCIA_PRUEBA_M, 180)
        : null,
    [latPrueba, lngPrueba],
  );
  const { ubicacion, gpsDebil } = useUserLocation(activo, simulada);
  const brujula = useHeading(activo);
  const { heading } = brujula;
  const { lugares, candidatos, masCercanoFuera } = useArPlaces(datos.hitos, ubicacion);

  // ---- Etiquetas y lugar más centrado ----
  const visibles = useMemo(() => candidatos.slice(0, MAX_ETIQUETAS), [candidatos]);
  const rumbos = useMemo(() => visibles.map((l) => ({ id: l.id, rumbo: l.rumbo })), [visibles]);
  const [centro, setCentro] = useState<{ id: string | null; bien: boolean }>({
    id: null,
    bien: false,
  });

  // Corre en el hilo de UI con cada lectura; solo avisa a React si cambia
  useAnimatedReaction(
    () => {
      let mejor: string | null = null;
      let minimo = 999;
      for (const r of rumbos) {
        const d = Math.abs(diferenciaAngular(heading.value, r.rumbo));
        if (d < minimo) {
          minimo = d;
          mejor = r.id;
        }
      }
      if (minimo > FOV_HORIZONTAL / 2) return "";
      return `${mejor}|${minimo <= UMBRAL_CENTRADO ? 1 : 0}`;
    },
    (clave, anterior) => {
      if (clave !== anterior) {
        scheduleOnRN(setCentroDesdeClave, clave);
      }
    },
    [rumbos],
  );

  function setCentroDesdeClave(clave: string) {
    const [id, bien] = clave.split("|");
    setCentro({ id: id || null, bien: bien === "1" });
  }

  // ---- Tarjeta, comparador, lista y guía ----
  const [tarjetaId, setTarjetaId] = useState<string | null>(null);
  const [comparadorId, setComparadorId] = useState<string | null>(null);
  const [listaVisible, setListaVisible] = useState(false);
  const [objetivoId, setObjetivoId] = useState<string | null>(null);
  const ultimaCerrada = useRef<string | null>(null);

  const buscar = useCallback((id: string | null) => lugares.find((l) => l.id === id) ?? null, [lugares]);
  const tarjeta = buscar(tarjetaId);
  const comparador = buscar(comparadorId);
  const objetivo = buscar(objetivoId);

  // Si una etiqueta queda bien centrada un momento, se abre su tarjeta sola
  // (salvo la que el usuario acaba de cerrar, hasta que salga del centro)
  useEffect(() => {
    if (ultimaCerrada.current && centro.id !== ultimaCerrada.current) {
      ultimaCerrada.current = null;
    }
    if (!centro.bien || !centro.id || tarjetaId || comparadorId || listaVisible) return;
    if (centro.id === ultimaCerrada.current) return;
    const id = centro.id;
    const temporizador = setTimeout(() => setTarjetaId(id), ESPERA_AUTO_TARJETA_MS);
    return () => clearTimeout(temporizador);
  }, [centro, tarjetaId, comparadorId, listaVisible]);

  function cerrarTarjeta() {
    ultimaCerrada.current = tarjetaId;
    setTarjetaId(null);
  }

  function elegirDeLista(lugar: LugarAR) {
    setListaVisible(false);
    if (lugar.enRango) {
      setObjetivoId(null);
      setTarjetaId(lugar.id);
    } else {
      setObjetivoId(lugar.id);
    }
  }

  // ---- Captura ----
  const [capturando, setCapturando] = useState(false);
  const [fotoCongelada, setFotoCongelada] = useState<string | null>(null);
  const fotoCargada = useRef<(() => void) | null>(null);

  async function capturar() {
    if (capturando) return;
    setCapturando(true);
    try {
      // La vista de cámara en vivo sale negra en una captura de pantalla:
      // se toma una foto, se pone debajo de las etiquetas y se captura eso.
      try {
        const foto = await camaraRef.current?.takePictureAsync({ quality: 0.8, shutterSound: false });
        if (foto?.uri) {
          await new Promise<void>((resolve) => {
            fotoCargada.current = resolve;
            setFotoCongelada(foto.uri);
            setTimeout(resolve, 1500);
          });
        }
      } catch (e) {
        console.warn("No se pudo tomar la foto; se captura solo la vista:", e);
      }

      const uri = await captureRef(capturaRef, { format: "jpg", quality: 0.9 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/jpeg",
          UTI: "public.jpeg",
          dialogTitle: "Compartir captura",
        });
      } else {
        avisar("Captura lista", "Este dispositivo no permite compartir la imagen.");
      }
    } catch (e) {
      avisar("No se pudo capturar", e instanceof Error ? e.message : String(e));
    } finally {
      fotoCargada.current = null;
      setFotoCongelada(null);
      setCapturando(false);
    }
  }

  // ---- Modo prueba ----
  function alternarModoPrueba() {
    if (modoPrueba) {
      setModoPrueba(false);
      setHitoPruebaId(null);
      brujula.setManual(null);
    } else {
      setModoPrueba(true);
    }
  }

  function elegirHitoPrueba(id: string | null) {
    setHitoPruebaId(id);
    // Simulación al sur del hito: mirando al norte queda de frente
    if (id && brujula.manual) brujula.setManual(0);
  }

  // Arrastrar de lado a lado gira el rumbo (solo con rumbo manual)
  const arrastreRumbo = usePanGesture({
    enabled: modoPrueba && brujula.manual,
    activeOffsetX: [-10, 10],
    onUpdate: (e) => {
      "worklet";
      heading.value = normalizarAngulo(heading.value - e.changeX * GRADOS_POR_PUNTO);
    },
  });

  // ---- Diseño ----
  const topBarra = insets.top + 8;
  const topEtiquetas = height * 0.24;
  const buscando = datos.cargando || !ubicacion || candidatos.length === 0;
  const mostrarSinLugares = !datos.cargando && !!ubicacion && candidatos.length === 0 && !tarjeta;

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <GestureDetector gesture={arrastreRumbo}>
        {/* Todo lo que está aquí dentro sale en la captura */}
        <View ref={capturaRef} collapsable={false} style={StyleSheet.absoluteFill}>
          <CameraView ref={camaraRef} style={StyleSheet.absoluteFill} facing="back" active={activo} />
          {fotoCongelada && (
            <Image
              source={{ uri: fotoCongelada }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onLoad={() => fotoCargada.current?.()}
            />
          )}
          {visibles.map((lugar, i) => (
            <ArPlaceLabel
              key={lugar.id}
              lugar={lugar}
              heading={heading}
              anchoPantalla={width}
              top={topEtiquetas + (i % FILAS_ETIQUETAS) * ALTO_FILA_ETIQUETA}
              compacta={visibles.length > 1}
              destacada={visibles.length > 1 && centro.id === lugar.id}
              onPress={() => setTarjetaId(lugar.id)}
            />
          ))}
        </View>
      </GestureDetector>

      {buscando && <ScanOverlay top={topBarra + 52} />}
      {mostrarSinLugares && <SinLugares masCercano={masCercanoFuera} heading={heading} />}

      {/* Barra superior: brújula, avisos y recargar */}
      <View style={[styles.barraSuperior, { top: topBarra }]} pointerEvents="box-none">
        <Pressable
          onLongPress={alternarModoPrueba}
          delayLongPress={PULSACION_MODO_PRUEBA_MS}
          accessibilityLabel={`Brújula: ${brujula.texto}`}
        >
          <PanelRA style={styles.chip}>
            <Ionicons name="navigate" size={15} color={colores.acentoRA} />
            <Text style={[styles.textoChip, { color: colores.texto }]}>{brujula.texto}</Text>
          </PanelRA>
        </Pressable>

        <View style={styles.avisos} pointerEvents="box-none">
          {gpsDebil && !simulada && <Aviso icono="cellular-outline" texto="Señal GPS débil" />}
          {brujula.calibrar && (
            <Aviso icono="sync-outline" texto="Mueve el teléfono en forma de 8 para calibrar" />
          )}
          {datos.error && (
            <Pressable onPress={datos.refrescar}>
              <Aviso icono="cloud-offline-outline" texto="No se cargaron los lugares. Toca para reintentar" />
            </Pressable>
          )}
        </View>

        <View style={styles.accionesSuperiores}>
          {__DEV__ && (
            <TouchableOpacity onPress={alternarModoPrueba} accessibilityLabel="Modo prueba">
              <PanelRA style={styles.botonRedondo}>
                <Ionicons
                  name="flask-outline"
                  size={18}
                  color={modoPrueba ? colores.acentoRA : colores.texto}
                />
              </PanelRA>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={datos.refrescar}
            disabled={datos.cargando}
            accessibilityLabel="Actualizar lugares"
          >
            <PanelRA style={styles.botonRedondo}>
              {datos.cargando ? (
                <ActivityIndicator size="small" color={colores.acentoRA} />
              ) : (
                <Ionicons name="refresh" size={18} color={colores.texto} />
              )}
            </PanelRA>
          </TouchableOpacity>
        </View>
      </View>

      {/* Panel inferior: modo prueba y guía hacia un lugar */}
      <View style={[styles.zonaInferior, { bottom: 112 }]} pointerEvents="box-none">
        {objetivo && (
          <PanelRA style={styles.guia}>
            <FlechaRumbo heading={heading} rumbo={objetivo.rumbo} color={colores.acentoRA} tamano={30} />
            <Text style={[styles.textoGuia, { color: colores.texto }]} numberOfLines={2}>
              {objetivo.nombre} · {formatearDistancia(objetivo.distancia)}
            </Text>
            <TouchableOpacity onPress={() => setObjetivoId(null)} hitSlop={10} accessibilityLabel="Quitar guía">
              <Ionicons name="close" size={20} color={colores.textoSecundario} />
            </TouchableOpacity>
          </PanelRA>
        )}
        {modoPrueba && (
          <PanelPrueba
            hitos={datos.hitos}
            hitoId={hitoPruebaId}
            onElegirHito={elegirHitoPrueba}
            rumboManual={brujula.manual}
            onRumboManual={(manual) => brujula.setManual(manual ? 0 : null)}
            onGirar={brujula.girar}
            onCerrar={alternarModoPrueba}
          />
        )}
      </View>

      {/* Barra inferior: captura (centro) y lugares cercanos (derecha) */}
      <View style={styles.barraInferior} pointerEvents="box-none">
        <View style={styles.espacioLateral} />
        <TouchableOpacity
          onPress={capturar}
          disabled={capturando}
          accessibilityLabel="Capturar y compartir"
          style={[styles.disparador, { borderColor: colores.tarjeta }]}
        >
          <View style={[styles.disparadorInterior, { backgroundColor: conAlfa(colores.tarjeta, 0.9) }]}>
            {capturando && <ActivityIndicator color={colores.acentoRA} />}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setListaVisible(true)}
          accessibilityLabel="Lugares cercanos"
          style={styles.espacioLateral}
        >
          <PanelRA style={styles.botonLista}>
            <Ionicons name="location" size={22} color={colores.acentoRA} />
          </PanelRA>
        </TouchableOpacity>
      </View>

      {tarjeta && (
        <ArPlaceCard
          lugar={tarjeta}
          onCerrar={cerrarTarjeta}
          onVerAntesDespues={() => setComparadorId(tarjeta.id)}
          onVerDetalle={() => {
            cerrarTarjeta();
            router.push(`/hito/${tarjeta.id}`);
          }}
        />
      )}

      <ListaCercanos
        visible={listaVisible}
        lugares={lugares}
        onElegir={elegirDeLista}
        onCerrar={() => setListaVisible(false)}
      />
      <ComparadorModal lugar={comparador} onCerrar={() => setComparadorId(null)} />
    </View>
  );
}

function Aviso({ icono, texto }: { icono: keyof typeof Ionicons.glyphMap; texto: string }) {
  const { colores } = useTema();
  return (
    <PanelRA style={styles.aviso}>
      <Ionicons name={icono} size={14} color={colores.peligro} />
      <Text style={[styles.textoAviso, { color: colores.texto }]} numberOfLines={2}>
        {texto}
      </Text>
    </PanelRA>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, overflow: "hidden" },
  barraSuperior: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textoChip: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  avisos: { flex: 1, alignItems: "center", gap: 6 },
  aviso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 220,
  },
  textoAviso: { fontSize: 12, flexShrink: 1 },
  accionesSuperiores: { flexDirection: "row", gap: 8 },
  botonRedondo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  zonaInferior: { position: "absolute", left: 12, right: 12, gap: 8 },
  guia: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  textoGuia: { flex: 1, fontSize: 14, fontWeight: "600" },
  barraInferior: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  espacioLateral: { width: 52, alignItems: "center" },
  disparador: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  disparadorInterior: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  botonLista: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
});
