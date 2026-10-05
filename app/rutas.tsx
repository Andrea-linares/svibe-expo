import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

/* ---------------------------------------------------------------------------
 * HU-003 · Rutas sugeridas
 *
 * Tres tipos de ruta, todas en esta pantalla:
 *  1. "Cerca de mí" / "Desde este hito": se calcula al momento (dinámica).
 *  2. Rutas fijas: viven en Supabase (tabla rutas con usuario_id NULL).
 *  3. "Guardar ruta": copia la ruta que estás viendo a tus rutas guardadas
 *     (tablas rutas + ruta_items), y sale en el perfil.
 * ------------------------------------------------------------------------- */

// Ajustes fáciles de cambiar
const ACENTO = "#5B9BD5";
const MAX_PARADAS = 4; // paradas de la ruta dinámica
const RADIO_KM = 25; // distancia máxima de cada salto en la ruta dinámica
const VELOCIDAD_KMH = 35; // velocidad promedio estimada en carretera
const FACTOR_CALLES = 1.3; // la distancia por calle es ~30% mayor que en línea recta
const VISITA_MIN = 30; // minutos estimados de visita en cada hito
const DINAMICA = "dinamica"; // id del chip de la ruta dinámica
const TIPO_ITEM_HITO = "hito"; // valor de ruta_items.tipo_item para un hito

type Coord = { lat: number; lng: number };

type Hito = Coord & {
  id: string;
  nombre: string;
  categoriaId: number | null;
  categoriaNombre: string;
  imagenUrl: string | null;
};

type Parada = Hito & { tramoKm: number | null; tramoMin: number | null };

type Resultado = {
  paradas: Parada[];
  usuario: Coord | null;
  conectarUsuario: boolean; // true si la ruta parte de la ubicación del usuario
};

type RutaFija = { id: string; nombre: string; hitoIds: string[] };

type Datos = {
  todos: Hito[];
  preferencias: number[];
  usuario: Coord | null;
  usuarioId: string | null;
  fijas: RutaFija[];
  propias: string[]; // nombres de las rutas que el usuario ya guardó
};

type NombreIcono = keyof typeof Ionicons.glyphMap;

/* ----------------------------- Cálculos ---------------------------------- */

function distanciaKm(a: Coord, b: Coord) {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Vecino más cercano con límite de distancia por salto
function armarCadena(origen: Coord, candidatos: Hito[], cuantos: number) {
  const restantes = [...candidatos];
  const cadena: Hito[] = [];
  let actual = origen;

  while (cadena.length < cuantos && restantes.length > 0) {
    let mejor = 0;
    let mejorDist = Infinity;
    restantes.forEach((h, i) => {
      const d = distanciaKm(actual, h);
      if (d < mejorDist) {
        mejorDist = d;
        mejor = i;
      }
    });
    if (mejorDist > RADIO_KM) break;
    const elegido = restantes.splice(mejor, 1)[0];
    cadena.push(elegido);
    actual = elegido;
  }
  return cadena;
}

// Calcula distancia y tiempo desde el punto anterior a cada parada
function calcularTramos(inicio: Coord | null, hitos: Hito[]): Parada[] {
  let previo = inicio;
  return hitos.map((h) => {
    let tramoKm: number | null = null;
    let tramoMin: number | null = null;
    if (previo) {
      tramoKm = distanciaKm(previo, h) * FACTOR_CALLES;
      tramoMin = Math.round((tramoKm / VELOCIDAD_KMH) * 60);
    }
    previo = h;
    return { ...h, tramoKm, tramoMin };
  });
}

function formatearTiempo(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// Ruta dinámica: parte del hito seleccionado o de la ubicación del usuario
function armarRutaDinamica(d: Datos, hitoId?: string): Resultado | null {
  const esPreferido = (h: Hito) =>
    h.categoriaId != null && d.preferencias.includes(h.categoriaId);
  const hitoOrigen = hitoId ? d.todos.find((h) => h.id === hitoId) : undefined;

  if (hitoOrigen) {
    const otros = d.todos.filter((h) => h.id !== hitoOrigen.id);
    let cadena = armarCadena(hitoOrigen, otros.filter(esPreferido), MAX_PARADAS - 1);
    if (cadena.length < 1) cadena = armarCadena(hitoOrigen, otros, MAX_PARADAS - 1);
    if (cadena.length < 1) return null;
    return {
      paradas: calcularTramos(null, [hitoOrigen, ...cadena]),
      usuario: d.usuario,
      conectarUsuario: false,
    };
  }

  if (!d.usuario) return null;
  let cadena = armarCadena(d.usuario, d.todos.filter(esPreferido), MAX_PARADAS);
  if (cadena.length < 2) cadena = armarCadena(d.usuario, d.todos, MAX_PARADAS);
  if (cadena.length < 2) return null;
  return {
    paradas: calcularTramos(d.usuario, cadena),
    usuario: d.usuario,
    conectarUsuario: true,
  };
}

// Ruta fija: las paradas vienen ya ordenadas desde Supabase
function armarRutaFija(d: Datos, ruta: RutaFija): Resultado | null {
  const hitos = ruta.hitoIds
    .map((id) => d.todos.find((h) => h.id === id))
    .filter((h): h is Hito => h !== undefined);
  if (hitos.length < 2) return null;
  return {
    paradas: calcularTramos(null, hitos),
    usuario: d.usuario,
    conectarUsuario: false,
  };
}

/* ------------------------- Estilo por categoría -------------------------- */

function estiloCategoria(nombre: string): { color: string; icono: NombreIcono } {
  const n = nombre.toLowerCase();
  if (n.includes("arqueol")) return { color: "#8D5A2B", icono: "triangle-outline" };
  if (n.includes("hist")) return { color: "#7E57C2", icono: "library-outline" };
  if (n.includes("natur")) return { color: "#2E9E5B", icono: "leaf-outline" };
  if (n.includes("cultur")) return { color: "#D9587A", icono: "color-palette-outline" };
  if (n.includes("religi")) return { color: "#B8860B", icono: "business-outline" };
  return { color: ACENTO, icono: "location-outline" };
}

function iconoRuta(nombre: string): NombreIcono {
  const n = nombre.toLowerCase();
  if (n.includes("flor")) return "flower-outline";
  if (n.includes("arqueol")) return "triangle-outline";
  if (n.includes("hist")) return "library-outline";
  return "map-outline";
}

/* ------------------------------ Pantalla --------------------------------- */

export default function RutasScreen() {
  // ---- Todos los hooks van aquí arriba, antes de cualquier return ----
  const { colores } = useTema();
  const insets = useSafeAreaInsets();
  const { hitoId } = useLocalSearchParams<{ hitoId?: string }>();

  const [datos, setDatos] = useState<Datos | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [intento, setIntento] = useState(0); // para reintentar
  const [seleccion, setSeleccion] = useState<string>(DINAMICA);
  const [guardando, setGuardando] = useState(false);

  // Carga de datos (una sola vez, o al reintentar)
  useEffect(() => {
    let activo = true;

    async function cargar() {
      setErrorCarga(false);
      setDatos(null);
      try {
        // 1) Hitos + categorías + primera imagen
        const [{ data: hitosData, error: errHitos }, { data: catData }] =
          await Promise.all([
            supabase
              .from("hitos")
              .select("id, nombre, lat, lng, categoria_id, hito_imagenes(url, orden)"),
            supabase.from("categorias").select("id, nombre"),
          ]);
        if (errHitos) throw errHitos;

        const nombreCategoria = new Map<number, string>(
          (catData ?? []).map((c: any) => [c.id, c.nombre]),
        );

        const todos: Hito[] = (hitosData ?? [])
          .filter((h: any) => h.lat != null && h.lng != null)
          .map((h: any) => {
            const imgs = [...(h.hito_imagenes ?? [])].sort(
              (a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0),
            );
            return {
              id: h.id,
              nombre: h.nombre,
              lat: h.lat,
              lng: h.lng,
              categoriaId: h.categoria_id,
              categoriaNombre: nombreCategoria.get(h.categoria_id) ?? "Hito",
              imagenUrl: imgs.length > 0 ? imgs[0].url : null,
            };
          });

        // 2) Usuario y sus preferencias (solo si inició sesión)
        let usuarioId: string | null = null;
        let preferencias: number[] = [];
        let propias: string[] = [];
        const { data: sesion } = await supabase.auth.getUser();
        if (sesion?.user) {
          usuarioId = sesion.user.id;
          const { data: prefs } = await supabase
            .from("usuario_categorias")
            .select("categoria_id")
            .eq("usuario_id", usuarioId);
          preferencias = (prefs ?? []).map((p: any) => p.categoria_id);

          // Rutas que este usuario ya guardó (para marcar el corazón)
          const { data: propiasData } = await supabase
            .from("rutas")
            .select("nombre")
            .eq("usuario_id", usuarioId);
          propias = (propiasData ?? []).map((r: any) => r.nombre);
        }

        // 3) Rutas fijas (usuario_id vacío) y sus paradas
        let fijas: RutaFija[] = [];
        const { data: rutasData } = await supabase
          .from("rutas")
          .select("id, nombre")
          .is("usuario_id", null)
          .order("nombre", { ascending: true });
        const ids = (rutasData ?? []).map((r: any) => r.id);
        if (ids.length > 0) {
          const { data: itemsData } = await supabase
            .from("ruta_items")
            .select("ruta_id, referencia_id, orden")
            .in("ruta_id", ids)
            .eq("tipo_item", TIPO_ITEM_HITO);
          fijas = (rutasData ?? []).map((r: any) => ({
            id: r.id,
            nombre: r.nombre,
            hitoIds: (itemsData ?? [])
              .filter((i: any) => i.ruta_id === r.id)
              .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0))
              .map((i: any) => i.referencia_id),
          }));
        }

        // 4) Ubicación del usuario (opcional si viene de un hito o elige una ruta fija)
        let usuario: Coord | null = null;
        try {
          const permiso = await Location.requestForegroundPermissionsAsync();
          if (permiso.status === "granted") {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            usuario = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          }
        } catch {
          usuario = null;
        }

        if (activo) setDatos({ todos, preferencias, usuario, usuarioId, fijas, propias });
      } catch (e) {
        console.error("Error cargando rutas:", e);
        if (activo) setErrorCarga(true);
      }
    }

    cargar();
    return () => {
      activo = false;
    };
  }, [intento]);

  // Ruta que se está mostrando según el chip elegido
  const resultado = useMemo<Resultado | null>(() => {
    if (!datos) return null;
    if (seleccion === DINAMICA) return armarRutaDinamica(datos, hitoId);
    const ruta = datos.fijas.find((r) => r.id === seleccion);
    return ruta ? armarRutaFija(datos, ruta) : null;
  }, [datos, seleccion, hitoId]);

  // Totales
  const totales = useMemo(() => {
    if (!resultado) return { km: 0, min: 0 };
    const km = resultado.paradas.reduce((s, p) => s + (p.tramoKm ?? 0), 0);
    const viaje = resultado.paradas.reduce((s, p) => s + (p.tramoMin ?? 0), 0);
    return { km, min: viaje + resultado.paradas.length * VISITA_MIN };
  }, [resultado]);

  // Mapa Leaflet (mismo enfoque que mapa.tsx)
  const html = useMemo(() => {
    if (!resultado) return "";
    const info = {
      usuario: resultado.usuario,
      conectarUsuario: resultado.conectarUsuario,
      acento: ACENTO,
      paradas: resultado.paradas.map((p, i) => ({
        n: i + 1,
        lat: p.lat,
        lng: p.lng,
        nombre: p.nombre,
        color: estiloCategoria(p.categoriaNombre).color,
      })),
    };
    const json = JSON.stringify(info).replace(/</g, "\\u003c");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <style>
            html, body, #map { height: 100%; margin: 0; padding: 0; }
            .pin { width: 34px; height: 34px; border-radius: 50%; border: 3px solid #fff;
                   color: #fff; font: bold 15px sans-serif; display: flex;
                   align-items: center; justify-content: center;
                   box-shadow: 0 2px 6px rgba(0,0,0,.35); }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <script>
            var d = ${json};
            var map = L.map('map', { zoomControl: false });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            var puntos = [];
            var linea = [];

            if (d.usuario) {
              L.circleMarker([d.usuario.lat, d.usuario.lng], {
                radius: 9, color: '#fff', weight: 3, fillColor: '#1E88E5', fillOpacity: 1
              }).addTo(map);
              if (d.conectarUsuario) {
                puntos.push([d.usuario.lat, d.usuario.lng]);
                linea.push([d.usuario.lat, d.usuario.lng]);
              }
            }

            d.paradas.forEach(function (p) {
              linea.push([p.lat, p.lng]);
              puntos.push([p.lat, p.lng]);
              L.marker([p.lat, p.lng], {
                icon: L.divIcon({
                  className: '',
                  html: '<div class="pin" style="background:' + p.color + '">' + p.n + '</div>',
                  iconSize: [34, 34],
                  iconAnchor: [17, 17]
                })
              }).addTo(map).bindTooltip(p.nombre);
            });

            L.polyline(linea, { color: d.acento, weight: 5, opacity: 0.9 }).addTo(map);
            map.fitBounds(puntos, { padding: [50, 50] });
          </script>
        </body>
      </html>
    `;
  }, [resultado]);

  // Nombre con el que se guarda la ruta que se está viendo, y si ya está guardada
  const fijaActual = datos ? datos.fijas.find((r) => r.id === seleccion) : undefined;
  const nombreActual = resultado
    ? fijaActual
      ? fijaActual.nombre
      : `Ruta desde ${resultado.paradas[0].nombre}`
    : null;
  const guardada = !!datos && nombreActual !== null && datos.propias.includes(nombreActual);

  /* ----------------------------- Acciones -------------------------------- */

  function elegir(id: string) {
    setSeleccion(id);
  }

  // Abrir la ruta en Google Maps (sin API key, solo URL)
  function iniciarRuta() {
    if (!resultado) return;
    const pts: Coord[] = [
      ...(resultado.conectarUsuario && resultado.usuario ? [resultado.usuario] : []),
      ...resultado.paradas,
    ];
    const f = (p: Coord) => `${p.lat},${p.lng}`;
    const medio = pts.slice(1, -1).map(f).join("|");
    let url =
      `https://www.google.com/maps/dir/?api=1&travelmode=driving` +
      `&origin=${f(pts[0])}&destination=${f(pts[pts.length - 1])}`;
    if (medio) url += `&waypoints=${encodeURIComponent(medio)}`;
    Linking.openURL(url);
  }

  // Corazón: guarda la ruta actual (rutas + ruta_items) o la quita si ya estaba guardada
  async function alternarGuardada() {
    if (!resultado || !datos || !nombreActual || guardando) return;

    if (!datos.usuarioId) {
      Alert.alert("Inicia sesión", "Necesitas una cuenta para guardar rutas.", [
        { text: "Ahora no", style: "cancel" },
        { text: "Iniciar sesión", onPress: () => router.push("/login") },
      ]);
      return;
    }

    const usuarioId = datos.usuarioId;
    const nombre = nombreActual;
    setGuardando(true);
    try {
      if (guardada) {
        // ---- Quitar de guardadas ----
        const { data: existentes, error: errBuscar } = await supabase
          .from("rutas")
          .select("id")
          .eq("usuario_id", usuarioId)
          .eq("nombre", nombre);
        if (errBuscar) throw errBuscar;

        const ids = (existentes ?? []).map((r: any) => r.id);
        if (ids.length > 0) {
          const { error: errItems } = await supabase.from("ruta_items").delete().in("ruta_id", ids);
          if (errItems) throw errItems;
          const { error: errRutas } = await supabase.from("rutas").delete().in("id", ids);
          if (errRutas) throw errRutas;
        }
        setDatos((d) => (d ? { ...d, propias: d.propias.filter((n) => n !== nombre) } : d));
        return;
      }

      // ---- Guardar ----
      const { data: ruta, error: errRuta } = await supabase
        .from("rutas")
        .insert({ usuario_id: usuarioId, nombre })
        .select("id")
        .single();
      if (errRuta || !ruta) throw errRuta ?? new Error("No se pudo crear la ruta");

      const items = resultado.paradas.map((p, i) => ({
        ruta_id: ruta.id,
        tipo_item: TIPO_ITEM_HITO,
        referencia_id: p.id,
        orden: i + 1,
      }));
      const { error: errItems } = await supabase.from("ruta_items").insert(items);
      if (errItems) {
        // Si fallan las paradas, no dejamos una ruta vacía
        await supabase.from("rutas").delete().eq("id", ruta.id);
        throw errItems;
      }

      setDatos((d) => (d ? { ...d, propias: [...d.propias, nombre] } : d));
    } catch (e: any) {
      Alert.alert(
        guardada ? "No se pudo quitar" : "No se pudo guardar",
        e?.message ?? "Inténtalo de nuevo.",
      );
    } finally {
      setGuardando(false);
    }
  }

  /* ------------------------------ Render -------------------------------- */

  const encabezado = (
    <View
      style={[
        styles.encabezado,
        { paddingTop: insets.top + 8, backgroundColor: colores.encabezado, borderBottomColor: colores.borde },
      ]}
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={26} color={colores.texto} />
      </TouchableOpacity>
      <Text style={[styles.titulo, { color: colores.texto }]}>Rutas sugeridas</Text>
      <View style={{ width: 26 }} />
    </View>
  );

  const opciones: { id: string; nombre: string; icono: NombreIcono }[] = datos
    ? [
        {
          id: DINAMICA,
          nombre: hitoId ? "Desde este hito" : "Cerca de mí",
          icono: hitoId ? "location-outline" : "navigate-outline",
        },
        ...datos.fijas.map((r) => ({ id: r.id, nombre: r.nombre, icono: iconoRuta(r.nombre) })),
      ]
    : [];

  const chips = datos ? (
    <View style={[styles.barraChips, { backgroundColor: colores.encabezado, borderBottomColor: colores.borde }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contenidoChips}>
        {opciones.map((o) => {
          const activo = o.id === seleccion;
          return (
            <TouchableOpacity
              key={o.id}
              onPress={() => elegir(o.id)}
              style={[
                styles.chipRuta,
                activo
                  ? { backgroundColor: ACENTO, borderColor: ACENTO }
                  : { backgroundColor: colores.tarjeta, borderColor: colores.borde },
              ]}
            >
              <Ionicons name={o.icono} size={16} color={activo ? "#fff" : colores.textoSecundario} />
              <Text style={[styles.textoChipRuta, { color: activo ? "#fff" : colores.texto }]}>{o.nombre}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  ) : null;

  // Qué vista toca mostrar
  const esFija = seleccion !== DINAMICA;
  let vista: "cargando" | "error" | "sinUbicacion" | "sinRuta" | "rutaVacia" | "listo" = "listo";
  if (errorCarga) vista = "error";
  else if (!datos) vista = "cargando";
  else if (!resultado) {
    if (esFija) vista = "rutaVacia";
    else if (!hitoId && !datos.usuario) vista = "sinUbicacion";
    else vista = "sinRuta";
  }

  if (vista !== "listo" || !resultado) {
    const mensajes = {
      error: {
        icono: "alert-circle-outline" as NombreIcono,
        titulo: "No pudimos cargar las rutas",
        texto: "Revisa tu conexión a internet e inténtalo de nuevo.",
        boton: "Intentar de nuevo",
        accion: () => setIntento((n) => n + 1),
      },
      sinUbicacion: {
        icono: "location-outline" as NombreIcono,
        titulo: "Necesitamos tu ubicación",
        texto: "Activa el permiso de ubicación para armar una ruta cerca de ti, o elige una de las rutas de arriba.",
        boton: "Intentar de nuevo",
        accion: () => setIntento((n) => n + 1),
      },
      sinRuta: {
        icono: "map-outline" as NombreIcono,
        titulo: "No hay rutas disponibles en esta zona",
        texto: "No encontramos hitos culturales cerca. Prueba acercándote a otra zona o elige una de las rutas de arriba.",
        boton: "Volver al mapa",
        accion: () => router.back(),
      },
      rutaVacia: {
        icono: "map-outline" as NombreIcono,
        titulo: "Esta ruta aún no está lista",
        texto: "Todavía no tiene suficientes lugares. Prueba con otra ruta.",
        boton: "Ver ruta cerca de mí",
        accion: () => elegir(DINAMICA),
      },
    };

    return (
      <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
        {encabezado}
        {chips}
        <View style={styles.centrado}>
          {vista === "cargando" ? (
            <>
              <ActivityIndicator size="large" color={ACENTO} />
              <Text style={[styles.textoVacio, { color: colores.textoSecundario, marginTop: 14 }]}>
                Armando tu ruta…
              </Text>
            </>
          ) : (
            (() => {
              const m = mensajes[vista as keyof typeof mensajes];
              return (
                <>
                  <Ionicons name={m.icono} size={64} color={ACENTO} />
                  <Text style={[styles.tituloVacio, { color: colores.texto }]}>{m.titulo}</Text>
                  <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>{m.texto}</Text>
                  <TouchableOpacity style={styles.botonPrimario} onPress={m.accion}>
                    <Text style={styles.textoBotonPrimario}>{m.boton}</Text>
                  </TouchableOpacity>
                </>
              );
            })()
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.pantalla, { backgroundColor: colores.fondo }]}>
      {encabezado}
      {chips}

      {/* Mapa */}
      <View style={styles.contenedorMapa}>
        <WebView originWhitelist={["*"]} source={{ html }} style={{ flex: 1 }} />
        <View style={[styles.chipResumen, { backgroundColor: colores.tarjeta }]}>
          <Ionicons name="git-branch-outline" size={16} color={ACENTO} />
          <Text style={[styles.textoChip, { color: colores.texto }]}>
            {resultado.paradas.length} hitos · {formatearTiempo(totales.min)} · {totales.km.toFixed(1)} km
          </Text>
        </View>
      </View>

      {/* Panel inferior */}
      <View style={[styles.panel, { backgroundColor: colores.fondo }]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
          {resultado.paradas.map((p, i) => {
            const cat = estiloCategoria(p.categoriaNombre);
            let detalle = "Punto de partida";
            if (p.tramoKm != null && p.tramoMin != null) {
              const desde = i === 0 && resultado.conectarUsuario ? "desde tu ubicación" : "desde la parada anterior";
              detalle = `${p.tramoKm.toFixed(1)} km · ${p.tramoMin} min ${desde}`;
            }
            return (
              <View key={p.id} style={styles.filaParada}>
                <View style={styles.columnaNumero}>
                  <View style={styles.numero}>
                    <Text style={styles.textoNumero}>{i + 1}</Text>
                  </View>
                  {i < resultado.paradas.length - 1 && <View style={[styles.conector, { borderColor: ACENTO }]} />}
                </View>

                <TouchableOpacity
                  style={[styles.tarjetaParada, { backgroundColor: colores.tarjeta, borderColor: colores.borde }]}
                  onPress={() => router.push(`/hito/${p.id}`)}
                >
                  {p.imagenUrl ? (
                    <Image source={{ uri: p.imagenUrl }} style={styles.miniatura} />
                  ) : (
                    <View style={[styles.miniatura, styles.miniaturaVacia, { backgroundColor: cat.color + "22" }]}>
                      <Ionicons name={cat.icono} size={28} color={cat.color} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.nombreParada, { color: colores.texto }]} numberOfLines={2}>
                      {p.nombre}
                    </Text>
                    <View style={styles.filaCategoria}>
                      <Ionicons name={cat.icono} size={14} color={cat.color} />
                      <Text style={[styles.textoCategoria, { color: cat.color }]}>{p.categoriaNombre}</Text>
                    </View>
                    <Text style={[styles.detalleParada, { color: colores.textoSecundario }]}>{detalle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colores.textoSecundario} />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        {/* Total + acciones */}
        <View style={[styles.pie, { paddingBottom: insets.bottom + 12, borderTopColor: colores.borde }]}>
          <View style={[styles.cajaTotal, { backgroundColor: colores.tarjeta }]}>
            <Ionicons name="time-outline" size={24} color={colores.textoSecundario} />
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.etiquetaTotal, { color: colores.textoSecundario }]}>Tiempo total estimado</Text>
              <Text style={styles.valorTotal}>{formatearTiempo(totales.min)}</Text>
            </View>
          </View>
          <View style={styles.filaBotones}>
            <TouchableOpacity style={[styles.botonPrimario, { flex: 1, marginTop: 0 }]} onPress={iniciarRuta}>
              <Ionicons name="play" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.textoBotonPrimario}>Iniciar ruta</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botonSecundario, guardada && styles.botonGuardada]}
              onPress={alternarGuardada}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator size="small" color={ACENTO} />
              ) : (
                <>
                  <Ionicons
                    name={guardada ? "heart" : "heart-outline"}
                    size={18}
                    color={ACENTO}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.textoBotonSecundario}>{guardada ? "Guardada" : "Guardar ruta"}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------- Estilos --------------------------------- */

const styles = StyleSheet.create({
  pantalla: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  titulo: { fontSize: 18, fontWeight: "bold" },

  barraChips: { borderBottomWidth: 1 },
  contenidoChips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chipRuta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  textoChipRuta: { fontSize: 13, fontWeight: "600" },

  contenedorMapa: { height: "36%" },
  chipResumen: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  textoChip: { fontSize: 13, fontWeight: "600" },

  panel: {
    flex: 1,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },

  filaParada: { flexDirection: "row", marginBottom: 10 },
  columnaNumero: { width: 34, alignItems: "center" },
  numero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACENTO,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  textoNumero: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  conector: { flex: 1, borderLeftWidth: 2, borderStyle: "dashed", marginTop: 4, marginBottom: -14 },
  tarjetaParada: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  miniatura: { width: 68, height: 68, borderRadius: 10 },
  miniaturaVacia: { justifyContent: "center", alignItems: "center" },
  nombreParada: { fontSize: 15, fontWeight: "bold" },
  filaCategoria: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  textoCategoria: { fontSize: 13, fontWeight: "600" },
  detalleParada: { fontSize: 12, marginTop: 3 },

  pie: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  cajaTotal: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, marginBottom: 10 },
  etiquetaTotal: { fontSize: 12 },
  valorTotal: { fontSize: 20, fontWeight: "bold", color: ACENTO },
  filaBotones: { flexDirection: "row", gap: 10 },

  botonPrimario: {
    flexDirection: "row",
    backgroundColor: ACENTO,
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  textoBotonPrimario: { color: "#fff", fontSize: 15, fontWeight: "600" },
  botonSecundario: {
    flexDirection: "row",
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: ACENTO,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 140,
  },
  botonGuardada: { backgroundColor: "#EAF2FA" },
  textoBotonSecundario: { color: ACENTO, fontSize: 15, fontWeight: "600" },

  tituloVacio: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginTop: 16 },
  textoVacio: { fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 },
});