import { FavoritosProvider } from "@/contexts/FavoritosContext";
import { TemaProvider, useTema } from "@/contexts/ThemeContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Stack } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

// La barra de estado sigue el interruptor de tema de la app, no solo el del sistema
function BarraDeEstado() {
  const { esOscuro } = useTema();
  return <StatusBar style={esOscuro ? "light" : "dark"} />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // Necesario para los gestos de arrastre (comparador antes/después)
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TemaProvider>
        <FavoritosProvider>
          <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            {/* Las pantallas usan su propio encabezado; el nativo solo se activa
                donde se indica explícitamente. */}
            <Stack screenOptions={{ headerShown: false }}>
              {/* hito/[id] no tiene flecha propia: usa la del encabezado nativo */}
              <Stack.Screen name="hito/[id]" options={{ headerShown: true, title: "" }} />
              <Stack.Screen
                name="modal"
                options={{ headerShown: true, presentation: "modal", title: "Modal" }}
              />
            </Stack>
            <BarraDeEstado />
          </ThemeProvider>
        </FavoritosProvider>
      </TemaProvider>
    </GestureHandlerRootView>
  );
}
