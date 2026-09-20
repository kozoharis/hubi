/*
  ═══════════════════════════════════════════════════════════════
  LA SEMANA
  ═══════════════════════════════════════════════════════════════

  Todo lo de fechas de los menús, en un sitio y sin `Date` donde se
  pueda evitar. La regla de siempre en este proyecto: el servidor está
  en Londres y la casa en Canarias, así que cualquier cuenta de días
  hecha a medianoche se equivoca de día medio año.

  Y la semana empieza en LUNES. Postgres y JavaScript la empiezan en
  domingo, que aquí no lo hace nadie: un menú semanal que arranca en
  domingo se lee mal a la primera ojeada.
*/

export type Momento = 'comida' | 'cena'

export const MOMENTOS: { valor: Momento; texto: string }[] = [
  { valor: 'comida', texto: 'Comida' },
  { valor: 'cena', texto: 'Cena' },
]

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/* A mediodía siempre, por lo de la zona horaria. */
function elDia(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

function comoTexto(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** El lunes de la semana en la que cae esta fecha. */
export function elLunesDe(iso: string): string {
  const d = elDia(iso)
  /* getDay(): 0 = domingo … 6 = sábado. Se convierte a 0 = lunes. */
  const desdeElLunes = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - desdeElLunes)
  return comoTexto(d)
}

/** Los siete días de esa semana, de lunes a domingo. */
export function laSemanaDe(lunes: string): string[] {
  const dias: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = elDia(lunes)
    d.setDate(d.getDate() + i)
    dias.push(comoTexto(d))
  }
  return dias
}

export function otraSemana(lunes: string, cuantas: number): string {
  const d = elDia(lunes)
  d.setDate(d.getDate() + cuantas * 7)
  return comoTexto(d)
}

/** «lunes 9» — el nombre del día con su número, que es como se lee. */
export function comoSeLlamaElDia(iso: string): string {
  const d = elDia(iso)
  const nombre = DIAS[(d.getDay() + 6) % 7]
  return `${nombre} ${d.getDate()}`
}

/**
 * «Del 9 al 15 de septiembre», y con los dos meses cuando la semana
 * los cruza. Escribir «del 30 al 6 de octubre» sería mentir sobre
 * media semana.
 */
export function comoSeLlamaLaSemana(lunes: string): string {
  const dias = laSemanaDe(lunes)
  const a = elDia(dias[0])
  const b = elDia(dias[6])

  const mesA = MESES[a.getMonth()]
  const mesB = MESES[b.getMonth()]

  if (mesA === mesB) return `Del ${a.getDate()} al ${b.getDate()} de ${mesB}`
  return `Del ${a.getDate()} de ${mesA} al ${b.getDate()} de ${mesB}`
}

/*
  ═══════════════════════════════════════════════════════════════
  EL PLATO QUE VUELVE
  ═══════════════════════════════════════════════════════════════

  Haris: *«poder crearlo en un solo sitio y luego asignarle el día o
  días que se repite en la semana, si es comida o cena y si se repite
  cada semana, cada dos semanas o tres»*.

  Aquí solo se calculan LAS FECHAS. Lo que se hace con ellas —escribir
  los menús, saltar los días que ya tienen algo— es de la API, y lo que
  significan es del sql/81.

  ─────────────────────────────────────────────────────────────
  POR QUÉ ESTO NO USA `Date` MÁS DE LO IMPRESCINDIBLE

  Lo mismo que arriba: el servidor está en Londres, la casa en
  Canarias. Una cuenta de días hecha con horas se equivoca de día dos
  veces al año, y son justo los días en que alguien mira la pantalla y
  no entiende nada.

  Todo pasa por `elDia()`, que fija las doce del mediodía.
*/

/** Cada cuántas semanas vuelve un plato. Lo que se pidió, ni más. */
export const CADA_SEMANAS: { valor: 1 | 2 | 3; texto: string }[] = [
  { valor: 1, texto: 'Cada semana' },
  { valor: 2, texto: 'Cada dos semanas' },
  { valor: 3, texto: 'Cada tres semanas' },
]

/*
  Lunes = 0 … domingo = 6. El orden en que se lee una semana aquí.

  El corto va de TRES letras y no de una. La costumbre española es
  L·M·X·J·V·S·D, y esa X de miércoles hay que sabérsela: no se deduce
  mirándola. «Mié» se lee sin que nadie lo explique, que es la regla
  del punto 5 del planteamiento.
*/
export const DIAS_DE_LA_SEMANA: { valor: number; texto: string; corto: string }[] = DIAS.map(
  (nombre, i) => ({
    valor: i,
    texto: nombre.charAt(0).toUpperCase() + nombre.slice(1),
    corto: nombre.charAt(0).toUpperCase() + nombre.slice(1, 3),
  })
)

/** Cuánto se escribe por delante. Tres meses, y luego el botón de alargar. */
export const SEMANAS_POR_DELANTE = 13

/**
 * Los días en que toca ese plato.
 *
 * @param desde        Desde cuándo cuenta. Nunca se devuelve nada anterior.
 * @param dias         Días de la semana, lunes = 0.
 * @param cadaSemanas  1, 2 o 3.
 * @param semanas      Cuántas semanas se escriben por delante.
 *
 * La cuenta se ancla al LUNES de la semana de `desde`, no a `desde`.
 * Si no, «cada dos semanas desde el miércoles» y «cada dos semanas
 * desde el viernes de esa misma semana» darían calendarios distintos
 * para lo que cualquiera diría que es el mismo plan.
 */
export function losDiasDelPlan(
  desde: string,
  dias: number[],
  cadaSemanas: 1 | 2 | 3,
  semanas: number = SEMANAS_POR_DELANTE
): string[] {
  const limpios = [...new Set(dias)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort()
  if (limpios.length === 0) return []

  const lunes = elLunesDe(desde)
  const salida: string[] = []

  for (let s = 0; s < semanas; s += cadaSemanas) {
    for (const d of limpios) {
      const f = elDia(lunes)
      f.setDate(f.getDate() + s * 7 + d)
      const iso = comoTexto(f)
      /* Nada antes de hoy: un menú en el pasado no se puede comprar ni
         cocinar, solo estorba en la semana que se está mirando. */
      if (iso >= desde) salida.push(iso)
    }
  }

  return salida.sort()
}

/*
  ¿Es un enlace de verdad?

  Se admite lo que tenga pinta de dirección de internet y nada más. Un
  campo de enlace que acepta cualquier cosa acaba con teléfonos,
  direcciones y trozos de conversación dentro, y luego la pantalla
  intenta abrirlos.

  Y solo http/https a propósito: `javascript:` en un enlace que otra
  persona de la casa va a tocar no es una posibilidad teórica, es la
  forma más vieja que hay de colar algo en el navegador de alguien.
*/
export function esEnlace(url: string): boolean {
  const limpio = url.trim()
  if (!limpio) return false
  try {
    const u = new URL(limpio)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** «youtube.com», «cocina.es» — de dónde viene, para verlo de un vistazo. */
export function deDondeEs(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/*
  ═══════════════════════════════════════════════════════════════
  Y SI ES UN VÍDEO, QUE SE VEA AQUÍ
  ═══════════════════════════════════════════════════════════════

  Haris: *«cuando seleccionas el menú que aparezca la receta y el
  vídeo… que nada se pierda a nivel visual»*.

  Casi todas las recetas de esta casa son vídeos de YouTube, y hasta
  hoy lo único que había era un enlace que SACA de mappel: se abre otra
  pestaña, se ve el vídeo, y al volver hay que acordarse de en qué día
  se estaba. Con el vídeo dentro, se mira y se sigue.

  Devuelve la dirección para meter en un marco, o `null` si eso no es
  un vídeo — y entonces se queda el enlace de siempre, que para una
  receta de un blog es exactamente lo que hace falta.

  ── TRES DECISIONES PEQUEÑAS ──

  · `youtube-nocookie.com` y no `youtube.com`. Es el mismo reproductor
    sin las galletas de seguimiento. Una casa no tiene por qué
    aparecer en el historial de publicidad de nadie por mirar cómo se
    hace un bizcocho.

  · Sólo YouTube y Vimeo. No se adivina: si no se reconoce el sitio,
    no se mete nada en un marco. Meter en un marco una dirección
    cualquiera que alguien ha pegado es abrirle la puerta de par en
    par a lo que sea que haya al otro lado.

  · Y si la dirección no se puede ni leer, `null` sin ruido. Una
    receta con el enlace mal escrito tiene que seguir saliendo.
*/
export function elVideo(url: string | null): string | null {
  if (!url) return null

  let d: URL
  try {
    d = new URL(url)
  } catch {
    return null
  }

  if (d.protocol !== 'https:' && d.protocol !== 'http:') return null

  const sitio = d.hostname.replace(/^www\./, '').toLowerCase()

  /* youtu.be/XXXX · youtube.com/watch?v=XXXX · /embed/XXXX · /shorts/XXXX */
  if (sitio === 'youtu.be') {
    const id = d.pathname.slice(1).split('/')[0]
    return id ? `https://www.youtube-nocookie.com/embed/${limpiaId(id)}` : null
  }

  if (sitio === 'youtube.com' || sitio === 'm.youtube.com' || sitio === 'youtube-nocookie.com') {
    const v = d.searchParams.get('v')
    if (v) return `https://www.youtube-nocookie.com/embed/${limpiaId(v)}`

    const partes = d.pathname.split('/').filter(Boolean)
    if ((partes[0] === 'embed' || partes[0] === 'shorts' || partes[0] === 'live') && partes[1]) {
      return `https://www.youtube-nocookie.com/embed/${limpiaId(partes[1])}`
    }
    return null
  }

  if (sitio === 'vimeo.com' || sitio === 'player.vimeo.com') {
    const id = d.pathname.split('/').filter(Boolean).pop() ?? ''
    return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null
  }

  return null
}

/* Sólo letras, números, guion y guion bajo: es lo que llevan los
   identificadores de YouTube. Cualquier otra cosa que venga pegada
   —una comilla, un `?`— se queda fuera de la dirección del marco. */
function limpiaId(t: string): string {
  return t.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24)
}
