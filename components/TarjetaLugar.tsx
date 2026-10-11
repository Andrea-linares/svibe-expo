import { useTema } from "@/contexts/ThemeContext";
import { router } from "expo-router";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/* ---------------------------------------------------------------------------
 * Tarjeta de lugar de ancho completo (Inicio: "Lugares imprescindibles";
 * Oculto: "Lugares ocultos"). Al tocarla abre el detalle del hito.
 * Borde de 1 px y sin elevation: en Android, elevation + borderRadius deja
 * líneas grises en las esquinas.
 * ------------------------------------------------------------------------- */

export type LugarTarjeta = {
  id: string;
  nombre: string;
  direccion_referencia: string | null;
  // Opcional: las pantallas que no consultan el precio no lo muestran
  precio?: number | null;
  hito_imagenes: { url: string; orden: number }[] | null;
};

// Imagen principal del lugar (la de menor orden) o el placeholder
export function obtenerImagenPrincipal(hito: Pick<LugarTarjeta, "hito_imagenes">) {
  if (hito.hito_imagenes && hito.hito_imagenes.length > 0) {
    const ordenadas = [...hito.hito_imagenes].sort((a, b) => a.orden - b.orden);

    return {
      uri: ordenadas[0].url,
    };
  }

  return require("@/assets/images/partial-react-logo.png");
}

// null si el lugar no tiene precio (o no se consultó); "Gratis" si es 0
function textoPrecio(precio: number | null | undefined) {
  if (precio === null || precio === undefined) return null;
  return precio > 0 ? `Desde $${precio.toFixed(2)}` : "Gratis";
}

export default function TarjetaLugar({ hito }: Readonly<{ hito: LugarTarjeta }>) {
  const { colores } = useTema();
  const precio = textoPrecio(hito.precio);

  return (
    <TouchableOpacity
      style={[
        styles.cardLugar,
        { backgroundColor: colores.tarjeta, borderColor: colores.borde },
      ]}
      activeOpacity={0.85}
      onPress={() => router.push(`/hito/${hito.id}`)}
    >
      <Image
        source={obtenerImagenPrincipal(hito)}
        style={styles.imagenLugar}
        resizeMode="cover"
      />

      <View style={styles.infoLugar}>
        <Text
          style={[styles.nombreLugar, { color: colores.texto }]}
          numberOfLines={1}
        >
          {hito.nombre}
        </Text>

        {hito.direccion_referencia && (
          <Text
            style={[styles.ubicacionLugar, { color: colores.textoSecundario }]}
            numberOfLines={1}
          >
            📍 {hito.direccion_referencia}
          </Text>
        )}

        {precio && <Text style={styles.precioLugar}>{precio}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardLugar: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },

  imagenLugar: {
    width: "100%",
    height: 180,
  },

  infoLugar: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  nombreLugar: {
    fontSize: 19,
    fontWeight: "700",
  },

  ubicacionLugar: {
    fontSize: 15,
    marginTop: 4,
  },

  precioLugar: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2196F3",
    marginTop: 6,
  },
});
