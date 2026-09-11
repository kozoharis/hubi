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

/**
 * Si esta pantalla se ha pedido SIN espacio en la dirección, dice a
 * cuál habría que mandarla. Si ya lo lleva, dice `null`.
 *
 * ─────────────────────────────────────────────────────────────
 * POR QUÉ HACE FALTA
 *
 * A la casa propia no se entra nunca por la puerta: al abrir HUBI se
 * aterriza en `/` a secas y `casa_activa` decide cuál se enseña. Sin
 * espacio en la barra no hay espacio que conservar, así que los
 * enlaces siguen sin él y esa pestaña vuelve a obedecer al dato
 * global — el que la otra pestaña acaba de cambiar.
 *
 * O sea: el espacio mandaba en las casas en las que entrabas a
 * propósito, y no mandaba en la tuya.
 *
 * Con esto, `casa_activa` se usa UNA VEZ —para decidir dónde
 * aterrizas— y a partir de ahí no vuelve a mandar en nada.
 */
export async function laPuertaQueFalta(espacio: string | null): Promise<string | null> {
  if (!espacio) return null
  if ((await headers()).get('x-espacio')) return null
  return `/e/${espacio}`
}
