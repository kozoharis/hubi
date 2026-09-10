import { headers } from 'next/headers'
import { conElEspacio } from './enlaces-comunes'

/*
  ═══════════════════════════════════════════════════════════════
  LA MISMA REGLA, DESDE EL SERVIDOR
  ═══════════════════════════════════════════════════════════════

  Los enlaces se arreglan solos: pasan por `app/enlace.tsx`, que sabe
  la ruta. Pero una redirección del servidor no es un enlace — no la
  pulsa nadie, la decide la pantalla antes de pintarse:

      if (!elOtro) redirect('/')

  Ésa hay que decírsela. Son tres en toda la aplicación; las otras
  cuarenta van a `/entrar` o a `/empezar`, que están fuera de los
  espacios y se quedan como están.

  El espacio sale de la cabecera que puso `proxy.ts` a partir de la
  dirección — la misma de la que bebe `elEspacio()`.
*/

/** Ese camino, dentro del espacio en el que estamos. */
export async function aqui(camino: string): Promise<string> {
  return conElEspacio((await headers()).get('x-espacio'), camino)
}
