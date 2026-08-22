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
  hito_imagenes: { url: string; orden: number }[];
};

type Categoria = {
  id: number;
  nombre: string;
};

const OPCIONES_MENU = [
  "Favoritos",
  "Descargas",
  "Logros",
  "Quiz",
  "Sugerencias",
  "Reportar un problema",
  "Foro",
  "Mis preferencias",
];

// Rangos de precio para el filtro
const RANGOS_PRECIO = [
  { etiqueta: "Gratis", min: 0, max: 0 },
  { etiqueta: "$1 - $3", min: 1, max: 3 },
  { etiqueta: "$3 - $6", min: 3.01, max: 6 },
  { etiqueta: "Más de $6", min: 6.01, max: 999 },
];

// Ancho de cada tarjeta del carrusel (160 de la tarjeta + 12 del margen)
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
    (typeof RANGOS_PRECIO)[0] | null
  >(null);

  //preferencias
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
  
  // ---- Referencias para el auto-scroll del carrusel ----
  const scrollCarruselRef = useRef<ScrollView>(null);
  const indiceCarruselRef = useRef(0);
  const pausadoRef = useRef(false);

  async function cargarPreferencias() {
    try {
      const { data: sesion } = await supabase.auth.getUser();

      if (sesion?.user) {
        setUsuarioAutenticado(true);

        const { data } = await supabase
          .from("usuario_categorias")
          .select("categoria_id")
          .eq("usuario_id", sesion.user.id);

        const ids = (data ?? []).map((p) => p.categoria_id);
        setCategoriasPreferidas(ids);

        const { data: perfilData } = await supabase
          .from("perfiles")
          .select("onboarding_visto")
          .eq("id", sesion.user.id)
          .single();

        const yaVioOnboarding = perfilData?.onboarding_visto ?? false;

        if (ids.length === 0) {
          setCategoriasPreferidas([]);
          setUsuarioAutenticado(true);

          if (!yaVioOnboarding) {
            setMostrarOnboarding(true);
          }
        }
      } else {
        setUsuarioAutenticado(false);
        setCategoriasPreferidas([]);
      }
    } catch (error) {
      console.error(" Error cargando preferencias:", error);
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
    if (!sesion?.user) return;

    setGuardandoOnboarding(true);

    if (seleccionOnboarding.size > 0) {
      const filas = Array.from(seleccionOnboarding).map((categoria_id) => ({
        usuario_id: sesion.user.id,
        categoria_id,
      }));
      await supabase.from("usuario_categorias").insert(filas);
      setCategoriasPreferidas(Array.from(seleccionOnboarding));
    }

    await supabase
      .from("perfiles")
      .update({ onboarding_visto: true })
      .eq("id", sesion.user.id);

    setGuardandoOnboarding(false);
    setMostrarOnboarding(false);
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
          .select("id, nombre");
        setCategorias(cats ?? []);

        await cargarPreferencias();
      } catch (error) {
        
      }
    }
    cargarInicial();
  }, []),
);
  
  useEffect(() => {
    async function cargarHitos() {
      if (verificandoPreferencias) return;

      try {
        const { data } = await supabase
          .from("hitos")
          .select(
            "id, nombre, direccion_referencia, precio, categoria_id, creado_en, hito_imagenes(url, orden)",
          )
          .eq("es_lugar_oculto", false)
          .order("creado_en", { ascending: true });

        if (data) {
          setImprescindibles(data.slice(0, 10));
          setCarrusel(data.slice(10, 14));
        }

      
        if (usuarioAutenticado && categoriasPreferidas.length > 0) {
          const { data: dataPreferidos } = await supabase
            .from("hitos")
            .select(
              "id, nombre, direccion_referencia, precio, categoria_id, creado_en, hito_imagenes(url, orden)",
            )
            .eq("es_lugar_oculto", false)
            .in("categoria_id", categoriasPreferidas)
            .order("creado_en", { ascending: true })
            .limit(10);

          setPreferidos(dataPreferidos ?? []);
        } else {
          setPreferidos([]);
        }
      } catch (error) {
        console.log(" Error en cargarHitos:", error);
      } finally {
        // Asegurar que cargando siempre se ponga en false
        setCargando(false);
      }
    }
    cargarHitos();
  }, [usuarioAutenticado, categoriasPreferidas, verificandoPreferencias]);

  // ---- Auto-scroll del carrusel: avanza sola cada 3 segundos ----
  useEffect(() => {
    if (carrusel.length === 0) return;

    const intervalo = setInterval(() => {
      if (pausadoRef.current) return; 

      indiceCarruselRef.current =
        (indiceCarruselRef.current + 1) % carrusel.length;
      scrollCarruselRef.current?.scrollTo({
        x: indiceCarruselRef.current * ANCHO_TARJETA_CARRUSEL,
        animated: true,
      });
    }, 3000);

    return () => clearInterval(intervalo);
  }, [carrusel]);

  function pausarCarrusel() {
    pausadoRef.current = true;
  }

  function reanudarCarruselConRetraso() {
    // Espera unos segundos después de soltar antes de retomar el auto-scroll
    setTimeout(() => {
      pausadoRef.current = false;
    }, 4000);
  }

  // Búsqueda + filtros: se dispara cada vez que cambia el texto o los filtros
  const hayFiltrosActivos =
    busqueda.trim().length > 0 ||
    categoriaFiltro !== null ||
    rangoFiltro !== null;

  useEffect(() => {
    if (!hayFiltrosActivos) {
      setResultadosBusqueda(null);
      return;
    }

    // Pequeño retraso para no disparar una consulta en cada letra tecleada
    const timeout = setTimeout(async () => {
      setBuscando(true);

      let query = supabase
        .from("hitos")
        .select(
          "id, nombre, direccion_referencia, precio, categoria_id, hito_imagenes(url, orden)",
        );

      const texto = busqueda.trim();
      if (texto.length > 0) {
        // Busca coincidencias en nombre O en la ubicación/referencia
        query = query.or(
          `nombre.ilike.%${texto}%,direccion_referencia.ilike.%${texto}%`,
        );
      }

      if (categoriaFiltro !== null) {
        query = query.eq("categoria_id", categoriaFiltro);
      }

      if (rangoFiltro !== null) {
        query = query
          .gte("precio", rangoFiltro.min)
          .lte("precio", rangoFiltro.max);
      }

      const { data } = await query.order("nombre", { ascending: true });
      setResultadosBusqueda(data ?? []);
      setBuscando(false);
    }, 400);

    return () => clearTimeout(timeout);
  }, [busqueda, categoriaFiltro, rangoFiltro]);

  function limpiarFiltros() {
    setCategoriaFiltro(null);
    setRangoFiltro(null);
  }

  return (
    <View style={[styles.contenedor, { backgroundColor: colores.fondo }]}>
      {/* Encabezado: hamburguesa + barra de búsqueda + botón de filtro */}
      <View
        style={[styles.encabezado, { backgroundColor: colores.encabezado }]}
      >
        <TouchableOpacity
          onPress={() => setMenuAbierto(true)}
          style={styles.botonIcono}
        >
          <Text style={styles.icono}>☰</Text>
        </TouchableOpacity>

        <BotonTema />

        <TextInput
          style={styles.inputBusqueda}
          placeholder="Buscar por nombre, lugar o precio..."
          placeholderTextColor="#999"
          value={busqueda}
          onChangeText={setBusqueda}
        />

        <TouchableOpacity
          onPress={() => setFiltrosAbiertos(true)}
          style={styles.botonIcono}
        >
          <Text style={styles.icono}>⚙️</Text>
          {(categoriaFiltro !== null || rangoFiltro !== null) && (
            <View style={styles.puntoActivo} />
          )}
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : hayFiltrosActivos ? (
        // ---- MODO BÚSQUEDA/FILTRO ----
        <ScrollView style={styles.scroll}>
          <View style={styles.encabezadoResultados}>
            <Text style={[styles.tituloSeccion, { color: colores.texto }]}>
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
              <Text style={styles.limpiar}>Limpiar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {(resultadosBusqueda ?? []).map((hito) => (
              <TarjetaGrid key={hito.id} hito={hito} />
            ))}
          </View>

          {resultadosBusqueda?.length === 0 && !buscando && (
            <Text style={styles.sinResultados}>
              No se encontraron lugares con esos criterios.
            </Text>
          )}
        </ScrollView>
      ) : (
        // ---- MODO NORMAL (inicio) ----
        <ScrollView style={styles.scroll}>
          <Text style={[styles.tituloSeccion, { color: colores.texto }]}>
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
              // Sincroniza el índice si el usuario deslizó manualmente
              indiceCarruselRef.current = Math.round(
                evento.nativeEvent.contentOffset.x / ANCHO_TARJETA_CARRUSEL,
              );
            }}
          >
            {carrusel.map((hito) => (
              <TarjetaCarrusel key={hito.id} hito={hito} />
            ))}
          </ScrollView>

          {/* ==================== CAMBIO 4: INICIO — sección "Tus preferencias" ==================== */}
          {preferidos.length > 0 && (
            <>
              <View style={styles.encabezadoPreferencias}>
                <Text
                  style={[
                    styles.tituloSeccion,
                    { color: colores.texto, marginTop: 0, marginBottom: 0 },
                  ]}
                >
                  Tus preferencias
                </Text>
                <TouchableOpacity
                >
                  <Text style={styles.verTodas}>Ver todas</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.carrusel}
              >
                {preferidos.map((hito) => (
                  <TarjetaCarrusel key={hito.id} hito={hito} />
                ))}
              </ScrollView>
            </>
          )}
          {/* ==================== CAMBIO 4: FIN ==================== */}

          <Text style={[styles.tituloSeccion, { color: colores.texto }]}>
            Lugares imprescindibles
          </Text>
          <View style={styles.grid}>
            {imprescindibles.map((hito) => (
              <TarjetaGrid key={hito.id} hito={hito} />
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Menú lateral (hamburguesa) */}
      <Modal visible={menuAbierto} animationType="slide" transparent>
        <TouchableOpacity
          style={styles.fondoOscuro}
          activeOpacity={1}
          onPress={() => setMenuAbierto(false)}
        >
          <View
            style={[styles.panelMenu, { backgroundColor: colores.tarjeta }]}
          >
            <Text style={[styles.tituloMenu, { color: colores.texto }]}>
              Menú
            </Text>
            {OPCIONES_MENU.map((opcion) => (
              <TouchableOpacity
                key={opcion}
                style={styles.itemMenu}
                onPress={() => {
                  setMenuAbierto(false);
                  if (opcion === "Mis preferencias") {
                    router.push("/preferencias");
                  } else {
                    console.log(` Opción seleccionada: ${opcion}`);
                  }
                }}
              >
                <Text style={[styles.textoItemMenu, { color: colores.texto }]}>
                  {opcion}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de FILTROS */}
      <Modal visible={filtrosAbiertos} animationType="slide" transparent>
        <View style={styles.fondoOscuroCentrado}>
          <View
            style={[styles.panelFiltros, { backgroundColor: colores.tarjeta }]}
          >
            <Text style={[styles.tituloMenu, { color: colores.texto }]}>
              Filtrar por
            </Text>

            <Text style={styles.subtituloFiltro}>Precio</Text>
            <View style={styles.chips}>
              {RANGOS_PRECIO.map((rango) => (
                <TouchableOpacity
                  key={rango.etiqueta}
                  style={[
                    styles.chip,
                    rangoFiltro?.etiqueta === rango.etiqueta &&
                      styles.chipActivo,
                  ]}
                  onPress={() =>
                    setRangoFiltro(
                      rangoFiltro?.etiqueta === rango.etiqueta ? null : rango,
                    )
                  }
                >
                  <Text
                    style={
                      rangoFiltro?.etiqueta === rango.etiqueta
                        ? styles.chipTextoActivo
                        : styles.chipTexto
                    }
                  >
                    {rango.etiqueta}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.subtituloFiltro}>Categoría</Text>
            <View style={styles.chips}>
              {categorias.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.chip,
                    categoriaFiltro === cat.id && styles.chipActivo,
                  ]}
                  onPress={() =>
                    setCategoriaFiltro(
                      categoriaFiltro === cat.id ? null : cat.id,
                    )
                  }
                >
                  <Text
                    style={
                      categoriaFiltro === cat.id
                        ? styles.chipTextoActivo
                        : styles.chipTexto
                    }
                  >
                    {cat.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.botonesFiltro}>
              <TouchableOpacity
                style={styles.botonLimpiarFiltro}
                onPress={limpiarFiltros}
              >
                <Text style={styles.textoBotonLimpiar}>Limpiar filtros</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.botonAplicarFiltro}
                onPress={() => setFiltrosAbiertos(false)}
              >
                <Text style={styles.textoBotonAplicar}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CAMBIO: Modal de onboarding ligero — aparece una sola vez */}
      <Modal visible={mostrarOnboarding} animationType="fade" transparent>
        <View style={styles.fondoOscuroCentrado}>
          <View
            style={[
              styles.panelOnboarding,
              { backgroundColor: colores.tarjeta },
            ]}
          >
            <Text style={styles.iconoOnboarding}>🏛️</Text>
            <Text style={[styles.tituloOnboarding, { color: colores.texto }]}>
              Cuéntanos más de ti
            </Text>
            <Text style={styles.subtituloOnboarding}>
              Elige los temas que más te interesan para mostrarte mejores
              recomendaciones.
            </Text>

            <View style={styles.chipsOnboarding}>
              {categorias.map((cat) => {
                const activa = seleccionOnboarding.has(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.chipOnboarding,
                      activa && styles.chipOnboardingActivo,
                    ]}
                    onPress={() => toggleCategoriaOnboarding(cat.id)}
                  >
                    <Text
                      style={
                        activa
                          ? styles.chipOnboardingTextoActivo
                          : styles.chipOnboardingTexto
                      }
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
                <Text style={styles.textoBotonGuardarOnboarding}>
                  Guardar preferencias
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={omitirOnboarding}>
              <Text style={styles.textoOmitirOnboarding}>Ahora no</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function obtenerImagenPrincipal(hito: Hito) {
  if (hito.hito_imagenes && hito.hito_imagenes.length > 0) {
    const ordenadas = [...hito.hito_imagenes].sort((a, b) => a.orden - b.orden);
    return { uri: ordenadas[0].url };
  }
  return require("@/assets/images/partial-react-logo.png");
}

function TarjetaCarrusel({ hito }: { hito: Hito }) {
  const { colores } = useTema();
  return (
    <TouchableOpacity
      style={[styles.cardCarrusel, { backgroundColor: colores.tarjeta }]}
      onPress={() => router.push(`/hito/${hito.id}`)}
    >
      <Image
        source={obtenerImagenPrincipal(hito)}
        style={styles.imagenCarrusel}
      />
      <Text
        style={[styles.nombreCarrusel, { color: colores.texto }]}
        numberOfLines={1}
      >
        {hito.nombre}
      </Text>
    </TouchableOpacity>
  );
}

function TarjetaGrid({ hito }: { hito: Hito }) {
  const { colores } = useTema();
  return (
    <TouchableOpacity
      style={[styles.cardGrid, { backgroundColor: colores.tarjeta }]}
      onPress={() => router.push(`/hito/${hito.id}`)}
    >
      <Image source={obtenerImagenPrincipal(hito)} style={styles.imagenGrid} />
      <Text
        style={[styles.nombreGrid, { color: colores.texto }]}
        numberOfLines={2}
      >
        {hito.nombre}
      </Text>
      {hito.direccion_referencia && (
        <Text style={styles.ubicacionGrid} numberOfLines={1}>
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
  contenedor: { flex: 1, backgroundColor: "#F5F5F5" },
  centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 55,
    paddingBottom: 12,
    backgroundColor: "#fff",
    gap: 10,
  },
  botonIcono: { padding: 6 },
  icono: { fontSize: 22 },
  puntoActivo: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2196F3",
  },
  inputBusqueda: {
    flex: 1,
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
  },
  encabezadoResultados: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 20,
  },
  limpiar: { color: "#2196F3", fontWeight: "600" },
  tituloSeccion: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: 16,
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
    fontSize: 13,
  },
  sinResultados: {
    textAlign: "center",
    color: "#888",
    marginTop: 40,
    paddingHorizontal: 32,
  },
  carrusel: { paddingLeft: 16 },
  cardCarrusel: {
    width: 160,
    marginRight: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 3,
  },
  imagenCarrusel: { width: "100%", height: 100 },
  nombreCarrusel: { padding: 8, fontWeight: "600" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  cardGrid: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 3,
  },
  imagenGrid: { width: "100%", height: 90 },
  nombreGrid: { paddingHorizontal: 8, paddingTop: 8, fontWeight: "600" },
  ubicacionGrid: { paddingHorizontal: 8, fontSize: 12, color: "#666" },
  precioGrid: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    fontSize: 12,
    color: "#2196F3",
    fontWeight: "600",
    marginTop: 2,
  },
  fondoOscuro: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    flexDirection: "row",
  },
  fondoOscuroCentrado: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  panelMenu: {
    width: "75%",
    height: "100%",
    backgroundColor: "#fff",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  tituloMenu: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  itemMenu: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  textoItemMenu: { fontSize: 16 },
  panelFiltros: {
    backgroundColor: "#fff",
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  chipActivo: { backgroundColor: "#2196F3" },
  chipTexto: { color: "#333" },
  chipTextoActivo: { color: "#fff", fontWeight: "600" },
  botonesFiltro: { flexDirection: "row", gap: 12, marginTop: 24 },
  botonLimpiarFiltro: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
  },
  botonAplicarFiltro: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#2196F3",
    alignItems: "center",
  },
  textoBotonLimpiar: { color: "#333", fontWeight: "600" },
  textoBotonAplicar: { color: "#fff", fontWeight: "600" },

  panelOnboarding: {
    width: "88%",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  iconoOnboarding: { fontSize: 40, marginBottom: 10 },
  tituloOnboarding: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  subtituloOnboarding: {
    fontSize: 13,
    color: "#888",
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
    backgroundColor: "#F0F0F0",
  },
  chipOnboardingActivo: { backgroundColor: "#3B6FA0" },
  chipOnboardingTexto: { color: "#333", fontSize: 13 },
  chipOnboardingTextoActivo: { color: "#fff", fontSize: 13, fontWeight: "600" },
  botonGuardarOnboarding: {
    width: "100%",
    height: 48,
    backgroundColor: "#3B6FA0",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotonGuardarOnboarding: { color: "#fff", fontWeight: "600" },
  textoOmitirOnboarding: {
    color: "#999",
    fontSize: 13,
    marginTop: 14,
    textDecorationLine: "underline",
  },
});
