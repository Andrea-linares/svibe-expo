import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
  const [carrusel, setCarrusel] = useState<Hito[]>([]);
  const [imprescindibles, setImprescindibles] = useState<Hito[]>([]);
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
  const [categoriasPreferidas, setCategoriasPreferidas] = useState<number[]>([]);
  const [usuarioAutenticado, setUsuarioAutenticado] = useState(false);
  const [verificandoPreferencias, setVerificandoPreferencias] = useState(true);

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
        setCategoriasPreferidas(ids); // 🔴 INICIO CAMBIO: Se agregó esta línea para actualizar el estado si hay IDs

        console.log("📌 Preferencias del usuario:", ids);

        if (ids.length === 0) {
          console.log("⚠️ Usuario sin preferencias, mostrando todos los lugares");
          setCategoriasPreferidas([]);
          setUsuarioAutenticado(true);
        }
      } else {
        setUsuarioAutenticado(false);
        setCategoriasPreferidas([]);
        console.log("👤 Usuario invitado, mostrando todos los lugares");
      }
    } catch (error) {
      console.error("❌ Error cargando preferencias:", error);
      setUsuarioAutenticado(false);
      setCategoriasPreferidas([]);
    } finally {
      setVerificandoPreferencias(false);
    }
  }

  // 🔴 INICIO CAMBIO: Se eliminó la lógica de los hitos de aquí y se cambió la dependencia a []
  // Carga inicial SOLO de categorías y preferencias (se ejecuta una sola vez)
  useEffect(() => {
    async function cargarInicial() {
      try {
        // 1. Cargar categorías
        const { data: cats } = await supabase
          .from("categorias")
          .select("id, nombre");
        setCategorias(cats ?? []);

        // 2. Cargar preferencias del usuario
        await cargarPreferencias();

      } catch (error) {
        console.log(" Error en cargarInicial:", error);
      }
    }
    cargarInicial();
  }, []); 
  // 🔴 FIN CAMBIO

  // 🔴 INICIO CAMBIO: Nuevo useEffect separado para cargar los hitos cuando cambian las preferencias
  // Este se ejecuta cuando el usuario termina de cargar, o cuando cambia su sesión/preferencias
  useEffect(() => {
    async function cargarHitos() {
      if (verificandoPreferencias) return; // Espera a que termine de cargar preferencias

      try {
        // 3. Construir consulta de hitos
        let query = supabase
          .from("hitos")
          .select(
            "id, nombre, direccion_referencia, precio, categoria_id, creado_en, hito_imagenes(url, orden)",
          )
          .eq("es_lugar_oculto", false);

        // Filtrar SOLO si tiene preferencias
        if (usuarioAutenticado && categoriasPreferidas.length > 0) {
          query = query.in("categoria_id", categoriasPreferidas);
          console.log("🔍 Filtrando por categorías:", categoriasPreferidas);
        } else {
          console.log("🔍 Mostrando todos los lugares (invitado o sin filtro)");
        }

        const { data } = await query.order("creado_en", { ascending: true });

        if (data) {
          setImprescindibles(data.slice(0, 10));
          setCarrusel(data.slice(10, 14));
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
  // 🔴 FIN CAMBIO

  // ---- Auto-scroll del carrusel: avanza sola cada 3 segundos ----
  useEffect(() => {
    if (carrusel.length === 0) return;

    const intervalo = setInterval(() => {
      if (pausadoRef.current) return; // si el usuario lo está tocando, no la muevas

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
    <View style={styles.contenedor}>
      {/* Encabezado: hamburguesa + barra de búsqueda + botón de filtro */}
      <View style={styles.encabezado}>
        <TouchableOpacity
          onPress={() => setMenuAbierto(true)}
          style={styles.botonIcono}
        >
          <Text style={styles.icono}>☰</Text>
        </TouchableOpacity>

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
            <Text style={styles.tituloSeccion}>
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
          <Text style={styles.tituloSeccion}>Descubre El Salvador</Text>
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

          <Text style={styles.tituloSeccion}>Lugares imprescindibles</Text>
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
          <View style={styles.panelMenu}>
            <Text style={styles.tituloMenu}>Menú</Text>
            {OPCIONES_MENU.map((opcion) => (
              <TouchableOpacity
                key={opcion}
                style={styles.itemMenu}
                onPress={() => {
                  setMenuAbierto(false);
                  // 🆕 NUEVO: Manejar "Mis preferencias"
                  if (opcion === "Mis preferencias") {
                    router.push("/preferencias");
                  } else {
                    // ... resto de opciones (por ahora solo cierra el menú)
                    console.log(`📌 Opción seleccionada: ${opcion}`);
                  }
                }}
              >
                <Text style={styles.textoItemMenu}>{opcion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de FILTROS */}
      <Modal visible={filtrosAbiertos} animationType="slide" transparent>
        <View style={styles.fondoOscuroCentrado}>
          <View style={styles.panelFiltros}>
            <Text style={styles.tituloMenu}>Filtrar por</Text>

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
  return (
    <TouchableOpacity
      style={styles.cardCarrusel}
      onPress={() => router.push(`/hito/${hito.id}`)}
    >
      <Image
        source={obtenerImagenPrincipal(hito)}
        style={styles.imagenCarrusel}
      />
      <Text style={styles.nombreCarrusel} numberOfLines={1}>
        {hito.nombre}
      </Text>
    </TouchableOpacity>
  );
}

function TarjetaGrid({ hito }: { hito: Hito }) {
  return (
    <TouchableOpacity
      style={styles.cardGrid}
      onPress={() => router.push(`/hito/${hito.id}`)}
    >
      <Image source={obtenerImagenPrincipal(hito)} style={styles.imagenGrid} />
      <Text style={styles.nombreGrid} numberOfLines={2}>
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
});