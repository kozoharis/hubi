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
