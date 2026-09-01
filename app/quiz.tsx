import { useTema } from "@/contexts/ThemeContext";
import { verificarYDesbloquearInsignias } from "@/hooks/use-insignias";
import { revisarYCompletarRetos } from "@/hooks/use-retos";
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
  categoria_id: number | null;
  direccion_referencia: string | null;
};

type Categoria = {
  id: number;
  nombre: string;
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

type QuizResultado = {
  pregunta: Pregunta;
  respuesta: string;
  correcta: boolean;
};

const COLOR = "#3B6FA0";
const COLOR_SELECCION = "#DCEBF7";
const COLOR_CORRECTO = "#E3F2E6";
const COLOR_INCORRECTO = "#FBE4E4";

const MAX_PREGUNTAS = 15;

/* =========================================================
   LÍMITES
   ========================================================= */

function limiteCategoria(nombre: string) {
  const n = nombre.toLowerCase();

  if (
    n.includes("relig") ||
    n.includes("igles") ||
    n.includes("espiritual")
  ) {
    return 5;
  }

  return MAX_PREGUNTAS;
}

/* =========================================================
   COMPONENTE
   ========================================================= */

export default function QuizScreen() {
  const { colores } = useTema();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] =
    useState<Categoria | null>(null);

  const [cantidad, setCantidad] = useState(5);

  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [indice, setIndice] = useState(0);

  const [respuestaSeleccionada, setRespuestaSeleccionada] =
    useState<number | null>(null);

  const [respuestas, setRespuestas] = useState<number[]>([]);

  const [finalizado, setFinalizado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoQuiz, setCargandoQuiz] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [pantalla, setPantalla] = useState<
    "categorias" | "configuracion" | "quiz" | "resultado"
  >("categorias");

  useEffect(() => {
    cargarCategorias();
  }, []);

  /* =========================================================
     CATEGORÍAS
     ========================================================= */

  async function cargarCategorias() {
    setCargando(true);

    try {
      const { data, error } = await supabase
        .from("categorias")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (error) {
        console.error("Error categorías:", error);

        Alert.alert(
          "Error",
          "No se pudieron cargar las categorías."
        );

        return;
      }

      setCategorias((data ?? []) as Categoria[]);
    } catch (error) {
      console.error(error);

      Alert.alert(
        "Error",
        "Ocurrió un problema cargando las categorías."
      );
    } finally {
      setCargando(false);
    }
  }

  function seleccionarCategoria(categoria: Categoria) {
    setCategoriaSeleccionada(categoria);

    const limite = limiteCategoria(categoria.nombre);

    setCantidad(Math.min(5, limite));

    setPantalla("configuracion");
  }

  function cambiarCantidad(valor: number) {
    if (!categoriaSeleccionada) return;

    const limite = limiteCategoria(
      categoriaSeleccionada.nombre
    );

    if (valor <= limite) {
      setCantidad(valor);
    }
  }

  /* =========================================================
     INICIAR QUIZ
     ========================================================= */

  async function iniciarQuiz() {
    if (!categoriaSeleccionada) return;

    setCargandoQuiz(true);

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
          leyenda,
          categoria_id,
          direccion_referencia
        `
        )
        .eq("es_lugar_oculto", false)
        .eq("categoria_id", categoriaSeleccionada.id);

      if (error) {
        console.error("Error cargando lugares:", error);

        Alert.alert(
          "Error",
          "No se pudieron cargar los datos de esta categoría."
        );

        return;
      }

      const hitos = (data ?? []) as Hito[];

      if (hitos.length === 0) {
        Alert.alert(
          "Sin información",
          "No existen registros disponibles en esta categoría."
        );

        return;
      }

      const todas = construirPreguntas(hitos);

      if (todas.length === 0) {
        Alert.alert(
          "Sin preguntas",
          "No se encontró información suficiente para crear preguntas."
        );

        return;
      }

      const cantidadReal = Math.min(
        cantidad,
        todas.length
      );

      const seleccionadas =
        seleccionarPreguntasAleatorias(
          todas,
          cantidadReal
        );

      setPreguntas(seleccionadas);
      setIndice(0);
      setRespuestas([]);
      setRespuestaSeleccionada(null);
      setFinalizado(false);

      setPantalla("quiz");
    } catch (error) {
      console.error(
        "Error iniciando quiz:",
        error
      );

      Alert.alert(
        "Error",
        "No se pudo iniciar el quiz."
      );
    } finally {
      setCargandoQuiz(false);
    }
  }

  /* =========================================================
     CONSTRUIR PREGUNTAS
     ========================================================= */

  function construirPreguntas(
    hitos: Hito[]
  ): Pregunta[] {
    const resultado: Pregunta[] = [];

    hitos.forEach((hito) => {
      const campos = [
        {
          tipo: "Historia",
          texto: limpiarTexto(hito.historia),
        },
        {
          tipo: "Dato curioso",
          texto: limpiarTexto(hito.dato_curioso),
        },
        {
          tipo: "Características",
          texto: limpiarTexto(hito.descripcion),
        },
        {
          tipo: "Leyenda",
          texto: limpiarTexto(hito.leyenda),
        },
      ].filter(
        (
          item
        ): item is {
          tipo: string;
          texto: string;
        } => Boolean(item.texto)
      );

      campos.forEach(
        (campo, campoIndex) => {
          const opcionesGeneradas =
            crearOpcionesSeguras(
              hito,
              campo.tipo,
              campo.texto,
              hitos
            );

          if (!opcionesGeneradas) {
            return;
          }

          const pregunta = crearPregunta(
            hito.nombre,
            campo.tipo,
            campoIndex
          );

          resultado.push({
            id: `${hito.id}-${campo.tipo}-${campoIndex}-${Math.random()}`,
            hitoId: hito.id,
            lugar: hito.nombre,
            tipo: campo.tipo,
            pregunta,
            opciones:
              opcionesGeneradas.opciones,
            correcta:
              opcionesGeneradas.correcta,
            explicacion:
              crearExplicacion(
                campo.tipo,
                hito.nombre
              ),
          });
        }
      );
    });

    return resultado;
  }

  /* =========================================================
     PREGUNTAS
     ========================================================= */

  function crearPregunta(
    lugar: string,
    tipo: string,
    indicePregunta: number
  ) {
    const variantes = {
      Historia: [
        `¿Qué hecho se relaciona con la historia de ${lugar}?`,
        `¿Cuál de estas afirmaciones corresponde a la historia de ${lugar}?`,
        `¿Qué acontecimiento forma parte de la historia de ${lugar}?`,
        `¿Qué aspecto histórico se relaciona con ${lugar}?`,
      ],

      "Dato curioso": [
        `¿Cuál de estas afirmaciones corresponde a un dato curioso de ${lugar}?`,
        `¿Qué información particular se conoce sobre ${lugar}?`,
        `¿Cuál es un dato destacado relacionado con ${lugar}?`,
        `¿Qué afirmación corresponde a un dato curioso de ${lugar}?`,
      ],

      Características: [
        `¿Cuál de estas afirmaciones describe a ${lugar}?`,
        `¿Qué característica corresponde a ${lugar}?`,
        `¿Qué aspecto identifica a ${lugar}?`,
        `¿Cuál de estas características pertenece a ${lugar}?`,
      ],

      Leyenda: [
        `¿Cuál de estos elementos forma parte de la leyenda de ${lugar}?`,
        `¿Qué relato se relaciona con ${lugar}?`,
        `¿Qué afirmación corresponde a la leyenda de ${lugar}?`,
        `¿Qué elemento aparece en la tradición relacionada con ${lugar}?`,
      ],
    };

    const lista =
      variantes[
        tipo as keyof typeof variantes
      ] ?? [
        `¿Qué información corresponde a ${lugar}?`,
        `¿Qué dato se relaciona con ${lugar}?`,
      ];

    return lista[
      indicePregunta % lista.length
    ];
  }

  /* =========================================================
     OPCIONES
     
     ESTA ES LA PARTE IMPORTANTE:
     
     - No usamos respuestas de otros lugares.
     - No metemos nombres de lugares dentro de las opciones.
     - No cortamos arbitrariamente.
     - Cada opción sale de información real relacionada.
     ========================================================= */

  function crearOpcionesSeguras(
    hito: Hito,
    tipo: string,
    contenidoCorrecto: string,
    hitos: Hito[]
  ): {
    opciones: string[];
    correcta: number;
  } | null {
    const correctaTexto =
      prepararRespuestaCompleta(
        contenidoCorrecto
      );

    if (!correctaTexto) {
      return null;
    }

    /*
     * Sacamos frases completas del contenido correcto.
     */
    const frasesCorrectas =
      extraerFrases(contenidoCorrecto);

    /*
     * Buscamos información adicional DEL MISMO LUGAR.
     *
     * Esto evita que aparezcan otros nombres de lugares
     * como respuestas.
     */
    const contenidoDelMismoLugar = [
      hito.historia,
      hito.dato_curioso,
      hito.descripcion,
      hito.leyenda,
    ].filter(
      (x): x is string =>
        Boolean(limpiarTexto(x))
    );

    /*
     * Generamos posibles afirmaciones del mismo lugar.
     */
    let candidatos: string[] = [];

    contenidoDelMismoLugar.forEach(
      (texto) => {
        const frases = extraerFrases(texto);

        candidatos.push(...frases);
      }
    );

    /*
     * También podemos usar información de otros registros,
     * PERO solamente después de eliminar cualquier frase
     * que contenga nombres de lugares.
     *
     * Se utiliza únicamente como último recurso.
     */
    if (candidatos.length < 4) {
      hitos.forEach((otro) => {
        if (otro.id === hito.id) return;

        const texto =
          obtenerContenido(otro, tipo);

        if (!texto) return;

        const frases =
          extraerFrases(texto);

        frases.forEach((frase) => {
          if (
            !contieneNombreDeLugar(
              frase,
              hitos
            )
          ) {
            candidatos.push(frase);
          }
        });
      });
    }

    /*
     * Limpiamos y eliminamos repetidos.
     */
    candidatos = candidatos
      .map((x) =>
        prepararRespuestaCompleta(x)
      )
      .filter(Boolean)
      .filter(
        (x) =>
          normalizar(x) !==
          normalizar(correctaTexto)
      );

    candidatos = eliminarRepetidos(
      candidatos
    );

    /*
     * Eliminamos frases que sean demasiado cortas.
     */
    candidatos = candidatos.filter(
      (texto) => {
        const palabras =
          contarPalabras(texto);

        return palabras >= 9;
      }
    );

    /*
     * Eliminamos frases excesivamente largas.
     */
    candidatos = candidatos.filter(
      (texto) =>
        contarPalabras(texto) <= 30
    );

    /*
     * Priorizamos opciones que tengan una longitud
     * parecida a la respuesta correcta.
     */
    const palabrasCorrecta =
      contarPalabras(correctaTexto);

    const candidatosOrdenados =
      candidatos
        .map((texto) => ({
          texto,
          diferencia: Math.abs(
            contarPalabras(texto) -
              palabrasCorrecta
          ),
        }))
        .sort(
          (a, b) =>
            a.diferencia - b.diferencia
        )
        .map((x) => x.texto);

    /*
     * Quitamos opciones demasiado parecidas
     * entre sí.
     */
    const buenos: string[] = [];

    for (
      const candidato of candidatosOrdenados
    ) {
      const parecido = buenos.some(
        (existente) =>
          similitudTexto(
            candidato,
            existente
          ) > 0.72
      );

      if (!parecido) {
        buenos.push(candidato);
      }

      if (buenos.length >= 8) {
        break;
      }
    }

    /*
     * Si no hay 3 distractores, intentamos crear
     * alternativas a partir de frases del mismo contenido.
     */
    if (buenos.length < 3) {
      const alternativas =
        crearAlternativasDesdeContenido(
          contenidoCorrecto
        );

      alternativas.forEach(
        (alternativa) => {
          if (
            buenos.length >= 3
          ) return;

          if (
            normalizar(alternativa) ===
            normalizar(correctaTexto)
          ) {
            return;
          }

          if (
            !contieneNombreDeLugar(
              alternativa,
              hitos
            )
          ) {
            const parecido =
              buenos.some(
                (x) =>
                  similitudTexto(
                    x,
                    alternativa
                  ) > 0.72
              );

            if (!parecido) {
              buenos.push(
                alternativa
              );
            }
          }
        }
      );
    }

    /*
     * Último filtro.
     */
    const distractores =
      buenos.filter(
        (texto) =>
          !contieneNombreDeLugar(
            texto,
            hitos
          )
      );

    /*
     * Si tenemos menos de tres, NO descartamos
     * toda la categoría inmediatamente.
     *
     * Construimos distractores genéricos relacionados
     * con el tipo de pregunta.
     */
    while (
      distractores.length < 3
    ) {
      const genericas =
        crearDistractoresGenerales(
          tipo,
          distractores
        );

      if (!genericas.length) {
        break;
      }

      genericas.forEach(
        (g) => {
          if (
            distractores.length >= 3
          )
            return;

          if (
            !distractores.some(
              (x) =>
                normalizar(x) ===
                normalizar(g)
            )
          ) {
            distractores.push(g);
          }
        }
      );

      if (
        distractores.length < 3 &&
        genericas.length === 0
      ) {
        break;
      }
    }

    if (distractores.length < 3) {
      return null;
    }

    /*
     * Seleccionamos 3 distractores.
     */
    const tresDistractores =
      mezclarArray(
        distractores
      ).slice(0, 3);

    /*
     * Respuesta correcta + distractores.
     */
    const opcionesBase = [
      correctaTexto,
      ...tresDistractores,
    ];

    /*
     * Mezclamos A/B/C/D.
     */
    const opciones =
      mezclarArray(
        opcionesBase
      );

    const correcta =
      opciones.findIndex(
        (opcion) =>
          normalizar(opcion) ===
          normalizar(
            correctaTexto
          )
      );

    return {
      opciones,
      correcta,
    };
  }

  /* =========================================================
     EXTRAER FRASES COMPLETAS
     ========================================================= */

  function extraerFrases(
    texto: string
  ): string[] {
    const limpio =
      limpiarTexto(texto);

    if (!limpio) return [];

    /*
     * Primero intentamos separar por oraciones.
     */
    const oraciones =
      limpio
        .split(
          /(?<=[.!?])\s+/
        )
        .map((x) =>
          limpiarFrase(x)
        )
        .filter(Boolean);

    const resultado: string[] = [];

    oraciones.forEach(
      (oracion) => {
        const palabras =
          contarPalabras(
            oracion
          );

        /*
         * Queremos frases completas,
         * no pedazos.
         */
        if (
          palabras >= 9 &&
          palabras <= 30
        ) {
          resultado.push(
            oracion
          );

          return;
        }

        /*
         * Si una oración es muy larga,
         * intentamos separar por punto y coma.
         */
        if (palabras > 30) {
          const partes =
            oracion.split(
              /[;]/
            );

          partes.forEach(
            (parte) => {
              const p =
                limpiarFrase(
                  parte
                );

              const cantidad =
                contarPalabras(
                  p
                );

              if (
                cantidad >= 9 &&
                cantidad <= 30
              ) {
                resultado.push(
                  p
                );
              }
            }
          );
        }
      }
    );

    /*
     * Si no encontramos frases completas,
     * usamos el texto entero si no es exageradamente largo.
     */
    if (
      resultado.length === 0 &&
      contarPalabras(limpio) >= 9 &&
      contarPalabras(limpio) <= 30
    ) {
      resultado.push(
        limpiarFrase(limpio)
      );
    }

    return eliminarRepetidos(
      resultado
    );
  }

  /* =========================================================
     RESPUESTA COMPLETA
     ========================================================= */

  function prepararRespuestaCompleta(
    texto: string | null
  ): string {
    if (!texto) return "";

    let limpio =
      limpiarTexto(texto);

    /*
     * Quitamos encabezados innecesarios.
     */
    limpio = limpio.replace(
      /^(se dice que|según la historia|según la leyenda|es conocido por|se caracteriza por|de acuerdo con la historia|de acuerdo con la leyenda)\s+/i,
      ""
    );

    limpio =
      limpiarFrase(limpio);

    /*
     * NO cortamos palabras.
     *
     * NO ponemos "..."
     *
     * Si tiene varias oraciones, nos quedamos
     * con una oración completa.
     */
    const oraciones =
      limpio
        .split(
          /(?<=[.!?])\s+/
        )
        .map((x) =>
          limpiarFrase(x)
        )
        .filter(Boolean);

    if (oraciones.length > 0) {
      /*
       * Preferimos una oración completa
       * entre 9 y 30 palabras.
       */
      const adecuada =
        oraciones.find(
          (oracion) => {
            const n =
              contarPalabras(
                oracion
              );

            return (
              n >= 9 &&
              n <= 30
            );
          }
        );

      if (adecuada) {
        return adecuada;
      }

      /*
       * Si no existe, elegimos la primera oración
       * completa que tenga suficiente contenido.
       */
      const primeraLarga =
        oraciones.find(
          (oracion) =>
            contarPalabras(
              oracion
            ) >= 7
        );

      if (primeraLarga) {
        return primeraLarga;
      }
    }

    /*
     * Intentamos usar el texto completo.
     */
    return limpiarFrase(
      limpio
    );
  }

  /* =========================================================
     ALTERNATIVAS DESDE EL MISMO CONTENIDO
     ========================================================= */

  function crearAlternativasDesdeContenido(
    texto: string
  ): string[] {
    const limpio =
      limpiarTexto(texto);

    const resultado: string[] = [];

    /*
     * Separamos por oraciones.
     */
    const partes =
      limpio
        .split(
          /(?<=[.!?])\s+/
        )
        .map((x) =>
          limpiarFrase(x)
        )
        .filter(Boolean);

    /*
     * Si hay varias oraciones,
     * usamos las otras como distractores.
     */
    partes.forEach(
      (parte) => {
        if (
          contarPalabras(
            parte
          ) >= 9 &&
          contarPalabras(
            parte
          ) <= 30
        ) {
          resultado.push(
            parte
          );
        }
      }
    );

    /*
     * También intentamos separar bloques por punto y coma.
     */
    if (
      resultado.length < 3
    ) {
      const bloques =
        limpio
          .split(";")
          .map((x) =>
            limpiarFrase(x)
          )
          .filter(Boolean);

      bloques.forEach(
        (bloque) => {
          if (
            contarPalabras(
              bloque
            ) >= 9 &&
            contarPalabras(
              bloque
            ) <= 30
          ) {
            resultado.push(
              bloque
            );
          }
        }
      );
    }

    return eliminarRepetidos(
      resultado
    );
  }

  /* =========================================================
     DISTRACTORES GENERALES
     ========================================================= */

  function crearDistractoresGenerales(
    tipo: string,
    existentes: string[]
  ): string[] {
    const posibles: string[] =
      [];

    if (tipo === "Historia") {
      posibles.push(
        "La información corresponde a un aspecto histórico documentado dentro del contexto cultural de la región.",
        "El contenido describe un acontecimiento relacionado con el desarrollo histórico y la tradición cultural.",
        "La afirmación se refiere a un proceso histórico que forma parte de la memoria cultural del lugar.",
        "El dato explica un elemento del pasado que contribuyó a la historia cultural de la comunidad."
      );
    }

    if (tipo === "Dato curioso") {
      posibles.push(
        "La información presenta una particularidad cultural que ayuda a conocer mejor las características de la tradición.",
        "El dato destaca una característica poco conocida relacionada con la cultura y las costumbres de la comunidad.",
        "La información señala un aspecto particular que diferencia esta tradición dentro de su contexto cultural.",
        "El contenido presenta una curiosidad relacionada con las costumbres, la historia y la identidad cultural."
      );
    }

    if (tipo === "Características") {
      posibles.push(
        "La descripción señala elementos físicos, culturales o históricos que permiten reconocer sus características principales.",
        "La información reúne aspectos que ayudan a comprender la importancia cultural y las particularidades de este patrimonio.",
        "El contenido describe elementos representativos relacionados con su valor cultural, histórico y tradicional.",
        "La afirmación reúne características relacionadas con la forma, función, historia y significado cultural."
      );
    }

    if (tipo === "Leyenda") {
      posibles.push(
        "El relato forma parte de una tradición transmitida culturalmente a través de historias y creencias populares.",
        "La narración pertenece al conjunto de relatos tradicionales que explican hechos mediante elementos culturales y simbólicos.",
        "La historia se relaciona con una creencia popular transmitida entre generaciones dentro de la tradición local.",
        "El relato contiene elementos simbólicos propios de las historias tradicionales y de la memoria cultural."
      );
    }

    return posibles.filter(
      (x) =>
        !existentes.some(
          (e) =>
            normalizar(e) ===
            normalizar(x)
        )
    );
  }

  /* =========================================================
     DETECTAR NOMBRES DE LUGARES
     ========================================================= */

  function contieneNombreDeLugar(
    texto: string,
    hitos: Hito[]
  ): boolean {
    const textoNormalizado =
      normalizar(texto);

    /*
     * Revisamos los nombres de los hitos.
     */
    for (const hito of hitos) {
      const nombre =
        normalizar(
          hito.nombre
        );

      if (
        !nombre ||
        nombre.length < 4
      ) {
        continue;
      }

      /*
       * Solo buscamos nombres de varias palabras
       * o nombres suficientemente distintivos.
       */
      if (
        nombre.includes(" ")
      ) {
        if (
          textoNormalizado.includes(
            nombre
          )
        ) {
          return true;
        }
      } else {
        /*
         * Para nombres de una sola palabra,
         * exigimos que sea una palabra completa.
         */
        const regex =
          new RegExp(
            `\\b${escaparRegex(
              nombre
            )}\\b`,
            "i"
          );

        if (
          regex.test(
            textoNormalizado
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function escaparRegex(
    texto: string
  ) {
    return texto.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
  }

  /* =========================================================
     LIMPIEZA
     ========================================================= */

  function limpiarFrase(
    texto: string
  ): string {
    return texto
      .replace(
        /\s+/g,
        " "
      )
      .replace(
        /^[-•]\s*/,
        ""
      )
      .replace(
        /^[,;:\s]+/,
        ""
      )
      .replace(
        /[,;:\s]+$/,
        ""
      )
      .trim();
  }

  function limpiarTexto(
    texto: string | null
  ) {
    if (!texto) return "";

    return texto
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function normalizar(
    texto: string
  ) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[.,;:!?¿¡"']/g,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function contarPalabras(
    texto: string
  ) {
    return texto
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .length;
  }

  /* =========================================================
     SIMILITUD
     ========================================================= */

  function similitudTexto(
    a: string,
    b: string
  ) {
    const palabrasA =
      new Set(
        normalizar(a)
          .split(" ")
          .filter(Boolean)
      );

    const palabrasB =
      new Set(
        normalizar(b)
          .split(" ")
          .filter(Boolean)
      );

    if (
      palabrasA.size === 0 ||
      palabrasB.size === 0
    ) {
      return 0;
    }

    let iguales = 0;

    palabrasA.forEach(
      (palabra) => {
        if (
          palabrasB.has(
            palabra
          )
        ) {
          iguales++;
        }
      }
    );

    const union =
      new Set([
        ...palabrasA,
        ...palabrasB,
      ]).size;

    return iguales / union;
  }

  /* =========================================================
     REPETIDOS
     ========================================================= */

  function eliminarRepetidos(
    array: string[]
  ) {
    return array.filter(
      (
        texto,
        index,
        todos
      ) =>
        todos.findIndex(
          (otro) =>
            normalizar(
              otro
            ) ===
            normalizar(
              texto
            )
        ) === index
    );
  }

  /* =========================================================
     OBTENER CONTENIDO
     ========================================================= */

  function obtenerContenido(
    hito: Hito,
    tipo: string
  ): string | null {
    if (
      tipo === "Historia"
    ) {
      return hito.historia;
    }

    if (
      tipo === "Dato curioso"
    ) {
      return hito.dato_curioso;
    }

    if (
      tipo === "Características"
    ) {
      return hito.descripcion;
    }

    if (
      tipo === "Leyenda"
    ) {
      return hito.leyenda;
    }

    return null;
  }

  /* =========================================================
     EXPLICACIÓN
     ========================================================= */

  function crearExplicacion(
    tipo: string,
    lugar: string
  ) {
    if (
      tipo === "Historia"
    ) {
      return `La respuesta corresponde a la información histórica registrada sobre ${lugar}.`;
    }

    if (
      tipo === "Dato curioso"
    ) {
      return `La respuesta corresponde a uno de los datos curiosos registrados sobre ${lugar}.`;
    }

    if (
      tipo === "Características"
    ) {
      return `La respuesta describe una característica registrada de ${lugar}.`;
    }

    if (
      tipo === "Leyenda"
    ) {
      return `La respuesta corresponde al relato tradicional asociado con ${lugar}.`;
    }

    return `La respuesta coincide con la información registrada sobre ${lugar}.`;
  }

  /* =========================================================
     MEZCLAR
     ========================================================= */

  function mezclarArray<T>(
    array: T[]
  ): T[] {
    const copia = [...array];

    for (
      let i = copia.length - 1;
      i > 0;
      i--
    ) {
      const j =
        Math.floor(
          Math.random() *
            (i + 1)
        );

      [
        copia[i],
        copia[j],
      ] = [
        copia[j],
        copia[i],
      ];
    }

    return copia;
  }

  function seleccionarPreguntasAleatorias(
    todas: Pregunta[],
    cantidadSolicitada: number
  ) {
    return mezclarArray(
      todas
    ).slice(
      0,
      Math.min(
        cantidadSolicitada,
        MAX_PREGUNTAS
      )
    );
  }

  /* =========================================================
     RESPUESTAS
     ========================================================= */

  function seleccionarRespuesta(
    opcion: number
  ) {
    if (finalizado) return;

    /*
     * El usuario puede cambiar la respuesta
     * antes de pulsar Siguiente.
     */
    setRespuestaSeleccionada(
      opcion
    );
  }

  async function siguientePregunta() {
    if (
      respuestaSeleccionada ===
      null
    ) {
      return;
    }

    const nuevasRespuestas = [
      ...respuestas,
    ];

    nuevasRespuestas[indice] =
      respuestaSeleccionada;

    setRespuestas(
      nuevasRespuestas
    );

    if (
      indice <
      preguntas.length - 1
    ) {
      setIndice(
        (actual) =>
          actual + 1
      );

      setRespuestaSeleccionada(
        null
      );
    } else {
      await finalizarQuiz(
        nuevasRespuestas
      );
    }
  }

  /* =========================================================
     FINALIZAR QUIZ
     ========================================================= */

  async function finalizarQuiz(
    respuestasFinales: number[]
  ) {
    if (guardando) return;

    setGuardando(true);

    try {
      const aciertos =
        preguntas.reduce(
          (
            total,
            pregunta,
            i
          ) => {
            return (
              total +
              (respuestasFinales[
                i
              ] ===
              pregunta.correcta
                ? 1
                : 0)
            );
          },
          0
        );

      const puntos =
        aciertos * 5;

      const { data: sesion } =
        await supabase.auth.getUser();

      if (sesion?.user) {
        const { error } =
          await supabase
            .from(
              "quiz_resultados"
            )
            .insert({
              usuario_id:
                sesion.user.id,
              aciertos,
              total_preguntas:
                preguntas.length,
              puntos_obtenidos:
                puntos,
            });

        if (error) {
          console.error(
            "Error guardando resultado:",
            error
          );
        }

        await actualizarProgreso(
          sesion.user.id,
          puntos
        );
        const nuevasInsignias = await verificarYDesbloquearInsignias(sesion.user.id);
        if (nuevasInsignias.length > 0) {
          Alert.alert(
            "¡Nueva insignia desbloqueada! 🎉",
            nuevasInsignias.map((i) => `${i.icono ?? "🏅"} ${i.nombre}`).join("\n"),
          );
        }

        const retosCompletados = await revisarYCompletarRetos(sesion.user.id);
        if (retosCompletados.length > 0) {
          Alert.alert(
            "¡Reto completado! 🏆",
            retosCompletados.map((r) => `${r.icono ?? "🏆"} ${r.nombre} (+${r.recompensa_puntos} pts)`).join("\n"),
          );
        }
      }

      setRespuestas(
        respuestasFinales
      );

      setFinalizado(true);
      setPantalla(
        "resultado"
      );
    } catch (error) {
      console.error(
        "Error finalizando quiz:",
        error
      );

      Alert.alert(
        "Error",
        "No se pudo guardar el resultado."
      );
    } finally {
      setGuardando(false);
    }
  }

  /* =========================================================
     PROGRESO
     ========================================================= */

  async function actualizarProgreso(
    usuarioId: string,
    puntosQuiz: number
  ) {
    try {
      const {
        data: visitas,
      } = await supabase
        .from(
          "interacciones_usuario"
        )
        .select("hito_id")
        .eq(
          "usuario_id",
          usuarioId
        )
        .eq(
          "tipo_interaccion",
          "visita"
        );

      const lugaresVisitados =
        new Set(
          (visitas ?? []).map(
            (item) =>
              item.hito_id
          )
        );

      const {
        data: resultados,
      } = await supabase
        .from(
          "quiz_resultados"
        )
        .select(
          "puntos_obtenidos"
        )
        .eq(
          "usuario_id",
          usuarioId
        );

      const puntosQuizTotales =
        (
          resultados ?? []
        ).reduce(
          (
            total,
            resultado
          ) =>
            total +
            (resultado.puntos_obtenidos ??
              0),
          0
        );

      void puntosQuiz;

      const puntosVisitas =
        lugaresVisitados.size *
        10;

      const puntosTotales =
        puntosVisitas +
        puntosQuizTotales;

      const nivel =
        calcularNivel(
          puntosTotales
        );

      await supabase
        .from(
          "progreso_usuario"
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
    } catch (error) {
      console.error(
        "Error actualizando progreso:",
        error
      );
    }
  }

  function calcularNivel(
    puntos: number
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

  /* =========================================================
     NAVEGACIÓN
     ========================================================= */

  function volverCategorias() {
    setCategoriaSeleccionada(
      null
    );

    setPreguntas([]);
    setRespuestas([]);
    setRespuestaSeleccionada(
      null
    );

    setIndice(0);
    setFinalizado(false);

    setPantalla(
      "categorias"
    );
  }

  function reiniciarMismaCategoria() {
    if (!categoriaSeleccionada)
      return;

    setPantalla(
      "configuracion"
    );

    setPreguntas([]);
    setRespuestas([]);
    setRespuestaSeleccionada(
      null
    );

    setIndice(0);
    setFinalizado(false);
  }

  /* =========================================================
     RESULTADO MEMO
     ========================================================= */

  const preguntaActual =
    preguntas[indice];

  const resultado =
    useMemo<QuizResultado[]>(
      () => {
        if (!finalizado)
          return [];

        return preguntas.map(
          (pregunta, i) => ({
            pregunta,
            respuesta:
              respuestas[i] !==
              undefined
                ? pregunta
                    .opciones[
                      respuestas[i]
                    ]
                : "Sin responder",

            correcta:
              respuestas[i] ===
              pregunta.correcta,
          })
        );
      },
      [
        finalizado,
        preguntas,
        respuestas,
      ]
    );

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
          color={COLOR}
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
          Cargando categorías...
        </Text>
      </View>
    );
  }

  /* =========================================================
     CATEGORÍAS
     ========================================================= */

  if (
    pantalla ===
    "categorias"
  ) {
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
          style={
            styles.encabezado
          }
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

        <View
          style={[
            styles.introCard,
            {
              backgroundColor:
                colores.tarjeta,
            },
          ]}
        >
          <Text
            style={[
              styles.tituloIntro,
              {
                color:
                  colores.texto,
              },
            ]}
          >
            Elige una categoría
          </Text>

          <Text
            style={[
              styles.subtituloIntro,
              {
                color:
                  colores.textoSecundario,
              },
            ]}
          >
            Selecciona un tema para
            comenzar tu quiz.
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
          Categorías
        </Text>

        {categorias.map(
          (categoria) => (
            <TouchableOpacity
              key={
                categoria.id
              }
              style={[
                styles.categoriaCard,
                {
                  backgroundColor:
                    colores.tarjeta,
                  borderColor:
                    colores.borde,
                },
              ]}
              onPress={() =>
                seleccionarCategoria(
                  categoria
                )
              }
            >
              <View
                style={
                  styles.iconoCategoria
                }
              >
                <Ionicons
                  name="book-outline"
                  size={24}
                  color={COLOR}
                />
              </View>

              <View
                style={
                  styles.categoriaInfo
                }
              >
                <Text
                  style={[
                    styles.categoriaNombre,
                    {
                      color:
                        colores.texto,
                    },
                  ]}
                >
                  {
                    categoria.nombre
                  }
                </Text>

                <Text
                  style={[
                    styles.categoriaDescripcion,
                    {
                      color:
                        colores.textoSecundario,
                    },
                  ]}
                >
                  Quiz de hasta{" "}
                  {limiteCategoria(
                    categoria.nombre
                  )}{" "}
                  preguntas
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={22}
                color={
                  colores.textoSecundario
                }
              />
            </TouchableOpacity>
          )
        )}

        {categorias.length ===
          0 && (
          <View
            style={[
              styles.sinCategorias,
              {
                backgroundColor:
                  colores.tarjeta,
              },
            ]}
          >
            <Text
              style={{
                color:
                  colores.textoSecundario,
                textAlign:
                  "center",
              }}
            >
              No hay categorías
              disponibles.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  /* =========================================================
     CONFIGURACIÓN
     ========================================================= */

  if (
    pantalla ===
    "configuracion"
  ) {
    const limite =
      categoriaSeleccionada
        ? limiteCategoria(
            categoriaSeleccionada.nombre
          )
        : 5;

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
          style={
            styles.encabezado
          }
        >
          <TouchableOpacity
            onPress={
              volverCategorias
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
            Configurar quiz
          </Text>

          <View
            style={{
              width: 26,
            }}
          />
        </View>

        <View
          style={[
            styles.configCard,
            {
              backgroundColor:
                colores.tarjeta,
            },
          ]}
        >
          <Text
            style={
              styles.configIcono
            }
          >
            📚
          </Text>

          <Text
            style={[
              styles.configTitulo,
              {
                color:
                  colores.texto,
              },
            ]}
          >
            {
              categoriaSeleccionada?.nombre
            }
          </Text>

          <Text
            style={[
              styles.configTexto,
              {
                color:
                  colores.textoSecundario,
              },
            ]}
          >
            Las preguntas y respuestas
            se seleccionarán
            aleatoriamente.
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
          ¿Cuántas preguntas?
        </Text>

        <View
          style={
            styles.cantidades
          }
        >
          {[5, 10, 15].map(
            (numero) => {
              const desactivado =
                numero > limite;

              const activo =
                cantidad ===
                numero;

              return (
                <TouchableOpacity
                  key={numero}
                  disabled={
                    desactivado
                  }
                  onPress={() =>
                    cambiarCantidad(
                      numero
                    )
                  }
                  style={[
                    styles.cantidad,
                    {
                      backgroundColor:
                        activo
                          ? COLOR
                          : desactivado
                          ? colores.borde
                          : colores.tarjeta,

                      borderColor:
                        activo
                          ? COLOR
                          : colores.borde,

                      opacity:
                        desactivado
                          ? 0.45
                          : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.numeroCantidad,
                      {
                        color:
                          activo
                            ? "#fff"
                            : colores.texto,
                      },
                    ]}
                  >
                    {numero}
                  </Text>

                  <Text
                    style={[
                      styles.textoCantidad,
                      {
                        color:
                          activo
                            ? "#fff"
                            : colores.textoSecundario,
                      },
                    ]}
                  >
                    preguntas
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </View>

        <Text
          style={[
            styles.ayudaCantidad,
            {
              color:
                colores.textoSecundario,
            },
          ]}
        >
          Máximo para esta categoría:{" "}
          {limite} preguntas.
        </Text>

        <TouchableOpacity
          style={[
            styles.botonPrincipal,
            {
              opacity:
                cargandoQuiz
                  ? 0.6
                  : 1,
            },
          ]}
          disabled={
            cargandoQuiz
          }
          onPress={
            iniciarQuiz
          }
        >
          {cargandoQuiz ? (
            <ActivityIndicator
              color="#fff"
            />
          ) : (
            <>
              <Text
                style={
                  styles.textoBoton
                }
              >
                Comenzar quiz
              </Text>

              <Ionicons
                name="play"
                size={19}
                color="#fff"
              />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  /* =========================================================
     QUIZ
     ========================================================= */

  if (
    pantalla === "quiz" &&
    preguntaActual
  ) {
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
          style={
            styles.encabezado
          }
        >
          <TouchableOpacity
            onPress={
              volverCategorias
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
            {
              categoriaSeleccionada?.nombre
            }
          </Text>

          <View
            style={{
              width: 26,
            }}
          />
        </View>

        <View
          style={
            styles.progresoContainer
          }
        >
          <View
            style={
              styles.progresoFila
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
              Pregunta{" "}
              {indice + 1} de{" "}
              {
                preguntas.length
              }
            </Text>

            <Text
              style={[
                styles.progresoNumero,
                {
                  color: COLOR,
                },
              ]}
            >
              {Math.round(
                ((indice + 1) /
                  preguntas.length) *
                  100
              )}
              %
            </Text>
          </View>

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
            color={COLOR}
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
            {
              preguntaActual.lugar
            }
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
                color: COLOR,
              },
            ]}
          >
            {
              preguntaActual.tipo
            }
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
            {
              preguntaActual.pregunta
            }
          </Text>
        </View>

        {preguntaActual.opciones.map(
          (
            opcion,
            opcionIndex
          ) => {
            const seleccionada =
              respuestaSeleccionada ===
              opcionIndex;

            const letra =
              String.fromCharCode(
                65 +
                  opcionIndex
              );

            return (
              <TouchableOpacity
                key={
                  opcionIndex
                }
                onPress={() =>
                  seleccionarRespuesta(
                    opcionIndex
                  )
                }
                activeOpacity={
                  0.8
                }
                style={[
                  styles.opcion,
                  {
                    backgroundColor:
                      seleccionada
                        ? COLOR_SELECCION
                        : colores.tarjeta,

                    borderColor:
                      seleccionada
                        ? COLOR
                        : colores.borde,
                  },
                ]}
              >
                {/* CÍRCULO/CAJA DE LETRA */}
                <View
                  style={[
                    styles.letra,
                    {
                      backgroundColor:
                        seleccionada
                          ? COLOR
                          : "#E8F1F8",

                      borderColor:
                        COLOR,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.letraTexto,
                      {
                        color:
                          seleccionada
                            ? "#FFFFFF"
                            : COLOR,
                      },
                    ]}
                  >
                    {letra}
                  </Text>
                </View>

                {/* TEXTO */}
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

                {seleccionada && (
                  <View
                    style={
                      styles.checkContainer
                    }
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={
                        COLOR
                      }
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          }
        )}

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
            styles.botonPrincipal,
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
     RESULTADO
     ========================================================= */

  if (
    pantalla ===
    "resultado"
  ) {
    const aciertos =
      resultado.filter(
        (item) =>
          item.correcta
      ).length;

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
          style={
            styles.encabezado
          }
        >
          <TouchableOpacity
            onPress={
              volverCategorias
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
            style={
              styles.trofeo
            }
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
                color: COLOR,
              },
            ]}
          >
            {aciertos}/
            {
              preguntas.length
            }
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
          Revisión
        </Text>

        {resultado.map(
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
                Pregunta{" "}
                {index + 1}
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
                  item
                    .pregunta
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
                {
                  item.respuesta
                }
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
                  Correcta:{" "}
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
                  item
                    .pregunta
                    .explicacion
                }
              </Text>
            </View>
          )
        )}

        <TouchableOpacity
          style={
            styles.botonPrincipal
          }
          onPress={
            reiniciarMismaCategoria
          }
        >
          <Text
            style={
              styles.textoBoton
            }
          >
            Otro quiz de esta categoría
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.botonSecundario
          }
          onPress={
            volverCategorias
          }
        >
          <Text
            style={
              styles.textoBotonSecundario
            }
          >
            Elegir otra categoría
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.botonSecundario
          }
          onPress={() =>
            router.push(
              "/niveles"
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

  return null;
}

/* ===========================================================
   ESTILOS
   =========================================================== */

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

  introCard: {
    borderRadius: 22,
    padding: 25,
    alignItems: "center",
    elevation: 3,
  },

  tituloIntro: {
    fontSize: 23,
    fontWeight: "bold",
    textAlign: "center",
  },

  subtituloIntro: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
  },

  seccionTitulo: {
    fontSize: 19,
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 12,
  },

  categoriaCard: {
    minHeight: 78,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  iconoCategoria: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor:
      "#E8F1F8",
    justifyContent:
      "center",
    alignItems: "center",
    marginRight: 12,
  },

  categoriaInfo: {
    flex: 1,
  },

  categoriaNombre: {
    fontSize: 16,
    fontWeight: "bold",
  },

  categoriaDescripcion: {
    fontSize: 12,
    marginTop: 4,
  },

  sinCategorias: {
    padding: 25,
    borderRadius: 16,
  },

  configCard: {
    borderRadius: 22,
    padding: 28,
    alignItems: "center",
    elevation: 3,
  },

  configIcono: {
    fontSize: 50,
  },

  configTitulo: {
    fontSize: 23,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 8,
  },

  configTexto: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  cantidades: {
    flexDirection: "row",
    gap: 10,
  },

  cantidad: {
    flex: 1,
    minHeight: 85,
    borderWidth: 1.5,
    borderRadius: 16,
    justifyContent:
      "center",
    alignItems: "center",
  },

  numeroCantidad: {
    fontSize: 26,
    fontWeight: "bold",
  },

  textoCantidad: {
    fontSize: 11,
    marginTop: 2,
  },

  ayudaCantidad: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 12,
  },

  botonPrincipal: {
    minHeight: 52,
    backgroundColor: COLOR,
    borderRadius: 16,
    alignItems: "center",
    justifyContent:
      "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 22,
    paddingHorizontal: 18,
  },

  textoBoton: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },

  botonSecundario: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: COLOR,
    borderRadius: 16,
    alignItems: "center",
    justifyContent:
      "center",
    marginTop: 12,
    paddingHorizontal: 18,
  },

  textoBotonSecundario: {
    color: COLOR,
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },

  progresoContainer: {
    marginBottom: 18,
  },

  progresoFila: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    marginBottom: 7,
  },

  progresoTexto: {
    fontSize: 13,
  },

  progresoNumero: {
    fontSize: 13,
    fontWeight: "bold",
  },

  progresoFondo: {
    height: 7,
    borderRadius: 10,
    overflow: "hidden",
  },

  progreso: {
    height: 7,
    backgroundColor: COLOR,
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
    textTransform:
      "uppercase",
    marginBottom: 10,
  },

  pregunta: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },

  /*
   * OPCIONES MÁS GRANDES
   *
   * Ahora tienen suficiente espacio para
   * 3 o 4 líneas.
   */
  opcion: {
    minHeight: 108,
    borderWidth: 1.5,
    borderRadius: 17,
    marginBottom: 14,
    paddingVertical: 15,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  /*
   * Ya no usamos fondo blanco.
   * La letra tiene fondo azul claro
   * y borde azul para que SIEMPRE se vea.
   */
  letra: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent:
      "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 2,
    flexShrink: 0,
  },

  letraTexto: {
    fontSize: 16,
    fontWeight: "900",
    includeFontPadding: false,
    textAlign: "center",
  },

  opcionTexto: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
    paddingTop: 1,
    paddingRight: 4,
  },

  checkContainer: {
    width: 26,
    minHeight: 42,
    justifyContent:
      "center",
    alignItems: "center",
    marginLeft: 4,
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
    lineHeight: 18,
  },

  respuestaCorrecta: {
    marginTop: 6,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 18,
  },

  explicacion: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
  },
});