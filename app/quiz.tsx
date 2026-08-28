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

type RespuestaUsuario = {
  preguntaId: string;
  opcion: number;
};

export default function QuizScreen() {
  const { colores } = useTema();

  const [preguntas, setPreguntas] = useState<Pregunta[]>(
    [],
  );

  const [indice, setIndice] = useState(0);

  const [respuestaSeleccionada, setRespuestaSeleccionada] =
    useState<number | null>(null);

  const [respuestas, setRespuestas] = useState<
    RespuestaUsuario[]
  >([]);

  const [finalizado, setFinalizado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarPreguntas();
  }, []);

  async function cargarPreguntas() {
    setCargando(true);

    try {
      const { data, error } = await supabase
        .from("hitos")
        .select(
          `
            id,
            nombre,
            descripcion,
            dato_curioso,
            historia,
            leyenda
          `,
        )
        .eq("es_lugar_oculto", false)
        .order("nombre", { ascending: true });

      if (error) {
        console.error("Error cargando hitos:", error);

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
      console.error("Error quiz:", error);

      Alert.alert(
        "Error",
        "Ocurrió un problema preparando el quiz.",
      );
    } finally {
      setCargando(false);
    }
  }

  function construirPreguntas(
    hitos: Hito[],
  ): Pregunta[] {
    const generadas: Pregunta[] = [];

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
              item.texto.trim().length > 10,
          ),
      );

      if (campos.length === 0) {
        return;
      }

      const contenido =
        campos[index % campos.length];

      const candidatos = hitos
        .filter(
          (otro) => otro.id !== hito.id,
        )
        .flatMap((otro) => [
          obtenerContenido(
            otro,
            contenido.tipo,
          ),
        ])
        .filter(
          (texto): texto is string =>
            Boolean(
              texto &&
                texto.trim() &&
                texto !== contenido.texto,
            ),
        );

      const distractores =
        eliminarDuplicados(candidatos).slice(
          0,
          3,
        );

      if (distractores.length < 3) {
        return;
      }

      const opcionesOriginales = [
        contenido.texto,
        ...distractores,
      ];

      const opciones =
        mezclarArray(opcionesOriginales);

      const correcta = opciones.indexOf(
        contenido.texto,
      );

      generadas.push({
        id: `${hito.id}-${contenido.tipo}-${index}`,
        hitoId: hito.id,
        lugar: hito.nombre,
        tipo: contenido.tipo,
        pregunta: construirTextoPregunta(
          hito.nombre,
          contenido.tipo,
        ),
        opciones,
        correcta,
        explicacion: contenido.texto,
      });
    });

    return mezclarArray(generadas);
  }

  function construirTextoPregunta(
    nombreLugar: string,
    tipo: string,
  ) {
    if (tipo === "Historia") {
      return `¿Cuál de las siguientes afirmaciones corresponde a la historia de "${nombreLugar}"?`;
    }

    if (tipo === "Dato curioso") {
      return `¿Cuál de estos datos curiosos corresponde a "${nombreLugar}"?`;
    }

    if (tipo === "Características") {
      return `¿Cuál de estas características corresponde a "${nombreLugar}"?`;
    }

    return `¿Cuál de las siguientes opciones corresponde a la leyenda de "${nombreLugar}"?`;
  }

  function obtenerContenido(
    hito: Hito,
    tipo: string,
  ): string | null {
    if (tipo === "Historia") {
      return hito.historia;
    }

    if (tipo === "Dato curioso") {
      return hito.dato_curioso;
    }

    if (tipo === "Características") {
      return hito.descripcion;
    }

    if (tipo === "Leyenda") {
      return hito.leyenda;
    }

    return null;
  }

  function eliminarDuplicados(
    valores: string[],
  ) {
    return Array.from(new Set(valores));
  }

  function mezclarArray<T>(
    array: T[],
  ): T[] {
    const copia = [...array];

    for (
      let i = copia.length - 1;
      i > 0;
      i--
    ) {
      const j = Math.floor(
        Math.random() * (i + 1),
      );

      [copia[i], copia[j]] = [
        copia[j],
        copia[i],
      ];
    }

    return copia;
  }

  function seleccionarRespuesta(
    opcion: number,
  ) {
    if (
      respuestaSeleccionada !== null ||
      finalizado
    ) {
      return;
    }

    const preguntaActual =
      preguntas[indice];

    if (!preguntaActual) {
      return;
    }

    setRespuestaSeleccionada(opcion);

    setRespuestas((anteriores) => [
      ...anteriores.filter(
        (item) =>
          item.preguntaId !==
          preguntaActual.id,
      ),
      {
        preguntaId: preguntaActual.id,
        opcion,
      },
    ]);
  }

  async function siguientePregunta() {
    if (respuestaSeleccionada === null) {
      return;
    }

    if (indice < preguntas.length - 1) {
      setIndice((actual) => actual + 1);
      setRespuestaSeleccionada(null);
    } else {
      await finalizarQuiz();
    }
  }

  async function finalizarQuiz() {
    if (guardando) return;

    setGuardando(true);

    try {
      const aciertos = preguntas.reduce(
        (total, pregunta) => {
          const respuesta =
            respuestas.find(
              (item) =>
                item.preguntaId ===
                pregunta.id,
            );

          return (
            total +
            (respuesta?.opcion ===
            pregunta.correcta
              ? 1
              : 0)
          );
        },
        0,
      );

      const puntos = aciertos * 5;

      const { data: sesion } =
        await supabase.auth.getUser();

      if (sesion?.user) {
        const { error: resultadoError } =
          await supabase
            .from("quiz_resultados")
            .insert({
              usuario_id:
                sesion.user.id,
              aciertos,
              total_preguntas:
                preguntas.length,
              puntos_obtenidos: puntos,
            });

        if (resultadoError) {
          console.error(
            "Error guardando resultado:",
            resultadoError,
          );
        }

        await actualizarProgreso(
          sesion.user.id,
        );
      }
    } catch (error) {
      console.error(
        "Error finalizando quiz:",
        error,
      );

      Alert.alert(
        "Aviso",
        "El resultado se mostrará, pero hubo un problema guardándolo.",
      );
    } finally {
      setFinalizado(true);
      setGuardando(false);
    }
  }

  async function actualizarProgreso(
    usuarioId: string,
  ) {
    const { data: visitas } =
      await supabase
        .from("interacciones_usuario")
        .select("hito_id")
        .eq("usuario_id", usuarioId)
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

    const { data: resultados } =
      await supabase
        .from("quiz_resultados")
        .select(
          "puntos_obtenidos",
        )
        .eq(
          "usuario_id",
          usuarioId,
        );

    const puntosQuiz =
      (resultados ?? []).reduce(
        (total, resultado) =>
          total +
          (resultado.puntos_obtenidos ??
            0),
        0,
      );

    const puntosVisitas =
      lugaresVisitados.size * 10;

    const puntosTotales =
      puntosVisitas + puntosQuiz;

    const nivel =
      calcularNivel(puntosTotales);

    await supabase
      .from("progreso_usuario")
      .upsert(
        {
          usuario_id: usuarioId,
          puntos: puntosTotales,
          nivel,
          actualizado_en:
            new Date().toISOString(),
        },
        {
          onConflict:
            "usuario_id",
        },
      );
  }

  function calcularNivel(
    puntos: number,
  ) {
    if (puntos >= 500) return 5;
    if (puntos >= 300) return 4;
    if (puntos >= 150) return 3;
    if (puntos >= 50) return 2;

    return 1;
  }

  const preguntaActual =
    preguntas[indice];

  const resultado = useMemo(() => {
    if (!finalizado) {
      return null;
    }

    return preguntas.map(
      (pregunta) => {
        const respuesta =
          respuestas.find(
            (item) =>
              item.preguntaId ===
              pregunta.id,
          );

        const opcion =
          respuesta?.opcion;

        return {
          pregunta,
          respuesta:
            opcion !== undefined
              ? pregunta.opciones[
                  opcion
                ]
              : "Sin responder",
          correcta:
            opcion ===
            pregunta.correcta,
        };
      },
    );
  }, [
    finalizado,
    preguntas,
    respuestas,
  ]);

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
          Preparando quiz cultural...
        </Text>
      </View>
    );
  }

  if (preguntas.length === 0) {
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
          size={64}
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
          Todavía no hay suficientes datos en los
          lugares para generar preguntas.
        </Text>

        <TouchableOpacity
          style={styles.boton}
          onPress={() => router.back()}
        >
          <Text style={styles.textoBoton}>
            Volver
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (finalizado) {
    const aciertos =
      resultado?.filter(
        (item) => item.correcta,
      ).length ?? 0;

    const puntos = aciertos * 5;

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
        <View style={styles.encabezado}>
          <TouchableOpacity
            onPress={() =>
              router.back()
            }
          >
            <Ionicons
              name="arrow-back"
              size={26}
              color={colores.texto}
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
            style={{ width: 26 }}
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
          <Text style={styles.trofeo}>
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
                color: "#3B6FA0",
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
          (item, index) => (
            <View
              key={
                item.pregunta.id
              }
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
                {item.pregunta.pregunta}
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
                {item.pregunta
                  .explicacion}
              </Text>
            </View>
          ),
        )}

        <TouchableOpacity
          style={styles.boton}
          onPress={cargarPreguntas}
        >
          <Text style={styles.textoBoton}>
            Intentar otro quiz
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botonSecundario}
          onPress={() =>
            router.push("/niveles")
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
      <View style={styles.encabezado}>
        <TouchableOpacity
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="arrow-back"
            size={26}
            color={colores.texto}
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
          style={{ width: 26 }}
        />
      </View>

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

      {preguntaActual.opciones.map(
        (opcion, opcionIndex) => {
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

      <TouchableOpacity
        disabled={
          respuestaSeleccionada ===
            null || guardando
        }
        onPress={siguientePregunta}
        style={[
          styles.boton,
          {
            opacity:
              respuestaSeleccionada ===
                null || guardando
                ? 0.5
                : 1,
          },
        ]}
      >
        <Text style={styles.textoBoton}>
          {guardando
            ? "Guardando..."
            : indice ===
                preguntas.length - 1
              ? "Finalizar quiz"
              : "Siguiente"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

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
    justifyContent: "center",
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
    justifyContent: "space-between",
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
    backgroundColor: "#3B6FA0",
    borderRadius: 10,
  },

  lugarCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },

  lugarTexto: {
    fontWeight: "700",
    fontSize: 15,
    flex: 1,
  },

  preguntaCard: {
    padding: 20,
    borderRadius: 18,
    marginBottom: 16,
    elevation: 2,
  },

  tipoPregunta: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 10,
  },

  pregunta: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },

  opcion: {
    minHeight: 70,
    borderWidth: 1.5,
    borderRadius: 16,
    marginBottom: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  letra: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  opcionTexto: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },

  boton: {
    backgroundColor: "#3B6FA0",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },

  textoBoton: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },

  botonSecundario: {
    borderWidth: 1,
    borderColor: "#3B6FA0",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
  },

  textoBotonSecundario: {
    color: "#3B6FA0",
    fontWeight: "bold",
  },

  resultadoCard: {
    borderRadius: 22,
    padding: 28,
    alignItems: "center",
    elevation: 3,
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
  },

  respuestaCorrecta: {
    marginTop: 6,
    fontWeight: "600",
    fontSize: 13,
  },

  explicacion: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
  },
});