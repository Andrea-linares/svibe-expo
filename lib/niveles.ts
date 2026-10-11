// Tabla de niveles de exploración (compartida por Niveles y Perfil).
// El nivel y los puntos del usuario se guardan en la tabla progreso_usuario.

export type NivelInfo = {
  nivel: number;
  nombre: string;
  minimo: number;
  maximo: number | null;
  beneficio: string;
  icono: string;
};

export const NIVELES: NivelInfo[] = [
  {
    nivel: 1,
    nombre: "Explorador",
    minimo: 0,
    maximo: 49,
    beneficio:
      "Acceso al perfil de explorador y seguimiento de tus puntos.",
    icono: "🧭",
  },
  {
    nivel: 2,
    nombre: "Viajero",
    minimo: 50,
    maximo: 149,
    beneficio:
      "Desbloqueas nuevas insignias y mejoras tu progreso de exploración.",
    icono: "🥾",
  },
  {
    nivel: 3,
    nombre: "Conocedor",
    minimo: 150,
    maximo: 299,
    beneficio:
      "Obtienes reconocimiento por conocer más lugares y completar retos.",
    icono: "🏛️",
  },
  {
    nivel: 4,
    nombre: "Experto cultural",
    minimo: 300,
    maximo: 499,
    beneficio:
      "Acceso al reconocimiento de experto y mayores logros culturales.",
    icono: "🏆",
  },
  {
    nivel: 5,
    nombre: "Maestro explorador",
    minimo: 500,
    maximo: null,
    beneficio:
      "Has alcanzado el máximo nivel de exploración cultural.",
    icono: "👑",
  },
];
