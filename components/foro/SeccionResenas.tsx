import FormularioResena from "@/components/FormularioResena";
import { COLORES, useTema } from "@/contexts/ThemeContext";
import { verificarYDesbloquearInsignias } from "@/hooks/use-insignias";
import { avisar, confirmar } from "@/lib/confirmar";
import {
  ComentarioPublico,
  editarComentario,
  editarResena,
  eliminarComentario,
  eliminarResena,
  obtenerComentariosHito,
  obtenerResenasHito,
  publicarComentario,
  publicarResena,
  ResenaPublica,
} from "@/lib/foro";
import { agruparPorResena, avisoComentariosAlEliminar, fechaForo } from "@/lib/foro-datos";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/* ---------------------------------------------------------------------------
 * Reseñas y comentarios de un hito (HU-018)
 * - Cualquiera (también invitados) ve reseñas y comentarios.
 * - Con sesión: escribir reseña (S3-9), comentar, y editar o eliminar lo propio.
 * - Validación de 10–500 caracteres en FormularioResena y en el servidor (S3-10).
 * Colores fijos en modo claro; en modo oscuro se usa la paleta de useTema,
 * igual que el resto del detalle del hito.
 * ------------------------------------------------------------------------- */

// Fondo del botón "Escribir reseña" (texto blanco): igual en ambos modos
const ACENTO = "#3B6FA0";
const GRIS_ICONO = "#777";

function crearEstilosOscuros(colores: typeof COLORES.oscuro) {
  return StyleSheet.create({
    texto: { color: colores.texto },
    textoSecundario: { color: colores.textoSecundario },
    card: {
      backgroundColor: colores.tarjeta,
      borderWidth: 1,
      borderColor: colores.borde,
    },
    comentario: { borderLeftColor: colores.borde },
  });
}

type Formulario =
  | { tipo: "resena" }
  | { tipo: "editarResena"; resena: ResenaPublica }
  | { tipo: "comentario"; resena: ResenaPublica }
  | { tipo: "editarComentario"; comentario: ComentarioPublico };

type Props = {
  hitoId: string;
  nombreHito: string;
  // Aviso breve (Toast) que muestra la pantalla
  onAviso: (mensaje: string) => void;
};

async function cargarForo(hitoId: string) {
  // Las reseñas son lo principal: si fallan los comentarios, se muestran igual
  const [resenas, comentarios] = await Promise.allSettled([
    obtenerResenasHito(hitoId),
    obtenerComentariosHito(hitoId),
  ]);
  if (resenas.status === "rejected") throw resenas.reason;
  if (comentarios.status === "rejected") {
    console.error("Error cargando comentarios:", comentarios.reason);
  }
  return {
    resenas: resenas.value,
    comentarios: comentarios.status === "fulfilled" ? agruparPorResena(comentarios.value) : {},
    errorComentarios: comentarios.status === "rejected",
  };
}

// Mismo aviso que favoritos cuando no hay sesión; devuelve el id del usuario o null
async function exigirSesion(accion: string) {
  const { data } = await supabase.auth.getUser();
  if (data?.user) return data.user.id;
  confirmar({
    titulo: "Inicia sesión",
    mensaje: `Necesitas una cuenta para ${accion}.`,
    textoConfirmar: "Iniciar sesión",
    textoCancelar: "Ahora no",
    destructivo: false,
    onConfirmar: () => router.push("/login"),
  });
  return null;
}

// Tras publicar, revisa si se desbloqueó alguna insignia del foro
async function revisarInsignias(usuarioId: string) {
  try {
    const nuevas = await verificarYDesbloquearInsignias(usuarioId);
    if (nuevas.length > 0) {
      avisar(
        "¡Nueva insignia desbloqueada! 🎉",
        nuevas.map((i) => `${i.icono ?? "🏅"} ${i.nombre}`).join("\n"),
      );
    }
  } catch (error) {
    console.error("Error revisando insignias:", error);
  }
}

function BotonIcono({
  icono,
  color,
  etiqueta,
  cargando,
  deshabilitado,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  color: string;
  etiqueta: string;
  cargando?: boolean;
  deshabilitado?: boolean;
  onPress: () => void;
}) {
  if (cargando) return <ActivityIndicator size="small" color={color} style={styles.botonIcono} />;
  return (
    <TouchableOpacity
      style={styles.botonIcono}
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityLabel={etiqueta}
      hitSlop={6}
    >
      <Ionicons name={icono} size={17} color={color} />
    </TouchableOpacity>
  );
}

export default function SeccionResenas({ hitoId, nombreHito, onAviso }: Props) {
  const { colores, esOscuro } = useTema();
  const o = esOscuro ? crearEstilosOscuros(colores) : null;
  const colorIcono = esOscuro ? colores.textoSecundario : GRIS_ICONO;

  const [resenas, setResenas] = useState<ResenaPublica[]>([]);
  const [comentarios, setComentarios] = useState<Record<string, ComentarioPublico[]>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [errorComentarios, setErrorComentarios] = useState(false);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  // Publicación que se está eliminando (evita dobles toques)
  const [eliminando, setEliminando] = useState<string | null>(null);

  function aplicar(datos: Awaited<ReturnType<typeof cargarForo>>) {
    setResenas(datos.resenas);
    setComentarios(datos.comentarios);
    setErrorComentarios(datos.errorComentarios);
  }

  // Carga inicial (mismo patrón que el próximo evento del hito)
  useEffect(() => {
    let cancelado = false;
    cargarForo(hitoId)
      .then((datos) => {
        if (!cancelado) aplicar(datos);
      })
      .catch((e) => {
        console.error("Error cargando reseñas:", e);
        if (!cancelado) setError(true);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [hitoId]);

  // Recarga al reintentar o después de publicar, editar o eliminar
  async function recargar(mostrarCarga = false) {
    if (mostrarCarga) setCargando(true);
    setError(false);
    try {
      aplicar(await cargarForo(hitoId));
    } catch (e) {
      console.error("Error cargando reseñas:", e);
      setError(true);
    } finally {
      setCargando(false);
    }
  }

  async function abrir(nuevo: Formulario, accion: string) {
    if (await exigirSesion(accion)) setFormulario(nuevo);
  }

  async function guardar(texto: string) {
    if (!formulario) return;
    const { data } = await supabase.auth.getUser();
    let mensaje = "";
    let esNueva = false;

    switch (formulario.tipo) {
      case "resena":
        await publicarResena(hitoId, texto);
        mensaje = "Tu reseña se publicó";
        esNueva = true;
        break;
      case "editarResena":
        await editarResena(formulario.resena.id, texto);
        mensaje = "Tu reseña se actualizó";
        break;
      case "comentario":
        await publicarComentario(formulario.resena.id, texto);
        mensaje = "Tu comentario se publicó";
        esNueva = true;
        break;
      case "editarComentario":
        await editarComentario(formulario.comentario.id, texto);
        mensaje = "Tu comentario se actualizó";
        break;
    }

    setFormulario(null);
    onAviso(mensaje);
    await recargar();
    if (esNueva && data?.user) revisarInsignias(data.user.id);
  }

  function eliminar(id: string, titulo: string, mensaje: string, accion: () => Promise<void>, aviso: string) {
    confirmar({
      titulo,
      mensaje,
      onConfirmar: async () => {
        setEliminando(id);
        try {
          await accion();
          onAviso(aviso);
          await recargar();
        } catch (e: any) {
          avisar("No se pudo eliminar", e?.message ?? "Inténtalo de nuevo.");
        } finally {
          setEliminando(null);
        }
      },
    });
  }

  function confirmarEliminarResena(resena: ResenaPublica) {
    const extra = avisoComentariosAlEliminar(comentarios[resena.id]?.length ?? 0);
    eliminar(
      resena.id,
      "Eliminar reseña",
      `¿Seguro que quieres eliminar tu reseña?${extra} Esta acción no se puede deshacer.`,
      () => eliminarResena(resena.id),
      "Tu reseña se eliminó",
    );
  }

  function confirmarEliminarComentario(comentario: ComentarioPublico) {
    eliminar(
      comentario.id,
      "Eliminar comentario",
      "¿Seguro que quieres eliminar tu comentario? Esta acción no se puede deshacer.",
      () => eliminarComentario(comentario.id),
      "Tu comentario se eliminó",
    );
  }

  const ocupado = eliminando !== null;

  function renderComentario(comentario: ComentarioPublico) {
    return (
      <View key={comentario.id} style={[styles.comentario, o?.comentario]}>
        <View style={styles.filaAutor}>
          <Text style={[styles.autorComentario, o?.texto]} numberOfLines={1}>
            {comentario.autor}
            {comentario.es_mio ? " (tú)" : ""}
          </Text>
          <Text style={[styles.fecha, o?.textoSecundario]}>
            {fechaForo(comentario.creado_en, comentario.editado_en)}
          </Text>
          {comentario.es_mio && (
            <>
              <BotonIcono
                icono="pencil-outline"
                color={colorIcono}
                etiqueta="Editar comentario"
                deshabilitado={ocupado}
                onPress={() => setFormulario({ tipo: "editarComentario", comentario })}
              />
              <BotonIcono
                icono="trash-outline"
                color={colores.peligro}
                etiqueta="Eliminar comentario"
                cargando={eliminando === comentario.id}
                deshabilitado={ocupado}
                onPress={() => confirmarEliminarComentario(comentario)}
              />
            </>
          )}
        </View>
        <Text style={[styles.textoComentario, o?.textoSecundario]}>{comentario.contenido}</Text>
      </View>
    );
  }

  function renderResena(resena: ResenaPublica) {
    const lista = comentarios[resena.id] ?? [];
    return (
      <View key={resena.id} style={[styles.card, o?.card]}>
        <View style={styles.filaAutor}>
          <Text style={[styles.autor, o?.texto]} numberOfLines={1}>
            {resena.autor}
            {resena.es_mia ? " (tú)" : ""}
          </Text>
          <Text style={[styles.fecha, o?.textoSecundario]}>
            {fechaForo(resena.creado_en, resena.editado_en)}
          </Text>
          {resena.es_mia && (
            <>
              <BotonIcono
                icono="pencil-outline"
                color={colorIcono}
                etiqueta="Editar reseña"
                deshabilitado={ocupado}
                onPress={() => setFormulario({ tipo: "editarResena", resena })}
              />
              <BotonIcono
                icono="trash-outline"
                color={colores.peligro}
                etiqueta="Eliminar reseña"
                cargando={eliminando === resena.id}
                deshabilitado={ocupado}
                onPress={() => confirmarEliminarResena(resena)}
              />
            </>
          )}
        </View>
        <Text style={[styles.texto, o?.texto]}>{resena.contenido}</Text>

        {lista.length > 0 && <View style={styles.listaComentarios}>{lista.map(renderComentario)}</View>}

        <TouchableOpacity
          style={styles.botonComentar}
          onPress={() => abrir({ tipo: "comentario", resena }, "comentar")}
          disabled={ocupado}
        >
          <Ionicons name="chatbubble-outline" size={15} color={colores.acento} />
          <Text style={[styles.textoComentar, { color: colores.acento }]}>
            Comentar{lista.length > 0 ? ` · ${lista.length}` : ""}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  let contenido;
  if (cargando) {
    contenido = <ActivityIndicator color="#5B8DB8" style={{ marginVertical: 20 }} />;
  } else if (error) {
    contenido = (
      <View style={[styles.card, o?.card]}>
        <Text style={[styles.textoVacio, o?.textoSecundario]}>No se pudieron cargar las reseñas.</Text>
        <TouchableOpacity onPress={() => recargar(true)}>
          <Text style={[styles.reintentar, { color: colores.acento }]}>Intentar de nuevo</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (resenas.length === 0) {
    contenido = (
      <View style={[styles.card, o?.card]}>
        <Text style={[styles.textoVacio, o?.textoSecundario]}>
          Todavía no hay reseñas. ¡Sé el primero en compartir tu experiencia!
        </Text>
      </View>
    );
  } else {
    contenido = (
      <>
        {errorComentarios && (
          <Text style={[styles.avisoComentarios, o?.textoSecundario]}>No se pudieron cargar los comentarios.</Text>
        )}
        {resenas.map(renderResena)}
      </>
    );
  }

  return (
    <View>
      <View style={styles.encabezado}>
        <Text style={[styles.titulo, o?.texto]}>
          Reseñas{resenas.length > 0 ? ` (${resenas.length})` : ""}
        </Text>
        <TouchableOpacity
          style={styles.botonEscribir}
          onPress={() => abrir({ tipo: "resena" }, "escribir reseñas")}
          accessibilityRole="button"
        >
          <Ionicons name="create-outline" size={17} color="#fff" />
          <Text style={styles.textoBotonEscribir}>Escribir reseña</Text>
        </TouchableOpacity>
      </View>

      {contenido}

      {formulario && (
        <FormularioResena
          titulo={
            formulario.tipo === "resena"
              ? "Escribir reseña"
              : formulario.tipo === "editarResena"
                ? "Editar reseña"
                : formulario.tipo === "comentario"
                  ? "Comentar reseña"
                  : "Editar comentario"
          }
          subtitulo={
            formulario.tipo === "comentario" ? `Respuesta a ${formulario.resena.autor}` : nombreHito
          }
          textoInicial={
            formulario.tipo === "editarResena"
              ? formulario.resena.contenido
              : formulario.tipo === "editarComentario"
                ? formulario.comentario.contenido
                : ""
          }
          textoBoton={formulario.tipo.startsWith("editar") ? "Guardar cambios" : "Publicar"}
          placeholder={
            formulario.tipo === "comentario" || formulario.tipo === "editarComentario"
              ? "Escribe tu comentario..."
              : undefined
          }
          onGuardar={guardar}
          onCerrar={() => setFormulario(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  titulo: { fontSize: 20, fontWeight: "bold" },
  botonEscribir: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ACENTO,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  textoBotonEscribir: { color: "#fff", fontWeight: "600", fontSize: 13 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    elevation: 3,
  },
  filaAutor: { flexDirection: "row", alignItems: "center", gap: 6 },
  autor: { fontSize: 14, fontWeight: "bold", color: "#222", flexShrink: 1, marginRight: "auto" },
  autorComentario: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#333",
    flexShrink: 1,
    marginRight: "auto",
  },
  fecha: { fontSize: 12, color: "#777" },
  botonIcono: { paddingHorizontal: 4, paddingVertical: 2 },
  texto: { fontSize: 14.5, color: "#333", marginTop: 6, lineHeight: 20 },
  listaComentarios: { marginTop: 10, gap: 10 },
  comentario: {
    borderLeftWidth: 2,
    borderLeftColor: "#E0E0E0",
    paddingLeft: 10,
    marginLeft: 4,
  },
  textoComentario: { fontSize: 13.5, color: "#444", marginTop: 3, lineHeight: 19 },
  botonComentar: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 12,
    paddingVertical: 4,
  },
  textoComentar: { fontWeight: "600", fontSize: 13 },
  textoVacio: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20 },
  avisoComentarios: { fontSize: 12.5, color: "#777", marginTop: 10 },
  reintentar: { fontWeight: "600", textAlign: "center", marginTop: 10 },
});
