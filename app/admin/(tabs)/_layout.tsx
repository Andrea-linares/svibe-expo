import { ESPACIADO_PANEL, useTema } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const E = ESPACIADO_PANEL;

export default function AdminTabLayout() {
  const { colores, esOscuro } = useTema();
  const insets = useSafeAreaInsets();

  return (
    // Pinta el hueco alrededor de la barra flotante con el fondo del panel
    <View style={[styles.contenedor, { backgroundColor: colores.panelFondo }]}>
      <Tabs
        // El margen inferior de la barra ya incluye el safe area
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={{
          sceneStyle: { backgroundColor: colores.panelFondo },
          tabBarActiveTintColor: colores.panelAzul,
          tabBarInactiveTintColor: colores.panelTabInactivo,
          tabBarStyle: {
            backgroundColor: colores.panelBarra,
            borderTopWidth: 0,
            borderRadius: E.radioBarra,
            marginHorizontal: E.margenBarra,
            marginBottom: insets.bottom + E.margenInferiorBarra,
            height: E.alturaBarra,
            paddingTop: 8,
            paddingBottom: 6,
            paddingHorizontal: 4,
            shadowColor: colores.panelSombra,
            shadowOpacity: esOscuro ? 0 : 0.12,
            shadowOffset: { width: 0, height: 6 },
            shadowRadius: 16,
            elevation: esOscuro ? 0 : 8,
          },
          tabBarItemStyle: styles.pestana,
          tabBarLabel: ({ focused, color, children }) => (
            <View style={styles.contenedorEtiqueta}>
              <Text
                style={[
                  styles.etiqueta,
                  { color, fontWeight: focused ? "700" : "500" },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {children}
              </Text>
              <View
                style={[
                  styles.lineaActiva,
                  { backgroundColor: focused ? color : "transparent" },
                ]}
              />
            </View>
          ),
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Inicio",
            tabBarIcon: ({ color }) => (
              <Ionicons name="home" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="hitos"
          options={{
            title: "Hitos",
            tabBarIcon: ({ color }) => (
              <Ionicons name="star" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="usuarios"
          options={{
            title: "Usuarios",
            tabBarIcon: ({ color }) => (
              <Ionicons name="people" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="reportes"
          options={{
            title: "Reportes",
            tabBarIcon: ({ color }) => (
              <Ionicons name="alert-circle" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="eventos"
          options={{
            title: "Eventos",
            tabBarIcon: ({ color }) => (
              <Ionicons name="calendar" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="foro"
          options={{
            title: "Foro",
            tabBarIcon: ({ color }) => (
              <Ionicons name="chatbubbles" size={22} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  pestana: { flex: 1, paddingHorizontal: 0 },
  contenedorEtiqueta: { width: "100%", alignItems: "center", paddingHorizontal: 2 },
  etiqueta: { fontSize: 11, letterSpacing: 0, textAlign: "center" },
  lineaActiva: { marginTop: 3, width: 16, height: 3, borderRadius: 2 },
});
