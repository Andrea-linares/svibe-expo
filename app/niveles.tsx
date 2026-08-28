import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Progreso = {
  usuario_id: string;
  puntos: number;
  nivel: number;
  actualizado_en: string;
};

type NivelInfo = {
  nivel: number;
  nombre: string;
  minimo: number;
  maximo: number | null;
  beneficio: string;
  icono: string;
};

const NIVELES: NivelInfo[] = [
  {
    nivel: 1,
    nombre: "Explorador",
    minimo: 0,
    maximo: 49,
    beneficio:
      "Acceso al perfil de explorador y seguimiento de tus puntos.",
    icono: "🧭",
  },
  {
    nivel: 2,
    nombre: "Viajero",
    minimo: 50,
    maximo: 149,
    beneficio:
      "Desbloqueas nuevas insignias y mejoras tu progreso de exploración.",
    icono: "🥾",
  },
  {
    nivel: 3,
    nombre: "Conocedor",
    minimo: 150,
    maximo: 299,
    beneficio:
      "Obtienes reconocimiento por conocer más lugares y completar retos.",
    icono: "🏛️",
  },
  {
    nivel: 4,
    nombre: "Experto cultural",
    minimo: 300,
    maximo: 499,
    beneficio:
      "Acceso al reconocimiento de experto y mayores logros culturales.",
    icono: "🏆",
  },
  {
    nivel: 5,
    nombre: "Maestro explorador",
    minimo: 500,
    maximo: null,
    beneficio:
      "Has alcanzado el máximo nivel de exploración cultural.",
    icono: "👑",
  },
];

export default function NivelesScreen() {
  const { colores } = useTema();

  const [progreso, setProgreso] =
    useState<Progreso | null>(null);

  const [lugaresVisitados, setLugaresVisitados] =
    useState(0);

  const [puntosQuiz, setPuntosQuiz] =
    useState(0);

  const [cargando, setCargando] =
    useState(true);

  const [refrescando, setRefrescando] =
    useState(false);

  const cargarDatos = useCallback(
    async () => {
      try {
        const { data: sesion } =
          await supabase.auth.getUser();

        if (!sesion?.user) {
          setProgreso(null);
          return;
        }

        const usuarioId =
          sesion.user.id;

        const { data: progresoData } =
          await supabase
            .from("progreso_usuario")
            .select(
              `
                usuario_id,
                puntos,
                nivel,
                actualizado_en
              `,
            )
            .eq(
              "usuario_id",
              usuarioId,
            )
            .maybeSingle();

        if (progresoData) {
          setProgreso(
            progresoData as Progreso,
          );
        } else {
          setProgreso({
            usuario_id: usuarioId,
            puntos: 0,
            nivel: 1,
            actualizado_en:
              new Date().toISOString(),
          });
        }

        const { data: visitas } =
          await supabase
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

        const lugares = new Set(
          (visitas ?? []).map(
            (item) => item.hito_id,
          ),
        );

        setLugaresVisitados(
          lugares.size,
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

        const totalQuiz =
          (resultados ?? []).reduce(
            (total, item) =>
              total +
              (item.puntos_obtenidos ??
                0),
            0,
          );

        setPuntosQuiz(totalQuiz);
      } catch (error) {
        console.error(
          "Error cargando niveles:",
          error,
        );
      } finally {
        setCargando(false);
        setRefrescando(false);
      }
    },
    [],
  );

  useState(() => {
    cargarDatos();
  });

  const puntos =
    progreso?.puntos ?? 0;

  const nivel =
    progreso?.nivel ?? 1;

  const infoNivel =
    NIVELES.find(
      (item) =>
        item.nivel === nivel,
    ) ?? NIVELES[0];

  const siguienteNivel =
    NIVELES.find(
      (item) =>
        item.nivel === nivel + 1,
    );

  let porcentaje = 100;

  if (siguienteNivel) {
    const inicio =
      infoNivel.minimo;

    const final =
      siguienteNivel.minimo;

    porcentaje = Math.min(
      100,
      Math.max(
        0,
        ((puntos - inicio) /
          (final - inicio)) *
          100,
      ),
    );
  }

  const puntosFaltantes =
    siguienteNivel
      ? Math.max(
          0,
          siguienteNivel.minimo -
            puntos,
        )
      : 0;

  const beneficioSiguiente =
    siguienteNivel?.beneficio ??
    "No hay un nivel superior. ¡Has llegado a la cima!";

  async function refrescar() {
    setRefrescando(true);
    await cargarDatos();
  }

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
            styles.cargando,
            {
              color:
                colores.texto,
            },
          ]}
        >
          Cargando tu progreso...
        </Text>
      </View>
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
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={refrescar}
        />
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
            styles.tituloEncabezado,
            {
              color:
                colores.texto,
            },
          ]}
        >
          Mis niveles
        </Text>

        <View
          style={{ width: 26 }}
        />
      </View>

      <View
        style={[
          styles.cardNivel,
          {
            backgroundColor:
              colores.tarjeta,
          },
        ]}
      >
        <Text style={styles.iconoNivel}>
          {infoNivel.icono}
        </Text>

        <Text
          style={[
            styles.nombreNivel,
            {
              color:
                colores.texto,
            },
          ]}
        >
          Nivel {nivel}
        </Text>

        <Text
          style={[
            styles.nombreNivelGrande,
            {
              color:
                colores.texto,
            },
          ]}
        >
          {infoNivel.nombre}
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
          {puntos} puntos
        </Text>
      </View>

      <View
        style={[
          styles.progresoCard,
          {
            backgroundColor:
              colores.tarjeta,
          },
        ]}
      >
        <View
          style={
            styles.filaEntre
          }
        >
          <Text
            style={[
              styles.tituloCard,
              {
                color:
                  colores.texto,
              },
            ]}
          >
            Progreso
          </Text>

          <Text
            style={[
              styles.porcentaje,
              {
                color:
                  colores.texto,
              },
            ]}
          >
            {Math.round(
              porcentaje,
            )}
            %
          </Text>
        </View>

        <View
          style={[
            styles.barraFondo,
            {
              backgroundColor:
                colores.borde,
            },
          ]}
        >
          <View
            style={[
              styles.barra,
              {
                width: `${porcentaje}%`,
              },
            ]}
          />
        </View>

        {siguienteNivel ? (
          <Text
            style={[
              styles.textoProgreso,
              {
                color:
                  colores.textoSecundario,
              },
            ]}
          >
            Te faltan{" "}
            <Text
              style={
                styles.textoDestacado
              }
            >
              {puntosFaltantes} puntos
            </Text>{" "}
            para llegar al nivel{" "}
            {siguienteNivel.nivel}.
          </Text>
        ) : (
          <Text
            style={[
              styles.textoProgreso,
              {
                color:
                  colores.textoSecundario,
              },
            ]}
          >
            ¡Has alcanzado el nivel
            máximo!
          </Text>
        )}
      </View>

      <Text
        style={[
          styles.seccion,
          {
            color:
              colores.texto,
          },
        ]}
      >
        Tu avance
      </Text>

      <View style={styles.estadisticas}>
        <View
          style={[
            styles.estadistica,
            {
              backgroundColor:
                colores.tarjeta,
            },
          ]}
        >
          <Text style={styles.estadisticaIcono}>
            📍
          </Text>

          <Text
            style={[
              styles.estadisticaNumero,
              {
                color:
                  colores.texto,
              },
            ]}
          >
            {lugaresVisitados}
          </Text>

          <Text
            style={[
              styles.estadisticaTexto,
              {
                color:
                  colores.textoSecundario,
              },
            ]}
          >
            Lugares visitados
          </Text>
        </View>

        <View
          style={[
            styles.estadistica,
            {
              backgroundColor:
                colores.tarjeta,
            },
          ]}
        >
          <Text style={styles.estadisticaIcono}>
            🧠
          </Text>

          <Text
            style={[
              styles.estadisticaNumero,
              {
                color:
                  colores.texto,
              },
            ]}
          >
            {puntosQuiz}
          </Text>

          <Text
            style={[
              styles.estadisticaTexto,
              {
                color:
                  colores.textoSecundario,
              },
            ]}
          >
            Puntos de quiz
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.seccion,
          {
            color:
              colores.texto,
          },
        ]}
      >
        Beneficio del siguiente nivel
      </Text>

      <View
        style={[
          styles.beneficioCard,
          {
            backgroundColor:
              colores.tarjeta,
          },
        ]}
      >
        <Text style={styles.beneficioIcono}>
          🎁
        </Text>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.beneficioTitulo,
              {
                color:
                  colores.texto,
              },
            ]}
          >
            {siguienteNivel
              ? `Nivel ${siguienteNivel.nivel} · ${siguienteNivel.nombre}`
              : "Nivel máximo"}
          </Text>

          <Text
            style={[
              styles.beneficioTexto,
              {
                color:
                  colores.textoSecundario,
              },
            ]}
          >
            {beneficioSiguiente}
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.seccion,
          {
            color:
              colores.texto,
          },
        ]}
      >
        Todos los niveles
      </Text>

      {NIVELES.map(
        (item) => {
          const desbloqueado =
            nivel >= item.nivel;

          return (
            <View
              key={item.nivel}
              style={[
                styles.nivelFila,
                {
                  backgroundColor:
                    colores.tarjeta,
                  borderColor:
                    desbloqueado
                      ? "#3B6FA0"
                      : colores.borde,
                },
              ]}
            >
              <Text
                style={
                  styles.nivelIcono
                }
              >
                {item.icono}
              </Text>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={[
                    styles.nivelFilaTitulo,
                    {
                      color:
                        colores.texto,
                    },
                  ]}
                >
                  Nivel {item.nivel} ·{" "}
                  {item.nombre}
                </Text>

                <Text
                  style={[
                    styles.nivelFilaTexto,
                    {
                      color:
                        colores.textoSecundario,
                    },
                  ]}
                >
                  {item.minimo} puntos
                  {item.maximo !==
                  null
                    ? ` - ${item.maximo}`
                    : "+"}
                </Text>
              </View>

              <Ionicons
                name={
                  desbloqueado
                    ? "checkmark-circle"
                    : "lock-closed"
                }
                size={25}
                color={
                  desbloqueado
                    ? "#2E7D32"
                    : colores.textoSecundario
                }
              />
            </View>
          );
        },
      )}

      <TouchableOpacity
        style={styles.botonQuiz}
        onPress={() =>
          router.push("/quiz")
        }
      >
        <Ionicons
          name="help-circle-outline"
          size={21}
          color="#fff"
        />

        <Text
          style={
            styles.textoBotonQuiz
          }
        >
          Ganar puntos con el Quiz
        </Text>
      </TouchableOpacity>

      <View
        style={{
          height: 40,
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },

  contenido: {
    padding: 16,
    paddingBottom: 40,
  },

  centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  cargando: {
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

  tituloEncabezado: {
    fontSize: 22,
    fontWeight: "bold",
  },

  cardNivel: {
    borderRadius: 24,
    padding: 25,
    alignItems: "center",
    elevation: 3,
  },

  iconoNivel: {
    fontSize: 55,
  },

  nombreNivel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
  },

  nombreNivelGrande: {
    fontSize: 25,
    fontWeight: "bold",
    marginTop: 4,
  },

  puntos: {
    marginTop: 7,
    fontSize: 16,
  },

  progresoCard: {
    borderRadius: 18,
    padding: 18,
    marginTop: 15,
  },

  filaEntre: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  tituloCard: {
    fontSize: 17,
    fontWeight: "bold",
  },

  porcentaje: {
    fontSize: 15,
    fontWeight: "bold",
  },

  barraFondo: {
    height: 10,
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 12,
  },

  barra: {
    height: "100%",
    backgroundColor: "#3B6FA0",
    borderRadius: 10,
  },

  textoProgreso: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
  },

  textoDestacado: {
    fontWeight: "bold",
  },

  seccion: {
    fontSize: 19,
    fontWeight: "bold",
    marginTop: 25,
    marginBottom: 12,
  },

  estadisticas: {
    flexDirection: "row",
    gap: 12,
  },

  estadistica: {
    flex: 1,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
  },

  estadisticaIcono: {
    fontSize: 28,
  },

  estadisticaNumero: {
    fontSize: 25,
    fontWeight: "bold",
    marginTop: 5,
  },

  estadisticaTexto: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 3,
  },

  beneficioCard: {
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  beneficioIcono: {
    fontSize: 35,
  },

  beneficioTitulo: {
    fontSize: 16,
    fontWeight: "bold",
  },

  beneficioTexto: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },

  nivelFila: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  nivelIcono: {
    fontSize: 30,
  },

  nivelFilaTitulo: {
    fontWeight: "bold",
    fontSize: 14,
  },

  nivelFilaTexto: {
    fontSize: 12,
    marginTop: 4,
  },

  botonQuiz: {
    marginTop: 15,
    backgroundColor: "#3B6FA0",
    paddingVertical: 15,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  textoBotonQuiz: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
});