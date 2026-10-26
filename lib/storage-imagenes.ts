import { supabase } from "@/lib/supabase";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/* ---------------------------------------------------------------------------
 * Utilidades de Storage para las imágenes de los hitos
 * Subida comprimida, borrado de archivos y comprobación de escrituras con RLS.
 * Mismo bucket que el carrusel.
 * ------------------------------------------------------------------------- */

export const BUCKET = "hitos-imagenes";

// Compresión antes de subir
const ANCHO_MAXIMO = 1600;
const CALIDAD_JPEG = 0.8;

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

// Comprime y sube una foto local a la ruta indicada del bucket;
// devuelve su ruta en el bucket y la URL pública
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

// Si la RLS rechaza la escritura, Supabase devuelve 0 filas sin error:
// por eso se pide la fila de vuelta y se comprueba que exista.
export function exigirFila<T>(data: T[] | null, accion: string): T {
  if (!data || data.length === 0) {
    throw new Error(`No tienes permiso para ${accion}.`);
  }
  return data[0];
}
