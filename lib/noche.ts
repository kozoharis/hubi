/*
  ═══════════════════════════════════════════════════════════════
  DE NOCHE · una sola hora, y en un solo sitio
  ═══════════════════════════════════════════════════════════════

  Tres trozos de la pared necesitan saber si es de noche y cada uno lo
  calculaba por su cuenta:

      reloj.tsx     bajaba el brillo
      fotos.tsx     paraba el carrusel
      descanso.tsx  apagaba las fotos del descanso

  Tres copias de `h >= 23 || h < 7`, con un comentario en cada una
  avisando de que las otras dos tienen que decir lo mismo. Un aviso
  escrito tres veces es una regla que todavía no está en ningún sitio.
*/

/** A partir de esta hora, la casa está acostada. */
export const EMPIEZA = 23

/** Y a partir de ésta, otra vez en pie. */
export const ACABA = 7

export function esDeNoche(cuando: Date = new Date()): boolean {
  const h = cuando.getHours()
  return h >= EMPIEZA || h < ACABA
}
