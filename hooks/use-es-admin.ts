import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export type EstadoAdmin = "cargando" | "admin" | "no_admin";

// Indica si el usuario actual es administrador.
// Usa el mismo criterio que el resto de la app: perfiles.rol === "administrador".
// La protección real de los datos la hace la RLS con es_admin().
export function useEsAdmin(): EstadoAdmin {
  const [estado, setEstado] = useState<EstadoAdmin>("cargando");

  useEffect(() => {
    let cancelado = false;

    async function verificar() {
      try {
        const { data: sesion } = await supabase.auth.getUser();
        if (!sesion?.user) {
          if (!cancelado) setEstado("no_admin");
          return;
        }
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", sesion.user.id)
          .maybeSingle();
        if (!cancelado) {
          setEstado(perfil?.rol === "administrador" ? "admin" : "no_admin");
        }
      } catch (error) {
        console.error("Error verificando rol de administrador:", error);
        if (!cancelado) setEstado("no_admin");
      }
    }

    verificar();
    return () => {
      cancelado = true;
    };
  }, []);

  return estado;
}
