/*
  ═══════════════════════════════════════════════════════════════
  LO QUE ESTÁ FUERA DE LOS ESPACIOS
  ═══════════════════════════════════════════════════════════════

  No todas las pantallas son de una casa. Éstas están por encima o por
  fuera, y ponerles el espacio delante sería mentir:

    · `/entrar` y `/empezar` — todavía no eres de ningún sitio.
    · `/escritorio` — es precisamente donde se ven TODOS los espacios.
      Meterlo dentro de uno sería guardar el llavero dentro de una de
      las casas.
    · `/privacidad` y `/terminos` — son de HUBI, no de nadie.
    · `/api/…` — de eso se encarga `api()`, que mira la barra de
      direcciones. Si además lo hiciera el enlazador, saldría dos veces.
*/
export const FUERA_DEL_ESPACIO = [
  '/entrar',
  '/empezar',
  '/escritorio',
  '/privacidad',
  '/terminos',
  '/api',
]

/** El espacio delante, salvo que el camino sea de los de arriba. */
export function conElEspacio(espacio: string | null, camino: string): string {
  if (!espacio) return camino
  if (!camino.startsWith('/')) return camino

  const limpio = camino.split('?')[0].split('#')[0]
  const fuera = FUERA_DEL_ESPACIO.some(
    (r) => limpio === r || limpio.startsWith(r + '/')
  )
  if (fuera) return camino

  /* Y si ya lo lleva, no se le pone otra vez. Pasa con los enlaces que
     se construyen a partir de la dirección actual. */
  if (limpio.startsWith(`/e/${espacio}`)) return camino

  return `/e/${espacio}${camino === '/' ? '' : camino}`
}
