import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type HitoMapa = {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
};

export default function MapaScreen() {
  const [hitos, setHitos] = useState<HitoMapa[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarUbicaciones() {
      const { data } = await supabase
        .from("hitos")
        .select("id, nombre, lat, lng");
      setHitos((data ?? []).filter((h) => h.lat && h.lng));
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

  // Construimos el HTML del mapa con Leaflet + OpenStreetMap (gratis, sin API key)
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
    <WebView
      originWhitelist={["*"]}
      source={{ html }}
      style={styles.mapa}
      onMessage={(evento) => {
        // Cuando tocan un marcador, navegamos a la pantalla de detalle
        const hitoId = evento.nativeEvent.data;
        router.push(`/hito/${hitoId}`);
      }}
    />
  );
}

const styles = StyleSheet.create({
  mapa: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
});
