import { EstadoManual, Horario } from "@/lib/horarios";
import { supabase } from "@/lib/supabase";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/* ---------------------------------------------------------------------------
 * Servicios de Supabase de la realidad aumentada
 * Fotos antes/después (hito_imagenes con tipo 'antes' | 'despues') y la
 * configuración de RA de cada hito. Mismo bucket que el carrusel.
 * ------------------------------------------------------------------------- */

export const BUCKET = "hitos-imagenes";
export const RADIO_MIN = 10;
export const RADIO_MAX = 1000;
export const MAX_DESCRIPCION_CORTA = 140;

// Compresión antes de subir
const ANCHO_MAXIMO = 1600;
const CALIDAD_JPEG = 0.8;

export type TipoFotoRA = "antes" | "despues";
export type TipoImagen = "galeria" | TipoFotoRA;

export type ImagenHito = {
  id: number;
  url: string;
  orden: number | null;
  tipo: TipoImagen;
  anio_aproximado: number | null;
  pie_foto: string | null;
  ruta_storage: string | null;
};

export type FotoRA = ImagenHito & { tipo: TipoFotoRA };

// ---- Rutas del bucket ----

// Filas antiguas sin ruta_storage: la ruta sale de la URL pública
// ".../storage/v1/object/public/hitos-imagenes/<ruta>?..." → "<ruta>"
export function rutaDesdeUrl(url: string): string | null {
  const marca = `/object/public/${BUCKET}/`;
  const indice = url.indexOf(marca);
  if (indice === -1) return null;
  return decodeURIComponent(url.slice(indice + marca.length).split("?")[0]);
}

export function rutaDeImagen(imagen: Pick<ImagenHito, "url" | "ruta_storage">) {
  return imagen.ruta_storage ?? rutaDesdeUrl(imagen.url);
}

// ---- Subida y borrado de archivos ----

// Reduce al ancho máximo (1600 px por defecto) y guarda como JPEG 0.8
async function comprimir(
  uri: string,
  ancho: number | null,
  anchoMaximo = ANCHO_MAXIMO,
): Promise<string> {
  const contexto = ImageManipulator.manipulate(uri);
  if (!ancho || ancho > anchoMaximo) contexto.resize({ width: anchoMaximo });
  const imagen = await contexto.renderAsync();
  const resultado = await imagen.saveAsync({
    compress: CALIDAD_JPEG,
    format: SaveFormat.JPEG,
  });
  return resultado.uri;
}

// Comprime y sube una foto local; devuelve su ruta en el bucket y la URL pública
export async function subirFotoRA(
  hitoId: string,
  tipo: TipoFotoRA,
  uriLocal: string,
  anchoOriginal: number | null,
) {
  return subirJpeg(`ar/${hitoId}/${tipo}-${Date.now()}.jpg`, uriLocal, anchoOriginal);
}

// Comprime y sube una foto local a la ruta indicada del bucket
export async function subirJpeg(
  ruta: string,
  uriLocal: string,
  anchoOriginal: number | null,
  anchoMaximo = ANCHO_MAXIMO,
) {
  const uri = await comprimir(uriLocal, anchoOriginal, anchoMaximo);
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, decode(base64), { contentType: "image/jpeg" });
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  return { ruta, url: data.publicUrl };
}

// Borra archivos del bucket. Devuelve cuántos se borraron de verdad: si la
// política de Storage no lo permite, Supabase no da error, solo no borra nada.
export async function borrarArchivos(rutas: string[]): Promise<number> {
  if (rutas.length === 0) return 0;
  const { data, error } = await supabase.storage.from(BUCKET).remove(rutas);
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

// ---- Lista de RA (admin) ----

export type HitoRAResumen = {
  id: string;
  nombre: string;
  ar_activo: boolean;
  ar_radio_metros: number;
  miniatura: string | null;
  tieneAntes: boolean;
};

type FilaHitoRA = {
  id: string;
  nombre: string;
  ar_activo: boolean;
  ar_radio_metros: number;
  hito_imagenes: { url: string; orden: number | null; tipo: TipoImagen }[];
};

// Primera foto de galería por orden; si no hay, la "después" o la "antes"
function elegirMiniatura(imagenes: FilaHitoRA["hito_imagenes"]) {
  const galeria = imagenes
    .filter((i) => i.tipo === "galeria")
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  return (
    galeria[0]?.url ??
    imagenes.find((i) => i.tipo === "despues")?.url ??
    imagenes.find((i) => i.tipo === "antes")?.url ??
    null
  );
}

export async function cargarHitosRA(): Promise<HitoRAResumen[]> {
  const { data, error } = await supabase
    .from("hitos")
    .select("id, nombre, ar_activo, ar_radio_metros, hito_imagenes(url, orden, tipo)")
    .order("nombre", { ascending: true });
  if (error) throw new Error(error.message);

  return ((data ?? []) as FilaHitoRA[]).map((h) => ({
    id: h.id,
    nombre: h.nombre,
    ar_activo: h.ar_activo,
    ar_radio_metros: h.ar_radio_metros,
    miniatura: elegirMiniatura(h.hito_imagenes ?? []),
    tieneAntes: (h.hito_imagenes ?? []).some((i) => i.tipo === "antes"),
  }));
}

export async function contarHitosRA() {
  return supabase
    .from("hitos")
    .select("*", { count: "exact", head: true })
    .eq("ar_activo", true);
}

// Si la RLS rechaza la escritura, Supabase devuelve 0 filas sin error:
// por eso se pide la fila de vuelta y se comprueba que exista.
export function exigirFila<T>(data: T[] | null, accion: string): T {
  if (!data || data.length === 0) {
    throw new Error(`No tienes permiso para ${accion}.`);
  }
  return data[0];
}

export async function alternarArActivo(hitoId: string, activo: boolean) {
  const { data, error } = await supabase
    .from("hitos")
    .update({ ar_activo: activo })
    .eq("id", hitoId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirFila(data, "cambiar la RA de este hito");
}

// ---- Editor de RA (admin) ----

export type ConfigRA = {
  ar_activo: boolean;
  ar_radio_metros: number;
  descripcion_corta: string | null;
};

export type DatosEditorRA = ConfigRA & {
  id: string;
  nombre: string;
  antes: FotoRA | null;
  despues: FotoRA | null;
  // Primera de galería: se usa como "ahora" si no hay foto 'despues'
  primeraGaleria: string | null;
};

const CAMPOS_IMAGEN = "id, url, orden, tipo, anio_aproximado, pie_foto, ruta_storage";

export async function cargarEditorRA(hitoId: string): Promise<DatosEditorRA> {
  const { data, error } = await supabase
    .from("hitos")
    .select(
      `id, nombre, ar_activo, ar_radio_metros, descripcion_corta, hito_imagenes(${CAMPOS_IMAGEN})`,
    )
    .eq("id", hitoId)
    .single();
  if (error) throw new Error(error.message);

  const imagenes = (data.hito_imagenes ?? []) as ImagenHito[];
  const galeria = imagenes
    .filter((i) => i.tipo === "galeria")
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  return {
    id: data.id,
    nombre: data.nombre,
    ar_activo: data.ar_activo,
    ar_radio_metros: data.ar_radio_metros,
    descripcion_corta: data.descripcion_corta,
    antes: (imagenes.find((i) => i.tipo === "antes") as FotoRA) ?? null,
    despues: (imagenes.find((i) => i.tipo === "despues") as FotoRA) ?? null,
    primeraGaleria: galeria[0]?.url ?? null,
  };
}

type CamposFoto = Pick<ImagenHito, "url" | "ruta_storage" | "anio_aproximado" | "pie_foto">;

export async function insertarFotoRA(hitoId: string, tipo: TipoFotoRA, campos: CamposFoto) {
  const { data, error } = await supabase
    .from("hito_imagenes")
    .insert({ hito_id: hitoId, tipo, orden: 0, ...campos })
    .select(CAMPOS_IMAGEN);
  if (error) throw new Error(error.message);
  return exigirFila(data, "guardar la foto") as FotoRA;
}

export async function actualizarFotoRA(id: number, campos: Partial<CamposFoto>) {
  const { data, error } = await supabase
    .from("hito_imagenes")
    .update(campos)
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  exigirFila(data, "actualizar la foto");
}

export async function eliminarFilaFotoRA(id: number) {
  const { data, error } = await supabase
    .from("hito_imagenes")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  exigirFila(data, "eliminar la foto");
}

export async function guardarConfigRA(hitoId: string, config: ConfigRA) {
  const { data, error } = await supabase
    .from("hitos")
    .update(config)
    .eq("id", hitoId)
    .select("id");
  if (error) throw new Error(error.message);
  exigirFila(data, "guardar la configuración de RA");
}

// ---- Cámara RA (usuario) ----

export type HitoRA = {
  id: string;
  nombre: string;
  descripcion_corta: string | null;
  lat: number;
  lng: number;
  estado_manual: EstadoManual | null;
  es_lugar_oculto: boolean;
  ar_radio_metros: number;
  horarios_hito: Horario[];
  hito_imagenes: ImagenHito[];
};

// Una sola consulta: hitos con RA activa, sus horarios e imágenes
export async function cargarHitosParaCamara(incluirOcultos: boolean): Promise<HitoRA[]> {
  // Tipado como string para que el cliente no intente deducir el tipo del select
  const campos: string = `id, nombre, descripcion_corta, lat, lng, estado_manual, es_lugar_oculto, ar_radio_metros,
       horarios_hito(dia_semana, hora_apertura, hora_cierre),
       hito_imagenes(${CAMPOS_IMAGEN})`;
  let consulta = supabase
    .from("hitos")
    .select(campos)
    .eq("ar_activo", true)
    .not("lat", "is", null)
    .not("lng", "is", null);
  // "is not true" para no perder los que tienen es_lugar_oculto en null
  if (!incluirOcultos) consulta = consulta.not("es_lugar_oculto", "is", true);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HitoRA[];
}
