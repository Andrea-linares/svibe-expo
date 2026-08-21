import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";

// Paletas de colores para cada modo
export const COLORES = {
  claro: {
    fondo: "#F5F5F5",
    tarjeta: "#FFFFFF",
    texto: "#1A1A1A",
    textoSecundario: "#666666",
    encabezado: "#FFFFFF",
    borde: "#E0E0E0",
  },
  oscuro: {
    fondo: "#121212",
    tarjeta: "#1E1E1E",
    texto: "#F0F0F0",
    textoSecundario: "#AAAAAA",
    encabezado: "#1A1A1A",
    borde: "#333333",
  },
};

type TemaContextType = {
  esOscuro: boolean;
  colores: typeof COLORES.claro;
  alternarTema: () => void;
};

const TemaContext = createContext<TemaContextType | undefined>(undefined);

const CLAVE_ALMACENAMIENTO = "tema_preferido";

export function TemaProvider({ children }: { children: ReactNode }) {
  const [esOscuro, setEsOscuro] = useState(false);

  // Carga la preferencia guardada al abrir la app
  useEffect(() => {
    AsyncStorage.getItem(CLAVE_ALMACENAMIENTO).then((valor) => {
      if (valor === "oscuro") setEsOscuro(true);
    });
  }, []);

  function alternarTema() {
    setEsOscuro((actual) => {
      const nuevo = !actual;
      AsyncStorage.setItem(CLAVE_ALMACENAMIENTO, nuevo ? "oscuro" : "claro");
      return nuevo;
    });
  }

  const colores = esOscuro ? COLORES.oscuro : COLORES.claro;

  return (
    <TemaContext.Provider value={{ esOscuro, colores, alternarTema }}>
      {children}
    </TemaContext.Provider>
  );
}

// Hook que usarás en cualquier pantalla: const { colores, esOscuro, alternarTema } = useTema();
export function useTema() {
  const contexto = useContext(TemaContext);
  if (!contexto) {
    throw new Error("useTema debe usarse dentro de un TemaProvider");
  }
  return contexto;
}
