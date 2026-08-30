import { BotonTema } from "@/components/BotonTema";
import { useTema } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Hito = {
  id: string;
  nombre: string;
  direccion_referencia: string | null;
  precio: number | null;
  categoria_id: number | null;
  creado_en?: string;
  hito_imagenes: {
    url: string;
    orden: number;
  }[];
};

type Categoria = {
  id: number;
  nombre: string;
};

const OPCIONES_MENU = [
  "Favoritos",
  "Descargas",
  "Logros",
  "Retos",
  "Quiz",
  "Niveles",
  "Sugerencias",
  "Reportar un problema",
  "Foro",
  "Mis preferencias",
];

const RANGOS_PRECIO = [
  { etiqueta: "Gratis", min: 0, max: 0 },
  { etiqueta: "$1 - $3", min: 1, max: 3 },
  { etiqueta: "$3 - $6", min: 3.01, max: 6 },
  { etiqueta: "Más de $6", min: 6.01, max: 999 },
];

const ANCHO_TARJETA_CARRUSEL = 172;

export default function HomeScreen() {
  const { colores } = useTema();

  const [carrusel, setCarrusel] = useState<Hito[]>([]);
  const [imprescindibles, setImprescindibles] = useState<Hito[]>([]);
  const [preferidos, setPreferidos] = useState<Hito[]>([]);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Hito[] | null>(
    null,
  );

  const [cargando, setCargando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<number | null>(null);

  const [rangoFiltro, setRangoFiltro] = useState<
    (typeof RANGOS_PRECIO)[number] | null
  >(null);

  const [categoriasPreferidas, setCategoriasPreferidas] = useState<number[]>(
    [],
  );

  const [usuarioAutenticado, setUsuarioAutenticado] = useState(false);
  const [verificandoPreferencias, setVerificandoPreferencias] = useState(true);

  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);
  const [seleccionOnboarding, setSeleccionOnboarding] = useState<Set<number>>(
    new Set(),
  );
  const [guardandoOnboarding, setGuardandoOnboarding] = useState(false);

  const scrollCarruselRef = useRef<ScrollView>(null);
  const indiceCarruselRef = useRef(0);
  const pausadoRef = useRef(false);

  async function cargarPreferencias() {
    try {
      const { data: sesion } = await supabase.auth.getUser();

      if (!sesion?.user) {
        setUsuarioAutenticado(false);
        setCategoriasPreferidas([]);
        return;
      }

      setUsuarioAutenticado(true);

      const { data: preferencias } = await supabase
        .from("usuario_categorias")
        .select("categoria_id")
        .eq("usuario_id", sesion.user.id);

      const ids = (preferencias ?? []).map(
        (item) => item.categoria_id,
      );

      setCategoriasPreferidas(ids);

      const { data: perfilData } = await supabase
        .from("perfiles")
        .select("onboarding_visto")
        .eq("id", sesion.user.id)
        .maybeSingle();

      const yaVioOnboarding = perfilData?.onboarding_visto ?? false;

      if (ids.length === 0 && !yaVioOnboarding) {
        setMostrarOnboarding(true);
      }
    } catch (error) {
      console.error("Error cargando preferencias:", error);
      setUsuarioAutenticado(false);
      setCategoriasPreferidas([]);
    } finally {
      setVerificandoPreferencias(false);
    }
  }

  function toggleCategoriaOnboarding(id: number) {
    setSeleccionOnboarding((prev) => {
      const nuevo = new Set(prev);

      if (nuevo.has(id)) {
        nuevo.delete(id);
      } else {
        nuevo.add(id);
      }

      return nuevo;
    });
  }

  async function guardarOnboardingPreferencias() {
    const { data: sesion } = await supabase.auth.getUser();

    if (!sesion?.user) {
      setMostrarOnboarding(false);
      return;
    }

    setGuardandoOnboarding(true);

    try {
      if (seleccionOnboarding.size > 0) {
        const filas = Array.from(seleccionOnboarding).map(
          (categoria_id) => ({
            usuario_id: sesion.user.id,
            categoria_id,
          }),
        );

        await supabase
          .from("usuario_categorias")
          .delete()
          .eq("usuario_id", sesion.user.id);

        await supabase
          .from("usuario_categorias")
          .insert(filas);

        setCategoriasPreferidas(
          Array.from(seleccionOnboarding),
        );
      }

      await supabase
        .from("perfiles")
        .update({ onboarding_visto: true })
        .eq("id", sesion.user.id);

      setMostrarOnboarding(false);
    } catch (error) {
      console.error("Error guardando onboarding:", error);
    } finally {
      setGuardandoOnboarding(false);
    }
  }

  async function omitirOnboarding() {
    const { data: sesion } = await supabase.auth.getUser();

    if (sesion?.user) {
      await supabase
        .from("perfiles")
        .update({ onboarding_visto: true })
        .eq("id", sesion.user.id);
    }

    setMostrarOnboarding(false);
  }

  useFocusEffect(
    useCallback(() => {
      async function cargarInicial() {
        try {
          const { data: cats } = await supabase
            .from("categorias")
            .select("id, nombre")
            .order("nombre", { ascending: true });

          setCategorias(cats ?? []);

          await cargarPreferencias();
        } catch (error) {
          console.error("Error inicial Home:", error);
        }
      }

      cargarInicial();
    }, []),
  );

  useEffect(() => {
    async function cargarHitos() {
      if (verificandoPreferencias) return;

      setCargando(true);

      try {
        const { data, error } = await supabase
          .from("hitos")
          .select(
            `
              id,
              nombre,
              direccion_referencia,
              precio,
              categoria_id,
              creado_en,
              hito_imagenes(url, orden)
            `,
          )
          .eq("es_lugar_oculto", false)
          .order("creado_en", { ascending: true });

        if (error) {
          console.error("Error cargando hitos:", error);
          return;
        }

        const hitos = (data ?? []) as Hito[];

        setImprescindibles(hitos.slice(0, 10));
        setCarrusel(hitos.slice(10, 14));

        if (
          usuarioAutenticado &&
          categoriasPreferidas.length > 0
        ) {
          const { data: dataPreferidos } = await supabase
            .from("hitos")
            .select(
              `
                id,
                nombre,
                direccion_referencia,
                precio,
                categoria_id,
                creado_en,
                hito_imagenes(url, orden)
              `,
            )
            .eq("es_lugar_oculto", false)
            .in("categoria_id", categoriasPreferidas)
            .order("creado_en", { ascending: true })
            .limit(10);

          setPreferidos((dataPreferidos ?? []) as Hito[]);
        } else {
          setPreferidos([]);
        }
      } catch (error) {
        console.error("Error en cargarHitos:", error);
      } finally {
        setCargando(false);
      }
    }

    cargarHitos();
  }, [
    usuarioAutenticado,
    categoriasPreferidas,
    verificandoPreferencias,
  ]);

  useEffect(() => {
    if (carrusel.length === 0) return;

    const intervalo = setInterval(() => {
      if (pausadoRef.current) return;

      indiceCarruselRef.current =
        (indiceCarruselRef.current + 1) % carrusel.length;

      scrollCarruselRef.current?.scrollTo({
        x:
          indiceCarruselRef.current *
          ANCHO_TARJETA_CARRUSEL,
        animated: true,
      });
    }, 3000);

    return () => clearInterval(intervalo);
  }, [carrusel]);

  function pausarCarrusel() {
    pausadoRef.current = true;
  }

  function reanudarCarruselConRetraso() {
    setTimeout(() => {
      pausadoRef.current = false;
    }, 4000);
  }

  const hayFiltrosActivos =
    busqueda.trim().length > 0 ||
    categoriaFiltro !== null ||
    rangoFiltro !== null;

  useEffect(() => {
    if (!hayFiltrosActivos) {
      setResultadosBusqueda(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setBuscando(true);

      try {
        let query = supabase
          .from("hitos")
          .select(
            `
              id,
              nombre,
              direccion_referencia,
              precio,
              categoria_id,
              hito_imagenes(url, orden)
            `,
          )
          .eq("es_lugar_oculto", false);

        const texto = busqueda.trim();

        if (texto.length > 0) {
          query = query.or(
            `nombre.ilike.%${texto}%,direccion_referencia.ilike.%${texto}%`,
          );
        }

        if (categoriaFiltro !== null) {
          query = query.eq(
            "categoria_id",
            categoriaFiltro,
          );
        }

        if (rangoFiltro !== null) {
          query = query
            .gte("precio", rangoFiltro.min)
            .lte("precio", rangoFiltro.max);
        }

        const { data } = await query.order("nombre", {
          ascending: true,
        });

        setResultadosBusqueda((data ?? []) as Hito[]);
      } catch (error) {
        console.error("Error buscando:", error);
        setResultadosBusqueda([]);
      } finally {
        setBuscando(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [
    busqueda,
    categoriaFiltro,
    rangoFiltro,
    hayFiltrosActivos,
  ]);

  function limpiarFiltros() {
    setCategoriaFiltro(null);
    setRangoFiltro(null);
  }

  /*
   * =========================================================
   * NAVEGACIÓN DEL MENÚ
   * =========================================================
   */
  function seleccionarOpcionMenu(opcion: string) {
    setMenuAbierto(false);

    if (opcion === "Quiz") {
      router.push("/quiz");
    } else if (opcion === "Niveles") {
      router.push("/niveles");
    } else if (opcion === "Mis preferencias") {
      router.push("/preferencias");
    } else if (opcion === "Retos") {        
      router.push("/retos");
    } else if (opcion === "Logros") { 
      router.push("/insignias");
    } else {
      console.log(`Opción seleccionada: ${opcion}`);
    }
  }

  return (
    <View
      style={[
        styles.contenedor,
        { backgroundColor: colores.fondo },
      ]}
    >
      <View
        style={[
          styles.encabezado,
          { backgroundColor: colores.encabezado },
        ]}
      >
        <TouchableOpacity
          onPress={() => setMenuAbierto(true)}
          style={styles.botonIcono}
        >
          <Text
            style={[
              styles.icono,
              { color: colores.texto },
            ]}
          >
            ☰
          </Text>
        </TouchableOpacity>

        <BotonTema />

        <TextInput
          style={[
            styles.inputBusqueda,
            {
              backgroundColor: colores.tarjeta,
              color: colores.texto,
            },
          ]}
          placeholder="Buscar por nombre, lugar o precio..."
          placeholderTextColor={colores.textoSecundario}
          value={busqueda}
          onChangeText={setBusqueda}
        />

        <TouchableOpacity
          onPress={() => setFiltrosAbiertos(true)}
          style={styles.botonIcono}
        >
          <Text style={styles.icono}>⚙️</Text>

          {(categoriaFiltro !== null ||
            rangoFiltro !== null) && (
            <View style={styles.puntoActivo} />
          )}
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator
            size="large"
            color="#3B6FA0"
          />
        </View>
      ) : hayFiltrosActivos ? (
        <ScrollView style={styles.scroll}>
          <View style={styles.encabezadoResultados}>
            <Text
              style={[
                styles.tituloSeccion,
                { color: colores.texto },
              ]}
            >
              {buscando
                ? "Buscando..."
                : `${resultadosBusqueda?.length ?? 0} resultados`}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setBusqueda("");
                limpiarFiltros();
              }}
            >
              <Text style={styles.limpiar}>
                Limpiar
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {(resultadosBusqueda ?? []).map((hito) => (
              <TarjetaGrid
                key={hito.id}
                hito={hito}
              />
            ))}
          </View>

          {resultadosBusqueda?.length === 0 &&
            !buscando && (
              <Text
                style={[
                  styles.sinResultados,
                  { color: colores.textoSecundario },
                ]}
              >
                No se encontraron lugares con esos
                criterios.
              </Text>
            )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.scroll}>
          <Text
            style={[
              styles.tituloSeccion,
              { color: colores.texto },
            ]}
          >
            Descubre El Salvador
          </Text>

          <ScrollView
            ref={scrollCarruselRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.carrusel}
            onTouchStart={pausarCarrusel}
            onScrollEndDrag={reanudarCarruselConRetraso}
            onMomentumScrollEnd={(evento) => {
              indiceCarruselRef.current =
                Math.round(
                  evento.nativeEvent.contentOffset.x /
                    ANCHO_TARJETA_CARRUSEL,
                );
            }}
          >
            {carrusel.map((hito) => (
              <TarjetaCarrusel
                key={hito.id}
                hito={hito}
              />
            ))}
          </ScrollView>

          {preferidos.length > 0 && (
            <>
              <View
                style={styles.encabezadoPreferencias}
              >
                <Text
                  style={[
                    styles.tituloSeccion,
                    {
                      color: colores.texto,
                      marginTop: 0,
                      marginBottom: 0,
                      marginHorizontal: 0,
                    },
                  ]}
                >
                  Tus preferencias
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    router.push("/preferencias")
                  }
                >
                  <Text style={styles.verTodas}>
                    Ver todas
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.carrusel}
              >
                {preferidos.map((hito) => (
                  <TarjetaCarrusel
                    key={hito.id}
                    hito={hito}
                  />
                ))}
              </ScrollView>
            </>
          )}

          <Text
            style={[
              styles.tituloSeccion,
              { color: colores.texto },
            ]}
          >
            Lugares imprescindibles
          </Text>

          <View style={styles.grid}>
            {imprescindibles.map((hito) => (
              <TarjetaGrid
                key={hito.id}
                hito={hito}
              />
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* MENÚ */}
      <Modal
        visible={menuAbierto}
        animationType="slide"
        transparent
        onRequestClose={() => setMenuAbierto(false)}
      >
        <View style={styles.fondoOscuro}>
          <View
            style={[
              styles.panelMenu,
              { backgroundColor: colores.tarjeta },
            ]}
          >
            <View style={styles.cabeceraMenu}>
              <Text
                style={[
                  styles.tituloMenu,
                  { color: colores.texto },
                ]}
              >
                Menú
              </Text>

              <TouchableOpacity
                onPress={() => setMenuAbierto(false)}
              >
                <Text
                  style={[
                    styles.cerrarMenu,
                    { color: colores.texto },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            {OPCIONES_MENU.map((opcion) => (
              <TouchableOpacity
                key={opcion}
                style={[
                  styles.itemMenu,
                  { borderBottomColor: colores.borde },
                ]}
                onPress={() =>
                  seleccionarOpcionMenu(opcion)
                }
              >
                <Text
                  style={[
                    styles.textoItemMenu,
                    { color: colores.texto },
                  ]}
                >
                  {opcion}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* FILTROS */}
      <Modal
        visible={filtrosAbiertos}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setFiltrosAbiertos(false)
        }
      >
        <View style={styles.fondoOscuroCentrado}>
          <View
            style={[
              styles.panelFiltros,
              { backgroundColor: colores.tarjeta },
            ]}
          >
            <Text
              style={[
                styles.tituloMenu,
                { color: colores.texto },
              ]}
            >
              Filtrar por
            </Text>

            <Text
              style={[
                styles.subtituloFiltro,
                { color: colores.texto },
              ]}
            >
              Precio
            </Text>

            <View style={styles.chips}>
              {RANGOS_PRECIO.map((rango) => {
                const activo =
                  rangoFiltro?.etiqueta ===
                  rango.etiqueta;

                return (
                  <TouchableOpacity
                    key={rango.etiqueta}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: activo
                          ? "#3B6FA0"
                          : colores.fondo,
                      },
                    ]}
                    onPress={() =>
                      setRangoFiltro(
                        activo ? null : rango,
                      )
                    }
                  >
                    <Text
                      style={{
                        color: activo
                          ? "#fff"
                          : colores.texto,
                      }}
                    >
                      {rango.etiqueta}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text
              style={[
                styles.subtituloFiltro,
                { color: colores.texto },
              ]}
            >
              Categoría
            </Text>

            <View style={styles.chips}>
              {categorias.map((cat) => {
                const activo =
                  categoriaFiltro === cat.id;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: activo
                          ? "#3B6FA0"
                          : colores.fondo,
                      },
                    ]}
                    onPress={() =>
                      setCategoriaFiltro(
                        activo ? null : cat.id,
                      )
                    }
                  >
                    <Text
                      style={{
                        color: activo
                          ? "#fff"
                          : colores.texto,
                      }}
                    >
                      {cat.nombre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.botonesFiltro}>
              <TouchableOpacity
                style={styles.botonLimpiarFiltro}
                onPress={limpiarFiltros}
              >
                <Text
                  style={[
                    styles.textoBotonLimpiar,
                    { color: colores.texto },
                  ]}
                >
                  Limpiar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botonAplicarFiltro}
                onPress={() =>
                  setFiltrosAbiertos(false)
                }
              >
                <Text
                  style={styles.textoBotonAplicar}
                >
                  Aplicar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ONBOARDING */}
      <Modal
        visible={mostrarOnboarding}
        animationType="fade"
        transparent
      >
        <View style={styles.fondoOscuroCentrado}>
          <View
            style={[
              styles.panelOnboarding,
              { backgroundColor: colores.tarjeta },
            ]}
          >
            <Text style={styles.iconoOnboarding}>
              🏛️
            </Text>

            <Text
              style={[
                styles.tituloOnboarding,
                { color: colores.texto },
              ]}
            >
              Cuéntanos más de ti
            </Text>

            <Text
              style={[
                styles.subtituloOnboarding,
                { color: colores.textoSecundario },
              ]}
            >
              Elige los temas que más te interesan para
              mostrarte mejores recomendaciones.
            </Text>

            <View
              style={styles.chipsOnboarding}
            >
              {categorias.map((cat) => {
                const activa =
                  seleccionOnboarding.has(cat.id);

                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.chipOnboarding,
                      {
                        backgroundColor: activa
                          ? "#3B6FA0"
                          : colores.fondo,
                      },
                    ]}
                    onPress={() =>
                      toggleCategoriaOnboarding(
                        cat.id,
                      )
                    }
                  >
                    <Text
                      style={{
                        color: activa
                          ? "#fff"
                          : colores.texto,
                      }}
                    >
                      {cat.nombre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.botonGuardarOnboarding}
              onPress={guardarOnboardingPreferencias}
              disabled={guardandoOnboarding}
            >
              {guardandoOnboarding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={
                    styles.textoBotonGuardarOnboarding
                  }
                >
                  Guardar preferencias
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={omitirOnboarding}
            >
              <Text
                style={styles.textoOmitirOnboarding}
              >
                Ahora no
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function obtenerImagenPrincipal(hito: Hito) {
  if (
    hito.hito_imagenes &&
    hito.hito_imagenes.length > 0
  ) {
    const ordenadas = [...hito.hito_imagenes].sort(
      (a, b) => a.orden - b.orden,
    );

    return {
      uri: ordenadas[0].url,
    };
  }

  return require("@/assets/images/partial-react-logo.png");
}

function TarjetaCarrusel({
  hito,
}: {
  hito: Hito;
}) {
  const { colores } = useTema();

  return (
    <TouchableOpacity
      style={[
        styles.cardCarrusel,
        { backgroundColor: colores.tarjeta },
      ]}
      onPress={() =>
        router.push(`/hito/${hito.id}`)
      }
    >
      <Image
        source={obtenerImagenPrincipal(hito)}
        style={styles.imagenCarrusel}
      />

      <Text
        style={[
          styles.nombreCarrusel,
          { color: colores.texto },
        ]}
        numberOfLines={1}
      >
        {hito.nombre}
      </Text>
    </TouchableOpacity>
  );
}

function TarjetaGrid({
  hito,
}: {
  hito: Hito;
}) {
  const { colores } = useTema();

  return (
    <TouchableOpacity
      style={[
        styles.cardGrid,
        { backgroundColor: colores.tarjeta },
      ]}
      onPress={() =>
        router.push(`/hito/${hito.id}`)
      }
    >
      <Image
        source={obtenerImagenPrincipal(hito)}
        style={styles.imagenGrid}
      />

      <Text
        style={[
          styles.nombreGrid,
          { color: colores.texto },
        ]}
        numberOfLines={2}
      >
        {hito.nombre}
      </Text>

      {hito.direccion_referencia && (
        <Text
          style={[
            styles.ubicacionGrid,
            { color: colores.textoSecundario },
          ]}
          numberOfLines={1}
        >
          📍 {hito.direccion_referencia}
        </Text>
      )}

      <Text style={styles.precioGrid}>
        {hito.precio && hito.precio > 0
          ? `Desde $${hito.precio.toFixed(2)}`
          : "Gratis"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },

  centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  scroll: {
    flex: 1,
  },

  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 55,
    paddingBottom: 12,
    gap: 10,
  },

  botonIcono: {
    padding: 6,
  },

  icono: {
    fontSize: 22,
  },

  inputBusqueda: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
  },

  puntoActivo: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2196F3",
  },

  tituloSeccion: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: 16,
  },

  encabezadoResultados: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
  },

  limpiar: {
    color: "#2196F3",
    fontWeight: "600",
  },

  carrusel: {
    paddingLeft: 16,
  },

  cardCarrusel: {
    width: 160,
    marginRight: 12,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 3,
  },

  imagenCarrusel: {
    width: "100%",
    height: 100,
  },

  nombreCarrusel: {
    padding: 8,
    fontWeight: "600",
  },

  encabezadoPreferencias: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },

  verTodas: {
    color: "#2196F3",
    fontWeight: "600",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },

  cardGrid: {
    width: "48%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 3,
  },

  imagenGrid: {
    width: "100%",
    height: 90,
  },

  nombreGrid: {
    paddingHorizontal: 8,
    paddingTop: 8,
    fontWeight: "600",
  },

  ubicacionGrid: {
    paddingHorizontal: 8,
    fontSize: 12,
  },

  precioGrid: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    fontSize: 12,
    color: "#2196F3",
    fontWeight: "600",
    marginTop: 2,
  },

  sinResultados: {
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 32,
  },

  fondoOscuro: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    flexDirection: "row",
  },

  fondoOscuroCentrado: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  panelMenu: {
    width: "78%",
    height: "100%",
    paddingTop: 60,
    paddingHorizontal: 20,
  },

  cabeceraMenu: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  tituloMenu: {
    fontSize: 22,
    fontWeight: "bold",
  },

  cerrarMenu: {
    fontSize: 22,
  },

  itemMenu: {
    paddingVertical: 14,
    borderBottomWidth: 1,
  },

  textoItemMenu: {
    fontSize: 16,
  },

  panelFiltros: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },

  subtituloFiltro: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },

  botonesFiltro: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },

  botonLimpiarFiltro: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#E5E5E5",
    alignItems: "center",
  },

  botonAplicarFiltro: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#2196F3",
    alignItems: "center",
  },

  textoBotonLimpiar: {
    fontWeight: "600",
  },

  textoBotonAplicar: {
    color: "#fff",
    fontWeight: "600",
  },

  panelOnboarding: {
    width: "88%",
    alignSelf: "center",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 30,
  },

  iconoOnboarding: {
    fontSize: 40,
    marginBottom: 10,
  },

  tituloOnboarding: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },

  subtituloOnboarding: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 18,
    lineHeight: 18,
  },

  chipsOnboarding: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },

  chipOnboarding: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },

  botonGuardarOnboarding: {
    width: "100%",
    height: 48,
    backgroundColor: "#3B6FA0",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },

  textoBotonGuardarOnboarding: {
    color: "#fff",
    fontWeight: "600",
  },

  textoOmitirOnboarding: {
    color: "#999",
    fontSize: 13,
    marginTop: 14,
    textDecorationLine: "underline",
  },
});