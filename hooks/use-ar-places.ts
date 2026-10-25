import { Coordenada, distanciaHaversine, rumbo } from "@/lib/geo";
import { calcularEstado, EstadoHito } from "@/lib/horarios";
import { cargarHitosParaCamara, FotoRA, HitoRA } from "@/lib/ra-servicio";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ---------------------------------------------------------------------------
 * Lugares de la cámara RA
 * Una sola consulta (hitos con ar_activo + horarios + imágenes) guardada en
 * memoria mientras la app está abierta. La distancia y el rumbo se calculan
 * en el teléfono cada vez que cambia la ubicación.
 * ------------------------------------------------------------------------- */

// Cambia a true para que los lugares ocultos también aparezcan en la RA
export const INCLUIR_OCULTOS = false;

export type LugarAR = {
  id: string;
  nombre: string;
  descripcionCorta: string | null;
  distancia: number;
  rumbo: number;
  radio: number;
  enRango: boolean;
  estado: EstadoHito;
  antes: FotoRA | null;
  despues: FotoRA | null;
  // Foto del "ahora" en el comparador: la 'despues' o la primera de galería
  ahoraUri: string | null;
  miniatura: string | null;
};

let cache: HitoRA[] | null = null;

function aLugar(hito: HitoRA, desde: Coordenada): LugarAR {
  const distancia = distanciaHaversine(desde, hito);
  const imagenes = hito.hito_imagenes ?? [];
  const galeria = imagenes
    .filter((i) => i.tipo === "galeria")
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const antes = (imagenes.find((i) => i.tipo === "antes") as FotoRA) ?? null;
  const despues = (imagenes.find((i) => i.tipo === "despues") as FotoRA) ?? null;
  const primeraGaleria = galeria[0]?.url ?? null;

  return {
    id: hito.id,
    nombre: hito.nombre,
    descripcionCorta: hito.descripcion_corta,
    distancia,
    rumbo: rumbo(desde, hito),
    radio: hito.ar_radio_metros,
    enRango: distancia <= hito.ar_radio_metros,
    estado: calcularEstado(hito.horarios_hito ?? [], hito.estado_manual),
    antes,
    despues,
    ahoraUri: despues?.url ?? primeraGaleria,
    miniatura: primeraGaleria ?? despues?.url ?? antes?.url ?? null,
  };
}

// Datos crudos: una consulta al abrir la pantalla, luego la caché
export function useHitosRA() {
  const [hitos, setHitos] = useState<HitoRA[] | null>(cache);
  const [cargando, setCargando] = useState(cache === null);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    setCargando(true);
    try {
      cache = await cargarHitosParaCamara(INCLUIR_OCULTOS);
      setHitos(cache);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (cache === null) refrescar();
  }, [refrescar]);

  return { hitos: hitos ?? [], cargando, error, refrescar };
}

// Distancia, rumbo y rango de cada hito desde la ubicación del usuario
export function useArPlaces(hitos: HitoRA[], ubicacion: Coordenada | null) {
  const lat = ubicacion?.lat;
  const lng = ubicacion?.lng;

  // Todos los lugares ordenados por distancia
  const lugares = useMemo(() => {
    if (lat === undefined || lng === undefined) return [];
    const desde = { lat, lng };
    return hitos.map((h) => aLugar(h, desde)).sort((a, b) => a.distancia - b.distancia);
  }, [hitos, lat, lng]);

  const candidatos = useMemo(() => lugares.filter((l) => l.enRango), [lugares]);
  const masCercanoFuera = useMemo(() => lugares.find((l) => !l.enRango) ?? null, [lugares]);

  return { lugares, candidatos, masCercanoFuera };
}
