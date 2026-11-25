import FormularioResena from "@/components/FormularioResena";
import { EstrellasFijas } from "@/components/foro/Estrellas";
import { COLORES, useTema } from "@/contexts/ThemeContext";
import { verificarYDesbloquearInsignias } from "@/hooks/use-insignias";
import { avisar, confirmar } from "@/lib/confirmar";
import {
  ComentarioPublico,
  editarComentario,
  editarResena,
  eliminarComentario,
  eliminarResena,
  MiCalificacion,
  obtenerComentariosHito,
  obtenerMiCalificacion,
  obtenerResenasHitoPagina,
  obtenerResumenCalificacion,
  publicarComentario,
  publicarResena,
  ResenaPublica,
  ResumenCalificacion,
} from "@/lib/foro";
import {
  agruparPorResena,
  avisoComentariosAlEliminar,
  fechaForo,
  textoValoraciones,
} from "@/lib/foro-datos";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/* ---------------------------------------------------------------------------
 * Reseñas y comentarios de un hito (HU-018) con calificación (HU-019)
 * - Cualquiera (también invitados) ve reseñas, comentarios y el promedio.
 * - Con sesión: escribir reseña (S3-9), comentar, y editar o eliminar lo propio.
 * - Validación de 10–500 caracteres en FormularioResena y en el servidor (S3-10).
 * - Calificación opcional de 1 a 5 estrellas, una por usuario e hito (índice
 *   único en la BD). Las respuestas no llevan calificación.
 * - Se cargan 2 reseñas y luego de 5 en 5 ("Ver más reseñas"); en cada
 *   reseña se ve la primera respuesta y el resto se despliega.
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

const PRIMERA_PAGINA = 2;
const TAMANO_PAGINA = 5;

async function cargarForo(hitoId: string, cantidad = PRIMERA_PAGINA) {
  // Las reseñas son lo principal: si fallan comentarios, promedio o la
  // calificación propia, las reseñas se muestran igual
  const [pagina, comentarios, resumen, miCalificacion] = await Promise.allSettled([
    obtenerResenasHitoPagina(hitoId, 0, cantidad - 1),
    obtenerComentariosHito(hitoId),
    obtenerResumenCalificacion(hitoId),
    obtenerMiCalificacion(hitoId),
  ]);
  if (pagina.status === "rejected") throw pagina.reason;
  if (comentarios.status === "rejected") {
    console.error("Error cargando comentarios:", comentarios.reason);
  }
  if (resumen.status === "rejected") console.error("Error cargando calificaciones:", resumen.reason);
  if (miCalificacion.status === "rejected") {
    console.error("Error cargando tu calificación:", miCalificacion.reason);
  }
  return {
    resenas: pagina.value.resenas,
    total: pagina.value.total,
    comentarios: comentarios.status === "fulfilled" ? agruparPorResena(comentarios.value) : {},
    errorComentarios: comentarios.status === "rejected",
    resumen: resumen.status === "fulfilled" ? resumen.value : null,
    miCalificacion: miCalificacion.status === "fulfilled" ? miCalificacion.value : null,
  };
}

// Qué muestra el formulario sobre las estrellas (solo en reseñas)
function calificacionFormulario(
  formulario: Formulario,
  mia: MiCalificacion | null,
): { modo: "editable" | "fija"; valor: number | null } | undefined {
  switch (formulario.tipo) {
    case "resena":
      return mia ? { modo: "fija", valor: mia.valor } : { modo: "editable", valor: null };
    case "editarResena": {
      const { resena } = formulario;
      // La calificación del hito está en otra reseña: aquí no se puede calificar
      if (mia && mia.id !== resena.id) return { modo: "fija", valor: mia.valor };
      return { modo: "editable", valor: mia?.id === resena.id ? mia.valor : (resena.calificacion ?? null) };
    }
    default:
      return undefined;
  }
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

type TextosFormulario = {
  titulo: string;
  subtitulo: string;
  textoInicial: string;
  textoBoton: string;
  placeholder: string | undefined;
};

const PLACEHOLDER_COMENTARIO = "Escribe tu comentario...";

// Textos del formulario según lo que se está escribiendo o editando
function textosFormulario(formulario: Formulario, nombreHito: string): TextosFormulario {
  switch (formulario.tipo) {
    case "resena":
      return {
        titulo: "Escribir reseña",
        subtitulo: nombreHito,
        textoInicial: "",
        textoBoton: "Publicar",
        placeholder: undefined,
      };
    case "editarResena":
      return {
        titulo: "Editar reseña",
        subtitulo: nombreHito,
        textoInicial: formulario.resena.contenido,
        textoBoton: "Guardar cambios",
        placeholder: undefined,
      };
    case "comentario":
      return {
        titulo: "Comentar reseña",
        subtitulo: `Respuesta a ${formulario.resena.autor}`,
        textoInicial: "",
        textoBoton: "Publicar",
        placeholder: PLACEHOLDER_COMENTARIO,
      };
    case "editarComentario":
      return {
        titulo: "Editar comentario",
        subtitulo: nombreHito,
        textoInicial: formulario.comentario.contenido,
        textoBoton: "Guardar cambios",
        placeholder: PLACEHOLDER_COMENTARIO,
      };
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
  // Total de reseñas del hito (no solo las cargadas)
  const [totalResenas, setTotalResenas] = useState(0);
  const [comentarios, setComentarios] = useState<Record<string, ComentarioPublico[]>>({});
  const [resumen, setResumen] = useState<ResumenCalificacion | null>(null);
  const [miCalificacion, setMiCalificacion] = useState<MiCalificacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(false);
  const [errorComentarios, setErrorComentarios] = useState(false);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  // Reseñas con todas sus respuestas desplegadas
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  // Publicación que se está eliminando (evita dobles toques)
  const [eliminando, setEliminando] = useState<string | null>(null);

  function aplicar(datos: Awaited<ReturnType<typeof cargarForo>>) {
    setResenas(datos.resenas);
    setTotalResenas(datos.total);
    setComentarios(datos.comentarios);
    setErrorComentarios(datos.errorComentarios);
    setResumen(datos.resumen);
    setMiCalificacion(datos.miCalificacion);
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

  // Recarga al reintentar o después de publicar, editar o eliminar.
  // Mantiene la cantidad de reseñas que ya se habían cargado con "Ver más".
  async function recargar(mostrarCarga = false) {
    if (mostrarCarga) setCargando(true);
    setError(false);
    try {
      aplicar(await cargarForo(hitoId, Math.max(resenas.length, PRIMERA_PAGINA)));
    } catch (e) {
      console.error("Error cargando reseñas:", e);
      setError(true);
    } finally {
      setCargando(false);
    }
  }

  async function verMas() {
    if (cargandoMas) return;
    setCargandoMas(true);
    try {
      const desde = resenas.length;
      const pagina = await obtenerResenasHitoPagina(hitoId, desde, desde + TAMANO_PAGINA - 1);
      setResenas((actuales) => {
        // Evita duplicados si alguien publicó mientras tanto
        const ids = new Set(actuales.map((r) => r.id));
        return [...actuales, ...pagina.resenas.filter((r) => !ids.has(r.id))];
      });
      setTotalResenas(pagina.total);
    } catch (e) {
      console.error("Error cargando más reseñas:", e);
      onAviso("No se pudieron cargar más reseñas");
    } finally {
      setCargandoMas(false);
    }
  }

  function alternarRespuestas(resenaId: string) {
    setExpandidas((actuales) => {
      const nuevas = new Set(actuales);
      if (nuevas.has(resenaId)) nuevas.delete(resenaId);
      else nuevas.add(resenaId);
      return nuevas;
    });
  }

  async function abrir(nuevo: Formulario, accion: string) {
    if (await exigirSesion(accion)) setFormulario(nuevo);
  }

  async function guardar(texto: string, calificacion?: number | null) {
    if (!formulario) return;
    const { data } = await supabase.auth.getUser();
    let mensaje = "";
    let esNueva = false;

    switch (formulario.tipo) {
      case "resena":
        await publicarResena(hitoId, texto, calificacion ?? null);
        mensaje = "Tu reseña se publicó";
        esNueva = true;
        break;
      case "editarResena": {
        // Solo se envía la calificación si cambió
        const inicial = calificacionFormulario(formulario, miCalificacion)?.valor ?? null;
        const cambio = calificacion !== undefined && calificacion !== inicial ? calificacion : undefined;
        await editarResena(formulario.resena.id, texto, cambio);
        mensaje = "Tu reseña se actualizó";
        break;
      }
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
    const expandida = expandidas.has(resena.id);
    const visibles = expandida ? lista : lista.slice(0, 1);
    const ocultas = lista.length - 1;
    return (
      <View key={resena.id} style={[styles.card, o?.card]}>
        <View style={styles.filaAutor}>
          <Text style={[styles.autor, o?.texto]} numberOfLines={1}>
            {resena.autor}
            {resena.es_mia ? " (tú)" : ""}
          </Text>
          {resena.calificacion != null && <EstrellasFijas valor={resena.calificacion} tamano={13} />}
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

        {visibles.length > 0 && (
          <View style={styles.listaComentarios}>{visibles.map(renderComentario)}</View>
        )}

        {ocultas > 0 && (
          <TouchableOpacity
            style={styles.botonRespuestas}
            onPress={() => alternarRespuestas(resena.id)}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandida }}
            hitSlop={6}
          >
            <Text style={[styles.textoRespuestas, o?.textoSecundario]}>
              {expandida ? "Ocultar respuestas" : `Ver respuestas (${ocultas})`}
            </Text>
          </TouchableOpacity>
        )}

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

  // Cargando, error, sin reseñas o la lista de reseñas
  function renderContenido() {
    if (cargando) {
      return <ActivityIndicator color={colores.acento} style={{ marginVertical: 20 }} />;
    }

    if (error) {
      return (
        <View style={[styles.card, o?.card]}>
          <Text style={[styles.textoVacio, o?.textoSecundario]}>No se pudieron cargar las reseñas.</Text>
          <TouchableOpacity onPress={() => recargar(true)}>
            <Text style={[styles.reintentar, { color: colores.acento }]}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (resenas.length === 0) {
      return (
        <View style={[styles.card, o?.card]}>
          <Text style={[styles.textoVacio, o?.textoSecundario]}>
            Todavía no hay reseñas. ¡Sé el primero en compartir tu experiencia!
          </Text>
        </View>
      );
    }

    const restantes = totalResenas - resenas.length;

    return (
      <>
        {renderResumen()}
        {errorComentarios && (
          <Text style={[styles.avisoComentarios, o?.textoSecundario]}>No se pudieron cargar los comentarios.</Text>
        )}
        {resenas.map(renderResena)}

        {restantes > 0 && (
          <TouchableOpacity
            style={[styles.botonVerMas, { borderColor: esOscuro ? colores.borde : "#D5DEE8" }]}
            onPress={verMas}
            disabled={cargandoMas}
            accessibilityRole="button"
          >
            {cargandoMas ? (
              <ActivityIndicator size="small" color={colores.acento} />
            ) : (
              <Text style={[styles.textoVerMas, { color: colores.acento }]}>
                Ver más reseñas ({restantes} {restantes === 1 ? "restante" : "restantes"})
              </Text>
            )}
          </TouchableOpacity>
        )}
      </>
    );
  }

  // Promedio de las calificaciones (solo si hay alguna)
  function renderResumen() {
    if (!resumen || resumen.total === 0) return null;
    return (
      <View
        style={[styles.card, styles.resumen, o?.card]}
        accessible
        accessibilityLabel={`Calificación promedio ${resumen.promedio.toFixed(1).replace(".", ",")} de 5, ${textoValoraciones(resumen.total)}`}
      >
        <Text style={[styles.promedio, o?.texto]}>{resumen.promedio.toFixed(1)}</Text>
        <View style={[styles.separador, { backgroundColor: esOscuro ? colores.borde : "#E0E0E0" }]} />
        <View style={styles.resumenDetalle}>
          <EstrellasFijas valor={resumen.promedio} tamano={20} />
          <Text style={[styles.fecha, o?.textoSecundario]}>({textoValoraciones(resumen.total)})</Text>
        </View>
      </View>
    );
  }

  const textos = formulario ? textosFormulario(formulario, nombreHito) : null;
  const tituloTotal = totalResenas > 0 ? ` (${totalResenas})` : "";

  return (
    <View>
      <View style={styles.encabezado}>
        <Text style={[styles.titulo, o?.texto]}>
          Reseñas{tituloTotal}
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

      {renderContenido()}

      {textos && (
        <FormularioResena
          titulo={textos.titulo}
          subtitulo={textos.subtitulo}
          textoInicial={textos.textoInicial}
          textoBoton={textos.textoBoton}
          placeholder={textos.placeholder}
          calificacion={formulario ? calificacionFormulario(formulario, miCalificacion) : undefined}
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
  botonRespuestas: { alignSelf: "flex-start", marginTop: 8, marginLeft: 16, paddingVertical: 4 },
  textoRespuestas: { fontSize: 12.5, fontWeight: "600", color: "#666" },
  resumen: { flexDirection: "row", alignItems: "center", gap: 16 },
  promedio: { fontSize: 36, fontWeight: "bold", color: "#222", fontVariant: ["tabular-nums"] },
  separador: { width: 1, alignSelf: "stretch" },
  resumenDetalle: { gap: 4 },
  botonVerMas: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  textoVerMas: { fontWeight: "600", fontSize: 13.5 },
  textoVacio: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20 },
  avisoComentarios: { fontSize: 12.5, color: "#777", marginTop: 10 },
  reintentar: { fontWeight: "600", textAlign: "center", marginTop: 10 },
});
