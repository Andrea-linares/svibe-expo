import {
  esProporcionEsfera,
  esUnaSolaFoto,
  MAX_FOTOS_COLLAGE,
  mover,
  TipoVista360,
  validarCantidadFotos,
} from "@/lib/vista360-reglas";
import {
  cargarEditorVista360,
  DatosEditorVista360,
  eliminarVista360,
  FotoBorrador360,
  guardarVista360,
} from "@/lib/vista360-servicio";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ---------------------------------------------------------------------------
 * Editor de la vista 360 de un hito (admin)
 * Todo queda como borrador en el dispositivo hasta llamar a guardar():
 * interruptor, tipo y fotos (las nuevas son URI locales).
 * ------------------------------------------------------------------------- */

type Borrador = {
  activa: boolean;
  tipo: TipoVista360;
  fotos: FotoBorrador360[];
};

export type ResultadoAccion = { ok: true; aviso?: string } | { ok: false; error: string };

export type ResultadoElegir = "ok" | "sin-permiso" | "lleno" | "proporcion";

function crearBorrador(datos: DatosEditorVista360): Borrador {
  const vista = datos.vista;
  if (!vista) return { activa: true, tipo: "esfera", fotos: [] };
  return {
    activa: vista.activa,
    tipo: vista.tipo,
    fotos: vista.imagenes.map((img) => ({ clave: img.id, existente: img, nueva: null })),
  };
}

// URI que se ve en pantalla: la nueva elegida o la guardada
export function uriFoto(foto: FotoBorrador360) {
  return foto.nueva?.uri ?? foto.existente?.url ?? "";
}

const claves = (b: Borrador) => b.fotos.map((f) => f.clave).join("|");

const mensajeError = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useVista360Admin(hitoId: string | undefined) {
  const [datos, setDatos] = useState<DatosEditorVista360 | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const recargar = useCallback(async () => {
    if (!hitoId) return;
    try {
      const nuevos = await cargarEditorVista360(hitoId);
      setDatos(nuevos);
      setBorrador(crearBorrador(nuevos));
      setErrorCarga(null);
    } catch (e) {
      setErrorCarga(mensajeError(e));
    }
  }, [hitoId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const hayCambios = useMemo(() => {
    if (!borrador || !datos) return false;
    const base = crearBorrador(datos);
    // Sin vista guardada, solo cuenta como cambio si ya hay fotos elegidas
    if (!datos.vista) return borrador.fotos.length > 0;
    return (
      borrador.activa !== base.activa ||
      borrador.tipo !== base.tipo ||
      claves(borrador) !== claves(base)
    );
  }, [borrador, datos]);

  const errorFotos = borrador
    ? validarCantidadFotos(borrador.tipo, borrador.fotos.length)
    : null;

  // Aviso (no bloquea) si la foto nueva de una esfera no es aproximadamente 2:1
  const primera = borrador?.fotos[0]?.nueva;
  const avisoProporcion =
    borrador?.tipo === "esfera" &&
    primera?.ancho &&
    primera.alto &&
    !esProporcionEsfera(primera.ancho, primera.alto)
      ? "La foto no parece equirectangular (2:1). Puede verse estirada."
      : null;

  // ---- Cambios en el borrador ----

  function cambiar(parcial: Partial<Omit<Borrador, "fotos">>) {
    setBorrador((actual) => (actual ? { ...actual, ...parcial } : actual));
  }

  function cambiarFotos(cambio: (fotos: FotoBorrador360[]) => FotoBorrador360[]) {
    setBorrador((actual) => (actual ? { ...actual, fotos: cambio(actual.fotos) } : actual));
  }

  // Abre la galería: 1 foto (reemplaza) para esfera y panorámica, varias
  // (se agregan al final) para collage
  async function elegirFotos(): Promise<ResultadoElegir> {
    if (!borrador) return "ok";
    const unaSola = esUnaSolaFoto(borrador.tipo);
    const disponibles = MAX_FOTOS_COLLAGE - borrador.fotos.length;
    if (!unaSola && disponibles <= 0) return "lleno";

    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return "sin-permiso";

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1, // se comprime al guardar
      allowsMultipleSelection: !unaSola,
      selectionLimit: unaSola ? 1 : disponibles,
      orderedSelection: true,
    });
    if (resultado.canceled) return "ok";

    const marca = Date.now();
    const nuevas: FotoBorrador360[] = resultado.assets
      .slice(0, unaSola ? 1 : disponibles)
      .map((asset, i) => ({
        clave: `nueva-${marca}-${i}`,
        existente: null,
        nueva: { uri: asset.uri, ancho: asset.width || null, alto: asset.height || null },
      }));
    cambiarFotos((fotos) => (unaSola ? nuevas : [...fotos, ...nuevas]));

    const foto = nuevas[0]?.nueva;
    if (
      borrador.tipo === "esfera" &&
      foto?.ancho &&
      foto.alto &&
      !esProporcionEsfera(foto.ancho, foto.alto)
    ) {
      return "proporcion";
    }
    return "ok";
  }

  function moverFoto(indice: number, delta: number) {
    cambiarFotos((fotos) => mover(fotos, indice, indice + delta));
  }

  function quitarFoto(indice: number) {
    cambiarFotos((fotos) => fotos.filter((_, i) => i !== indice));
  }

  function descartar() {
    if (datos) setBorrador(crearBorrador(datos));
  }

  // ---- Guardar y eliminar ----

  async function guardar(): Promise<ResultadoAccion> {
    if (!hitoId || !borrador || !datos) return { ok: false, error: "No hay datos." };
    if (errorFotos) return { ok: false, error: errorFotos };

    setGuardando(true);
    try {
      const { aviso } = await guardarVista360(hitoId, datos.vista, borrador);
      await recargar();
      return { ok: true, aviso };
    } catch (e) {
      return { ok: false, error: mensajeError(e) };
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(): Promise<ResultadoAccion> {
    if (!datos?.vista) return { ok: false, error: "Este hito no tiene vista 360." };

    setGuardando(true);
    try {
      const { aviso } = await eliminarVista360(datos.vista);
      await recargar();
      return { ok: true, aviso };
    } catch (e) {
      return { ok: false, error: mensajeError(e) };
    } finally {
      setGuardando(false);
    }
  }

  return {
    datos,
    borrador,
    errorCarga,
    errorFotos,
    avisoProporcion,
    hayCambios,
    guardando,
    recargar,
    cambiar,
    elegirFotos,
    moverFoto,
    quitarFoto,
    descartar,
    guardar,
    eliminar,
  };
}
