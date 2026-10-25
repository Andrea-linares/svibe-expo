import AccesoRestringido from "@/components/admin/acceso-restringido";
import AdminHeader from "@/components/admin/admin-header";
import { COLOR_ACENTO } from "@/constants/theme";
import { useTema } from "@/contexts/ThemeContext";
import { useEsAdmin } from "@/hooks/use-es-admin";
import { avisar, confirmar } from "@/lib/confirmar";
import { aFechaISO, formatearFechaCorta } from "@/lib/fechas";
import {
  ComentarioForo,
  eliminarComentario,
  eliminarResena,
  HitoForo,
  nombreAutor,
  obtenerForoAdmin,
  ResenaForo,
} from "@/lib/foro";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/* ---------------------------------------------------------------------------
 * Moderación del foro (admin)
 * Reseñas (foro_posts) y sus comentarios (foro_comentarios) agrupados por hito.
 * - Todos: todos los hitos, incluidos los que no tienen publicaciones.
 * - Con publicaciones: solo hitos con al menos una reseña.
 * ------------------------------------------------------------------------- */

type Filtro = "todos" | "con_publicaciones";

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "con_publicaciones", etiqueta: "Con publicaciones" },
];

const ROJO = "#D32F2F";

// Clave de cada hito en la lista (null = reseñas sin hito)
const claveHito = (hito: HitoForo) => hito.id ?? "sin-hito";

function fechaPublicacion(creadoEn: string | null) {
  return creadoEn ? formatearFechaCorta(aFechaISO(new Date(creadoEn))) : "";
}

function pluralizar(cantidad: number, singular: string, plural: string) {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

// Devuelve la reseña sin el comentario indicado
function quitarComentarioDeResena(resena: ResenaForo, comentarioId: string): ResenaForo {
  return {
    ...resena,
    comentarios: resena.comentarios.filter((c) => c.id !== comentarioId),
  };
}

// Devuelve el hito sin la reseña (o, si se indica comentarioId, sin ese
// comentario de la reseña) y con totalComentarios recalculado.
// Si la reseña no es de este hito, lo devuelve tal cual.
function quitarDeHito(hito: HitoForo, resenaId: string, comentarioId?: string): HitoForo {
  if (!hito.resenas.some((r) => r.id === resenaId)) return hito;

  const resenas = comentarioId
    ? hito.resenas.map((r) => (r.id === resenaId ? quitarComentarioDeResena(r, comentarioId) : r))
    : hito.resenas.filter((r) => r.id !== resenaId);

  return {
    ...hito,
    resenas,
    totalComentarios: resenas.reduce((suma, r) => suma + r.comentarios.length, 0),
  };
}

function BotonEliminar({
  id,
  eliminando,
  etiqueta,
  onPress,
}: {
  id: string;
  eliminando: string | null;
  etiqueta: string;
  onPress: () => void;
}) {
  return eliminando === id ? (
    <ActivityIndicator size="small" color={ROJO} style={styles.botonAccion} />
  ) : (
    <TouchableOpacity
      style={styles.botonAccion}
      onPress={onPress}
      disabled={eliminando !== null}
      accessibilityLabel={etiqueta}
    >
      <Ionicons name="trash-outline" size={18} color={ROJO} />
    </TouchableOpacity>
  );
}

export default function AdminForoScreen() {
  const estadoAdmin = useEsAdmin();
  const { colores } = useTema();

  const [hitos, setHitos] = useState<HitoForo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  // Publicación que se está eliminando (evita dobles toques)
  const [eliminando, setEliminando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setHitos(await obtenerForoAdmin());
    } catch (e: any) {
      console.error("Error cargando foro (admin):", e);
      setError(e?.message ?? "Inténtalo de nuevo.");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (estadoAdmin === "admin") cargar();
    }, [cargar, estadoAdmin]),
  );

  const hitosFiltrados = useMemo(
    () => (filtro === "todos" ? hitos : hitos.filter((h) => h.resenas.length > 0)),
    [hitos, filtro],
  );

  const totales = useMemo(
    () => ({
      resenas: hitos.reduce((suma, h) => suma + h.resenas.length, 0),
      comentarios: hitos.reduce((suma, h) => suma + h.totalComentarios, 0),
    }),
    [hitos],
  );

  function alternar(clave: string) {
    setAbiertos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });
  }

  // Quita la publicación de la lista sin recargar
  function quitarDeLista(resenaId: string, comentarioId?: string) {
    setHitos((actual) => actual.map((hito) => quitarDeHito(hito, resenaId, comentarioId)));
  }

  function confirmarEliminar(
    titulo: string,
    mensaje: string,
    id: string,
    eliminar: () => Promise<void>,
    alEliminar: () => void,
  ) {
    confirmar({
      titulo,
      mensaje,
      onConfirmar: async () => {
        setEliminando(id);
        try {
          await eliminar();
          alEliminar();
        } catch (e: any) {
          avisar("No se pudo eliminar", e?.message ?? "Inténtalo de nuevo.");
        } finally {
          setEliminando(null);
        }
      },
    });
  }

  function confirmarEliminarComentario(comentario: ComentarioForo) {
    confirmarEliminar(
      "Eliminar comentario",
      `¿Seguro que quieres eliminar el comentario de ${nombreAutor(comentario.autor)}? Dejará de mostrarse a los usuarios y no se puede deshacer.`,
      comentario.id,
      () => eliminarComentario(comentario.id),
      () => quitarDeLista(comentario.post_id, comentario.id),
    );
  }

  function confirmarEliminarResena(resena: ResenaForo) {
    const extra =
      resena.comentarios.length > 0
        ? ` También se eliminarán sus ${pluralizar(resena.comentarios.length, "comentario", "comentarios")}.`
        : "";
    confirmarEliminar(
      "Eliminar reseña",
      `¿Seguro que quieres eliminar la reseña de ${nombreAutor(resena.autor)}?${extra} Dejará de mostrarse a los usuarios y no se puede deshacer.`,
      resena.id,
      () => eliminarResena(resena.id),
      () => quitarDeLista(resena.id),
    );
  }

  if (estadoAdmin !== "admin") {
    return <AccesoRestringido verificando={estadoAdmin === "cargando"} />;
  }

  function renderResena(resena: ResenaForo) {
    return (
      <View key={resena.id} style={[styles.resena, { borderColor: colores.borde }]}>
        <View style={styles.filaPublicacion}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.autor, { color: colores.texto }]}>
              {nombreAutor(resena.autor)}
              <Text style={[styles.fecha, { color: colores.textoSecundario }]}>
                {"  "}
                {fechaPublicacion(resena.creado_en)}
              </Text>
            </Text>
            <Text style={[styles.contenido, { color: colores.texto }]}>{resena.contenido}</Text>
          </View>
          <BotonEliminar
            id={resena.id}
            eliminando={eliminando}
            etiqueta="Eliminar reseña"
            onPress={() => confirmarEliminarResena(resena)}
          />
        </View>

        {resena.comentarios.length === 0 ? (
          <Text style={[styles.sinComentarios, { color: colores.textoSecundario }]}>
            Sin comentarios
          </Text>
        ) : (
          resena.comentarios.map((comentario) => (
            <View
              key={comentario.id}
              style={[styles.comentario, styles.filaPublicacion, { borderLeftColor: colores.borde }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.autor, { color: colores.texto }]}>
                  {nombreAutor(comentario.autor)}
                  <Text style={[styles.fecha, { color: colores.textoSecundario }]}>
                    {"  "}
                    {fechaPublicacion(comentario.creado_en)}
                  </Text>
                </Text>
                <Text style={[styles.contenido, { color: colores.texto }]}>
                  {comentario.contenido}
                </Text>
              </View>
              <BotonEliminar
                id={comentario.id}
                eliminando={eliminando}
                etiqueta="Eliminar comentario"
                onPress={() => confirmarEliminarComentario(comentario)}
              />
            </View>
          ))
        )}
      </View>
    );
  }

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.panelFondo }]}>
      <AdminHeader
        titulo="Foro"
        subtitulo={`${pluralizar(totales.resenas, "reseña", "reseñas")} · ${pluralizar(totales.comentarios, "comentario", "comentarios")}`}
      />

      {/* Pestañas de filtro */}
      <View style={styles.pestañas}>
        {FILTROS.map((opcion) => (
          <TouchableOpacity
            key={opcion.valor}
            style={[styles.pestaña, filtro === opcion.valor && styles.pestañaActiva]}
            onPress={() => setFiltro(opcion.valor)}
          >
            <Text style={filtro === opcion.valor ? styles.textoPestañaActiva : styles.textoPestaña}>
              {opcion.etiqueta}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={COLOR_ACENTO} />
        </View>
      ) : error ? (
        <View style={styles.centrado}>
          <Text style={[styles.textoVacio, { color: colores.textoSecundario }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setCargando(true);
              cargar();
            }}
          >
            <Text style={styles.reintentar}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={hitosFiltrados}
          keyExtractor={claveHito}
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true);
                cargar();
              }}
            />
          }
          renderItem={({ item }) => {
            const clave = claveHito(item);
            const abierto = abiertos.has(clave);
            const sinPublicaciones = item.resenas.length === 0;
            return (
              <View style={[styles.tarjeta, { backgroundColor: colores.tarjeta }]}>
                <TouchableOpacity style={styles.encabezadoHito} onPress={() => alternar(clave)}>
                  <View style={styles.iconoHito}>
                    <Ionicons name="chatbubbles-outline" size={20} color={COLOR_ACENTO} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.nombre, { color: colores.texto }]} numberOfLines={1}>
                      {item.nombre}
                    </Text>
                    <Text style={[styles.secundario, { color: colores.textoSecundario }]}>
                      {sinPublicaciones
                        ? "Sin publicaciones"
                        : `${pluralizar(item.resenas.length, "reseña", "reseñas")} · ${pluralizar(item.totalComentarios, "comentario", "comentarios")}`}
                    </Text>
                  </View>
                  <Ionicons
                    name={abierto ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colores.textoSecundario}
                  />
                </TouchableOpacity>

                {abierto &&
                  (sinPublicaciones ? (
                    <Text style={[styles.mensajeVacio, { color: colores.textoSecundario }]}>
                      Este hito aún no tiene publicaciones.
                    </Text>
                  ) : (
                    <View style={styles.listaResenas}>{item.resenas.map(renderResena)}</View>
                  ))}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={[styles.textoVacio, { color: colores.textoSecundario, marginTop: 40 }]}>
              {filtro === "con_publicaciones"
                ? "Ningún hito tiene publicaciones todavía."
                : "No hay hitos registrados."}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
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
  pestañaActiva: { backgroundColor: COLOR_ACENTO },
  textoPestaña: { color: "#555", fontSize: 13, fontWeight: "600" },
  textoPestañaActiva: { color: "#fff", fontSize: 13, fontWeight: "600" },
  tarjeta: {
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    elevation: 2,
  },
  encabezadoHito: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconoHito: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#E3EEF8",
    justifyContent: "center",
    alignItems: "center",
  },
  nombre: { fontSize: 15, fontWeight: "600" },
  secundario: { fontSize: 12, marginTop: 2 },
  mensajeVacio: { fontSize: 13, textAlign: "center", paddingVertical: 14 },
  listaResenas: { marginTop: 10, gap: 10 },
  resena: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  filaPublicacion: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  autor: { fontSize: 13, fontWeight: "600" },
  fecha: { fontSize: 11, fontWeight: "400" },
  contenido: { fontSize: 14, marginTop: 3, lineHeight: 19 },
  sinComentarios: { fontSize: 12, marginTop: 6, marginLeft: 14, fontStyle: "italic" },
  comentario: { marginTop: 8, marginLeft: 6, paddingLeft: 10, borderLeftWidth: 2 },
  botonAccion: { padding: 6 },
  textoVacio: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  reintentar: { color: COLOR_ACENTO, fontWeight: "600", marginTop: 12 },
});
