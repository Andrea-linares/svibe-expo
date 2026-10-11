import { FavoritosContext } from "@/contexts/FavoritosContext";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useCallback, useContext } from "react";
import { Alert } from "react-native";

export type ResultadoFavorito = "agregado" | "quitado" | null;

// Código de Postgres para clave duplicada: el favorito ya existía
const CODIGO_DUPLICADO = "23505";

/* ---------------------------------------------------------------------------
 * useFavoritos
 * - esFavorito(id): si el hito está en favoritos.
 * - alternarFavorito(id): guarda o quita con actualización optimista; si la
 *   operación falla, revierte el cambio y muestra un aviso.
 *   Devuelve "agregado", "quitado" o null (sin sesión, en curso o error).
 * ------------------------------------------------------------------------- */
export function useFavoritos() {
  const contexto = useContext(FavoritosContext);
  if (!contexto) {
    throw new Error("useFavoritos debe usarse dentro de un FavoritosProvider");
  }

  const { usuarioId, ids, setIds, cargando, enCurso } = contexto;

  const esFavorito = useCallback((hitoId: string) => ids.has(hitoId), [ids]);

  const alternarFavorito = useCallback(
    async (hitoId: string): Promise<ResultadoFavorito> => {
      if (!usuarioId) {
        Alert.alert("Inicia sesión", "Necesitas una cuenta para guardar favoritos.", [
          { text: "Ahora no", style: "cancel" },
          { text: "Iniciar sesión", onPress: () => router.push("/login") },
        ]);
        return null;
      }

      // Ignora toques repetidos mientras la operación anterior sigue en curso
      if (enCurso.current.has(hitoId)) return null;
      enCurso.current.add(hitoId);

      const eraFavorito = ids.has(hitoId);

      function aplicar(agregar: boolean) {
        setIds((actual) => {
          const nuevo = new Set(actual);
          if (agregar) nuevo.add(hitoId);
          else nuevo.delete(hitoId);
          return nuevo;
        });
      }

      // Actualización optimista
      aplicar(!eraFavorito);

      try {
        if (eraFavorito) {
          const { error } = await supabase
            .from("favoritos")
            .delete()
            .eq("usuario_id", usuarioId)
            .eq("hito_id", hitoId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("favoritos")
            .insert({ usuario_id: usuarioId, hito_id: hitoId });
          if (error && error.code !== CODIGO_DUPLICADO) throw error;
        }
        return eraFavorito ? "quitado" : "agregado";
      } catch (error) {
        console.error("Error actualizando favorito:", error);
        // Reversión
        aplicar(eraFavorito);
        Alert.alert(
          "No se pudo actualizar tus favoritos",
          "Revisa tu conexión e inténtalo de nuevo.",
        );
        return null;
      } finally {
        enCurso.current.delete(hitoId);
      }
    },
    [usuarioId, ids, setIds, enCurso],
  );

  return { usuarioId, ids, cargando, esFavorito, alternarFavorito };
}
