import { obtenerRetosConProgreso, RetoConProgreso } from "@/hooks/use-retos";
import { supabase } from "@/lib/supabase";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function RetosScreen() {
  const [retos, setRetos] = useState<RetoConProgreso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  const cargarRetos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { data: sesion } = await supabase.auth.getUser();

      if (!sesion?.user) {
        setUsuarioId(null);
        setRetos([]);
        setCargando(false);
        return;
      }

      setUsuarioId(sesion.user.id);
      const datos = await obtenerRetosConProgreso(sesion.user.id);
      setRetos(datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar retos");
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarRetos();
    }, [cargarRetos])
  );

  if (cargando && retos.length === 0) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#3B6FA0" />
      </View>
    );
  }

  // ---- Invitado / sin sesión (mismo patrón que perfil.tsx e insignias.tsx) ----
  if (!usuarioId) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.tituloInvitado}>Estás como invitado</Text>
        <Text style={styles.textoInvitado}>
          Inicia sesión para ver tus retos y tu progreso.
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
        <Text style={styles.textoError}>No se pudieron cargar tus retos: {error}</Text>
      </View>
    );
  }

  const totalCompletados = retos.filter((r) => r.completado).length;

  return (
    <View style={styles.contenedor}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>Retos Culturales</Text>
        <Text style={styles.subtitulo}>
          {totalCompletados} de {retos.length} retos completados
        </Text>
      </View>

      <FlatList
        data={retos}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargarRetos} />}
        renderItem={({ item }) => <TarjetaReto reto={item} />}
      />
    </View>
  );
}

function TarjetaReto({ reto }: { reto: RetoConProgreso }) {
  const porcentaje =
    reto.progreso_total > 0
      ? Math.min(100, Math.round((reto.progreso_actual / reto.progreso_total) * 100))
      : 0;

  return (
    <View style={[styles.tarjeta, reto.completado && styles.tarjetaCompletada]}>
      <View style={styles.filaEncabezadoTarjeta}>
        <View style={styles.circuloIcono}>
          <Text style={styles.icono}>{reto.icono ?? "🏆"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nombre}>{reto.nombre}</Text>
          <Text style={styles.descripcion}>{reto.descripcion}</Text>
        </View>
        {reto.completado && <Text style={styles.check}>✓</Text>}
      </View>

      <View style={styles.progresoFondo}>
        <View
          style={[
            styles.progresoBarra,
            {
              width: `${porcentaje}%`,
              backgroundColor: reto.completado ? "#2E7D32" : "#3B6FA0",
            },
          ]}
        />
      </View>
      <View style={styles.filaProgresoTexto}>
        <Text style={styles.progresoTexto}>
          {reto.progreso_actual} / {reto.progreso_total}
        </Text>
        <Text style={styles.recompensaTexto}>
          +{reto.recompensa_puntos} pts{reto.recompensa_insignia_id ? " + insignia" : ""}
        </Text>
      </View>
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

  lista: { paddingHorizontal: 16, paddingBottom: 24 },
  tarjeta: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tarjetaCompletada: { backgroundColor: "#F1F8F1" },
  filaEncabezadoTarjeta: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  circuloIcono: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EAF2FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  icono: { fontSize: 22 },
  nombre: { fontSize: 15.5, fontWeight: "700", color: "#1A2A3A" },
  descripcion: { fontSize: 12.5, color: "#8A8A8A", marginTop: 2 },
  check: { fontSize: 20, color: "#2E7D32", fontWeight: "bold", marginLeft: 8 },
  progresoFondo: {
    height: 8,
    borderRadius: 5,
    backgroundColor: "#E9ECEF",
    overflow: "hidden",
  },
  progresoBarra: { height: 8, borderRadius: 5 },
  filaProgresoTexto: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  progresoTexto: { fontSize: 12, color: "#666", fontWeight: "600" },
  recompensaTexto: { fontSize: 12, color: "#3B6FA0", fontWeight: "600" },
  textoError: { color: "#D32F2F", textAlign: "center", paddingHorizontal: 24 },
});