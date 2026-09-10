/*
  ═══════════════════════════════════════════════════════════════
  LOS OCHO COLORES DE ÁMBITO
  ═══════════════════════════════════════════════════════════════

  Identifican de qué es algo. Nunca reclaman: eso es trabajo de los
  colores de estado, que son los únicos vivos de la paleta.

  ─────────────────────────────────────────────────────────────
  POR QUÉ VIVEN AQUÍ Y NO EN `piezas.tsx`

  Estaban allí, que es donde se usan. Pero `iconos.tsx` también los
  necesita —`pintaDe()` devuelve el ámbito de una tarea— y `piezas`
  importa de `iconos`. Dejarlos en piezas obligaba a que iconos
  importara de piezas: un círculo.

  Así que la paleta baja a `lib`, que no depende de nada. `piezas`
  los vuelve a exportar para que ninguna pantalla tenga que cambiar de
  sitio de dónde los pide.
*/
export const AMBITO = {
  azul: '#6B93D6',
  violeta: '#9482D9',
  ciruela: '#A87BB5',
  rosa: '#D07E97',
  arena: '#C09A62',
  oliva: '#9AA85E',
  verde: '#6FA88A',
  pizarra: '#7A8899',
} as const

export type Ambito = keyof typeof AMBITO

/**
 * Del hexadecimal al nombre del ámbito.
 *
 * Hace falta porque el color de una PERSONA se guarda en la base de
 * datos como hexadecimal —tiene que poder cambiarlo ella— mientras
 * que las piezas hablan por nombre. Lo que no esté en la paleta cae
 * en pizarra: no se inventa un color a partir de uno desconocido.
 */
export function ambitoDeColor(hex: string | null | undefined): Ambito {
  const buscado = (hex ?? '').trim().toUpperCase()
  for (const [nombre, valor] of Object.entries(AMBITO)) {
    if (valor.toUpperCase() === buscado) return nombre as Ambito
  }
  return 'pizarra'
}
