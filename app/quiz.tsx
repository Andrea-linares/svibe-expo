import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Hito = {
  id: string;
  nombre: string;
  descripcion: string | null;
  dato_curioso: string | null;
  historia: string | null;
  leyenda: string | null;
};

type Pregunta = {
  id: string;
  hitoId: string;
  lugar: string;
  tipo: string;
  pregunta: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
};

/* =========================================================
   FUNCIONES AUXILIARES
========================================================= */

function mezclarArray<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

/*
  Convierte textos largos en respuestas cortas.

  Ejemplo:
  "Fue construido durante el período colonial..."
  ->
  "Época colonial"
*/

function crearRespuestaCorta(texto: string, tipo: string): string {
  const limpio = texto
    .replace(/\s+/g, " ")
    .replace(/\([^)]*\)/g, "")
    .trim();

  if (!limpio) return "Información histórica";

  /*
    Primero intentamos detectar conceptos importantes.
  */

  const conceptos = [
    {
      palabras: ["colonial", "colonia", "español"],
      respuesta: "Época colonial",
    },
    {
      palabras: ["indígena", "indigena", "maya", "pipil", "nahua"],
      respuesta: "Origen indígena",
    },
    {
      palabras: ["siglo xvi", "siglo XVI", "1500", "1510", "1520", "1530"],
      respuesta: "Siglo XVI",
    },
    {
      palabras: ["siglo xvii", "siglo XVII", "1600", "1610", "1620"],
      respuesta: "Siglo XVII",
    },
    {
      palabras: ["siglo xviii", "siglo XVIII", "1700", "1710", "1720"],
      respuesta: "Siglo XVIII",
    },
    {
      palabras: ["siglo xix", "siglo XIX", "1800", "1810", "1820"],
      respuesta: "Siglo XIX",
    },
    {
      palabras: ["siglo xx", "siglo XX", "1900", "1910", "1920"],
      respuesta: "Siglo XX",
    },
    {
      palabras: ["iglesia", "religioso", "religiosa", "católico", "catolica"],
      respuesta: "Tradición religiosa",
    },
    {
      palabras: ["volcán", "volcan", "volcánico", "volcanico"],
      respuesta: "Origen volcánico",
    },
    {
      palabras: ["arqueológico", "arqueologica", "arqueológico"],
      respuesta: "Patrimonio arqueológico",
    },
    {
      palabras: ["natural", "naturaleza", "bosque", "flora", "fauna"],
      respuesta: "Patrimonio natural",
    },
    {
      palabras: ["leyenda", "mito", "mitología", "mitologia"],
      respuesta: "Tradición popular",
    },
    {
      palabras: ["batalla", "guerra", "conflicto"],
      respuesta: "Acontecimiento histórico",
    },
    {
      palabras: ["fundado", "fundada", "fundación", "fundacion"],
      respuesta: "Fundación histórica",
    },
  ];

  const minuscula = limpio.toLowerCase();

  for (const concepto of conceptos) {
    if (concepto.palabras.some((palabra) => minuscula.includes(palabra))) {
      return concepto.respuesta;
    }
  }

  /*
    Si no encontramos un concepto conocido,
    tomamos las primeras palabras importantes,
    pero nunca devolvemos toda la descripción.
  */

  const palabras = limpio
    .split(" ")
    .filter((palabra) => palabra.length > 3)
    .filter(
      (palabra) =>
        ![
          "este",
          "esta",
          "lugar",
          "sitio",
          "ubicado",
          "ubicada",
          "conocido",
          "conocida",
          "donde",
          "tiene",
          "cuenta",
          "forma",
          "parte",
          "través",
          "través",
          "también",
        ].includes(palabra.toLowerCase()),
    );

  if (palabras.length >= 2) {
    return palabras.slice(0, 2).join(" ");
  }

  return palabras[0] ?? "Dato histórico";
}

/*
  Obtiene el contenido disponible de un lugar.
*/

function obtenerContenido(
  hito: Hito,
  tipo: string,
): string | null {
  if (tipo === "Historia") return hito.historia;
  if (tipo === "Dato curioso") return hito.dato_curioso;
  if (tipo === "Características") return hito.descripcion;
  if (tipo === "Leyenda") return hito.leyenda;

  return null;
}

/*
  Genera respuestas incorrectas cortas pero parecidas.
*/

function generarDistractores(
  correcta: string,
  tipo: string,
  hitos: Hito[],
  hitoActual: Hito,
): string[] {
  const respuestas = new Set<string>();

  /*
    Primero obtenemos conceptos de otros lugares.
  */

  for (const hito of mezclarArray(hitos)) {
    if (hito.id === hitoActual.id) continue;

    const contenido = obtenerContenido(hito, tipo);

    if (!contenido) continue;

    const respuesta = crearRespuestaCorta(
      contenido,
      tipo,
    );

    if (
      respuesta &&
      respuesta.toLowerCase() !== correcta.toLowerCase()
    ) {
      respuestas.add(respuesta);
    }

    if (respuestas.size >= 3) break;
  }

  /*
    Si no hay suficientes respuestas diferentes,
    usamos respuestas genéricas relacionadas.
  */

  const genericas = [
    "Época colonial",
    "Origen indígena",
    "Tradición religiosa",
    "Patrimonio natural",
    "Patrimonio cultural",
    "Acontecimiento histórico",
    "Tradición popular",
    "Origen volcánico",
    "Patrimonio arqueológico",
    "Siglo XVI",
    "Siglo XVII",
    "Siglo XVIII",
    "Siglo XIX",
    "Siglo XX",
    "Fundación histórica",
  ];

  for (const respuesta of mezclarArray(genericas)) {
    if (
      respuesta.toLowerCase() !== correcta.toLowerCase()
    ) {
      respuestas.add(respuesta);
    }

    if (respuestas.size >= 3) break;
  }

  return Array.from(respuestas).slice(0, 3);
}

/* =========================================================
   PANTALLA QUIZ
========================================================= */

export default function QuizScreen() {
  const { colores } = useTema();

  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [indice, setIndice] = useState(0);
  const [respuestaSeleccionada, setRespuestaSeleccionada] =
    useState<number | null>(null);

  const [respuestas, setRespuestas] = useState<number[]>([]);

  const [finalizado, setFinalizado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarPreguntas();
  }, []);

  /* =========================================================
     CARGAR LUGARES
  ========================================================= */

  async function cargarPreguntas() {
    setCargando(true);

    try {
      const { data, error } = await supabase
        .from("hitos")
        .select(
          "id, nombre, descripcion, dato_curioso, historia, leyenda",
        )
        .eq("es_lugar_oculto", false)
        .order("nombre", { ascending: true });

      if (error) {
        console.log(
          "Error cargando lugares:",
          error,
        );

        Alert.alert(
          "Error",
          "No se pudieron cargar los lugares del quiz.",
        );

        return;
      }

      const hitos = (data ?? []) as Hito[];

      const nuevasPreguntas =
        construirPreguntas(hitos);

      setPreguntas(nuevasPreguntas);
      setIndice(0);
      setRespuestas([]);
      setRespuestaSeleccionada(null);
      setFinalizado(false);
    } catch (error) {
      console.log(
        "Error inesperado:",
        error,
      );

      Alert.alert(
        "Error",
        "Ocurrió un problema preparando el quiz.",
      );
    } finally {
      setCargando(false);
    }
  }

  /* =========================================================
     CONSTRUIR PREGUNTAS
  ========================================================= */

  function construirPreguntas(
    hitos: Hito[],
  ): Pregunta[] {
    const preguntasGeneradas: Pregunta[] = [];

    hitos.forEach((hito, index) => {
      const campos = [
        {
          tipo: "Historia",
          texto: hito.historia,
        },
        {
          tipo: "Dato curioso",
          texto: hito.dato_curioso,
        },
        {
          tipo: "Características",
          texto: hito.descripcion,
        },
        {
          tipo: "Leyenda",
          texto: hito.leyenda,
        },
      ].filter(
        (
          item,
        ): item is {
          tipo: string;
          texto: string;
        } =>
          Boolean(
            item.texto &&
              item.texto.trim(),
          ),
      );

      if (campos.length === 0) {
        return;
      }

      /*
        Elegimos un tipo diferente dependiendo
        del lugar.
      */

      const contenido =
        campos[index % campos.length];

      /*
        Convertimos la información larga
        en una respuesta corta.
      */

      const correcta = crearRespuestaCorta(
        contenido.texto,
        contenido.tipo,
      );

      /*
        Creamos respuestas incorrectas
        del mismo estilo.
      */

      const distractores =
        generarDistractores(
          correcta,
          contenido.tipo,
          hitos,
          hito,
        );

      if (distractores.length < 3) {
        return;
      }

      const opciones = mezclarArray([
        correcta,
        ...distractores,
      ]);

      const indiceCorrecto =
        opciones.indexOf(correcta);

      /*
        IMPORTANTE:
        La pregunta sí menciona el lugar.
        Las respuestas NO mencionan el lugar.
      */

      let textoPregunta = "";

      if (
        contenido.tipo === "Historia"
      ) {
        textoPregunta =
          `¿Qué aspecto histórico se relaciona con "${hito.nombre}"?`;
      } else if (
        contenido.tipo === "Dato curioso"
      ) {
        textoPregunta =
          `¿Cuál es un dato relacionado con "${hito.nombre}"?`;
      } else if (
        contenido.tipo === "Características"
      ) {
        textoPregunta =
          `¿Qué característica corresponde a "${hito.nombre}"?`;
      } else {
        textoPregunta =
          `¿Qué elemento de tradición se relaciona con "${hito.nombre}"?`;
      }

      preguntasGeneradas.push({
        id: `${hito.id}-${index}`,
        hitoId: hito.id,
        lugar: hito.nombre,
        tipo: contenido.tipo,
        pregunta: textoPregunta,
        opciones,
        correcta: indiceCorrecto,
        /*
          Para la explicación mostramos
          la información real.
        */
        explicacion: contenido.texto,
      });
    });

    /*
      Mezclamos las preguntas para que
      no salgan siempre en el mismo orden.
    */

    return mezclarArray(
      preguntasGeneradas,
    );
  }

  /* =========================================================
     SELECCIONAR RESPUESTA
  ========================================================= */

  function seleccionarRespuesta(
    opcion: number,
  ) {
    if (
      respuestaSeleccionada !== null ||
      finalizado
    ) {
      return;
    }

    setRespuestaSeleccionada(opcion);

    setRespuestas((anteriores) => [
      ...anteriores,
      opcion,
    ]);
  }

  /* =========================================================
     SIGUIENTE
  ========================================================= */

  async function siguientePregunta() {
    if (
      respuestaSeleccionada === null
    ) {
      return;
    }

    if (
      indice <
      preguntas.length - 1
    ) {
      setIndice(
        (actual) => actual + 1,
      );

      setRespuestaSeleccionada(null);
    } else {
      await finalizarQuiz();
    }
  }

  /* =========================================================
     FINALIZAR
  ========================================================= */

  async function finalizarQuiz() {
    setGuardando(true);

    try {
      const respuestasFinales = [
        ...respuestas,
      ];

      const aciertos =
        preguntas.reduce(
          (total, pregunta, i) => {
            return (
              total +
              (respuestasFinales[i] ===
              pregunta.correcta
                ? 1
                : 0)
            );
          },
          0,
        );

      const puntos =
        aciertos * 5;

      const { data: sesion } =
        await supabase.auth.getUser();

      if (sesion?.user) {
        const {
          error: errorResultado,
        } = await supabase
          .from("quiz_resultados")
          .insert({
            usuario_id:
              sesion.user.id,
            aciertos,
            total_preguntas:
              preguntas.length,
            puntos_obtenidos:
              puntos,
          });

        if (errorResultado) {
          console.log(
            "Error guardando resultado:",
            errorResultado,
          );
        }

        await actualizarProgreso(
          sesion.user.id,
          puntos,
        );
      }

      setFinalizado(true);
    } catch (error) {
      console.log(
        "Error finalizando quiz:",
        error,
      );

      Alert.alert(
        "Error",
        "No se pudo guardar el resultado.",
      );
    } finally {
      setGuardando(false);
    }
  }

  /* =========================================================
     ACTUALIZAR NIVEL
  ========================================================= */

  async function actualizarProgreso(
    usuarioId: string,
    puntosQuiz: number,
  ) {
    try {
      const {
        data: visitas,
      } = await supabase
        .from(
          "interacciones_usuario",
        )
        .select("hito_id")
        .eq(
          "usuario_id",
          usuarioId,
        )
        .eq(
          "tipo_interaccion",
          "visita",
        );

      const lugaresVisitados =
        new Set(
          (visitas ?? []).map(
            (item) => item.hito_id,
          ),
        );

      const {
        data: resultados,
      } = await supabase
        .from("quiz_resultados")
        .select(
          "puntos_obtenidos",
        )
        .eq(
          "usuario_id",
          usuarioId,
        );

      const puntosQuizTotales =
        (resultados ?? []).reduce(
          (total, resultado) =>
            total +
            (resultado.puntos_obtenidos ??
              0),
          0,
        );

      /*
        10 puntos por lugar visitado.
      */

      const puntosVisitas =
        lugaresVisitados.size * 10;

      const puntosTotales =
        puntosVisitas +
        puntosQuizTotales;

      const nivel =
        calcularNivel(
          puntosTotales,
        );

      const { error } =
        await supabase
          .from(
            "progreso_usuario",
          )
          .upsert({
            usuario_id:
              usuarioId,
            puntos:
              puntosTotales,
            nivel,
            actualizado_en:
              new Date().toISOString(),
          });

      if (error) {
        console.log(
          "Error actualizando progreso:",
          error,
        );
      }
    } catch (error) {
      console.log(
        "Error en progreso:",
        error,
      );
    }
  }

  /* =========================================================
     NIVELES
  ========================================================= */

  function calcularNivel(
    puntos: number,
  ) {
    if (puntos >= 500)
      return 5;

    if (puntos >= 300)
      return 4;

    if (puntos >= 150)
      return 3;

    if (puntos >= 50)
      return 2;

    return 1;
  }

  const preguntaActual =
    preguntas[indice];

  /* =========================================================
     RESULTADO
  ========================================================= */

  const resultado = useMemo(() => {
    if (!finalizado) {
      return null;
    }

    return preguntas.map(
      (pregunta, i) => ({
        pregunta,

        respuesta:
          respuestas[i] !==
          undefined
            ? pregunta.opciones[
                respuestas[i]
              ]
            : "Sin responder",

        correcta:
          respuestas[i] ===
          pregunta.correcta,
      }),
    );
  }, [
    finalizado,
    preguntas,
    respuestas,
  ]);

  /* =========================================================
     CARGANDO
  ========================================================= */

  if (cargando) {
    return (
      <View
        style={[
          styles.centrado,
          {
            backgroundColor:
              colores.fondo,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color="#3B6FA0"
        />

        <Text
          style={[
            styles.cargandoTexto,
            {
              color:
                colores.texto,
            },
          ]}
        >
          Preparando quiz...
        </Text>
      </View>
    );
  }

  /* =========================================================
     SIN PREGUNTAS
  ========================================================= */

  if (
    preguntas.length === 0
  ) {
    return (
      <View
        style={[
          styles.centrado,
          {
            backgroundColor:
              colores.fondo,
          },
        ]}
      >
        <Ionicons
          name="help-circle-outline"
          size={60}
          color="#3B6FA0"
        />

        <Text
          style={[
            styles.titulo,
            {
              color:
                colores.texto,
            },
          ]}
        >
          Quiz no disponible
        </Text>

        <Text
          style={[
            styles.subtitulo,
            {
              color:
                colores.textoSecundario,
            },
          ]}
        >
          Los lugares todavía no
          tienen suficiente
          información para generar
          preguntas.
        </Text>

        <TouchableOpacity
          style={styles.boton}
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.textoBoton
            }
          >
            Volver
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* =========================================================
     RESULTADO FINAL
  ========================================================= */

  if (finalizado) {
    const aciertos =
      resultado?.filter(
        (item) =>
          item.correcta,
      ).length ?? 0;

    const puntos =
      aciertos * 5;

    return (
      <ScrollView
        style={[
          styles.contenedor,
          {
            backgroundColor:
              colores.fondo,
          },
        ]}
        contentContainerStyle={
          styles.contenido
        }
      >
        <View
          style={styles.encabezado}
        >
          <TouchableOpacity
            onPress={() =>
              router.back()
            }
          >
            <Ionicons
              name="arrow-back"
              size={26}
              color={
                colores.texto
              }
            />
          </TouchableOpacity>

          <Text
            style={[
              styles.encabezadoTitulo,
              {
                color:
                  colores.texto,
              },
            ]}
          >
            Resultado
          </Text>

          <View
            style={{
              width: 26,
            }}
          />
        </View>

        <View
          style={[
            styles.resultadoCard,
            {
              backgroundColor:
                colores.tarjeta,
            },
          ]}
        >
          <Text
            style={styles.trofeo}
          >
            🏆
          </Text>

          <Text
            style={[
              styles.resultadoTitulo,
              {
                color:
                  colores.texto,
              },
            ]}
          >
            ¡Quiz completado!
          </Text>

          <Text
            style={[
              styles.puntuacion,
              {
                color:
                  "#3B6FA0",
              },
            ]}
          >
            {aciertos}/
            {preguntas.length}
          </Text>

          <Text
            style={[
              styles.puntos,
              {
                color:
                  colores.textoSecundario,
              },
            ]}
          >
            +{puntos} puntos
          </Text>
        </View>

        <Text
          style={[
            styles.seccionTitulo,
            {
              color:
                colores.texto,
            },
          ]}
        >
          Revisión de respuestas
        </Text>

        {resultado?.map(
          (
            item,
            index,
          ) => (
            <View
              key={index}
              style={[
                styles.revisionCard,
                {
                  backgroundColor:
                    colores.tarjeta,

                  borderLeftColor:
                    item.correcta
                      ? "#2E7D32"
                      : "#D32F2F",
                },
              ]}
            >
              <Text
                style={[
                  styles.numeroPregunta,
                  {
                    color:
                      colores.texto,
                  },
                ]}
              >
                Pregunta {index + 1}
              </Text>

              <Text
                style={[
                  styles.textoPreguntaRevision,
                  {
                    color:
                      colores.texto,
                  },
                ]}
              >
                {
                  item.pregunta
                    .pregunta
                }
              </Text>

              <Text
                style={{
                  color:
                    item.correcta
                      ? "#2E7D32"
                      : "#D32F2F",

                  fontWeight:
                    "bold",

                  marginTop: 8,
                }}
              >
                {item.correcta
                  ? "✓ Correcta"
                  : "✕ Incorrecta"}
              </Text>

              <Text
                style={[
                  styles.respuestaRevision,
                  {
                    color:
                      colores.textoSecundario,
                  },
                ]}
              >
                Tu respuesta:{" "}
                {item.respuesta}
              </Text>

              {!item.correcta && (
                <Text
                  style={[
                    styles.respuestaCorrecta,
                    {
                      color:
                        colores.texto,
                    },
                  ]}
                >
                  Respuesta correcta:{" "}
                  {
                    item
                      .pregunta
                      .opciones[
                      item
                        .pregunta
                        .correcta
                    ]
                  }
                </Text>
              )}

              <Text
                style={[
                  styles.explicacion,
                  {
                    color:
                      colores.textoSecundario,
                  },
                ]}
              >
                {
                  item.pregunta
                    .explicacion
                }
              </Text>
            </View>
          ),
        )}

        <TouchableOpacity
          style={styles.boton}
          onPress={
            cargarPreguntas
          }
        >
          <Text
            style={
              styles.textoBoton
            }
          >
            Intentar otro quiz
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.botonSecundario
          }
          onPress={() =>
            router.push(
              "/niveles",
            )
          }
        >
          <Text
            style={
              styles.textoBotonSecundario
            }
          >
            Ver mis niveles
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  /* =========================================================
     QUIZ
  ========================================================= */

  return (
    <ScrollView
      style={[
        styles.contenedor,
        {
          backgroundColor:
            colores.fondo,
        },
      ]}
      contentContainerStyle={
        styles.contenido
      }
    >
      <View
        style={styles.encabezado}
      >
        <TouchableOpacity
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="arrow-back"
            size={26}
            color={
              colores.texto
            }
          />
        </TouchableOpacity>

        <Text
          style={[
            styles.encabezadoTitulo,
            {
              color:
                colores.texto,
            },
          ]}
        >
          Quiz cultural
        </Text>

        <View
          style={{
            width: 26,
          }}
        />
      </View>

      {/* PROGRESO */}

      <View
        style={
          styles.progresoContainer
        }
      >
        <Text
          style={[
            styles.progresoTexto,
            {
              color:
                colores.textoSecundario,
            },
          ]}
        >
          Pregunta {indice + 1} de{" "}
          {preguntas.length}
        </Text>

        <View
          style={[
            styles.progresoFondo,
            {
              backgroundColor:
                colores.borde,
            },
          ]}
        >
          <View
            style={[
              styles.progreso,
              {
                width: `${
                  ((indice + 1) /
                    preguntas.length) *
                  100
                }%`,
              },
            ]}
          />
        </View>
      </View>

      {/* LUGAR */}

      <View
        style={[
          styles.lugarCard,
          {
            backgroundColor:
              colores.tarjeta,
          },
        ]}
      >
        <Ionicons
          name="location"
          size={20}
          color="#3B6FA0"
        />

        <Text
          style={[
            styles.lugarTexto,
            {
              color:
                colores.texto,
            },
          ]}
        >
          {preguntaActual.lugar}
        </Text>
      </View>

      {/* PREGUNTA */}

      <View
        style={[
          styles.preguntaCard,
          {
            backgroundColor:
              colores.tarjeta,
          },
        ]}
      >
        <Text
          style={[
            styles.tipoPregunta,
            {
              color:
                "#3B6FA0",
            },
          ]}
        >
          {preguntaActual.tipo}
        </Text>

        <Text
          style={[
            styles.pregunta,
            {
              color:
                colores.texto,
            },
          ]}
        >
          {preguntaActual.pregunta}
        </Text>
      </View>

      {/* RESPUESTAS */}

      {preguntaActual.opciones.map(
        (
          opcion,
          opcionIndex,
        ) => {
          const seleccionada =
            respuestaSeleccionada ===
            opcionIndex;

          return (
            <TouchableOpacity
              key={opcionIndex}
              onPress={() =>
                seleccionarRespuesta(
                  opcionIndex,
                )
              }
              activeOpacity={0.8}
              style={[
                styles.opcion,
                {
                  backgroundColor:
                    colores.tarjeta,

                  borderColor:
                    seleccionada
                      ? "#3B6FA0"
                      : colores.borde,
                },
              ]}
            >
              <View
                style={[
                  styles.letra,
                  {
                    backgroundColor:
                      seleccionada
                        ? "#3B6FA0"
                        : colores.borde,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      seleccionada
                        ? "#fff"
                        : colores.texto,

                    fontWeight:
                      "bold",
                  }}
                >
                  {String.fromCharCode(
                    65 +
                      opcionIndex,
                  )}
                </Text>
              </View>

              <Text
                style={[
                  styles.opcionTexto,
                  {
                    color:
                      colores.texto,
                  },
                ]}
              >
                {opcion}
              </Text>
            </TouchableOpacity>
          );
        },
      )}

      {/* BOTÓN */}

      <TouchableOpacity
        disabled={
          respuestaSeleccionada ===
            null ||
          guardando
        }
        onPress={
          siguientePregunta
        }
        style={[
          styles.boton,
          {
            opacity:
              respuestaSeleccionada ===
                null ||
              guardando
                ? 0.5
                : 1,
          },
        ]}
      >
        <Text
          style={
            styles.textoBoton
          }
        >
          {guardando
            ? "Guardando..."
            : indice ===
                preguntas.length -
                  1
              ? "Finalizar quiz"
              : "Siguiente"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },

  contenido: {
    padding: 16,
    paddingBottom: 50,
  },

  centrado: {
    flex: 1,
    justifyContent:
      "center",
    alignItems: "center",
    padding: 30,
  },

  cargandoTexto: {
    marginTop: 12,
    fontSize: 15,
  },

  encabezado: {
    marginTop: 45,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
  },

  encabezadoTitulo: {
    fontSize: 22,
    fontWeight: "bold",
  },

  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 15,
    textAlign: "center",
  },

  subtitulo: {
    textAlign: "center",
    marginTop: 10,
    lineHeight: 21,
  },

  /* PROGRESO */

  progresoContainer: {
    marginBottom: 18,
  },

  progresoTexto: {
    fontSize: 13,
    marginBottom: 7,
  },

  progresoFondo: {
    height: 7,
    borderRadius: 10,
    overflow: "hidden",
  },

  progreso: {
    height: 7,
    backgroundColor:
      "#3B6FA0",
    borderRadius: 10,
  },

  /* LUGAR */

  lugarCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },

  lugarTexto: {
    fontWeight: "700",
    fontSize: 15,
    flex: 1,
    marginLeft: 8,
  },

  /* PREGUNTA */

  preguntaCard: {
    padding: 20,
    borderRadius: 18,
    marginBottom: 16,

    elevation: 2,

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  tipoPregunta: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform:
      "uppercase",
    marginBottom: 10,
  },

  pregunta: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },

  /* RESPUESTAS */

  opcion: {
    minHeight: 68,

    borderWidth: 1.5,
    borderRadius: 16,

    marginBottom: 12,

    paddingVertical: 12,
    paddingHorizontal: 14,

    flexDirection: "row",
    alignItems: "center",

    /*
      Esto evita que el texto
      quede cortado.
    */

    width: "100%",
  },

  letra: {
    width: 40,
    height: 40,
    borderRadius: 20,

    justifyContent:
      "center",
    alignItems: "center",

    marginRight: 12,

    flexShrink: 0,
  },

  opcionTexto: {
    flex: 1,

    fontSize: 15,

    lineHeight: 21,

    /*
      Importante para que
      React Native pueda hacer
      salto de línea.
    */

    flexShrink: 1,

    includeFontPadding: true,
  },

  /* BOTONES */

  boton: {
    backgroundColor:
      "#3B6FA0",

    paddingVertical: 15,

    borderRadius: 16,

    alignItems: "center",

    marginTop: 10,

    width: "100%",
  },

  textoBoton: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },

  botonSecundario: {
    borderWidth: 1,
    borderColor:
      "#3B6FA0",

    paddingVertical: 15,

    borderRadius: 16,

    alignItems: "center",

    marginTop: 12,

    width: "100%",
  },

  textoBotonSecundario: {
    color: "#3B6FA0",
    fontWeight: "bold",
  },

  /* RESULTADO */

  resultadoCard: {
    borderRadius: 22,
    padding: 28,
    alignItems: "center",

    elevation: 3,

    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  trofeo: {
    fontSize: 50,
  },

  resultadoTitulo: {
    fontSize: 23,
    fontWeight: "bold",
    marginTop: 8,
  },

  puntuacion: {
    fontSize: 42,
    fontWeight: "bold",
    marginTop: 10,
  },

  puntos: {
    fontSize: 16,
    marginTop: 4,
  },

  seccionTitulo: {
    fontSize: 19,
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 12,
  },

  revisionCard: {
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 5,
  },

  numeroPregunta: {
    fontWeight: "bold",
    fontSize: 13,
  },

  textoPreguntaRevision: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 6,
    lineHeight: 21,
  },

  respuestaRevision: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
  },

  respuestaCorrecta: {
    marginTop: 6,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 19,
  },

  explicacion: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
  },
});