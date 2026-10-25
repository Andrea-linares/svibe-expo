import {
  actualizarFotoRA,
  borrarArchivos,
  cargarEditorRA,
  DatosEditorRA,
  eliminarFilaFotoRA,
  FotoRA,
  guardarConfigRA,
  insertarFotoRA,
  MAX_DESCRIPCION_CORTA,
  RADIO_MAX,
  RADIO_MIN,
  rutaDeImagen,
  subirFotoRA,
  TipoFotoRA,
} from "@/lib/ra-servicio";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ---------------------------------------------------------------------------
 * Editor de RA de un hito (admin)
 * Todo queda como borrador en el dispositivo hasta llamar a guardar():
 * fotos elegidas (URI locales), textos, interruptor y radio.
 * ------------------------------------------------------------------------- */

type FotoNueva = { uri: string; ancho: number | null };

export type BorradorFoto = {
  original: FotoRA | null;
  nueva: FotoNueva | null;
  eliminar: boolean;
  anio: string;
  pie: string;
};

type Borrador = {
  antes: BorradorFoto;
  despues: BorradorFoto;
  arActivo: boolean;
  radio: string;
  descripcion: string;
};

export type ErroresEditor = Partial<
  Record<"radio" | "descripcion" | "anioAntes" | "anioDespues", string>
>;

export type ResultadoGuardar = { ok: true; aviso?: string } | { ok: false; error: string };

function borradorFoto(original: FotoRA | null): BorradorFoto {
  return {
    original,
    nueva: null,
    eliminar: false,
    anio: original?.anio_aproximado?.toString() ?? "",
    pie: original?.pie_foto ?? "",
  };
}

function crearBorrador(datos: DatosEditorRA): Borrador {
  return {
    antes: borradorFoto(datos.antes),
    despues: borradorFoto(datos.despues),
    arActivo: datos.ar_activo,
    radio: String(datos.ar_radio_metros),
    descripcion: datos.descripcion_corta ?? "",
  };
}

// URI que se ve en pantalla: la nueva elegida, la guardada o ninguna
export function uriVisible(foto: BorradorFoto): string | null {
  if (foto.nueva) return foto.nueva.uri;
  if (foto.eliminar) return null;
  return foto.original?.url ?? null;
}

const textoONulo = (texto: string) => texto.trim() || null;
const anioONulo = (texto: string) => (texto.trim() ? Number(texto.trim()) : null);

function fotoCambio(foto: BorradorFoto) {
  if (foto.nueva || foto.eliminar) return true;
  if (!foto.original) return false;
  return (
    anioONulo(foto.anio) !== foto.original.anio_aproximado ||
    textoONulo(foto.pie) !== foto.original.pie_foto
  );
}

function validarAnio(texto: string): string | undefined {
  if (!texto.trim()) return undefined;
  const anio = Number(texto.trim());
  const actual = new Date().getFullYear();
  if (!/^\d{3,4}$/.test(texto.trim()) || anio < 1000 || anio > actual) {
    return `Escribe un año entre 1000 y ${actual}.`;
  }
  return undefined;
}

function validar(b: Borrador): ErroresEditor {
  const errores: ErroresEditor = {};
  const radio = Number(b.radio);
  if (!/^\d+$/.test(b.radio.trim()) || radio < RADIO_MIN || radio > RADIO_MAX) {
    errores.radio = `El radio debe estar entre ${RADIO_MIN} y ${RADIO_MAX} m.`;
  }
  if (Array.from(b.descripcion.trim()).length > MAX_DESCRIPCION_CORTA) {
    errores.descripcion = `Máximo ${MAX_DESCRIPCION_CORTA} caracteres.`;
  }
  errores.anioAntes = validarAnio(b.antes.anio);
  errores.anioDespues = validarAnio(b.despues.anio);
  // Quita las claves sin error
  return Object.fromEntries(
    Object.entries(errores).filter(([, v]) => v),
  ) as ErroresEditor;
}

export function useAntesDespuesAdmin(hitoId: string | undefined) {
  const [datos, setDatos] = useState<DatosEditorRA | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const recargar = useCallback(async () => {
    if (!hitoId) return;
    try {
      const nuevos = await cargarEditorRA(hitoId);
      setDatos(nuevos);
      setBorrador(crearBorrador(nuevos));
      setErrorCarga(null);
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : String(e));
    }
  }, [hitoId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const errores = useMemo(() => (borrador ? validar(borrador) : {}), [borrador]);

  const hayCambios = useMemo(() => {
    if (!borrador || !datos) return false;
    return (
      fotoCambio(borrador.antes) ||
      fotoCambio(borrador.despues) ||
      borrador.arActivo !== datos.ar_activo ||
      borrador.radio.trim() !== String(datos.ar_radio_metros) ||
      textoONulo(borrador.descripcion) !== datos.descripcion_corta
    );
  }, [borrador, datos]);

  // ---- Cambios en el borrador ----

  function cambiar(parcial: Partial<Borrador>) {
    setBorrador((actual) => (actual ? { ...actual, ...parcial } : actual));
  }

  function cambiarFoto(tipo: TipoFotoRA, parcial: Partial<BorradorFoto>) {
    setBorrador((actual) =>
      actual ? { ...actual, [tipo]: { ...actual[tipo], ...parcial } } : actual,
    );
  }

  // Abre la galería del teléfono; devuelve false si no hay permiso
  async function elegirFoto(tipo: TipoFotoRA): Promise<boolean> {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return false;

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1, // se comprime al guardar
    });
    if (!resultado.canceled) {
      const asset = resultado.assets[0];
      cambiarFoto(tipo, {
        nueva: { uri: asset.uri, ancho: asset.width || null },
        eliminar: false,
      });
    }
    return true;
  }

  // Marca la foto para eliminarla al guardar (o descarta la recién elegida)
  function quitarFoto(tipo: TipoFotoRA) {
    cambiarFoto(tipo, { nueva: null, eliminar: true, anio: "", pie: "" });
  }

  // Vuelve a la foto guardada (deshace "Cambiar" o "Eliminar")
  function restaurarFoto(tipo: TipoFotoRA) {
    if (!datos) return;
    cambiarFoto(tipo, borradorFoto(datos[tipo]));
  }

  function descartar() {
    if (datos) setBorrador(crearBorrador(datos));
  }

  // ---- Guardar ----
  // Orden: subir fotos → filas de hito_imagenes → hitos → borrar archivos viejos.
  // Si falla algo antes del último paso, se deshace lo hecho (en orden inverso)
  // y se borran los archivos recién subidos.
  async function guardar(): Promise<ResultadoGuardar> {
    if (!hitoId || !borrador || !datos) return { ok: false, error: "No hay datos." };
    if (Object.keys(errores).length > 0) {
      return { ok: false, error: "Revisa los campos marcados." };
    }

    setGuardando(true);
    const subidas: string[] = [];
    const deshacer: (() => Promise<unknown>)[] = [];
    const archivosViejos: string[] = [];

    try {
      for (const tipo of ["antes", "despues"] as const) {
        const foto = borrador[tipo];
        const original = foto.original;
        const textos = {
          anio_aproximado: anioONulo(foto.anio),
          pie_foto: textoONulo(foto.pie),
        };

        if (foto.nueva) {
          const { ruta, url } = await subirFotoRA(hitoId, tipo, foto.nueva.uri, foto.nueva.ancho);
          subidas.push(ruta);

          if (original) {
            await actualizarFotoRA(original.id, { url, ruta_storage: ruta, ...textos });
            deshacer.push(() =>
              actualizarFotoRA(original.id, {
                url: original.url,
                ruta_storage: original.ruta_storage,
                anio_aproximado: original.anio_aproximado,
                pie_foto: original.pie_foto,
              }),
            );
            const rutaVieja = rutaDeImagen(original);
            if (rutaVieja) archivosViejos.push(rutaVieja);
          } else {
            const insertada = await insertarFotoRA(hitoId, tipo, {
              url,
              ruta_storage: ruta,
              ...textos,
            });
            deshacer.push(() => eliminarFilaFotoRA(insertada.id));
          }
        } else if (foto.eliminar && original) {
          await eliminarFilaFotoRA(original.id);
          deshacer.push(() =>
            insertarFotoRA(hitoId, tipo, {
              url: original.url,
              ruta_storage: original.ruta_storage,
              anio_aproximado: original.anio_aproximado,
              pie_foto: original.pie_foto,
            }),
          );
          const rutaVieja = rutaDeImagen(original);
          if (rutaVieja) archivosViejos.push(rutaVieja);
        } else if (original && fotoCambio(foto)) {
          await actualizarFotoRA(original.id, textos);
          deshacer.push(() =>
            actualizarFotoRA(original.id, {
              anio_aproximado: original.anio_aproximado,
              pie_foto: original.pie_foto,
            }),
          );
        }
      }

      await guardarConfigRA(hitoId, {
        ar_activo: borrador.arActivo,
        ar_radio_metros: Number(borrador.radio.trim()),
        descripcion_corta: textoONulo(borrador.descripcion),
      });
    } catch (e) {
      for (const paso of deshacer.reverse()) {
        await paso().catch((err) => console.error("No se pudo deshacer un paso:", err));
      }
      await borrarArchivos(subidas).catch((err) =>
        console.error("No se pudieron borrar las fotos subidas:", err),
      );
      setGuardando(false);
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    // Ya está todo guardado: borrar los archivos reemplazados o eliminados
    let aviso: string | undefined;
    try {
      const borrados = await borrarArchivos(archivosViejos);
      if (borrados < archivosViejos.length) {
        aviso = "Se guardó, pero no se pudo borrar del almacenamiento la foto anterior.";
      }
    } catch (e) {
      console.error("Error borrando archivos viejos:", e);
      aviso = "Se guardó, pero no se pudo borrar del almacenamiento la foto anterior.";
    }

    await recargar();
    setGuardando(false);
    return { ok: true, aviso };
  }

  return {
    datos,
    borrador,
    errorCarga,
    errores,
    hayCambios,
    guardando,
    recargar,
    cambiar,
    cambiarFoto,
    elegirFoto,
    quitarFoto,
    restaurarFoto,
    descartar,
    guardar,
  };
}
