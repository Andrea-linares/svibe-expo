import { TemaProvider } from "@/contexts/ThemeContext";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <TemaProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="registro" options={{ headerShown: false }} />
          <Stack.Screen
            name="verificar-codigo"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="olvide-password"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="verificar-recuperacion"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="nueva-contrasena"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="hito/[id]" options={{ title: "" }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </TemaProvider>
  );
}
