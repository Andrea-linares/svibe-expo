import TarjetaLugar, { LugarTarjeta } from "@/components/TarjetaLugar";
import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function OcultoScreen() {
  const { colores } = useTema();
  const [lugares, setLugares] = useState<LugarTarjeta[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarOcultos() {
      const { data } = await supabase
        .from("hitos")
        .select("id, nombre, direccion_referencia, hito_imagenes(url, orden)")
        .eq("es_lugar_oculto", true) // <-- la única diferencia con home.tsx
        .order("nombre", { ascending: true });

      setLugares(data ?? []);
      setCargando(false);
    }
    cargarOcultos();
  }, []);

  if (cargando) {
    return (
      <View style={[styles.centrado, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator size="large" color={colores.acento} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.contenedor, { backgroundColor: colores.fondo }]}
      contentContainerStyle={styles.contenido}
    >
      <Text style={[styles.tituloSeccion, { color: colores.texto }]}>
        Lugares ocultos
      </Text>
      <Text style={[styles.subtitulo, { color: colores.textoSecundario }]}>
        Destinos poco conocidos para explorar
      </Text>

      {/* Una columna de ancho completo (mismo estilo que Inicio) */}
      <View style={styles.listaLugares}>
        {lugares.map((hito) => (
          <TarjetaLugar key={hito.id} hito={hito} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  contenido: { paddingBottom: 40 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  tituloSeccion: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 55,
    marginHorizontal: 16,
  },
  subtitulo: {
    fontSize: 14,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  listaLugares: {
    paddingHorizontal: 20,
    gap: 16,
  },
});
