import { borrarArchivos, exigirFila, subirJpeg } from "@/lib/ra-servicio";
import { supabase } from "@/lib/supabase";
import {
  anchoMaximoDe,
  rutasSinUso,
  rutaVista360,
  TipoVista360,
  validarCantidadFotos,
} from "@/lib/vista360-reglas";

/* ---------------------------------------------------------------------------
 * Servicios de Supabase de la vista 360
 * Una vista como máximo por hito (hito_vistas_360) y sus fotos
 * (hito_vista_360_imagenes). Las fotos van al mismo bucket que la RA, en
 * 360/{hitoId}/{orden}-{timestamp}.jpg.
 * ------------------------------------------------------------------------- */

export type ImagenVista360 = {
  id: string;
  url: string;
  ruta_storage: string;
  orden: number;
};

export type Vista360 = {
  id: string;
  hito_id: string;
  tipo: TipoVista360;
  activa: boolean;
  imagenes: ImagenVista360[];
};

// Lo que necesita el visor: tipo y URLs en orden
export type VistaPublica360 = {
  tipo: TipoVista360;
  imagenes: { url: string; orden: number }[];
};

const CAMPOS_IMAGEN = "id, url, ruta_storage, orden";

const porOrden = (a: { orden: number }, b: { orden: number }) => a.orden - b.orden;

// ---- Usuario ----

// Vista activa del hito con sus imágenes ordenadas; null si no tiene
export async function cargarVistaActiva(hitoId: string): Promise<VistaPublica360 | null> {
  const { data, error } = await supabase
    .from("hito_vistas_360")
    .select("tipo, hito_vista_360_imagenes(url, orden)")
    .eq("hito_id", hitoId)
    .eq("activa", true)
    .order("orden", { referencedTable: "hito_vista_360_imagenes", ascending: true })
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const imagenes = ((data.hito_vista_360_imagenes ?? []) as VistaPublica360["imagenes"])
    .slice()
    .sort(porOrden);
  if (imagenes.length === 0) return null;
  return { tipo: data.tipo as TipoVista360, imagenes };
}

// ---- Editor (admin) ----

export type DatosEditorVista360 = { nombre: string; vista: Vista360 | null };

export async function cargarEditorVista360(hitoId: string): Promise<DatosEditorVista360> {
  const [hito, vista] = await Promise.all([
    supabase.from("hitos").select("nombre").eq("id", hitoId).single(),
    supabase
      .from("hito_vistas_360")
      .select(`id, hito_id, tipo, activa, hito_vista_360_imagenes(${CAMPOS_IMAGEN})`)
      .eq("hito_id", hitoId)
      .maybeSingle(),
  ]);
  if (hito.error) throw new Error(hito.error.message);
  if (vista.error) throw new Error(vista.error.message);

  const fila = vista.data;
  return {
    nombre: hito.data.nombre,
    vista: fila
      ? {
          id: fila.id,
          hito_id: fila.hito_id,
          tipo: fila.tipo as TipoVista360,
          activa: fila.activa,
          imagenes: ((fila.hito_vista_360_imagenes ?? []) as ImagenVista360[])
            .slice()
            .sort(porOrden),
        }
      : null,
  };
}

// Una foto del editor: ya guardada (existente) o elegida en el teléfono (nueva)
export type FotoBorrador360 = {
  clave: string;
  existente: ImagenVista360 | null;
  nueva: { uri: string; ancho: number | null; alto: number | null } | null;
};

export type CambiosVista360 = {
  tipo: TipoVista360;
  activa: boolean;
  fotos: FotoBorrador360[];
};

type CamposFila = { url: string; ruta_storage: string };

async function insertarVista(hitoId: string, tipo: TipoVista360, activa: boolean) {
  const { data, error } = await supabase
    .from("hito_vistas_360")
    .insert({ hito_id: hitoId, tipo, activa })
    .select("id");
  if (error) throw new Error(error.message);
  return exigirFila(data, "crear la vista 360").id as string;
}

async function actualizarVista(id: string, tipo: TipoVista360, activa: boolean) {
  const { data, error } = await supabase
    .from("hito_vistas_360")
    .update({ tipo, activa, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  exigirFila(data, "actualizar la vista 360");
}

// Borra la vista; sus imágenes se borran en cascada
async function borrarFilaVista(id: string) {
  const { data, error } = await supabase
    .from("hito_vistas_360")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  exigirFila(data, "eliminar la vista 360");
}

async function insertarImagenes(vistaId: string, filas: (CamposFila & { id?: string })[]) {
  if (filas.length === 0) return;
  const { data, error } = await supabase
    .from("hito_vista_360_imagenes")
    .insert(filas.map((fila, orden) => ({ ...fila, vista_id: vistaId, orden })))
    .select("id");
  if (error) throw new Error(error.message);
  if ((data?.length ?? 0) < filas.length) {
    throw new Error("No tienes permiso para guardar las fotos de la vista 360.");
  }
}

async function borrarImagenes(vistaId: string, esperadas: number) {
  if (esperadas === 0) return;
  const { data, error } = await supabase
    .from("hito_vista_360_imagenes")
    .delete()
    .eq("vista_id", vistaId)
    .select("id");
  if (error) throw new Error(error.message);
  if ((data?.length ?? 0) < esperadas) {
    throw new Error("No tienes permiso para cambiar las fotos de la vista 360.");
  }
}

const AVISO_ARCHIVOS =
  "Se guardó, pero no se pudieron borrar del almacenamiento las fotos anteriores.";

// Borra de Storage y avisa si no se borraron todos (remove devuelve los borrados)
async function borrarArchivosConAviso(rutas: string[], aviso: string) {
  try {
    const borrados = await borrarArchivos(rutas);
    return borrados < rutas.length ? aviso : undefined;
  } catch (e) {
    console.error("Error borrando archivos de la vista 360:", e);
    return aviso;
  }
}

// Orden: subir fotos nuevas → fila de la vista → filas de imágenes → borrar
// archivos que ya no se usan. Si algo falla antes del último paso se deshace
// lo hecho (en orden inverso), se borran las fotos recién subidas y se lanza
// el error.
export async function guardarVista360(
  hitoId: string,
  original: Vista360 | null,
  cambios: CambiosVista360,
): Promise<{ aviso?: string }> {
  const errorCantidad = validarCantidadFotos(cambios.tipo, cambios.fotos.length);
  if (errorCantidad) throw new Error(errorCantidad);

  const subidas: string[] = [];
  const deshacer: (() => Promise<unknown>)[] = [];
  const anteriores = original?.imagenes ?? [];
  const finales: CamposFila[] = [];
  const marca = Date.now();

  try {
    for (const [orden, foto] of cambios.fotos.entries()) {
      if (foto.existente) {
        finales.push({ url: foto.existente.url, ruta_storage: foto.existente.ruta_storage });
      } else if (foto.nueva) {
        const { ruta, url } = await subirJpeg(
          rutaVista360(hitoId, orden, marca),
          foto.nueva.uri,
          foto.nueva.ancho,
          anchoMaximoDe(cambios.tipo),
        );
        subidas.push(ruta);
        finales.push({ url, ruta_storage: ruta });
      }
    }

    let vistaId: string;
    if (original) {
      await actualizarVista(original.id, cambios.tipo, cambios.activa);
      deshacer.push(() => actualizarVista(original.id, original.tipo, original.activa));
      vistaId = original.id;
    } else {
      const nuevaId = await insertarVista(hitoId, cambios.tipo, cambios.activa);
      deshacer.push(() => borrarFilaVista(nuevaId));
      vistaId = nuevaId;
    }

    // Por la restricción UNIQUE (vista_id, orden) no se puede reordenar fila
    // por fila: si cambia algo se reemplaza el conjunto completo.
    const cambiaronFotos =
      anteriores.length !== finales.length ||
      anteriores.some((img, i) => img.ruta_storage !== finales[i].ruta_storage);
    if (cambiaronFotos) {
      await borrarImagenes(vistaId, anteriores.length);
      deshacer.push(() =>
        insertarImagenes(
          vistaId,
          anteriores.map(({ id, url, ruta_storage }) => ({ id, url, ruta_storage })),
        ),
      );
      await insertarImagenes(vistaId, finales);
      deshacer.push(() => borrarImagenes(vistaId, finales.length));
    }
  } catch (e) {
    for (const paso of deshacer.reverse()) {
      await paso().catch((err) => console.error("No se pudo deshacer un paso:", err));
    }
    await borrarArchivos(subidas).catch((err) =>
      console.error("No se pudieron borrar las fotos subidas:", err),
    );
    throw e;
  }

  // Ya está todo guardado: borrar los archivos reemplazados o quitados
  const viejos = rutasSinUso(
    anteriores.map((img) => img.ruta_storage),
    finales.map((img) => img.ruta_storage),
  );
  return { aviso: await borrarArchivosConAviso(viejos, AVISO_ARCHIVOS) };
}

// Borra la vista (y en cascada sus filas de imágenes) y después sus archivos
export async function eliminarVista360(vista: Vista360): Promise<{ aviso?: string }> {
  await borrarFilaVista(vista.id);
  const aviso = await borrarArchivosConAviso(
    vista.imagenes.map((img) => img.ruta_storage),
    "La vista se eliminó, pero no se pudieron borrar sus fotos del almacenamiento.",
  );
  return { aviso };
}
