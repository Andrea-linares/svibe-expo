/* ---------------------------------------------------------------------------
 * Utilidades geográficas de la realidad aumentada
 * Funciones puras (sin imports) para poder probarlas con `node --test`.
 * Las que llevan la directiva "worklet" también se usan en el hilo de UI
 * desde reanimated (useAnimatedStyle); fuera de reanimated es solo un string.
 * Ángulos en grados: 0 = norte, 90 = este, sentido horario.
 * ------------------------------------------------------------------------- */

export type Coordenada = { lat: number; lng: number };

const RADIO_TIERRA_M = 6371000;

const aRad = (grados: number) => (grados * Math.PI) / 180;
const aGrados = (rad: number) => (rad * 180) / Math.PI;

// Distancia en metros sobre la superficie terrestre (fórmula de Haversine)
export function distanciaHaversine(a: Coordenada, b: Coordenada): number {
  const dLat = aRad(b.lat - a.lat);
  const dLng = aRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRad(a.lat)) * Math.cos(aRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Rumbo inicial (bearing) de "desde" hacia "hasta", en 0..360
export function rumbo(desde: Coordenada, hasta: Coordenada): number {
  const lat1 = aRad(desde.lat);
  const lat2 = aRad(hasta.lat);
  const dLng = aRad(hasta.lng - desde.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normalizarAngulo(aGrados(Math.atan2(y, x)));
}

// Lleva cualquier ángulo al rango 0..360
export function normalizarAngulo(grados: number): number {
  "worklet";
  const resto = grados % 360;
  return resto < 0 ? resto + 360 : resto;
}

// Diferencia más corta de "desde" a "hasta", en -180..180
// (positivo = "hasta" queda a la derecha)
export function diferenciaAngular(desde: number, hasta: number): number {
  "worklet";
  const d = normalizarAngulo(hasta - desde);
  return d > 180 ? d - 360 : d;
}

// Filtro exponencial para ángulos: avanza "factor" (0..1) de la diferencia
// más corta, así 359° → 1° pasa por 0° y no da la vuelta por 180°.
export function suavizarAngulo(anterior: number, nuevo: number, factor: number): number {
  "worklet";
  return normalizarAngulo(anterior + diferenciaAngular(anterior, nuevo) * factor);
}

const PUNTOS_CARDINALES = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

// 45 → "NE 45°"
export function puntoCardinal(grados: number): string {
  const redondeado = Math.round(normalizarAngulo(grados)) % 360;
  const indice = Math.round(redondeado / 45) % 8;
  return `${PUNTOS_CARDINALES[indice]} ${redondeado}°`;
}

// Punto a "metros" de distancia en la dirección "direccion" (grados)
export function desplazarCoordenada(
  origen: Coordenada,
  metros: number,
  direccion: number,
): Coordenada {
  const d = metros / RADIO_TIERRA_M;
  const theta = aRad(direccion);
  const lat1 = aRad(origen.lat);
  const lng1 = aRad(origen.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(theta),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: aGrados(lat2), lng: aGrados(lng2) };
}

export type Vector3 = { x: number; y: number; z: number };

// Rumbo hacia donde apunta la cámara trasera, a partir de la gravedad
// (acelerómetro) y el campo magnético (magnetómetro), ambos en ejes del
// teléfono. Mismo cálculo que SensorManager.getRotationMatrix de Android:
// H = este, M = norte, A = arriba. Con el teléfono vertical se usa el eje -Z
// (la cámara); si está casi plano, ese eje apunta al suelo y se usa el borde
// superior (+Y). Devuelve null si las lecturas no sirven.
export function rumboCamara(gravedad: Vector3, campo: Vector3): number | null {
  const ga = Math.hypot(gravedad.x, gravedad.y, gravedad.z);
  if (ga < 0.1) return null;
  const A = { x: gravedad.x / ga, y: gravedad.y / ga, z: gravedad.z / ga };

  let H = {
    x: campo.y * A.z - campo.z * A.y,
    y: campo.z * A.x - campo.x * A.z,
    z: campo.x * A.y - campo.y * A.x,
  };
  const ha = Math.hypot(H.x, H.y, H.z);
  if (ha < 0.1) return null;
  H = { x: H.x / ha, y: H.y / ha, z: H.z / ha };

  const M = {
    x: A.y * H.z - A.z * H.y,
    y: A.z * H.x - A.x * H.z,
    z: A.x * H.y - A.y * H.x,
  };

  // Componente horizontal del eje de la cámara (-Z)
  if (Math.hypot(H.z, M.z) > 0.35) {
    return normalizarAngulo(aGrados(Math.atan2(-H.z, -M.z)));
  }
  return normalizarAngulo(aGrados(Math.atan2(H.y, M.y)));
}

// "150 m" o "1.2 km"
export function formatearDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1)} km`;
}
