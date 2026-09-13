/*
  ═══════════════════════════════════════════════════════════════
  QUÉ SE PUEDE ENSEÑAR DENTRO DE LA PARED, Y CÓMO
  ═══════════════════════════════════════════════════════════════

  La ventana de recetas enseña páginas de fuera dentro de una pantalla
  colgada en una cocina, a la que llega cualquiera que entre en la casa.
  Eso hay que mirarlo con cuidado, y por eso la decisión vive aquí, en
  un sitio, y no repartida por la pantalla.

  ─────────────────────────────────────────────────────────────
  LAS TRES REGLAS

  **1 · Solo http y https.** Ya lo comprueba `esEnlace` al guardar la
  receta, y se vuelve a comprobar aquí. Un `javascript:` en un enlace
  que otra persona de la casa va a tocar no es una posibilidad teórica:
  es la forma más vieja que hay de colar algo en el navegador de
  alguien.

  **2 · YouTube se traduce a su forma de empotrar**, y a la de
  `youtube-nocookie`, que no deja rastro de quién lo vio. Un enlace
  normal de YouTube no se deja meter en una ventana; el de empotrar sí.

  **3 · Y de esa ventana no se sale.** El `sandbox` de abajo no lleva
  `allow-top-navigation` ni `allow-popups`: la página puede moverse por
  dentro, pero no puede llevarse la pared a otro sitio ni abrir nada
  encima. Es literalmente lo que se pidió — «que no se pueda abrir ni
  reproducir nada más en esa ventana».

  ─────────────────────────────────────────────────────────────
  ⚠️  Y LO QUE NO PODEMOS EVITAR, DICHO

  Muchas páginas se niegan a que las metan en una ventana de otra
  —lo dicen con `X-Frame-Options`— y no hay manera de saberlo antes de
  intentarlo: el navegador no nos deja mirar dentro.

  Cuando pasa, la ventana sale en blanco. No es un fallo de HUBI y no se
  puede arreglar desde aquí, así que la pantalla lo dice con palabras en
  vez de dejar un hueco gris sin explicación.
*/

export const SANDBOX = 'allow-scripts allow-same-origin allow-forms'

/**
 * La dirección lista para meter en la ventana, o `null` si no vale.
 *
 * Devuelve además de qué va: `'video'` para YouTube —que se sabe que
 * funciona— y `'pagina'` para el resto, que puede negarse.
 */
export function paraLaVentana(url: string | null): { src: string; tipo: 'video' | 'pagina' } | null {
  if (!url) return null

  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return null
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null

  const video = elVideoDeYoutube(u)
  if (video) {
    return {
      /*
        `nocookie` para no dejar rastro de quién mira qué desde la
        cocina. `rel=0` para que al acabar no salgan vídeos de otros
        —que es justo «reproducir otra cosa»—, y `modestbranding` para
        que no invite a irse a YouTube.
      */
      src: `https://www.youtube-nocookie.com/embed/${video}?rel=0&modestbranding=1`,
      tipo: 'video',
    }
  }

  /* Todo lo demás se intenta tal cual, siempre en https cuando se
     pueda: una página en claro dentro de una pantalla que está en https
     la bloquea el navegador de todas formas. */
  u.protocol = 'https:'
  return { src: u.toString(), tipo: 'pagina' }
}

/**
 * El identificador del vídeo, si la dirección es de YouTube.
 *
 * Las tres formas que se usan de verdad: `youtube.com/watch?v=`,
 * `youtu.be/` y los `shorts`. No se intenta cubrir todas las que
 * existen — lo que no se reconozca cae en «página» e igual funciona.
 */
function elVideoDeYoutube(u: URL): string | null {
  const casa = u.hostname.replace(/^www\./, '')

  if (casa === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0]
    return valido(id) ? id : null
  }

  if (casa === 'youtube.com' || casa === 'm.youtube.com' || casa === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v')
    if (valido(v)) return v

    const m = u.pathname.match(/^\/(?:embed|shorts|v)\/([^/?#]+)/)
    if (m && valido(m[1])) return m[1]
  }

  return null
}

/* Un identificador de YouTube son once caracteres de un alfabeto muy
   concreto. Comprobarlo no es manía: eso se va a pegar dentro de una
   dirección, y lo que se pega dentro de una dirección se comprueba. */
function valido(id: string | null): id is string {
  return !!id && /^[A-Za-z0-9_-]{11}$/.test(id)
}
