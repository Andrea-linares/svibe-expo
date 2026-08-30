import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Perfil = {
  nombre: string | null;
  apellido: string | null;
  ciudad: string | null;
  foto_perfil_url: string | null;
};

type Ruta = {
  id: string;
  nombre: string;
};

type Logro = {
  insignia_id: number;
  insignias: {
    nombre: string;
    descripcion: string | null;
    icono: string | null;
  } | null;
};

export default function PerfilScreen() {
  const [cargando, setCargando] = useState(true);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [totalVisitados, setTotalVisitados] = useState(0);
  const [totalFavoritos, setTotalFavoritos] = useState(0);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [logros, setLogros] = useState<Logro[]>([]);

  useFocusEffect(
    useCallback(() => {
    async function cargarPerfil() {
      const { data: sesion } = await supabase.auth.getUser();

      if (!sesion?.user) {
        setUsuarioId(null);
        setCargando(false);
        return;
      }

      const userId = sesion.user.id;
      setUsuarioId(userId);

      // Datos del perfil
      const { data: perfilData } = await supabase
        .from("perfiles")
        .select("nombre, apellido, ciudad, foto_perfil_url")
        .eq("id", userId)
        .single();

      // Hitos visitados (distintos)
      const { data: visitas } = await supabase
        .from("interacciones_usuario")
        .select("hito_id")
        .eq("usuario_id", userId)
        .eq("tipo_interaccion", "visita");

      const hitosUnicos = new Set((visitas ?? []).map((v) => v.hito_id));

      // Hitos favoritos
      const { count: favoritosCount } = await supabase
        .from("favoritos")
        .select("*", { count: "exact", head: true })
        .eq("usuario_id", userId);

      // Rutas guardadas
      const { data: rutasData } = await supabase
        .from("rutas")
        .select("id, nombre")
        .eq("usuario_id", userId)
        .order("creada_en", { ascending: false });

      // Logros obtenidos
      const { data: logrosData } = await supabase
        .from("usuario_insignias")
        .select("insignia_id, insignias(nombre, descripcion, icono)")
        .eq("usuario_id", userId);

      setPerfil(perfilData);
      setTotalVisitados(hitosUnicos.size);
      setTotalFavoritos(favoritosCount ?? 0);
      setRutas(rutasData ?? []);
      setLogros((logrosData as unknown as Logro[]) ?? []);
      setCargando(false);
    }

    cargarPerfil();
    }, []),
  );

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#3B6FA0" />
      </View>
    );
  }

  // ---- Invitado / sin sesión ----
  if (!usuarioId) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.tituloInvitado}>Estás como invitado</Text>
        <Text style={styles.textoInvitado}>
          Inicia sesión para ver tu perfil, tus favoritos y tus rutas
          guardadas.
        </Text>
        <TouchableOpacity
          style={styles.botonIniciarSesion}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.textoBotonIniciarSesion}>Iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

   const nombreCompleto = perfil?.nombre?.trim()
    ? `${perfil.nombre}${perfil.apellido ? ` ${perfil.apellido}` : ""}`
    : "Usuario";

  return (
    <ScrollView style={styles.contenedor}
    contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Encabezado con avatar, nombre y ciudad */}
      <View style={styles.tarjetaEncabezado}>
        <View style={styles.filaEncabezado}>
          <Image
          source={
            perfil?.foto_perfil_url
              ? { uri: perfil.foto_perfil_url }
              : require("@/assets/images/partial-react-logo.png")
          }
          style={styles.avatar}
        />
        <View style={styles.infoEncabezado}>
            <Text style={styles.nombre} numberOfLines={1}>
              {nombreCompleto}
            </Text>
            {perfil?.ciudad && (
              <View style={styles.filaUbicacion}>
                <Ionicons name="location-sharp" size={13} color="#EAF2FA" />
                <Text style={styles.ciudad}>{perfil.ciudad}</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.botonEditarPerfil}
          onPress={() => router.push("/editar-perfil")}
          >
          <Ionicons name="pencil-outline" size={14} color="#fff" />
          <Text style={styles.textoBotonEditarPerfil}>Editar perfil</Text>
        </TouchableOpacity>
      </View>

       {/* Estadísticas: 2x2 */}
      <View style={styles.gridEstadisticas}>
        <View style={styles.tarjetaEstadistica}>
          <View style={[styles.circuloIcono, { backgroundColor: "#E3EEF8" }]}>
            <Ionicons name="location" size={20} color="#3B6FA0" />
          </View>
          <Text style={styles.numeroEstadistica}>{totalVisitados}</Text>
          <Text style={styles.etiquetaEstadistica}>Lugares visitados</Text>
        </View>

        <View style={styles.tarjetaEstadistica}>
          <View style={[styles.circuloIcono, { backgroundColor: "#E3EEF8" }]}>
            <Ionicons name="bookmark" size={20} color="#3B6FA0" />
          </View>
          <Text style={styles.numeroEstadistica}>{rutas.length}</Text>
          <Text style={styles.etiquetaEstadistica}>Rutas guardadas</Text>
        </View>

        <View style={styles.tarjetaEstadistica}>
          <View style={[styles.circuloIcono, { backgroundColor: "#E3EEF8" }]}>
            <Ionicons name="ribbon" size={20} color="#3B6FA0" />
          </View>
          <Text style={styles.numeroEstadistica}>{logros.length}</Text>
          <Text style={styles.etiquetaEstadistica}>Insignias</Text>
        </View>

        <View style={styles.tarjetaEstadistica}>
          <View style={[styles.circuloIcono, { backgroundColor: "#FCEBEE" }]}>
            <Ionicons name="heart" size={20} color="#D9587A" />
          </View>
          <Text style={styles.numeroEstadistica}>{totalFavoritos}</Text>
          <Text style={styles.etiquetaEstadistica}>Hitos favoritos</Text>
        </View>
      </View>

      {/* Lista de secciones */}
      <View style={styles.tarjetaLista}>
        <TouchableOpacity
          style={styles.filaLista}
          activeOpacity={0.6}
          onPress={() =>
            Alert.alert(
              "Mis Rutas Guardadas",
              rutas.length > 0
                ? rutas.map((r) => `• ${r.nombre}`).join("\n")
                : "Todavía no tienes rutas guardadas.",
            )
          }
        >
          <View style={styles.iconoFilaLista}>
            <Ionicons name="map-outline" size={19} color="#3B6FA0" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.textoFilaLista}>Mis Rutas Guardadas</Text>
            <Text style={styles.subtextoFilaLista}>
              {rutas.length} ruta{rutas.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C4C4C4" />
        </TouchableOpacity>

        <View style={styles.separadorLista} />

        <TouchableOpacity
          style={styles.filaLista}
          activeOpacity={0.6}
          onPress={() => router.push("/insignias")}
        >
          <View style={styles.iconoFilaLista}>
            <Ionicons name="trophy-outline" size={19} color="#3B6FA0" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.textoFilaLista}>Logros Obtenidos</Text>
            <Text style={styles.subtextoFilaLista}>
              {logros.length} logro{logros.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C4C4C4" />
        </TouchableOpacity>

      {/* Cerrar Sesión */}
      <TouchableOpacity
        style={styles.botonCerrarSesion}
        activeOpacity={0.75}
        onPress={cerrarSesion}
      >
        <Ionicons name="log-out-outline" size={18} color="#D32F2F" />
        <Text style={styles.textoBotonCerrarSesion}>Cerrar Sesión</Text>
      </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#F5F6F8" },
  centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  tituloInvitado: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  textoInvitado: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  botonIniciarSesion: {
    backgroundColor: "#3B6FA0",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  textoBotonIniciarSesion: { color: "#fff", fontWeight: "600" },

  // Encabezado con color sólido (antes era degradado)
  tarjetaEncabezado: {
    marginTop: 55,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 22,
    backgroundColor: "#3B6FA0",
    shadowColor: "#3B6FA0",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  filaEncabezado: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EEE",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.85)",
  },
  infoEncabezado: { marginLeft: 16, flex: 1 },
  nombre: { fontSize: 19, fontWeight: "bold", color: "#fff" },
  filaUbicacion: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  ciudad: { fontSize: 13, color: "#EAF2FA", marginLeft: 4 },
  botonEditarPerfil: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    alignSelf: "flex-start",
    borderWidth: 1.3,
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  textoBotonEditarPerfil: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // Grid de estadísticas
  gridEstadisticas: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 12,
  },
  tarjetaEstadistica: {
    width: "47.5%",
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  circuloIcono: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  numeroEstadistica: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1A2A3A",
  },
  etiquetaEstadistica: { fontSize: 12.5, color: "#8A8A8A", marginTop: 3 },

  // Lista de secciones
  tarjetaLista: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  filaLista: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  iconoFilaLista: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#EAF2FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 13,
  },
  textoFilaLista: { fontSize: 15, fontWeight: "600", color: "#1A2A3A" },
  subtextoFilaLista: { fontSize: 12, color: "#999", marginTop: 2 },
  separadorLista: {
    height: 1,
    backgroundColor: "#F1F1F1",
    marginLeft: 65,
  },

  // Cerrar sesión
  botonCerrarSesion: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 22,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: "#FDEAEA",
    gap: 8,
  },
  textoBotonCerrarSesion: { color: "#D32F2F", fontWeight: "600", fontSize: 15 },
});