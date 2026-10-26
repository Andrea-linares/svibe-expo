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
    acento: "#3B6FA0",
    peligro: "#D32F2F",
    // Realidad aumentada (verde azulado), en la zona de usuario y en el panel
    acentoRA: "#0E8C80",
    // Panel de administración
    panelFondo: "#F4F7FB",
    panelTarjeta: "#FFFFFF",
    panelBorde: "#E3E8F0",
    panelTexto: "#0F1B33",
    panelTextoSecundario: "#6B7486",
    panelIconoNeutro: "#EEF1F6",
    panelIlustracion: "#9DB8DE",
    panelIlustracionOpacidad: 0.14,
    panelBarra: "#FFFFFF",
    panelTabInactivo: "#8A93A3",
    panelSombra: "#1B2A4A",
    panelSombraOpacidad: 0.08,
    // Acentos: iguales en ambos modos
    panelAzul: "#2F7FEA",
    panelAzulDegradado: "#1D5FC4",
    panelDorado: "#D4A72C",
    panelRosa: "#E0566F",
    panelMorado: "#7C5CE0",
  },
  oscuro: {
    fondo: "#121212",
    tarjeta: "#1E1E1E",
    texto: "#F0F0F0",
    textoSecundario: "#AAAAAA",
    encabezado: "#1A1A1A",
    borde: "#333333",
    // Acento y peligro aclarados para mantener contraste sobre fondos oscuros
    acento: "#7FB0E0",
    peligro: "#FF6B6B",
    acentoRA: "#3CC4B4",
    // Panel de administración
    panelFondo: "#0B1220",
    panelTarjeta: "#121C30",
    panelBorde: "#1F2B44",
    panelTexto: "#FFFFFF",
    panelTextoSecundario: "#9AA6BD",
    panelIconoNeutro: "#2A3550",
    panelIlustracion: "#24395F",
    panelIlustracionOpacidad: 0.35,
    panelBarra: "#121C30",
    panelTabInactivo: "#6F7E99",
    panelSombra: "#000000",
    panelSombraOpacidad: 0,
    // Acentos: iguales en ambos modos
    panelAzul: "#2F7FEA",
    panelAzulDegradado: "#1D5FC4",
    panelDorado: "#D4A72C",
    panelRosa: "#E0566F",
    panelMorado: "#7C5CE0",
  },
};

// Espaciados y radios del panel de administración
export const ESPACIADO_PANEL = {
  margen: 20,
  separacion: 12,
  radioTarjeta: 16,
  radioBoton: 18,
  radioBarra: 24,
  alturaBarra: 66,
  margenBarra: 16,
  margenInferiorBarra: 12,
  grosorLinea: 4,
};

// Color del tema con transparencia: conAlfa(colores.tarjeta, 0.7)
// Sirve para paneles sobre la cámara sin inventar colores nuevos.
export function conAlfa(hex: string, alfa: number) {
  const canal = Math.round(Math.min(1, Math.max(0, alfa)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex.slice(0, 7)}${canal}`;
}

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
