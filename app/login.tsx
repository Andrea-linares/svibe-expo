import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMargenSuperior } from "@/hooks/use-margen-superior";
import { useState } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

// Permite cerrar el navegador correctamente cuando el usuario vuelve de Google
WebBrowser.maybeCompleteAuthSession();

/* ---------------------------------------------------------------------------
 * Login con Google mediante OAuth de Supabase (funciona en Expo Go).
 * Google solo redirige al callback https de Supabase; Supabase devuelve la
 * sesión a la app en la URL de retorno (exp://… en Expo Go, svibe://… en un
 * build propio). El Client Secret vive solo en el panel de Supabase.
 * ------------------------------------------------------------------------- */

// Lee los parámetros de la URL de retorno: query (?code=…, ?error=…) y
// fragmento (#access_token=…&refresh_token=…)
function leerParametrosUrl(url: string) {
  const [sinFragmento, fragmento = ""] = url.split("#");
  const consulta = sinFragmento.split("?")[1] ?? "";
  const parametros = new URLSearchParams(consulta);
  new URLSearchParams(fragmento).forEach((valor, clave) => {
    parametros.set(clave, valor);
  });
  return parametros;
}

// Crea la sesión de Supabase a partir de la URL de retorno.
// Flujo implícito: tokens en el fragmento → setSession.
// Flujo PKCE: ?code= → exchangeCodeForSession.
async function crearSesionDesdeUrl(url: string): Promise<User> {
  const parametros = leerParametrosUrl(url);

  const mensajeError =
    parametros.get("error_description") ?? parametros.get("error");
  if (mensajeError) throw new Error(mensajeError);

  const codigo = parametros.get("code");
  if (codigo) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (error) throw error;
    return data.user;
  }

  const accessToken = parametros.get("access_token");
  const refreshToken = parametros.get("refresh_token");
  if (!accessToken || !refreshToken) {
    throw new Error("Google no devolvió una sesión válida. Inténtalo de nuevo.");
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  if (!data.user) throw new Error("No se pudo obtener el usuario de Google.");
  return data.user;
}

function textoONulo(valor: unknown) {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

// Crea la fila en `perfiles` si no existe, con los datos de Google.
// ignoreDuplicates: si el perfil ya existe no se modifica (el usuario pudo
// haber editado su nombre o foto). `rol` no se envía: toma su valor por defecto.
async function asegurarPerfil(user: User) {
  const meta = user.user_metadata ?? {};
  const nombre =
    textoONulo(meta.given_name) ??
    textoONulo(meta.full_name) ??
    textoONulo(meta.name) ??
    "Usuario";

  const { error } = await supabase.from("perfiles").upsert(
    {
      id: user.id,
      nombre,
      apellido: textoONulo(meta.family_name),
      foto_perfil_url: textoONulo(meta.avatar_url) ?? textoONulo(meta.picture),
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  // Igual que en verificar-codigo: un fallo aquí no interrumpe el inicio de sesión
  if (error) console.error("Error creando el perfil de Google:", error);
}

export default function LoginScreen() {
  const margenSuperior = useMargenSuperior(55);
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [conectandoGoogle, setConectandoGoogle] = useState(false);

  // ---- Decide a dónde mandar según el rol del usuario que acaba de iniciar sesión ----
  async function irSegunRol() {
    const { data: sesion } = await supabase.auth.getUser();

    if (!sesion?.user) {
      router.replace("/(tabs)/home");
      return;
    }

    const { data: perfilData } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", sesion.user.id)
      .single();

    if (perfilData?.rol === "administrador") {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/(tabs)/home");
    }
  }

  // Inicia sesión con Google: abre el navegador, espera la URL de retorno,
  // crea la sesión y el perfil, y navega según el rol
  async function iniciarSesionGoogle() {
    if (conectandoGoogle) return;
    setConectandoGoogle(true);

    try {
      const redirectTo = Linking.createURL("auth/callback");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No se pudo abrir el inicio de sesión de Google.");

      const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      // El usuario cerró el navegador o canceló: no es un error
      if (resultado.type !== "success") return;

      const usuario = await crearSesionDesdeUrl(resultado.url);
      // El perfil debe existir antes de leer el rol
      await asegurarPerfil(usuario);
      await irSegunRol();
    } catch (error: any) {
      Alert.alert(
        "Error al iniciar sesión con Google",
        error?.message ?? "Inténtalo de nuevo.",
      );
    } finally {
      setConectandoGoogle(false);
    }
  }

  async function iniciarSesion() {
    if (!correo.trim() || !contrasena) {
      Alert.alert("Faltan datos", "Ingresa tu correo y contraseña.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password: contrasena,
    });

    if (error) {
      Alert.alert("Error al iniciar sesión", error.message);
      return;
    }

    await irSegunRol();
  }

  function continuarConRed(nombreRed: string) {
    Alert.alert(
      "En desarrollo",
      `Inicio de sesión con ${nombreRed} próximamente.`,
    );
  }

  return (
    <View style={styles.fondo}>
      <Image
        source={{
          uri: "https://gdrrajvafwzgnbvjmqtw.supabase.co/storage/v1/object/public/hitos-imagenes/fondo.png",
        }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={styles.overlay} />

      <TouchableOpacity
        style={[styles.botonAtras, { top: margenSuperior }]}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={26} color="#fff" />
      </TouchableOpacity>

      <View style={styles.contenido}>
        <Text style={styles.logo}>
          S<Text style={styles.logoAcento}>V</Text>ibe
        </Text>
        <Text style={styles.subtitulo}>
          Tu viaje por la historia{"\n"}empieza aquí.
        </Text>

        <View style={{ height: 30 }} />

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="rgba(255,255,255,0.6)"
          value={correo}
          onChangeText={setCorreo}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View style={styles.inputConIcono}>
          <TextInput
            style={styles.inputTextoConIcono}
            placeholder="Contraseña"
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={contrasena}
            onChangeText={setContrasena}
            secureTextEntry={!mostrarContrasena}
          />
          <TouchableOpacity
            onPress={() => setMostrarContrasena(!mostrarContrasena)}
          >
            <Ionicons
              name={mostrarContrasena ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="rgba(255,255,255,0.8)"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push("/olvide-password")}>
          <Text style={styles.olvidaste}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botonIniciar} onPress={iniciarSesion}>
          <Text style={styles.textoBotonIniciar}>Iniciar sesión</Text>
        </TouchableOpacity>

        <View style={styles.filaSeparador}>
          <View style={styles.linea} />
          <Text style={styles.textoSeparador}>o</Text>
          <View style={styles.linea} />
        </View>

        <TouchableOpacity
          style={styles.botonGoogle}
          onPress={iniciarSesionGoogle}
          disabled={conectandoGoogle}
        >
          <Ionicons
            name="logo-google"
            size={20}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.textoBotonGoogle}>Continuar con Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botonInvitado}
          onPress={() => router.replace("/(tabs)/home")}
        >
          <Ionicons
            name="person-outline"
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.textoBotonInvitado}>Continuar como invitado</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/registro")}>
          <Text style={styles.registrate}>
            ¿No tienes cuenta?{" "}
            <Text style={styles.registrateLink}>Regístrate</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 30, 0.45)",
  },
  botonAtras: { position: "absolute", top: 55, left: 20, zIndex: 1 },
  contenido: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  logo: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  logoAcento: { color: "#5B9BD5" },
  subtitulo: {
    fontSize: 15,
    color: "#EAEAEA",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 12,
    paddingHorizontal: 16,
    color: "#fff",
    marginBottom: 14,
  },
  inputConIcono: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  inputTextoConIcono: { flex: 1, color: "#fff" },
  olvidaste: {
    color: "#9DBEE0",
    textAlign: "right",
    marginBottom: 20,
    fontSize: 13,
  },
  botonIniciar: {
    height: 52,
    backgroundColor: "#3B6FA0",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonIniciar: { color: "#fff", fontSize: 15, fontWeight: "600" },
  filaSeparador: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  linea: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.3)" },
  textoSeparador: { color: "rgba(255,255,255,0.7)", marginHorizontal: 10 },
  botonInvitado: {
    flexDirection: "row",
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  botonGoogle: {
    flexDirection: "row",
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  textoBotonGoogle: { color: "#fff", fontSize: 15, fontWeight: "600" },

  textoBotonInvitado: { color: "#fff", fontSize: 15, fontWeight: "600" },
  filaIconos: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 24,
  },
  iconoRedondo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  registrate: {
    color: "#EAEAEA",
    textAlign: "center",
    marginTop: 26,
    fontSize: 13,
  },
  registrateLink: { color: "#9DBEE0", fontWeight: "600" },
});
