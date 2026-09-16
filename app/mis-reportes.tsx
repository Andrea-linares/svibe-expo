import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTema } from '@/contexts/ThemeContext';

type Reporte = {
  id: string;
  tipo: string | null;
  descripcion: string;
  estado: string;
  creado_en: string;
  hitos: { nombre: string } | null;
};

const ETIQUETAS_TIPO: Record<string, string> = {
  sitio: 'Problema con un sitio',
  app: 'Problema con la app',
  cuenta: 'Problema con la cuenta',
  otro: 'Otro',
};

export default function MisReportesScreen() {
  const { colores } = useTema();
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);

  useFocusEffect(
    useCallback(() => {
      async function cargar() {
        const { data: sesion } = await supabase.auth.getUser();
        if (!sesion.user) {
          setCargando(false);
          return;
        }

        const { data } = await supabase
          .from('reportes_problemas')
          .select('id, tipo, descripcion, estado, creado_en, hitos(nombre)')
          .eq('usuario_id', sesion.user.id)
          .order('creado_en', { ascending: false });

        setReportes((data ?? []) as unknown as Reporte[]);
        setCargando(false);
      }
      cargar();
    }, [])
  );

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#3B6FA0" />
      </View>
    );
  }

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      <TouchableOpacity style={styles.botonAtras} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={colores.texto} />
      </TouchableOpacity>

      <Text style={[styles.titulo, { color: colores.texto }]}>Mis reportes</Text>

      <FlatList
        data={reportes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        renderItem={({ item }) => {
          const colorEstado =
            item.estado === 'pendiente' ? '#D9587A' : item.estado === 'revisando' ? '#D9A62A' : '#2E9E5B';
          const fondoEstado =
            item.estado === 'pendiente' ? '#FCEBEE' : item.estado === 'revisando' ? '#FBF2DD' : '#E3F5E9';

          return (
            <TouchableOpacity
              style={[styles.tarjeta, { backgroundColor: colores.tarjeta }]}
              onPress={() => router.push(`/reporte-detalle?id=${item.id}`)}
            >
              <View style={styles.filaTarjeta}>
                <Text style={[styles.tipo, { color: colores.textoSecundario }]}>
                  {ETIQUETAS_TIPO[item.tipo ?? 'otro']}
                </Text>
                <View style={[styles.badge, { backgroundColor: fondoEstado }]}>
                  <Text style={{ color: colorEstado, fontSize: 11, fontWeight: '700' }}>
                    {item.estado.charAt(0).toUpperCase() + item.estado.slice(1)}
                  </Text>
                </View>
              </View>

              {item.hitos?.nombre && (
                <Text style={[styles.lugar, { color: colores.textoSecundario }]}>📍 {item.hitos.nombre}</Text>
              )}

              <Text style={[styles.descripcion, { color: colores.texto }]} numberOfLines={2}>
                {item.descripcion}
              </Text>

              <Text style={[styles.fecha, { color: colores.textoSecundario }]}>
                {new Date(item.creado_en).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: colores.textoSecundario, marginTop: 40 }}>
            Todavía no has enviado ningún reporte.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  botonAtras: { marginTop: 55, marginLeft: 16, marginBottom: 4 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginHorizontal: 16, marginBottom: 14 },
  tarjeta: { borderRadius: 14, padding: 14, marginBottom: 12, elevation: 2 },
  filaTarjeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipo: { fontSize: 12, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  lugar: { fontSize: 12, marginTop: 6 },
  descripcion: { fontSize: 14, marginTop: 6, lineHeight: 19 },
  fecha: { fontSize: 11, marginTop: 8 },
});