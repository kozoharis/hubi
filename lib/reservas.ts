/*
  Leer una reserva de una captura de pantalla.

  El caso real: Juan Miguel abre Airbnb en el móvil, hace una captura
  de la reserva y la guarda en HUBI. De ahí tiene que salir el ingreso
  entero — importe, noches, personas y a nombre de quién— sin teclear
  nada.

  QUÉ SE LEE BIEN Y QUÉ NO. Medido con una captura de verdad, no
  supuesto:

    Reserva 65032482                 ← perfecto
    Oliver Gregorio Ramos Mesa       ← perfecto
    Precio total: €185.90 . Pagado   ← perfecto
    2C . 22%. (Y                     ← esto era «2 🌙 · 2 👥 · Airbnb»

  La última línea es la importante y es la que peor sale, porque los
  datos van pegados a iconos. Un icono no es una letra: la luna acabó
  en «C», el muñeco en «2%» y el logotipo de Airbnb en «(Y».

  Así que aquí NO se lee la línea entera: se saca el primer número
  plausible de cada trozo y se recorta hasta que tenga sentido —22
  personas en un apartamento no existen; 2, sí—. Y sale siempre a
  pantalla para confirmar, nunca se guarda a la callada.

  LA PLATAFORMA NO SE LEE DEL LOGOTIPO. No se puede: es un dibujo. Se
  deduce de cómo escribe cada una. «Sumatorio del pago» y «Precio
  total» son de Airbnb; «Número de reserva» e «Importe total», de
  Booking. Es una pista, no una certeza — por eso solo se propone.
*/

export type Reserva = {
  plataforma: 'Airbnb' | 'Booking' | null
  referencia: string | null
  huesped: string | null
  importe: number | null
  noches: number | null
  personas: number | null
}

/** Los tres apartamentos, y lo que es de la casa entera. */
export const APARTAMENTOS = [
  { n: 1, nombre: 'Helechos 1' },
  { n: 2, nombre: 'Helechos 2' },
  { n: 3, nombre: 'Helechos 3' },
] as const

export function nombreApartamento(n: number | null | undefined): string {
  return n ? `Helechos ${n}` : 'Toda la casa'
}

/* Topes de lo que puede tener sentido en esta casa. No son validación:
   son la regla que permite deshacer el estropicio de los iconos. */
const MAX_NOCHES = 60
const MAX_PERSONAS = 16

/**
 * ¿Esto es una reserva?
 *
 * Se pide más de una señal a propósito. Cualquier factura lleva la
 * palabra "total"; solo una reserva lleva además un check-in, un
 * número de reserva o unas noches.
 */
export function pareceReserva(texto: string): boolean {
  const t = texto.toLowerCase()
  let señales = 0
  if (/\bcheck[\s-]?(in|out)\b/.test(t)) señales++
  if (/\breserva\s*(n[ºo°.]*\s*)?[a-z0-9]{6,}/i.test(texto)) señales++
  if (/sumatorio del pago/.test(t)) señales++
  if (/precio total/.test(t)) señales++
  if (/\bhu[ée]sped(es)?\b/.test(t)) señales++
  if (/\bnoches?\b/.test(t)) señales++
  return señales >= 2
}

export function leerReserva(texto: string): Reserva | null {
  if (!pareceReserva(texto)) return null

  const todas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  /*
    QUEDARSE CON LA TARJETA DE LA RESERVA, NO CON LA PANTALLA ENTERA.

    Una captura de móvil no es el recorte limpio de una reserva: es la
    pantalla completa. La ficha abierta está abajo, y por encima queda
    la lista de las otras reservas —con sus nombres, sus check-in y sus
    numeritos—. Leyéndolo todo se acaba cogiendo el huésped de una
    reserva y las noches de otra, que es peor que no leer nada.

    La línea "Reserva 65032482" marca dónde empieza la ficha abierta.
    De ahí hacia abajo, y nada de lo de arriba.
  */
  const anclaje = todas.findIndex((l) => /reserva\s*(n[ºo°.]*\s*)?[:\s]*[A-Z0-9]{6,}/i.test(l))
  const lineas = anclaje >= 0 ? todas.slice(anclaje) : todas

  return {
    /* La plataforma sí se busca en TODA la pantalla: el nombre de la
       aplicación suele estar arriba del todo, fuera de la ficha, y ahí
       encontrarlo es un acierto, no una confusión. */
    plataforma: laPlataforma(texto.toLowerCase()),
    referencia: laReferencia(lineas.join('\n')),
    huesped: elHuesped(lineas),
    importe: elPrecioTotal(lineas),
    ...lasCifras(lineas),
  }
}

/* ── La plataforma, por cómo escribe cada una ────────────── */
function laPlataforma(t: string): 'Airbnb' | 'Booking' | null {
  // Si el nombre aparece escrito, no hay nada que deducir.
  if (/\bairbnb\b/.test(t)) return 'Airbnb'
  if (/booking\.?com|\bbooking\b/.test(t)) return 'Booking'

  let airbnb = 0
  let booking = 0
  if (/sumatorio del pago/.test(t)) airbnb += 2
  if (/precio total/.test(t)) airbnb += 1
  if (/detalles de la reserva/.test(t)) airbnb += 1
  if (/n[uú]mero de reserva/.test(t)) booking += 2
  if (/importe total/.test(t)) booking += 1
  if (/\bpin\b/.test(t)) booking += 1

  if (airbnb > booking && airbnb >= 2) return 'Airbnb'
  if (booking > airbnb && booking >= 2) return 'Booking'
  return null
}

/* ── El número de la reserva ─────────────────────────────── */
function laReferencia(texto: string): string | null {
  const m =
    texto.match(/reserva\s*(?:n[ºo°.]*\s*)?[:\s]*([A-Z0-9]{6,14})\b/i) ??
    texto.match(/\bc[oó]digo\s*(?:de\s*)?reserva\s*[:\s]*([A-Z0-9]{6,14})\b/i)

  if (!m) return null
  const ref = m[1].toUpperCase()

  // Un código que sea todo letras es casi seguro una palabra mal leída.
  if (!/\d/.test(ref)) return null
  return ref
}

/* ── A nombre de quién ───────────────────────────────────── */
/*
  El nombre va justo encima del check-in. Se busca por ahí y no por
  "parece un nombre", porque media captura parece un nombre: "Precio
  total" también son dos palabras con mayúscula.
*/
function elHuesped(lineas: string[]): string | null {
  const donde = lineas.findIndex((l) => /^check[\s-]?in/i.test(l))
  const candidatas = donde > 0 ? lineas.slice(0, donde).reverse() : lineas.slice(0, 5)

  for (const l of candidatas) {
    if (esNombre(l)) return l.replace(/\s+/g, ' ').trim()
  }
  return null
}

function esNombre(linea: string): boolean {
  const l = linea.trim()
  if (l.length < 5 || l.length > 60) return false
  if (/\d|€|:|@/.test(l)) return false

  const palabras = l.split(/\s+/)
  if (palabras.length < 2 || palabras.length > 5) return false

  // Estados y etiquetas de la propia pantalla, no personas.
  if (/^(modificad|confirmad|cancelad|pendient|pagad|reserv|precio|sumatorio|detalles|check)/i.test(l)) {
    return false
  }

  // Todas las palabras empiezan por mayúscula y son letras.
  return palabras.every((p) => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñü'’-]+$/.test(p))
}

/* ── El importe ──────────────────────────────────────────── */
/*
  Aquí manda "precio total" o "importe total". Una captura de reserva
  lleva varias cifras —la limpieza, la comisión, la fianza— y la que
  entra en las cuentas es lo que se ha cobrado en total.

  Ojo con el separador: Airbnb en España escribe €185.90 con punto,
  y una factura española escribe 185,90 con coma. Los dos son lo
  mismo y los dos tienen que salir 185.90.
*/
function elPrecioTotal(lineas: string[]): number | null {
  const conTotal = lineas.filter((l) => /(precio|importe|coste)\s+total|^total\b/i.test(l))
  for (const l of conTotal.length > 0 ? conTotal : []) {
    const n = primerNumero(l)
    if (n != null) return n
  }
  return null
}

function primerNumero(linea: string): number | null {
  const m = linea.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/)
  if (!m) return null

  let s = m[1]
  /* Si lleva los dos separadores, el último manda: 1.234,56 y
     1,234.56 son la misma cantidad escrita en dos idiomas. */
  if (s.includes('.') && s.includes(',')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }

  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

/* ── Las noches y las personas ───────────────────────────── */
/*
  La línea de los iconos. Dos números seguidos, separados por puntos:
  primero las noches, después las personas. Ese orden lo pone la
  aplicación, no el papel, así que se puede dar por bueno.

  Lo que NO se puede dar por bueno es el número tal cual sale: el
  icono se pega detrás y lo estira. Por eso se recorta hasta que sea
  posible — 22 personas no caben en un apartamento, 2 sí.
*/
function lasCifras(lineas: string[]): { noches: number | null; personas: number | null } {
  // Primero, por si la captura lo dice con palabras.
  const escritas = conPalabras(lineas)
  if (escritas.noches != null || escritas.personas != null) return escritas

  for (const l of lineas) {
    // La línea de iconos es corta y casi todo son símbolos.
    if (l.length > 30) continue
    const trozos = l.split(/[·.•|]+/).map((x) => x.trim()).filter(Boolean)
    if (trozos.length < 2) continue

    const nums = trozos.map(digitosDelante).filter((x): x is string => x != null)
    if (nums.length < 2) continue

    const noches = recortar(nums[0], MAX_NOCHES)
    const personas = recortar(nums[1], MAX_PERSONAS)
    if (noches != null && personas != null) return { noches, personas }
  }

  return { noches: null, personas: null }
}

function conPalabras(lineas: string[]): { noches: number | null; personas: number | null } {
  const todo = lineas.join(' ')
  const n = todo.match(/(\d{1,3})\s*noches?/i)
  const p = todo.match(/(\d{1,2})\s*(hu[ée]spedes?|personas?|adultos?|viajeros?)/i)
  return {
    noches: n ? recortar(n[1], MAX_NOCHES) : null,
    personas: p ? recortar(p[1], MAX_PERSONAS) : null,
  }
}

function digitosDelante(trozo: string): string | null {
  const m = trozo.match(/^\D{0,2}(\d+)/)
  return m ? m[1] : null
}

/**
 * Quita cifras por detrás hasta que el número sea posible.
 *
 *   "22" personas  →  22 no cabe  →  2   ✓
 *   "122" personas →  122 no cabe →  12  ✓
 *   "2"   noches   →  2 cabe      →  2   ✓
 */
function recortar(digitos: string, maximo: number): number | null {
  let s = digitos
  while (s.length > 0) {
    const n = Number(s)
    if (n >= 1 && n <= maximo) return n
    s = s.slice(0, -1)
  }
  return null
}
