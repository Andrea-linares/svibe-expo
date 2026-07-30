import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

type HitoMapa = {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  direccion_referencia: string | null;
  imagenUrl: string | null;
};

export default function MapaScreen() {
  const [hitos, setHitos] = useState<HitoMapa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<HitoMapa | null>(null);

  useEffect(() => {
    async function cargarUbicaciones() {
      // Traemos también la primera imagen de cada lugar (si existe) en la misma consulta
      const { data } = await supabase
        .from("hitos")
        .select(
          "id, nombre, lat, lng, direccion_referencia, hito_imagenes(url, orden)",
        );

      const procesados: HitoMapa[] = (data ?? [])
        .filter((h: any) => h.lat && h.lng)
        .map((h: any) => {
          const imagenes = (h.hito_imagenes ?? []).sort(
            (a: any, b: any) => a.orden - b.orden,
          );
          return {
            id: h.id,
            nombre: h.nombre,
            lat: h.lat,
            lng: h.lng,
            direccion_referencia: h.direccion_referencia,
            imagenUrl: imagenes.length > 0 ? imagenes[0].url : null,
          };
        });

      setHitos(procesados);
      setCargando(false);
    }
    cargarUbicaciones();
  }, []);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // Le mandamos solo el id a cada marcador; al tocarlo buscamos el hito completo en el estado
  const marcadoresJS = hitos
    .map(
      (h) => `
      L.marker([${h.lat}, ${h.lng}])
        .addTo(map)
        .bindPopup(${JSON.stringify(h.nombre)})
        .on('click', function() {
          window.ReactNativeWebView.postMessage(${JSON.stringify(h.id)});
        });
    `,
    )
    .join("\n");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          html, body, #map { height: 100%; margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          var map = L.map('map').setView([13.483, -88.18], 9);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);
          ${marcadoresJS}
        </script>
      </body>
    </html>
  `;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.mapa}
        onMessage={(evento) => {
          const hitoId = evento.nativeEvent.data;
          const hito = hitos.find((h) => h.id === hitoId);
          if (hito) setSeleccionado(hito);
        }}
      />

      {/* Mini tarjeta flotante al tocar un marcador */}
      {seleccionado && (
        <View style={styles.tarjetaFlotante}>
          <TouchableOpacity
            style={styles.botonCerrar}
            onPress={() => setSeleccionado(null)}
          >
            <Text style={styles.textoCerrar}>✕</Text>
          </TouchableOpacity>

          <View style={styles.filaTarjeta}>
            <Image
              source={
                seleccionado.imagenUrl
                  ? { uri: seleccionado.imagenUrl }
                  : require("@/assets/images/partial-react-logo.png")
              }
              style={styles.imagenTarjeta}
            />
            <View style={styles.infoTarjeta}>
              <Text style={styles.nombreTarjeta} numberOfLines={2}>
                {seleccionado.nombre}
              </Text>
              {seleccionado.direccion_referencia && (
                <Text style={styles.ubicacionTarjeta} numberOfLines={1}>
                  📍 {seleccionado.direccion_referencia}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.botonDetalle}
            onPress={() => router.push(`/hito/${seleccionado.id}`)}
          >
            <Text style={styles.textoBotonDetalle}>Ver más detalles</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapa: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  tarjetaFlotante: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  botonCerrar: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 6,
    zIndex: 1,
  },
  textoCerrar: { fontSize: 16, color: "#999" },
  filaTarjeta: { flexDirection: "row", gap: 12 },
  imagenTarjeta: { width: 70, height: 70, borderRadius: 10 },
  infoTarjeta: { flex: 1, justifyContent: "center" },
  nombreTarjeta: { fontSize: 16, fontWeight: "bold" },
  ubicacionTarjeta: { fontSize: 13, color: "#666", marginTop: 4 },
  botonDetalle: {
    marginTop: 12,
    backgroundColor: "#2196F3",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  textoBotonDetalle: { color: "#fff", fontWeight: "600" },
});
