import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function BienvenidaScreen() {
  const [verificando, setVerificando] = useState(true);
  const [tienePreferencias, setTienePreferencias] = useState(false);

 useEffect(() => {
    async function verificarPreferencias() {
      try {
        const { data: sesion } = await supabase.auth.getUser();

        if (sesion?.user) {
          // Verificar si tiene categorías seleccionadas
          const { count } = await supabase
            .from("usuario_categorias")
            .select("*", { count: "exact", head: true })
            .eq("usuario_id", sesion.user.id);

          setTienePreferencias((count ?? 0) > 0);
          console.log(
            "🔍 Tiene preferencias:",
            (count ?? 0) > 0,
            "(",
            count,
            ")"
          );
        } else {
          setTienePreferencias(false);
        }
      } catch (error) {
        console.error(" Error verificando preferencias:", error);
        setTienePreferencias(false);
      } finally {
        setVerificando(false);
      }
    }

    verificarPreferencias();
  }, []);
  
  useEffect(() => {
    if (!verificando) {
      if (tienePreferencias) {
        router.replace("/(tabs)/home");
      }
    }
  }, [verificando, tienePreferencias]);
  
  if (verificando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#5B9BD5" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={{
        uri: "https://gdrrajvafwzgnbvjmqtw.supabase.co/storage/v1/object/public/hitos-imagenes/fondo.png",
      }}
      style={styles.fondo}
      resizeMode="cover"
    >
      {/* Capa oscura semitransparente para quenele el texto se lea bien sobre la foto */}
      <View style={styles.overlay} />

      <View style={styles.contenido}>
        <View style={styles.arriba}>
          <Text style={styles.logo}>
            S<Text style={styles.logoAcento}>V</Text>ibe
          </Text>
          <Text style={styles.subtitulo}>
            Tu viaje por la historia{"\n"}empieza aquí.
          </Text>
        </View>

        <View style={styles.botones}>
          <TouchableOpacity
            style={styles.botonInvitado}
            onPress={() => router.replace("/(tabs)/home")}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color="#1a1a2e"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.textoBotonInvitado}>Entrar como invitado</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botonLogin}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.textoBotonLogin}>
              Iniciar sesión / Registrarse
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1 },
   centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 30, 0.35)",
  },
  contenido: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 100,
    paddingBottom: 50,
  },
  arriba: { alignItems: "center" },
  logo: { fontSize: 42, fontWeight: "bold", color: "#fff" },
  logoAcento: { color: "#5B9BD5" },
  subtitulo: {
    fontSize: 16,
    color: "#EAEAEA",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 22,
  },
  botones: { gap: 14 },
  botonInvitado: {
    flexDirection: "row",
    backgroundColor: "#fff",
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonInvitado: { color: "#1a1a2e", fontSize: 15, fontWeight: "600" },
  botonLogin: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonLogin: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
