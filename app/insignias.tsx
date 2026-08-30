// app/insignias.tsx
//
// Pantalla de Logros — Escenario 1 de HU-025:
// "el usuario ve sus insignias obtenidas y las que le faltan".
import { InsigniaConEstado, useInsignias } from "@/hooks/use-insignias";
import { router } from "expo-router";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function LogrosScreen() {
  const { insignias, cargando, error, usuarioId, recargar } = useInsignias();

  if (cargando && insignias.length === 0) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#3B6FA0" />
      </View>
    );
  }

  // ---- Invitado / sin sesión (mismo patrón que perfil.tsx) ----
  if (!usuarioId) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.tituloInvitado}>Estás como invitado</Text>
        <Text style={styles.textoInvitado}>
          Inicia sesión para ver tus insignias y tu progreso.
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

  if (error) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.textoError}>No se pudieron cargar tus logros: {error}</Text>
      </View>
    );
  }

  const totalObtenidas = insignias.filter((i) => i.desbloqueada).length;

  return (
    <View style={styles.contenedor}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>Mis Logros</Text>
        <Text style={styles.subtitulo}>
          {totalObtenidas} de {insignias.length} insignias obtenidas
        </Text>
      </View>

      <FlatList
        data={insignias}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={recargar} />}
        renderItem={({ item }) => <TarjetaInsignia insignia={item} />}
      />
    </View>
  );
}

function TarjetaInsignia({ insignia }: { insignia: InsigniaConEstado }) {
  return (
    <View style={[styles.tarjeta, !insignia.desbloqueada && styles.tarjetaBloqueada]}>
      <View style={styles.circuloIcono}>
        <Text style={styles.icono}>{insignia.icono ?? "🏅"}</Text>
      </View>
      <Text style={styles.nombre}>{insignia.nombre}</Text>
      <Text style={styles.descripcion} numberOfLines={2}>
        {insignia.desbloqueada ? insignia.descripcion : insignia.requisito}
      </Text>
      {!insignia.desbloqueada && <Text style={styles.etiquetaBloqueada}>Bloqueada</Text>}
    </View>
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

  encabezado: { paddingHorizontal: 20, paddingTop: 55, paddingBottom: 14 },
  titulo: { fontSize: 22, fontWeight: "bold", color: "#1A2A3A" },
  subtitulo: { fontSize: 13.5, color: "#8A8A8A", marginTop: 4 },

  lista: { paddingHorizontal: 10, paddingBottom: 24 },
  tarjeta: {
    flex: 1,
    margin: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    minHeight: 150,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tarjetaBloqueada: { opacity: 0.5 },
  circuloIcono: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EAF2FA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  icono: { fontSize: 26 },
  nombre: { fontSize: 14.5, fontWeight: "600", color: "#1A2A3A", textAlign: "center" },
  descripcion: {
    fontSize: 11.5,
    color: "#8A8A8A",
    textAlign: "center",
    marginTop: 4,
  },
  etiquetaBloqueada: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: "600",
    color: "#B0B0B0",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textoError: { color: "#D32F2F", textAlign: "center", paddingHorizontal: 24 },
});