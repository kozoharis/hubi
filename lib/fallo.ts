/*
  ═══════════════════════════════════════════════════════════════
  LO QUE SE PUEDE DECIR EN PANTALLA, Y LO QUE NO
  ═══════════════════════════════════════════════════════════════

  Había ocho sitios en MAPPEL escritos así:

      try {
        if (!r.ok) throw new Error((await r.json()).error)
      } catch (e) {
        setAviso(e instanceof Error ? e.message : 'No se ha podido apuntar.')
      }

  Y a primera vista está bien: si el servidor manda un motivo, se
  enseña el motivo. Nuestros motivos están escritos en castellano y en
  el tono de MAPPEL, así que enseñarlos es lo correcto.

  El problema es TODO LO DEMÁS que cae en ese mismo `catch`, porque
  `e.message` no distingue de dónde viene:

  · **No hay red.** `fetch` lanza, y `e.message` es
    `Failed to fetch` — o `Load failed` en Safari. En la pantalla de
    Conchita, en inglés.

  · **El servidor no ha contestado JSON.** Un 502 de Vercel devuelve
    una página HTML. Entonces `r.json()` lanza *dentro del `throw`*, y
    lo que acaba en pantalla es
    `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.

  · **El servidor ha contestado JSON pero sin `error`.** Entonces
    `new Error(undefined)` y la pantalla dice, literalmente,
    **«undefined»**.

  Ninguno de los tres es un fallo raro. El primero pasa en cuanto se
  entra en un ascensor.

  ─────────────────────────────────────────────────────────────
  EL ARREGLO NO ES DEJAR DE ENSEÑAR `e.message`

  Eso perdería los motivos buenos: «Esa lista ya no existe», «No
  tienes permiso para borrar esto». Son los que de verdad ayudan.

  El arreglo es poder DISTINGUIR. Un fallo que trae una frase nuestra
  se lanza como `FalloDicho`; cualquier otra cosa que caiga en el
  `catch` no lo es, y se cuenta con nuestras palabras mientras el
  detalle técnico se va al registro, que es donde sirve.

  Es la misma regla que ya aplicamos con el lector de papeles: al
  servidor lo que es del servidor, y a la pantalla una frase que se
  entienda.
*/

/** Un fallo cuyo mensaje SÍ se le puede enseñar a una persona. */
export class FalloDicho extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'FalloDicho'
  }
}

/**
 * Convierte una respuesta que ha ido mal en un fallo que se puede
 * contar. Se llama cuando `r.ok` es falso:
 *
 *     if (!r.ok) await elMotivo(r, 'No se ha podido apuntar.')
 *
 * Nunca devuelve: siempre lanza.
 */
export async function elMotivo(respuesta: Response, siNoLoDice: string): Promise<never> {
  let dicho = ''

  try {
    const cuerpo = await respuesta.json()
    if (typeof cuerpo?.error === 'string' && cuerpo.error.trim()) {
      dicho = cuerpo.error.trim()
    }
  } catch {
    /* No era JSON — una página de error del alojamiento, o la conexión
       cortada a mitad de la lectura. No es nada que contar en
       pantalla. */
  }

  if (!dicho) {
    /* Que no se pierda: en el registro sirve para arreglarlo, en la
       pantalla sólo asusta. */
    console.error(`[MAPPEL] El servidor ha contestado ${respuesta.status} sin un motivo legible.`)
  }

  throw new FalloDicho(dicho || siNoLoDice)
}

/**
 * Lo que se le enseña a la persona a partir de lo que sea que haya
 * caído en el `catch`.
 *
 *     catch (e) {
 *       setAviso(loQueSePuedeDecir(e, 'No se ha podido apuntar.'))
 *     }
 *
 * Si el fallo trae una frase nuestra, se enseña. Si no —sin red, un
 * fallo de JavaScript, lo que sea— se enseña la frase de reserva y el
 * detalle se va al registro.
 */
export function loQueSePuedeDecir(fallo: unknown, siNoSePuede: string): string {
  if (fallo instanceof FalloDicho && fallo.message.trim()) return fallo.message

  console.error('[MAPPEL]', fallo)

  /*
    Y si no hay red, se dice eso mismo en vez de «no se ha podido
    guardar»: son dos consejos distintos. Uno lleva a mirar el wifi;
    el otro, a volver a intentarlo sin más.
  */
  if (sinConexion(fallo)) return 'No hay conexión. Comprueba el wifi o los datos y prueba otra vez.'

  return siNoSePuede
}

/* `TypeError` con esos textos es lo que lanza `fetch` cuando no sale
   de casa. Cada navegador lo dice a su manera, y por eso se miran
   varios: Chrome «Failed to fetch», Safari «Load failed», Firefox
   «NetworkError…». */
function sinConexion(fallo: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (!(fallo instanceof TypeError)) return false
  const t = fallo.message.toLowerCase()
  return t.includes('fetch') || t.includes('load failed') || t.includes('network')
}
