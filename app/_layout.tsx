import { FavoritosProvider } from "@/contexts/FavoritosContext";
import { TemaProvider } from "@/contexts/ThemeContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Stack } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
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
          <StatusBar style="auto" />
        </ThemeProvider>
      </FavoritosProvider>
    </TemaProvider>
  );
}
