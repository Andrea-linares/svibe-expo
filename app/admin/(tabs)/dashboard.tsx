import AdminHeader from "@/components/admin/admin-header";
import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function AdminDashboardScreen() {
  const { colores } = useTema();
  const [cargando, setCargando] = useState(true);
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [totalHitos, setTotalHitos] = useState(0);
  const [totalReportes, setTotalReportes] = useState(0);
  const [totalEventos, setTotalEventos] = useState(0);

  useFocusEffect(
    useCallback(() => {
      async function cargar() {
        const [usuarios, hitos, reportes, eventos] = await Promise.all([
          supabase.from("perfiles").select("*", { count: "exact", head: true }),
          supabase.from("hitos").select("*", { count: "exact", head: true }),
          supabase
            .from("reportes_problemas")
            .select("*", { count: "exact", head: true }),
          supabase.from("eventos").select("*", { count: "exact", head: true }),
        ]);

        setTotalUsuarios(usuarios.count ?? 0);
        setTotalHitos(hitos.count ?? 0);
        setTotalReportes(reportes.count ?? 0);
        setTotalEventos(eventos.count ?? 0);
        setCargando(false);
      }
      cargar();
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

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <AdminHeader titulo="Hola, Admin" subtitulo="Resumen general de la app" />

      <View style={styles.cuerpo}>
        <View style={styles.grid}>
          <TarjetaResumen
            icono="people"
            colorIcono="#3B6FA0"
            fondoIcono="#E3EEF8"
            numero={totalUsuarios}
            etiqueta="Usuarios totales"
            colores={colores}
            onPress={() => router.push("/admin/usuarios")}
          />
          <TarjetaResumen
            icono="star"
            colorIcono="#D9A62A"
            fondoIcono="#FBF2DD"
            numero={totalHitos}
            etiqueta="Hitos culturales"
            colores={colores}
            onPress={() => router.push("/admin/hitos")}
          />
          <TarjetaResumen
            icono="alert-circle"
            colorIcono="#D9587A"
            fondoIcono="#FCEBEE"
            numero={totalReportes}
            etiqueta="Reportes de problemas"
            colores={colores}
            onPress={() => router.push("/admin/reportes")}
          />
          <TarjetaResumen
            icono="calendar"
            colorIcono="#3B9FD9"
            fondoIcono="#E3F2FB"
            numero={totalEventos}
            etiqueta="Eventos próximos"
            colores={colores}
            onPress={() => router.push("/admin/eventos")}
          />
        </View>

        <TouchableOpacity
          style={[styles.filaAcceso, { backgroundColor: colores.tarjeta }]}
          onPress={() => router.push("/admin/hito-formulario")}
        >
          <View style={[styles.iconoAcceso, { backgroundColor: "#E3EEF8" }]}>
            <Ionicons name="add-circle-outline" size={20} color="#3B6FA0" />
          </View>
          <Text style={[styles.textoAcceso, { color: colores.texto }]}>
            Agregar nuevo hito
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#C4C4C4" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botonCerrarSesion}
          onPress={cerrarSesion}
        >
          <Ionicons name="log-out-outline" size={18} color="#D32F2F" />
          <Text style={styles.textoBotonCerrarSesion}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      {/* Botón flotante: Ver como usuario */}
      <TouchableOpacity
        style={styles.botonFlotante}
        onPress={() => router.push("/(tabs)/home")}
      >
        <Ionicons name="eye-outline" size={18} color="#fff" />
        <Text style={styles.textoBotonFlotante}>Ver como usuario</Text>
      </TouchableOpacity>
    </View>
  );
}

function TarjetaResumen({
  icono,
  colorIcono,
  fondoIcono,
  numero,
  etiqueta,
  colores,
  onPress,
}: {
  icono: any;
  colorIcono: string;
  fondoIcono: string;
  numero: number;
  etiqueta: string;
  colores: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tarjeta, { backgroundColor: colores.tarjeta }]}
      onPress={onPress}
    >
      <View style={[styles.circuloIcono, { backgroundColor: fondoIcono }]}>
        <Ionicons name={icono} size={20} color={colorIcono} />
      </View>
      <Text style={[styles.numero, { color: colores.texto }]}>{numero}</Text>
      <Text style={[styles.etiqueta, { color: colores.textoSecundario }]}>
        {etiqueta}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  cuerpo: { flex: 1, paddingHorizontal: 20, paddingBottom: 100 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  tarjeta: {
    width: "47.5%",
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    marginBottom: 12,
  },
  circuloIcono: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  numero: { fontSize: 24, fontWeight: "bold" },
  etiqueta: { fontSize: 12.5, marginTop: 2 },
  filaAcceso: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    elevation: 2,
    gap: 12,
  },
  iconoAcceso: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  textoAcceso: { flex: 1, fontSize: 15, fontWeight: "600" },
  botonCerrarSesion: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: "#FDEAEA",
    gap: 8,
  },
  textoBotonCerrarSesion: {
    color: "#D32F2F",
    fontWeight: "600",
    fontSize: 15,
  },
  botonFlotante: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#3B6FA0",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 26,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  textoBotonFlotante: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
