import { ZONA } from '@/lib/tablon'

/*
  LEER UN CALENDARIO DE GOOGLE SIN PEDIRLE PERMISO A GOOGLE.

  Google da a cada calendario una "dirección secreta en formato iCal".
  Es un archivo de texto con todas las citas dentro. Quien tenga la
  dirección lo lee: no hace falta ni sesión, ni permisos, ni pasar por
  la verificación de Google —que para leer un calendario exige
  justificación, dominio y vídeo demostrativo—.

  A cambio, dos cosas que hay que tener presentes y no esconder:

  1. ESA DIRECCIÓN ES UNA LLAVE. Se guarda cifrada, igual que el
     permiso de Drive, y no sale nunca al navegador. Si se filtrara, se
     regenera desde Google y la vieja muere.

  2. GOOGLE LA REFRESCA DESPACIO. Una cita puesta esta mañana en el
     móvil puede tardar horas en aparecer aquí. No es un fallo nuestro
     y no se puede acelerar; se dice y ya está.

  Es de SOLO LECTURA y en un sentido. Estas citas se enseñan, no se
  tocan: son suyas, viven en su Google, y HUBI no tiene por qué poder
  cambiarlas.

  ─────────────────────────────────────────────────────────────
  El formato es viejo y tiene sus trampas. Las que importan:

  · Las líneas largas se parten y continúan con un espacio delante.
    Hay que volver a juntarlas ANTES de mirar nada, o los títulos
    aparecen cortados por la mitad.
  · Una fecha puede venir de tres maneras: día suelto (todo el día),
    hora con zona horaria, y hora en UTC —que hay que traer a la hora
    de aquí o las citas salen corridas—.
  · Las que se repiten no vienen repetidas: viene UNA y una regla.
    Los cumpleaños son de éstas. Si no se despliega la regla, no sale
    ni un cumpleaños.
*/

export type CitaExterna = {
  uid: string
  titulo: string
  /** "2026-09-02", ya en la hora de aquí. */
  fecha: string
  /** "10:30", o null si dura todo el día. */
  hora: string | null
  lugar: string | null
  /*
    ¿Esta cita la puso HUBI?

    Todo lo que HUBI escribe en Google lleva "Apuntado en HUBI" en su
    descripción. Sirve para no enseñar dos veces la misma cosa: si
    alguien conecta como calendario propio uno donde HUBI también
    escribe, sus tareas volverían de Google y saldrían duplicadas en la
    Agenda —una como tarea y otra como cita— sin que se entienda por
    qué. Se marcan aquí y se descartan al enseñarlas.
  */
  deHubi: boolean
}

/** La firma que HUBI deja en todo lo que escribe en Google. */
export const FIRMA_HUBI = 'Apuntado en HUBI'

const MAXIMO = 400

/**
 * Saca las citas que caen entre dos fechas (las dos incluidas).
 *
 * Se le pasa la ventana porque un calendario de años tiene miles de
 * citas y solo interesan las de la pantalla que se está mirando.
 */
export function leerICS(texto: string, desde: string, hasta: string): CitaExterna[] {
  const bloques = trocear(desplegar(texto))
  const citas: CitaExterna[] = []

  for (const bloque of bloques) {
    const campos = propiedades(bloque)

    // Una cita anulada sigue en el archivo. No se enseña.
    if ((campos.get('STATUS')?.valor ?? '').toUpperCase() === 'CANCELLED') continue

    const inicio = campos.get('DTSTART')
    if (!inicio) continue

    const cuando = laFecha(inicio)
    if (!cuando) continue

    const titulo = texto_(campos.get('SUMMARY')?.valor ?? '').trim() || '(sin título)'
    const lugar = texto_(campos.get('LOCATION')?.valor ?? '').trim() || null
    const deHubi = texto_(campos.get('DESCRIPTION')?.valor ?? '').includes(FIRMA_HUBI)
    const uid = (campos.get('UID')?.valor ?? '').trim() || `${cuando.fecha}-${titulo}`

    const regla = campos.get('RRULE')?.valor ?? null
    const excluidas = new Set(
      (campos.get('EXDATE')?.valor ?? '')
        .split(',')
        .map((x) => x.trim().slice(0, 8))
        .filter(Boolean)
        .map((x) => `${x.slice(0, 4)}-${x.slice(4, 6)}-${x.slice(6, 8)}`)
    )

    const dias = regla
      ? desplegarRegla(cuando.fecha, regla, desde, hasta)
      : cuando.fecha >= desde && cuando.fecha <= hasta
        ? [cuando.fecha]
        : []

    for (const dia of dias) {
      if (excluidas.has(dia)) continue
      citas.push({ uid: `${uid}·${dia}`, titulo, fecha: dia, hora: cuando.hora, lugar, deHubi })
      if (citas.length >= MAXIMO) return ordenar(citas)
    }
  }

  return ordenar(citas)
}

function ordenar(citas: CitaExterna[]): CitaExterna[] {
  return citas.sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? '')
  )
}

/*
  Volver a juntar las líneas partidas.

  El formato parte las líneas largas a los 75 caracteres y marca la
  continuación con un espacio o un tabulador al principio. Si no se
  deshace esto primero, un título largo se lee cortado y una regla de
  repetición se lee a medias.
*/
function desplegar(texto: string): string {
  return texto.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function trocear(texto: string): string[] {
  const bloques: string[] = []
  let dentro: string[] | null = null

  for (const linea of texto.split('\n')) {
    if (linea.startsWith('BEGIN:VEVENT')) dentro = []
    else if (linea.startsWith('END:VEVENT')) {
      if (dentro) bloques.push(dentro.join('\n'))
      dentro = null
    } else if (dentro) dentro.push(linea)
  }
  return bloques
}

type Campo = { parametros: Record<string, string>; valor: string }

function propiedades(bloque: string): Map<string, Campo> {
  const mapa = new Map<string, Campo>()

  for (const linea of bloque.split('\n')) {
    const corte = linea.indexOf(':')
    if (corte < 0) continue

    const izquierda = linea.slice(0, corte)
    const valor = linea.slice(corte + 1)
    const trozos = izquierda.split(';')
    const nombre = trozos[0].toUpperCase()

    const parametros: Record<string, string> = {}
    for (const p of trozos.slice(1)) {
      const igual = p.indexOf('=')
      if (igual > 0) parametros[p.slice(0, igual).toUpperCase()] = p.slice(igual + 1)
    }

    /* EXDATE puede venir varias veces. Se juntan, que si no solo se
       excluiría la última. */
    if (nombre === 'EXDATE' && mapa.has('EXDATE')) {
      mapa.get('EXDATE')!.valor += ',' + valor
    } else if (!mapa.has(nombre)) {
      mapa.set(nombre, { parametros, valor })
    }
  }
  return mapa
}

/** Los caracteres escapados del formato: \n, \, ; y , */
function texto_(v: string): string {
  return v
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/*
  La fecha y la hora de una cita, ya en la hora de aquí.

  Tres formas posibles, y cada una se trata distinto:

    DTSTART;VALUE=DATE:20260902            → todo el día
    DTSTART;TZID=Atlantic/Canary:...T1030  → la hora tal cual
    DTSTART:20260902T093000Z               → UTC, HAY QUE TRAERLA

  La del medio se toma tal como viene: Google exporta con la zona del
  propio calendario, que es la de ellos. Si algún día importaran un
  calendario de otro huso, esa cita saldría con su hora local — se
  prefiere eso a inventar una conversión a medias.
*/
function laFecha(campo: Campo): { fecha: string; hora: string | null } | null {
  const v = campo.valor.trim()

  // Todo el día: 20260902
  if (campo.parametros.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    if (!/^\d{8}/.test(v)) return null
    return { fecha: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, hora: null }
  }

  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
  if (!m) return null

  const [, a, me, d, h, mi, , zulu] = m

  if (zulu) {
    // UTC → la hora de aquí. Sin esto, en verano todo sale una hora antes.
    const cuando = new Date(Date.UTC(+a, +me - 1, +d, +h, +mi))
    return { fecha: enZona(cuando), hora: horaEnZona(cuando) }
  }

  return { fecha: `${a}-${me}-${d}`, hora: `${h}:${mi}` }
}

const DIA_AQUI = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const HORA_AQUI = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function enZona(f: Date): string {
  return DIA_AQUI.format(f)
}

function horaEnZona(f: Date): string {
  return HORA_AQUI.format(f)
}

/*
  Desplegar una regla de repetición dentro de la ventana que se mira.

  Sin esto NO SALE NI UN CUMPLEAÑOS: los cumpleaños son una sola cita
  con la regla "cada año", y el archivo no trae una copia por año.

  Se cubren las reglas que de verdad usa una familia —cada día, cada
  semana (con sus días), cada mes, cada año— con su intervalo, su tope
  de veces y su fecha final. Lo raro de verdad (el tercer martes de
  cada mes) no se despliega: se prefiere no enseñar una cita a
  enseñarla el día que no es.
*/
const DIAS_ICS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

function desplegarRegla(
  primera: string,
  regla: string,
  desde: string,
  hasta: string
): string[] {
  const r: Record<string, string> = {}
  for (const parte of regla.split(';')) {
    const igual = parte.indexOf('=')
    if (igual > 0) r[parte.slice(0, igual).toUpperCase()] = parte.slice(igual + 1).toUpperCase()
  }

  const frecuencia = r.FREQ
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(frecuencia)) return []

  const intervalo = Math.max(1, Number(r.INTERVAL || '1'))
  const tope = r.COUNT ? Number(r.COUNT) : Infinity
  const finRegla = r.UNTIL ? `${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}` : null

  const porDia = (r.BYDAY ?? '')
    .split(',')
    .map((x) => DIAS_ICS[x.trim().slice(-2)])
    .filter((x) => x !== undefined)

  const [a0, m0, d0] = primera.split('-').map(Number)
  const arranque = new Date(a0, m0 - 1, d0)
  const limite = new Date(hasta.split('-').map(Number)[0], +hasta.split('-')[1] - 1, +hasta.split('-')[2])

  const salida: string[] = []
  let veces = 0
  let vuelta = 0

  /* Un tope duro de vueltas: un archivo con una regla rota no puede
     dejar el servidor dando vueltas para siempre. */
  while (vuelta < 2000 && veces < tope) {
    let candidatos: Date[] = []
    const paso = new Date(arranque)

    if (frecuencia === 'DAILY') {
      paso.setDate(paso.getDate() + vuelta * intervalo)
      candidatos = [paso]
    } else if (frecuencia === 'WEEKLY') {
      paso.setDate(paso.getDate() + vuelta * 7 * intervalo)
      if (porDia.length === 0) candidatos = [paso]
      else {
        const lunes = new Date(paso)
        lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7))
        candidatos = porDia.map((d) => {
          const x = new Date(lunes)
          x.setDate(x.getDate() + ((d + 6) % 7))
          return x
        })
      }
    } else if (frecuencia === 'MONTHLY') {
      paso.setMonth(paso.getMonth() + vuelta * intervalo)
      /* Si el mes no tiene ese día —31 en febrero— JavaScript se pasa
         al mes siguiente. Esa vuelta no cuenta. */
      candidatos = paso.getDate() === d0 ? [paso] : []
    } else {
      paso.setFullYear(paso.getFullYear() + vuelta * intervalo)
      candidatos = paso.getDate() === d0 ? [paso] : []
    }

    vuelta++

    let algunoDentro = false
    for (const c of candidatos.sort((x, y) => x.getTime() - y.getTime())) {
      if (c < arranque) continue
      const iso = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`
      if (finRegla && iso > finRegla) return salida
      if (c <= limite) algunoDentro = true
      veces++
      if (veces > tope) break
      if (iso >= desde && iso <= hasta) salida.push(iso)
    }

    // Ya se ha pasado del final de la ventana: no hay nada más que ver.
    if (!algunoDentro && candidatos.length > 0 && candidatos[0] > limite) break
  }

  return salida
}

/*
  ¿Es una dirección de calendario que podamos aceptar?

  Solo https y solo de Google. No por cerrazón: es una dirección que
  nuestro SERVIDOR va a pedir, y aceptar cualquier dirección
  convertiría a HUBI en un recadero que va a donde le manden — a la red
  interna de Vercel, por ejemplo. Se acota a lo que de verdad se
  necesita.
*/
export function esDireccionDeCalendario(url: string): boolean {
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:') return false
    if (!/(^|\.)google\.com$/.test(u.hostname)) return false
    return /\.ics$/i.test(u.pathname)
  } catch {
    return false
  }
}
