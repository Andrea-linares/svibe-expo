import { supabase } from "@/lib/supabase";
import {
  createContext,
  Dispatch,
  MutableRefObject,
  ReactNode,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

/* ---------------------------------------------------------------------------
 * Estado global de favoritos
 * Guarda los ids de los hitos favoritos del usuario con sesión para que el
 * corazón, el botón del detalle y la pantalla de Favoritos estén sincronizados.
 * La lógica de guardar/quitar está en hooks/use-favoritos.ts.
 * ------------------------------------------------------------------------- */

export type FavoritosContextType = {
  usuarioId: string | null;
  ids: Set<string>;
  setIds: Dispatch<SetStateAction<Set<string>>>;
  // true mientras se determina la sesión y se cargan los ids
  cargando: boolean;
  // hitos con una operación en curso (evita dobles toques)
  enCurso: MutableRefObject<Set<string>>;
};

export const FavoritosContext = createContext<FavoritosContextType | undefined>(
  undefined,
);

export function FavoritosProvider({ children }: { children: ReactNode }) {
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [sesionLista, setSesionLista] = useState(false);
  const [ids, setIds] = useState<Set<string>>(new Set());
  // Usuario al que pertenecen los ids cargados
  const [idsDeUsuario, setIdsDeUsuario] = useState<string | null>(null);
  const enCurso = useRef<Set<string>>(new Set());

  // Escucha la sesión (incluye la sesión inicial, login y logout)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      const id = sesion?.user?.id ?? null;
      setUsuarioId(id);
      setSesionLista(true);
      if (!id) {
        setIds(new Set());
        setIdsDeUsuario(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Carga los favoritos cada vez que cambia el usuario
  useEffect(() => {
    if (!usuarioId) return;

    let cancelado = false;

    supabase
      .from("favoritos")
      .select("hito_id")
      .eq("usuario_id", usuarioId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          console.error("Error cargando favoritos:", error);
        } else {
          setIds(new Set((data ?? []).map((f) => f.hito_id as string)));
        }
        setIdsDeUsuario(usuarioId);
      });

    return () => {
      cancelado = true;
    };
  }, [usuarioId]);

  return (
    <FavoritosContext.Provider
      value={{
        usuarioId,
        ids,
        setIds,
        cargando: !sesionLista || (usuarioId !== null && idsDeUsuario !== usuarioId),
        enCurso,
      }}
    >
      {children}
    </FavoritosContext.Provider>
  );
}
