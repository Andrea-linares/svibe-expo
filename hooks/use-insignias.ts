import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

// ---------- Tipos ----------

export type CriterioInsignia =
  | { tipo: "visitas_totales"; cantidad: number }
  | { tipo: "visitas_categoria"; categoria_id: number; cantidad: number }
  | { tipo: "quiz_completado" }
  | { tipo: "otorgada_por_reto" };

export interface Insignia {
  id: number;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  criterio: CriterioInsignia | null;
}

export interface InsigniaConEstado extends Insignia {
  desbloqueada: boolean;
  obtenida_en: string | null;
  requisito: string;
}

// ---------- Funciones de datos (Supabase) ----------

// Convierte el criterio JSON en un texto legible para el usuario,
// para que sepa exactamente qué debe hacer para desbloquear la insignia.
function describirCriterio(criterio: CriterioInsignia | null): string {
  if (!criterio) return "Requisito no definido";

  switch (criterio.tipo) {
    case "visitas_totales":
      return criterio.cantidad === 1
        ? "Visita 1 hito"
        : `Visita ${criterio.cantidad} hitos`;
    case "visitas_categoria":
      return `Visita ${criterio.cantidad} hitos de categoría histórica`;
    case "quiz_completado":
      return "Completa el quiz cultural";
    case "otorgada_por_reto":
      return "Se obtiene al completar un reto";
    default:
      return "Requisito no definido";
  }
}


async function obtenerInsigniasConEstado(usuarioId: string): Promise<InsigniaConEstado[]> {
  const { data: insignias, error: errInsignias } = await supabase
    .from("insignias")
    .select("id, nombre, descripcion, icono, criterio")
    .order("id", { ascending: true });

  if (errInsignias) throw errInsignias;

  const { data: obtenidas, error: errObtenidas } = await supabase
    .from("usuario_insignias")
    .select("insignia_id, obtenida_en")
    .eq("usuario_id", usuarioId);

  if (errObtenidas) throw errObtenidas;

  const mapaObtenidas = new Map((obtenidas ?? []).map((o) => [o.insignia_id, o.obtenida_en]));

  return (insignias ?? []).map((insignia) => ({
    ...insignia,
    desbloqueada: mapaObtenidas.has(insignia.id),
    obtenida_en: mapaObtenidas.get(insignia.id) ?? null,
    requisito: describirCriterio(insignia.criterio as CriterioInsignia),
  }));
}

async function cumpleCriterio(
  usuarioId: string,
  criterio: CriterioInsignia | null
): Promise<boolean> {
  if (!criterio) return false;

  switch (criterio.tipo) {
    // OJO: tu app usa "visita", no "visitado" (confirmado en perfil.tsx).
    case "visitas_totales": {
      const { count, error } = await supabase
        .from("interacciones_usuario")
        .select("*", { count: "exact", head: true })
        .eq("usuario_id", usuarioId)
        .eq("tipo_interaccion", "visita");
      if (error) throw error;
      return (count ?? 0) >= criterio.cantidad;
    }

    case "visitas_categoria": {
      const { count, error } = await supabase
        .from("interacciones_usuario")
        .select("hito_id, hitos!inner(categoria_id)", { count: "exact", head: true })
        .eq("usuario_id", usuarioId)
        .eq("tipo_interaccion", "visita")
        .eq("hitos.categoria_id", criterio.categoria_id);
      if (error) throw error;
      return (count ?? 0) >= criterio.cantidad;
    }

    case "quiz_completado": {
      const { count, error } = await supabase
        .from("quiz_resultados")
        .select("*", { count: "exact", head: true })
        .eq("usuario_id", usuarioId);
      if (error) throw error;
      return (count ?? 0) >= 1;
    }

    default:
      return false;
  }
}

export async function verificarYDesbloquearInsignias(usuarioId: string): Promise<Insignia[]> {
  const [{ data: insignias, error: errInsignias }, { data: yaObtenidas, error: errObtenidas }] =
    await Promise.all([
      supabase.from("insignias").select("id, nombre, descripcion, icono, criterio"),
      supabase.from("usuario_insignias").select("insignia_id").eq("usuario_id", usuarioId),
    ]);

  if (errInsignias) throw errInsignias;
  if (errObtenidas) throw errObtenidas;

  const idsObtenidas = new Set((yaObtenidas ?? []).map((r) => r.insignia_id));
  const pendientes = (insignias ?? []).filter((i) => !idsObtenidas.has(i.id));

  const recienDesbloqueadas: Insignia[] = [];

  for (const insignia of pendientes) {
    const cumple = await cumpleCriterio(usuarioId, insignia.criterio as CriterioInsignia);
    if (cumple) {
      const { error: errInsert } = await supabase
        .from("usuario_insignias")
        .insert({ usuario_id: usuarioId, insignia_id: insignia.id });

      if (!errInsert) {
        recienDesbloqueadas.push(insignia as Insignia);
      }
    }
  }

  return recienDesbloqueadas;
}

// ---------- El hook ----------

interface UseInsigniasResult {
  insignias: InsigniaConEstado[];
  cargando: boolean;
  error: string | null;
  usuarioId: string | null;
  recargar: () => Promise<void>;
  revisarDesbloqueos: () => Promise<Insignia[]>;
}

export function useInsignias(): UseInsigniasResult {
  const [insignias, setInsignias] = useState<InsigniaConEstado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  const cargarInsignias = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { data: sesion } = await supabase.auth.getUser();

      if (!sesion?.user) {
        setUsuarioId(null);
        setInsignias([]);
        setCargando(false);
        return;
      }

      const userId = sesion.user.id;
      setUsuarioId(userId);

      const datos = await obtenerInsigniasConEstado(userId);
      setInsignias(datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar insignias");
    } finally {
      setCargando(false);
    }
  }, []);

  // Revisa si el usuario cumple nuevos criterios y los desbloquea.
  // Llámala desde otras pantallas después de:
  //   insert en interacciones_usuario (visitar un hito)
  //   insert en quiz_resultados (terminar el quiz)
  const revisarDesbloqueos = useCallback(async (): Promise<Insignia[]> => {
    const { data: sesion } = await supabase.auth.getUser();
    if (!sesion?.user) return [];

    const nuevas = await verificarYDesbloquearInsignias(sesion.user.id);
    if (nuevas.length > 0) {
      await cargarInsignias();
    }
    return nuevas;
  }, [cargarInsignias]);

  useFocusEffect(
    useCallback(() => {
      cargarInsignias();
    }, [cargarInsignias])
  );

  return { insignias, cargando, error, usuarioId, recargar: cargarInsignias, revisarDesbloqueos };
}