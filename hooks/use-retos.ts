import { supabase } from "@/lib/supabase";

// ---------- Tipos ----------

export type CriterioReto =
  | { tipo: "categorias_distintas" }
  | { tipo: "visitas_totales"; cantidad: number }
  | { tipo: "quiz_perfecto" };

export interface Reto {
  id: number;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  criterio: CriterioReto;
  recompensa_puntos: number;
  recompensa_insignia_id: number | null;
}

export interface ProgresoReto {
  reto_id: number;
  progreso_actual: number;
  progreso_total: number;
  completado: boolean;
}

export interface RetoConProgreso extends Reto {
  progreso_actual: number;
  progreso_total: number;
  completado: boolean;
}

// Se usa en el Paso 4 para saber qué recompensa otorgar por cada reto
// que se acaba de completar.
export interface RetoRecienCompletado extends Reto {
  esNuevo: true;
}

// ---------- Cálculo de progreso por tipo de criterio ----------

async function calcularProgreso(
  usuarioId: string,
  criterio: CriterioReto
): Promise<{ actual: number; total: number }> {
  switch (criterio.tipo) {
    // Explorador Total: cuántas categorías DISTINTAS ha visitado,
    // sobre el total de categorías que existen.
    case "categorias_distintas": {
      const { count: totalCategorias, error: errCategorias } = await supabase
        .from("categorias")
        .select("*", { count: "exact", head: true });
      if (errCategorias) throw errCategorias;

      const { data: visitas, error: errVisitas } = await supabase
        .from("interacciones_usuario")
        .select("hitos!inner(categoria_id)")
        .eq("usuario_id", usuarioId)
        .eq("tipo_interaccion", "visita");
      if (errVisitas) throw errVisitas;

      const categoriasDistintas = new Set(
        (visitas ?? []).map((v: any) => v.hitos?.categoria_id).filter(Boolean)
      );

      return { actual: categoriasDistintas.size, total: totalCategorias ?? 0 };
    }

    // Maratón Cultural: cuántos hitos DISTINTOS ha visitado
    // (no cuenta visitas repetidas al mismo hito).
    case "visitas_totales": {
      const { data: visitas, error } = await supabase
        .from("interacciones_usuario")
        .select("hito_id")
        .eq("usuario_id", usuarioId)
        .eq("tipo_interaccion", "visita");
      if (error) throw error;

      const hitosDistintos = new Set((visitas ?? []).map((v) => v.hito_id));

      return {
        actual: Math.min(hitosDistintos.size, criterio.cantidad),
        total: criterio.cantidad,
      };
    }

    // Perfeccionista: ¿ya sacó 100% en algún quiz? (progreso binario 0/1)
    case "quiz_perfecto": {
      const { data: resultados, error } = await supabase
        .from("quiz_resultados")
        .select("aciertos, total_preguntas")
        .eq("usuario_id", usuarioId);
      if (error) throw error;

      const yaLoLogro = (resultados ?? []).some(
        (r) => r.total_preguntas > 0 && r.aciertos === r.total_preguntas
      );

      return { actual: yaLoLogro ? 1 : 0, total: 1 };
    }

    default:
      return { actual: 0, total: 1 };
  }
}

// ---------- Revisar y actualizar progreso de TODOS los retos ----------

// Llamar después de: visitar un hito, o terminar un quiz.
// Guarda el progreso actualizado en usuario_retos y devuelve los retos
// que se acaban de completar en esta revisión (para otorgar recompensa
// en el Paso 4).
export async function verificarYActualizarRetos(
  usuarioId: string
): Promise<RetoRecienCompletado[]> {
  const { data: retos, error: errRetos } = await supabase
    .from("retos")
    .select(
      "id, nombre, descripcion, icono, criterio, recompensa_puntos, recompensa_insignia_id"
    );
  if (errRetos) throw errRetos;

  const { data: progresoExistente, error: errProgreso } = await supabase
    .from("usuario_retos")
    .select("reto_id, completado")
    .eq("usuario_id", usuarioId);
  if (errProgreso) throw errProgreso;

  const mapaCompletados = new Map(
    (progresoExistente ?? []).map((p) => [p.reto_id, p.completado])
  );

  const recienCompletados: RetoRecienCompletado[] = [];

  for (const reto of (retos ?? []) as Reto[]) {
    const { actual, total } = await calcularProgreso(
      usuarioId,
      reto.criterio
    );
    const completado = total > 0 && actual >= total;
    const yaEstabaCompletado = mapaCompletados.get(reto.id) === true;

    const { error: errUpsert } = await supabase.from("usuario_retos").upsert(
      {
        usuario_id: usuarioId,
        reto_id: reto.id,
        progreso_actual: actual,
        progreso_total: total,
        completado,
        completado_en: completado && !yaEstabaCompletado ? new Date().toISOString() : undefined,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "usuario_id,reto_id" }
    );
    if (errUpsert) throw errUpsert;

    if (completado && !yaEstabaCompletado) {
      recienCompletados.push({ ...reto, esNuevo: true });
    }
  }

  return recienCompletados;
}

// ---------- Obtener retos con el progreso del usuario (para la UI) ----------

export async function obtenerRetosConProgreso(
  usuarioId: string
): Promise<RetoConProgreso[]> {
  const { data: retos, error: errRetos } = await supabase
    .from("retos")
    .select(
      "id, nombre, descripcion, icono, criterio, recompensa_puntos, recompensa_insignia_id"
    )
    .order("id", { ascending: true });
  if (errRetos) throw errRetos;

  const { data: progreso, error: errProgreso } = await supabase
    .from("usuario_retos")
    .select("reto_id, progreso_actual, progreso_total, completado")
    .eq("usuario_id", usuarioId);
  if (errProgreso) throw errProgreso;

  const mapaProgreso = new Map(
    (progreso ?? []).map((p) => [p.reto_id, p])
  );

  return (retos ?? []).map((reto) => {
    const p = mapaProgreso.get(reto.id);
    return {
      ...reto,
      progreso_actual: p?.progreso_actual ?? 0,
      progreso_total:
        p?.progreso_total ??
        (reto.criterio.tipo === "visitas_totales" ? reto.criterio.cantidad : 1),
      completado: p?.completado ?? false,
    };
  });
}

// ---------- Otorgar recompensa (Paso 4) ----------

// Mismos umbrales que usa quiz.tsx en calcularNivel, para no desincronizarnos.
function calcularNivel(puntos: number): number {
  if (puntos >= 500) return 5;
  if (puntos >= 300) return 4;
  if (puntos >= 150) return 3;
  if (puntos >= 50) return 2;
  return 1;
}

async function otorgarRecompensasRetos(
  usuarioId: string,
  retosCompletados: RetoRecienCompletado[]
): Promise<void> {
  if (retosCompletados.length === 0) return;

  const totalPuntosNuevos = retosCompletados.reduce(
    (suma, reto) => suma + (reto.recompensa_puntos ?? 0),
    0
  );

  // 1. Sumar los puntos a progreso_usuario (lee el valor actual y suma encima).
  if (totalPuntosNuevos > 0) {
    const { data: progresoActual, error: errLeer } = await supabase
      .from("progreso_usuario")
      .select("puntos")
      .eq("usuario_id", usuarioId)
      .maybeSingle();
    if (errLeer) throw errLeer;

    const puntosNuevosTotal = (progresoActual?.puntos ?? 0) + totalPuntosNuevos;

    const { error: errUpsert } = await supabase.from("progreso_usuario").upsert({
      usuario_id: usuarioId,
      puntos: puntosNuevosTotal,
      nivel: calcularNivel(puntosNuevosTotal),
      actualizado_en: new Date().toISOString(),
    });
    if (errUpsert) throw errUpsert;
  }

  // 2. Otorgar la insignia asociada (si el reto tiene una).
  for (const reto of retosCompletados) {
    if (!reto.recompensa_insignia_id) continue;

    const { error: errInsignia } = await supabase.from("usuario_insignias").insert({
      usuario_id: usuarioId,
      insignia_id: reto.recompensa_insignia_id,
    });
    // Si ya la tenía (condición de carrera), lo ignoramos silenciosamente.
    if (errInsignia && errInsignia.code !== "23505") {
      throw errInsignia;
    }
  }
}

// ---------- Función combinada: revisar + otorgar (usar esta desde las pantallas) ----------

export async function revisarYCompletarRetos(
  usuarioId: string
): Promise<RetoRecienCompletado[]> {
  const recienCompletados = await verificarYActualizarRetos(usuarioId);
  await otorgarRecompensasRetos(usuarioId, recienCompletados);
  return recienCompletados;
}