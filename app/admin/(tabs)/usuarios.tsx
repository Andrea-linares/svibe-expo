import AdminHeader from "@/components/admin/admin-header";
import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Usuario = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  rol: string;
  fecha_registro: string;
};

type Filtro = "todos" | "administradores" | "usuarios";

export default function AdminUsuariosScreen() {
  const { colores } = useTema();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  useFocusEffect(
    useCallback(() => {
      async function cargar() {
        const { data } = await supabase
          .from("perfiles")
          .select("id, nombre, apellido, rol, fecha_registro")
          .order("fecha_registro", { ascending: false });
        setUsuarios(data ?? []);
        setCargando(false);
      }
      cargar();
    }, []),
  );

  const totalAdmins = useMemo(
    () => usuarios.filter((u) => u.rol === "administrador").length,
    [usuarios],
  );

  const usuariosFiltrados = useMemo(() => {
    let lista = usuarios;
    if (filtro === "administradores")
      lista = lista.filter((u) => u.rol === "administrador");
    if (filtro === "usuarios")
      lista = lista.filter((u) => u.rol !== "administrador");
    if (busqueda.trim()) {
      const texto = busqueda.trim().toLowerCase();
      lista = lista.filter(
        (u) =>
          u.nombre?.toLowerCase().includes(texto) ||
          u.apellido?.toLowerCase().includes(texto),
      );
    }
    return lista;
  }, [usuarios, filtro, busqueda]);

  function alternarRol(usuario: Usuario) {
    const nuevoRol =
      usuario.rol === "administrador" ? "usuario" : "administrador";

    Alert.alert(
      nuevoRol === "administrador"
        ? "Hacer administrador"
        : "Quitar administrador",
      `¿Confirmas este cambio para ${usuario.nombre ?? "este usuario"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            const { error } = await supabase
              .from("perfiles")
              .update({ rol: nuevoRol })
              .eq("id", usuario.id);

            if (error) {
              Alert.alert("Error", error.message);
              return;
            }

            setUsuarios((actual) =>
              actual.map((u) =>
                u.id === usuario.id ? { ...u, rol: nuevoRol } : u,
              ),
            );
          },
        },
      ],
    );
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
      <AdminHeader titulo="Usuarios" />

      {/* Tarjetas de estadísticas */}
      <View style={styles.filaEstadisticas}>
        <View
          style={[
            styles.tarjetaEstadistica,
            { backgroundColor: colores.tarjeta },
          ]}
        >
          <Text style={styles.numeroEstadistica}>{usuarios.length}</Text>
          <Text
            style={[
              styles.etiquetaEstadistica,
              { color: colores.textoSecundario },
            ]}
          >
            Usuarios totales
          </Text>
        </View>
        <View
          style={[
            styles.tarjetaEstadistica,
            { backgroundColor: colores.tarjeta },
          ]}
        >
          <Text style={[styles.numeroEstadistica, { color: "#D9A62A" }]}>
            {totalAdmins}
          </Text>
          <Text
            style={[
              styles.etiquetaEstadistica,
              { color: colores.textoSecundario },
            ]}
          >
            Administradores
          </Text>
        </View>
      </View>

      {/* Buscador */}
      <View
        style={[
          styles.buscador,
          { backgroundColor: colores.tarjeta, borderColor: colores.borde },
        ]}
      >
        <TextInput
          style={[styles.inputBuscador, { color: colores.texto }]}
          placeholder="Buscar usuario..."
          placeholderTextColor={colores.textoSecundario}
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {/* Pestañas de filtro */}
      <View style={styles.pestañas}>
        {(["todos", "administradores", "usuarios"] as Filtro[]).map(
          (opcion) => (
            <TouchableOpacity
              key={opcion}
              style={[
                styles.pestaña,
                filtro === opcion && styles.pestañaActiva,
              ]}
              onPress={() => setFiltro(opcion)}
            >
              <Text
                style={
                  filtro === opcion
                    ? styles.textoPestañaActiva
                    : styles.textoPestaña
                }
              >
                {opcion === "todos"
                  ? "Todos"
                  : opcion === "administradores"
                    ? "Admins"
                    : "Usuarios"}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </View>

      <FlatList
        data={usuariosFiltrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        renderItem={({ item }) => {
          const inicial = (item.nombre?.charAt(0) ?? "?").toUpperCase();
          const esAdmin = item.rol === "administrador";
          return (
            <View style={[styles.fila, { backgroundColor: colores.tarjeta }]}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: esAdmin ? "#3B6FA0" : "#B0BEC5" },
                ]}
              >
                <Text style={styles.avatarTexto}>{inicial}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.nombre, { color: colores.texto }]}>
                  {item.nombre ?? "Sin nombre"} {item.apellido ?? ""}
                </Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: esAdmin ? "#EAF2FA" : "#F0F0F0" },
                  ]}
                >
                  <Text
                    style={{
                      color: esAdmin ? "#3B6FA0" : "#666",
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    {esAdmin ? "Administrador" : "Usuario"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.botonOjo}
                onPress={() =>
                  router.push(`/admin/detalle-usuario?id=${item.id}`)
                }
              >
                <Ionicons name="eye-outline" size={20} color="#3B6FA0" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botonRol}
                onPress={() => alternarRol(item)}
              >
                <Text style={styles.textoBotonRol}>
                  {esAdmin ? "Quitar admin" : "Hacer admin"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text
            style={{
              textAlign: "center",
              color: colores.textoSecundario,
              marginTop: 40,
            }}
          >
            No se encontraron usuarios.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  filaEstadisticas: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  tarjetaEstadistica: { flex: 1, borderRadius: 14, padding: 14, elevation: 2 },
  numeroEstadistica: { fontSize: 22, fontWeight: "bold", color: "#3B6FA0" },
  etiquetaEstadistica: { fontSize: 12, marginTop: 2 },
  buscador: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 42,
    justifyContent: "center",
    marginBottom: 12,
  },
  inputBuscador: { fontSize: 14 },
  pestañas: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  pestaña: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  pestañaActiva: { backgroundColor: "#3B6FA0" },
  textoPestaña: { color: "#555", fontSize: 13, fontWeight: "600" },
  textoPestañaActiva: { color: "#fff", fontSize: 13, fontWeight: "600" },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 10,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarTexto: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  nombre: { fontSize: 15, fontWeight: "600" },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 5,
  },
  botonOjo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EAF2FA",
    justifyContent: "center",
    alignItems: "center",
  },
  botonRol: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
  },
  textoBotonRol: { fontSize: 12, fontWeight: "600", color: "#333" },
});
