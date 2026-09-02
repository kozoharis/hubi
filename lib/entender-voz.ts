import type { Categoria } from '@/lib/rutas'
import { COMPRABLES_ORDENADOS } from '@/lib/comprables'
import type { Entendido, Tarea } from '@/lib/voz'

/*
  Entender una frase hablada sin preguntarle a nadie.

  Esto es la red de seguridad de la voz. Mientras Gemini responda, se
  usa Gemini: entiende mejor y aguanta frases enrevesadas. Cuando no
  responde —se acabó el cupo, se cayó, no hay conexión con él— entra
  esto.

  Por qué hacía falta: las palabras YA ESTÁN. El teléfono las ha
  transcrito, se ven en la pantalla. Perderlas porque un servidor de
  Google está ocupado, delante de alguien que acaba de hablar treinta
  segundos, es el peor fallo que puede tener esta función. Que HUBI
  acierte un poco menos es un incordio; que le haga repetir la frase
  entera es lo que consigue que deje de usarla.

  No pretende igualar al modelo. Pretende cubrir las cinco o seis
  formas en que Juan Miguel y Conchita van a hablar de verdad:

    "Recuérdale a Conchita el martes que llame al médico"
    "Apunta un gasto de 85 euros de productos"
    "Hemos cobrado 1200 de la cooperativa"
    "Busca la factura del seguro del coche"
    "¿Cuánto hemos gastado este trimestre en agua?"

  Y cuando algo no lo saca, lo deja vacío — nunca lo inventa. Un campo
  en blanco se ve y se rellena; un dato inventado se guarda y se
  descubre dentro de seis meses.
*/

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function limpio(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// ── Qué se está pidiendo ──────────────────────────────────
const SEÑALES: { accion: Entendido['accion']; palabras: string[] }[] = [
  /*
    Borrar y cambiar van DELANTE de todo, y no es un capricho de orden.

    "Borra el gasto de la luz" lleva la palabra "gasto", y "cambia lo
    del médico" podría sonar a apuntar algo nuevo. Si estas dos señales
    fueran las últimas, cada frase para quitar algo acabaría creando
    una tarea más — que es exactamente lo contrario de lo que se pide.
  */
  {
    accion: 'borrar',
    palabras: [
      'borra', 'borrar', 'elimina', 'eliminar', 'quita ', 'quitar ',
      'anula', 'anular', 'cancela', 'cancelar', 'ya no hace falta',
      'ya no hay que', 'olvidate de', 'olvidate del', 'olvidate la',
      'deshazte de', 'tira ',
    ],
  },
  {
    accion: 'cambiar',
    palabras: [
      'cambia ', 'cambiar ', 'cambialo', 'cambiala', 'corrige', 'corregir',
      'modifica', 'modificar', 'mueve ', 'muevelo', 'muevela', 'pasalo a',
      'pasala a', 'mejor el ', 'mejor a las', 'en vez de', 'no es el ',
      'no era el ', 'adelanta', 'retrasa', 'aplaza',
    ],
  },
  {
    /*
      Preguntar. Cinco cosas distintas se contestan por aquí —cuentas,
      un papel, la compra, la agenda— y todas empiezan igual: dime,
      qué, cuánto. El tipo concreto se decide más abajo, en
      `queSePregunta`.

      Van ANTES que "buscar" a propósito: "enséñame la compra" quiere
      verla, pero "dime la compra" quiere que se la cuenten, y sin esto
      las dos acababan abriendo una pantalla.
    */
    accion: 'consulta',
    palabras: [
      'cuanto hemos', 'cuanto llevamos', 'cuanto he', 'como vamos',
      'que balance', 'cuanto se ha gastado',
      'dime la lista', 'dime la compra', 'dime que hay en la compra',
      'que hay en la compra', 'que falta por comprar', 'que falta en la compra',
      /* SIN EÑE NI TILDES. La frase se compara ya limpia —"mañana"
         llega aquí como "manana"—, así que una señal escrita con ñ no
         coincide NUNCA. Costó dos pruebas verlo. */
      'que tengo hoy', 'que tengo manana', 'que tengo el', 'que tengo en',
      'que tenemos hoy', 'que tenemos manana', 'que tenemos el',
      'que hay hoy', 'que hay manana', 'en el calendario', 'en la agenda',
      'dime la agenda', 'que toca hoy', 'que toca manana',
      'dime la ultima factura', 'cual fue la ultima', 'dime el ultimo',
    ],
  },
  {
    accion: 'buscar',
    palabras: ['busca', 'buscame', 'encuentra', 'ensename', 'enseñame', 'muestrame', 'muestra', 'donde esta', 'donde estan', 'sacame'],
  },
  {
    accion: 'ingreso',
    palabras: ['hemos cobrado', 'he cobrado', 'nos han pagado', 'un ingreso', 'ingreso de', 'hemos vendido', 'hemos ingresado'],
  },
  {
    accion: 'gasto',
    palabras: ['un gasto', 'gasto de', 'hemos pagado', 'he pagado', 'he gastado', 'hemos gastado', 'me ha costado', 'nos ha costado'],
  },
  /*
    LA COMPRA VA LA ÚLTIMA, Y ESO SE APRENDIÓ PROBÁNDOLO.

    Primero la puse delante, con el razonamiento de que "apunta leche
    en la compra" lleva las mismas palabras que una tarea. Y con eso,
    "apunta un gasto de 40 euros de la compra del súper" se convertía
    en un artículo de la lista llamado "Un gasto de 40 euros del
    súper". El dinero desaparecía de las cuentas.

    Puesta la última funciona sola: una frase de la compra no lleva
    ninguna de las señales de arriba —ni euros, ni "cuánto hemos", ni
    "busca"—, así que llega hasta aquí. Y una que sí las lleva, se
    queda antes, donde le toca.

    Sigue por delante de "recordatorio", que es lo que se supone
    cuando no encaja nada.
  */
  {
    accion: 'compra',
    palabras: [
      'en la compra', 'a la compra', 'de la compra', 'lista de la compra',
      'hay que comprar', 'necesitamos comprar', 'nos falta', 'nos hace falta',
      'se ha acabado', 'se acabo', 'compra la', 'compra el',
    ],
  },
]

function queQuiere(plano: string): Entendido['accion'] {
  for (const s of SEÑALES) {
    if (s.palabras.some((p) => plano.includes(p))) return s.accion
  }
  // Lo más común con diferencia. Y es el que menos daño hace si se
  // equivoca: sale la pantalla de confirmación y se corrige.
  return 'recordatorio'
}

// ── Los números ───────────────────────────────────────────
/*
  El transcriptor casi siempre escribe cifras ("85 euros"), pero no
  siempre: con cantidades redondas suele poner letra. Así que se
  entienden las dos.
*/
const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30,
  cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
  cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700,
  ochocientos: 800, novecientos: 900,
}

function enLetra(palabras: string[]): number | null {
  let total = 0
  let parcial = 0
  let algo = false

  for (const p of palabras) {
    if (p === 'y') continue
    if (p === 'mil') {
      total += (parcial || 1) * 1000
      parcial = 0
      algo = true
      continue
    }
    const v = UNIDADES[p]
    if (v === undefined) return algo ? total + parcial : null
    parcial += v
    algo = true
  }

  return algo ? total + parcial : null
}

function elImporte(plano: string): number | null {
  // 85 € · 85 euros · 1.200,50 euros
  const cifra = plano.match(
    /(\d{1,3}(?:[.\s]\d{3})*|\d+)(?:[,.](\d{1,2}))?\s*(?:€|euros?|eur)/
  )
  if (cifra) {
    const entera = cifra[1].replace(/[.\s]/g, '')
    return Number(`${entera}.${cifra[2] ?? '0'}`)
  }

  /*
    "ochenta y cinco euros".

    AQUÍ HABÍA UN FALLO DE DINERO. Se cogían las seis palabras
    anteriores a "euros" y se le pasaban enteras al lector de números.
    Con "apunta un gasto de ochenta y cinco euros", esas seis palabras
    eran "un gasto de ochenta y cinco" — y el lector, al toparse con
    "gasto", devolvía lo que llevaba: el 1 de "un".

    Un gasto de ochenta y cinco euros se apuntaba como UN EURO. Sin
    error, sin aviso, y con la confirmación en pantalla enseñando
    "1,00 €" que nadie lee con atención.

    Ahora se va HACIA ATRÁS desde "euros" cogiendo solo palabras que
    son número, y se para en la primera que no lo es. "de" corta, y
    quedan "ochenta y cinco".
  */
  const antesDeEuros = plano.match(/^(.*?)\s*(?:€|euros?|eur)\b/)
  if (antesDeEuros) {
    const palabras = antesDeEuros[1].split(/\s+/).filter(Boolean)
    const numero: string[] = []

    for (let i = palabras.length - 1; i >= 0 && numero.length < 8; i--) {
      const w = palabras[i]
      if (w === 'y' || w === 'mil' || UNIDADES[w] !== undefined) numero.unshift(w)
      else break
    }

    /* Una "y" suelta al principio no es parte del número: "pan y cinco
       euros" no son cinco, pero "y" delante de nada tampoco suma. */
    while (numero[0] === 'y') numero.shift()

    if (numero.length > 0) {
      const n = enLetra(numero)
      if (n !== null && n > 0) return n
    }
  }

  return null
}

// ── Cuándo ────────────────────────────────────────────────
type Cuando = { fecha: string | null; hora: string | null }

function aIso(f: Date): string {
  return new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate(), 12))
    .toISOString()
    .slice(0, 10)
}

function elCuando(plano: string, hoy: string): Cuando {
  const base = new Date(hoy + 'T12:00:00Z')
  let fecha: string | null = null

  if (/\bpasado ma[nñ]ana\b/.test(plano)) {
    const f = new Date(base)
    f.setUTCDate(f.getUTCDate() + 2)
    fecha = aIso(f)
  } else if (/\bma[nñ]ana\b/.test(plano)) {
    const f = new Date(base)
    f.setUTCDate(f.getUTCDate() + 1)
    fecha = aIso(f)
  } else if (/\bhoy\b|\besta tarde\b|\besta noche\b/.test(plano)) {
    fecha = hoy
  }

  // dentro de 3 días · en dos semanas
  if (!fecha) {
    const dentro = plano.match(/\b(?:dentro de|en)\s+(\d+|[a-zñ]+)\s+(dias?|semanas?|meses?)\b/)
    if (dentro) {
      const n = /^\d+$/.test(dentro[1]) ? Number(dentro[1]) : enLetra([dentro[1]])
      if (n && n > 0 && n < 400) {
        const f = new Date(base)
        if (dentro[2].startsWith('dia')) f.setUTCDate(f.getUTCDate() + n)
        else if (dentro[2].startsWith('semana')) f.setUTCDate(f.getUTCDate() + n * 7)
        else f.setUTCMonth(f.getUTCMonth() + n)
        fecha = aIso(f)
      }
    }
  }

  // el martes · el próximo jueves — siempre el que viene, nunca el pasado
  if (!fecha) {
    for (let i = 0; i < 7; i++) {
      const nombre = limpio(DIAS[i])
      if (new RegExp(`\\b(?:el |este |proximo |el proximo )?${nombre}\\b`).test(plano)) {
        const f = new Date(base)
        const salto = (i - f.getUTCDay() + 7) % 7 || 7
        f.setUTCDate(f.getUTCDate() + salto)
        fecha = aIso(f)
        break
      }
    }
  }

  // el 5 de septiembre · el 12 de noviembre de 2027
  if (!fecha) {
    const conMes = plano.match(
      new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MESES.map(limpio).join('|')})(?:\\s+de\\s+(\\d{4}))?`)
    )
    if (conMes) {
      const dia = Number(conMes[1])
      const mes = MESES.map(limpio).indexOf(conMes[2])
      const anio = conMes[3] ? Number(conMes[3]) : base.getUTCFullYear()
      const f = new Date(Date.UTC(anio, mes, dia, 12))

      /* Sin año, si ese día ya pasó se entiende el del año que viene:
         "el 5 de enero" dicho en diciembre no es el de hace once meses. */
      if (!conMes[3] && aIso(f) < hoy) f.setUTCFullYear(anio + 1)
      if (!Number.isNaN(f.getTime())) fecha = aIso(f)
    }
  }

  // 12/11/2026
  if (!fecha) {
    const barras = plano.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
    if (barras) {
      let anio = barras[3] ? Number(barras[3]) : base.getUTCFullYear()
      if (anio < 100) anio += 2000
      const f = new Date(Date.UTC(anio, Number(barras[2]) - 1, Number(barras[1]), 12))
      if (!Number.isNaN(f.getTime())) fecha = aIso(f)
    }
  }

  return { fecha, hora: laHora(plano) }
}

function laHora(plano: string): string | null {
  // a las 10:30 · a las 10.30
  const conMinutos = plano.match(/\ba las\s+(\d{1,2})[:.](\d{2})/)
  if (conMinutos) return ajustar(Number(conMinutos[1]), Number(conMinutos[2]), plano)

  // a las diez y media · a las 10 y cuarto
  const conCuarto = plano.match(/\ba las\s+(\d{1,2}|[a-zñ]+)(?:\s+y\s+(media|cuarto))?/)
  if (conCuarto) {
    const h = /^\d+$/.test(conCuarto[1]) ? Number(conCuarto[1]) : enLetra([conCuarto[1]])
    if (h !== null && h >= 0 && h <= 23) {
      const m = conCuarto[2] === 'media' ? 30 : conCuarto[2] === 'cuarto' ? 15 : 0
      return ajustar(h, m, plano)
    }
  }

  return null
}

/*
  "A las diez" en una casa quiere decir las diez de la mañana; "a las
  ocho de la tarde", las veinte. Sin esto, una cita de la tarde se
  apuntaría de madrugada — y el aviso sonaría cuando ya no sirve.
*/
function ajustar(h: number, m: number, plano: string): string {
  const tarde = /\bde la (tarde|noche)\b|\bpor la (tarde|noche)\b/.test(plano)
  if (tarde && h < 12) h += 12
  return `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ── Cada cuánto vuelve ────────────────────────────────────
function laRepeticion(plano: string): Tarea['repite'] {
  if (/\btodos los dias\b|\bcada dia\b|\bdiariamente\b|\btodas las (ma[nñ]anas|tardes|noches)\b|\bcada (ma[nñ]ana|tarde|noche)\b/.test(plano)) return 'diaria'
  if (/\btodas las semanas\b|\bcada semana\b|\btodos los (lunes|martes|miercoles|jueves|viernes|sabados?|domingos)\b/.test(plano)) return 'semanal'
  if (/\btodos los meses\b|\bcada mes\b|\bmensualmente\b/.test(plano)) return 'mensual'
  if (/\btodos los a[nñ]os\b|\bcada a[nñ]o\b|\banualmente\b/.test(plano)) return 'anual'
  return null
}

/*
  ── De qué tarea hablan ───────────────────────────────────

  "Borra lo de la farmacia" tiene que dejar "farmacia". Se quitan los
  verbos, los artículos y el relleno, y queda lo que de verdad estaría
  escrito en el título de la tarea.

  Si no queda nada con sustancia, se devuelve vacío — y entonces HUBI
  pregunta cuál en vez de adivinar. Borrar la tarea equivocada es peor
  que no borrar ninguna.
*/
const RELLENO_CUAL = [
  'borra', 'borrar', 'borrame', 'elimina', 'eliminar', 'quita', 'quitar',
  'anula', 'anular', 'cancela', 'cancelar', 'cambia', 'cambiar', 'cambiame',
  'cambialo', 'cambiala', 'corrige', 'corregir', 'modifica', 'modificar',
  'mueve', 'muevelo', 'muevela', 'pasalo', 'pasala', 'adelanta', 'retrasa',
  'aplaza', 'olvidate', 'deshazte', 'tira',
  'la', 'el', 'lo', 'los', 'las', 'de', 'del', 'que', 'ya', 'no', 'hace',
  'falta', 'hay', 'un', 'una', 'tarea', 'cita', 'recordatorio', 'aviso',
  'eso', 'esa', 'ese', 'aquello', 'mejor', 'para', 'a', 'al', 'y', 'en',
  'vez', 'me', 'se', 'es', 'era', 'mi', 'su',
  /* Las palabras de la hora y del día dicen CUÁNDO se quiere dejar la
     tarea, no CUÁL es. Coladas en la búsqueda, "lo de Silvia a las
     seis" buscaría una tarea que dijera "seis" y no encontraría la de
     Silvia. */
  'las', 'los', 'hora', 'horas', 'media', 'cuarto', 'menos', 'tarde',
  'noche', 'mediodia', 'punto',
  'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
  'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
  'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
  'proximo', 'proxima', 'siguiente', 'semana', 'mes', 'dia',
]

function deCual(plano: string): string | null {
  const palabras = plano
    .replace(/[¿?¡!.,;:]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !RELLENO_CUAL.includes(p))
    /* Los días y las horas dicen CUÁNDO se quiere dejar, no CUÁL es.
       "Cambia lo del médico al jueves": la tarea es "médico", no
       "médico jueves" — y buscando las dos no se encontraría. */
    .filter((p) => !/^(hoy|manana|ayer|lunes|martes|miercoles|jueves|viernes|sabado|domingo)$/.test(p))
    .filter((p) => !/^\d/.test(p))
    .filter((p) => p.length > 2)

  const cual = palabras.join(' ').trim()
  return cual.length >= 3 ? cual : null
}

/*
  ── Hasta cuándo se repite ────────────────────────────────

  "Todos los días durante dos semanas", "cada lunes hasta fin de mes".
  Solo se saca si LO DICEN. Sin final, se repite para siempre — que es
  lo normal en una casa: el agua, la basura y regar no se acaban.
*/
function hastaCuando(plano: string, hoy: string): string | null {
  const desde = new Date(hoy + 'T12:00:00Z')

  /* "durante una semana", "por dos meses", "solo durante 10 dias".
     "por" solo cuenta si va seguido de un número: "por la mañana" no
     es una duración. */
  const durante = plano.match(
    /(?:durante|por|en) (\d{1,3}|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez) (dias?|semanas?|meses?|a[nñ]os?)/
  )
  if (durante) {
    const CIFRAS: Record<string, number> = {
      un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
      seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    }
    const n = CIFRAS[durante[1]] ?? Number(durante[1])
    if (Number.isFinite(n) && n > 0) {
      const f = new Date(desde)
      if (durante[2].startsWith('dia')) f.setUTCDate(f.getUTCDate() + n)
      else if (durante[2].startsWith('semana')) f.setUTCDate(f.getUTCDate() + n * 7)
      else if (durante[2].startsWith('mes')) f.setUTCMonth(f.getUTCMonth() + n)
      else f.setUTCFullYear(f.getUTCFullYear() + n)
      return f.toISOString().slice(0, 10)
    }
  }

  /* "solo esta semana" — acaba el domingo. Es de las formas más
     naturales de poner un final y no estaba contemplada. */
  if (/\b(solo |unicamente )?esta semana\b/.test(plano)) {
    const f = new Date(desde)
    f.setUTCDate(f.getUTCDate() + ((7 - ((f.getUTCDay() + 6) % 7) - 1) % 7))
    return f.toISOString().slice(0, 10)
  }

  if (/hasta (fin|final) de mes|hasta (el )?(fin|final) del mes/.test(plano)) {
    const f = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 0, 12))
    return f.toISOString().slice(0, 10)
  }

  if (/hasta (fin|final) de a[nñ]o/.test(plano)) {
    return `${desde.getUTCFullYear()}-12-31`
  }

  /* "hasta el 30 de octubre". Se reutiliza el lector de fechas de
     siempre sobre el trozo que va detrás de "hasta". */
  const trozo = plano.split(/\bhasta\b/)[1]
  if (trozo) {
    const f = elCuando(trozo.trim(), hoy).fecha
    if (f && f > hoy) return f
  }

  return null
}

/*
  ── Qué hay que comprar ───────────────────────────────────

  "Apunta leche, pan y huevos en la compra" tiene que dar tres cosas,
  no una frase larga. Se quita el andamiaje —"apunta", "en la compra",
  "hay que comprar"— y lo que queda se parte por comas y por "y".
*/
const ANDAMIO_COMPRA = [
  /\b(a|en|de|para)\s+la\s+lista\s+de\s+la\s+compra\b/g,
  /\blista\s+de\s+la\s+compra\b/g,
  /\b(a|en|de|para)\s+la\s+compra\b/g,
  /\b(hay|tenemos|tengo)\s+que\s+comprar\b/g,
  /\bnecesitamos\s+comprar\b/g,
  /\bnos\s+(falta|faltan|hace falta|hacen falta)\b/g,
  /\bse\s+(ha\s+)?acabo?a?d?o?\b/g,
  /\b(apunta|apuntame|anota|a[nñ]ade|agrega|pon|mete|compra|comprar)\b/g,
  /\b(por favor|porfa|tambien|adem[aá]s)\b/g,
]

/*
  ── PARA QUÉ ES LA COMPRA ─────────────────────────────────

  "Abono y semillas PARA LA FINCA". "Toallas PARA LOS HELECHOS".

  Es un dato de la lista entera, no de cada artículo: nadie va al súper
  a comprar dos cosas para la finca y una para la casa en la misma
  frase. Y sin quitarlo de en medio se quedaba pegado al nombre —el
  artículo salía como "Semillas para la finca"—.

  Se busca la SECCIÓN por su nombre, no por una lista escrita aquí: si
  mañana una familia crea "Obras", "para la obra" funcionará sin tocar
  nada.
*/
const RE_DESTINO =
  /\b(?:para|de|en)\s+(?:la|el|los|las)?\s*(finca|huerta|helechos|casa|obra|obras|piso|apartamento|coche|jard[ií]n|animales|perro|gato)\b/g

function elDestino(plano: string, categorias: Categoria[]): string | null {
  /* Primero, contra las secciones que esta familia tiene de verdad.
     Se comparan las RAÍCES, que son las secciones. */
  const raices = categorias.filter((c) => !c.padre_id)
  for (const r of raices) {
    const nombre = limpio(r.nombre)
    const suelto = nombre.replace(/^(los|las|el|la)\s+/, '')
    if (
      new RegExp(`\\b(para|de|en)\\s+(los|las|el|la)?\\s*${suelto}\\b`).test(plano) ||
      new RegExp(`\\b(para|de|en)\\s+${nombre}\\b`).test(plano)
    ) {
      return r.id
    }
  }
  return null
}

/* Las palabras de medida y de cifra, para saber dónde empieza un
   artículo nuevo dentro de un chorro de palabras. */
const MEDIDAS =
  '(?:kilos?|kg|gramos?|g|litros?|l|docenas?|paquetes?|botellas?|latas?|barras?|cajas?|bolsas?|botes?|unidades?|piezas?)'
const CUANTAS =
  '(?:\\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|media|medio)'

function laCompra(frase: string): { que: string; cantidad: string | null }[] {
  let t = ' ' + limpio(frase) + ' '
  for (const r of ANDAMIO_COMPRA) t = t.replace(r, ' ')

  // El destino —"para la finca"— no es un artículo. Se quita.
  t = t.replace(RE_DESTINO, ' ')

  const trozos = t
    .split(/,| y | e |;|\+/)
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const cosas: { que: string; cantidad: string | null }[] = []
  for (const trozo of trozos) {
    for (const suelto of separarSinComas(trozo)) {
      const c = conCantidad(suelto)
      if (c) cosas.push(c)
    }
  }
  return cosas.slice(0, 25)
}

/*
  ── PARTIR UN CHORRO DE PALABRAS SIN COMAS ────────────────

  Aquí estaba el fallo grande. Se partía por comas y por "y", y el
  transcriptor del móvil NO PONE COMAS: al dictar la compra sale
  "leche pan huevos tomates aceite" de un tirón, y eso se guardaba
  como UN artículo con los cinco dentro.

  Ahora se recorre el trozo reconociendo lo que suena a producto —de
  la lista de `comprables.ts`, los de varias palabras primero— y cada
  uno se separa del siguiente.

  Lo que no reconoce NO se tira: se acumula y se emite como su propio
  artículo. Así, decir algo que no está en la lista sigue funcionando;
  lo único que se pierde es que se junte con lo de al lado.

  Si el trozo ya viene corto —tres palabras o menos— se deja tal cual:
  "pan de molde" no hay que partirlo, y la persona que sí puso comas
  merece que se le respeten.
*/
function separarSinComas(trozo: string): string[] {
  const palabras = trozo.split(/\s+/).filter(Boolean)
  if (palabras.length <= 1) return [trozo]

  const salida: string[] = []
  let resto: string[] = []
  let i = 0

  while (i < palabras.length) {
    /* Una cantidad delante ata lo que viene detrás: "dos kilos de
       tomates" es una sola cosa aunque tenga cuatro palabras. */
    const desdeAqui = palabras.slice(i).join(' ')
    const conNumero = desdeAqui.match(
      new RegExp(`^(${CUANTAS}\\s*${MEDIDAS}?)\\s+(?:de\\s+)?(.+)$`)
    )

    let encajado: string | null = null

    if (conNumero) {
      const loQueSigue = conNumero[2]
      const producto = alPrincipio(loQueSigue)
      if (producto) {
        encajado = `${conNumero[1]} de ${producto}`.replace(/\s+/g, ' ')
        i += encajado.split(/\s+/).length - (encajado.includes(' de ') ? 0 : 0)
        // Se avanza por lo consumido de verdad: cantidad + producto.
        i = palabras.length - loQueSigue.split(/\s+/).length + producto.split(/\s+/).length
      }
    }

    if (!encajado) {
      const producto = alPrincipio(palabras.slice(i).join(' '))
      if (producto) {
        encajado = producto
        i += producto.split(/\s+/).length
      }
    }

    if (encajado) {
      if (resto.length) {
        salida.push(resto.join(' '))
        resto = []
      }
      salida.push(encajado)
    } else {
      resto.push(palabras[i])
      i++
    }
  }

  if (resto.length) salida.push(resto.join(' '))

  /*
    Y ahora se vuelve a pegar lo que era un complemento y no un
    artículo nuevo.

    "Pan de molde" se parte en "pan" —que sí está en la lista— y "de
    molde", que se queda suelto. Pero "de molde" no es nada que se
    compre: es parte del pan. Todo trozo que empiece por "de", "con",
    "para" o "sin" vuelve al anterior.
  */
  const juntas: string[] = []
  for (const x of salida) {
    if (juntas.length > 0 && /^(de|del|con|sin|para|al|en)\s/.test(limpio(x))) {
      juntas[juntas.length - 1] += ' ' + x
    } else {
      juntas.push(x)
    }
  }

  return juntas.length > 0 ? juntas : [trozo]
}

/** ¿Empieza esto por algo que se compra? Devuelve ese algo. */
function alPrincipio(texto: string): string | null {
  const plano = limpio(texto)
  for (const producto of COMPRABLES_ORDENADOS) {
    const p = limpio(producto)
    if (plano === p || plano.startsWith(p + ' ')) {
      return texto.split(/\s+/).slice(0, p.split(' ').length).join(' ')
    }
  }
  return null
}

/*
  Separar la cantidad del artículo.

  Antes el patrón era glotón: "dos kilos de tomates un litro de leche"
  daba cantidad "dos kilos" y artículo "tomates un litro de leche". Se
  corta en cuanto aparece otra cantidad.
*/
function conCantidad(x: string): { que: string; cantidad: string | null } | null {
  const m = x.match(new RegExp(`^(${CUANTAS}\\s*${MEDIDAS}?)\\s+de\\s+(.+)$`))
  let que = m ? m[2] : x
  const cantidad = m ? m[1].trim() : null

  // Fuera el artículo: "el aceite" es "Aceite".
  que = que.replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '').trim()
  if (que.length < 2) return null

  return { que: que.replace(/^\w/, (l) => l.toUpperCase()), cantidad }
}

// ── Para quién ────────────────────────────────────────────
function paraQuien(plano: string, personas: { nombre: string }[]): string | null {
  if (/\blos dos\b|\bambos\b|\bambas\b/.test(plano)) return 'los dos'

  for (const p of personas) {
    const pila = limpio(p.nombre).split(' ')[0]
    if (pila.length > 2 && plano.includes(pila)) return p.nombre
  }
  return null
}

// ── Qué hay que hacer ─────────────────────────────────────
/*
  El título es lo que queda al quitar los andamios: quién lo pide, para
  quién es, cuándo, y las muletillas del principio. Lo que sobrevive es
  la acción — que es justo lo que hay que leer en la lista.
*/
const ANDAMIOS = [
  /^\s*(oye|mira|hola)[, ]+/i,
  /\b(recuerdale|recuérdale|recuerdame|recuérdame|recuerda|acuerdate|acuérdate|apunta|ap[uú]ntame|anota|no te olvides de|no se te olvide|hay que|tengo que|tienes que|tenemos que)\b/gi,
  /\b(a|para)\s+(mi|mí|nosotros)\b/gi,
  /\b(por favor|porfa)\b/gi,
  /\bque\s+(me|te|le|nos)\b/gi,
]

function elTitulo(
  frase: string,
  personas: { nombre: string }[],
  cuando: Cuando,
  plano: string
): string {
  let t = frase

  for (const a of ANDAMIOS) t = t.replace(a, ' ')

  /*
    El nombre de la persona y su preposición.

    El nombre COMPLETO primero, y solo después el de pila. Al revés,
    "Recuérdale a Juan Miguel que pase la ITV" quitaba "Juan" y dejaba
    un "Miguel" suelto dentro del título: "Miguel el que pase la ITV".
    Lo pilló la primera prueba con nombres de verdad.
  */
  const nombres = personas
    .flatMap((p) => [p.nombre, p.nombre.split(' ')[0]])
    .filter((n) => n.length > 2)
    .sort((a, b) => b.length - a.length)

  for (const n of nombres) {
    t = t.replace(new RegExp(`\\b(a|para)?\\s*${n}\\b`, 'gi'), ' ')
  }
  t = t.replace(/\b(a|para)\s+los dos\b/gi, ' ')

  // Lo que ya se ha entendido como fecha, hora o repetición
  t = t
    .replace(/\b(el|este|proximo|próximo)?\s*(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi, ' ')
    .replace(/\b(pasado ma[nñ]ana|ma[nñ]ana|hoy|esta tarde|esta noche)\b/gi, ' ')
    .replace(/\b(dentro de|en)\s+\w+\s+(d[ií]as?|semanas?|meses?)\b/gi, ' ')
    .replace(/\b\d{1,2}\s+de\s+[a-zñáéíóú]+(\s+de\s+\d{4})?\b/gi, ' ')
    .replace(/\ba las\s+[\w:.]+(\s+y\s+(media|cuarto))?/gi, ' ')
    .replace(/\b(de|por) la (ma[nñ]ana|tarde|noche)\b/gi, ' ')
    .replace(/\b(todos los|todas las|cada)\s+\w+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Conectores que se quedan colgando al principio
  t = t.replace(/^\s*(que|de|a|el|la|los|las|y|,)\s+/i, '').trim()
  t = t.replace(/^[,;.\s]+|[,;.\s]+$/g, '')

  if (t.length < 3) {
    // No ha quedado nada aprovechable: mejor la frase entera que un
    // título vacío. Lo dicho no se tira nunca.
    return frase.trim()
  }

  return t.charAt(0).toUpperCase() + t.slice(1)
}

// ── La categoría, por su nombre ───────────────────────────
function laCategoria(plano: string, categorias: Categoria[]): string | null {
  /* De más largo a más corto: "obras y mejoras" tiene que ganar a
     "obras" cuando las dos existen. */
  const ordenadas = [...categorias].sort((a, b) => b.nombre.length - a.nombre.length)

  for (const c of ordenadas) {
    const nombre = limpio(c.nombre)
    if (nombre.length > 3 && plano.includes(nombre)) return c.id
  }

  /*
    Y si no, por una palabra suya.

    La carpeta se llama "Ventas cooperativa" pero nadie dice eso
    hablando: dice "de la cooperativa". Se prueba con cada palabra
    larga del nombre, de la más larga a la más corta, para que gane la
    más específica.
  */
  const sueltas = ordenadas
    .flatMap((c) => limpio(c.nombre).split(/\s+/).map((w) => ({ w, id: c.id })))
    .filter((x) => x.w.length > 5)
    .sort((a, b) => b.w.length - a.w.length)

  for (const x of sueltas) {
    if (plano.includes(x.w)) return x.id
  }

  return null
}

// ── Todo junto ────────────────────────────────────────────
export function entenderFrase(opciones: {
  frase: string
  pista?: Entendido['accion']
  personas: { nombre: string }[]
  categorias: Categoria[]
  hoy: string
}): Entendido {
  const frase = opciones.frase.trim()
  const plano = limpio(frase)

  let accion = opciones.pista ?? queQuiere(plano)

  /*
    PREGUNTAR POR LA AGENDA, DICHO COMO SE DICE.

    Con una lista de frases hechas no basta: entre "qué tengo" y
    "mañana" cabe cualquier cosa —"qué tengo PROGRAMADO PARA mañana",
    "qué hay PUESTO el martes"— y cada variante que no esté escrita
    aquí se cae a "recordatorio", que además INTENTA APUNTAR la
    pregunta como si fuera una tarea. Eso es lo peor: no solo no
    contesta, encima ensucia la agenda.

    Con un patrón se cubren todas: alguna forma de "qué tengo / qué
    hay / qué toca" seguida, más adelante en la frase, de un día o de
    la palabra agenda.
  */
  if (!opciones.pista && PREGUNTA_POR_LA_AGENDA.test(plano)) accion = 'consulta'

  /*
    UNA PREGUNTA NO PUEDE ACABAR SIENDO UNA CITA.

    Es el peor fallo posible de esta pantalla y estaba pasando: "dime
    los ingresos previstos de Los Helechos tres" no encajaba en ninguna
    señal de consulta, se caía a "recordatorio" y HUBI APUNTABA LA
    PREGUNTA EN EL CALENDARIO. No solo no contestaba: ensuciaba la
    agenda con una cita que nadie había pedido y que hay que borrar a
    mano.

    La regla es sencilla y no necesita listar cada frase posible: si
    empieza pidiendo información —dime, dame, cuánto, cuál, qué— y
    nombra algo que HUBI guarda —ingresos, gastos, balance, facturas,
    la compra, la agenda—, es una pregunta. Nunca una tarea.
  */
  if (!opciones.pista && ES_UNA_PREGUNTA.test(plano)) accion = 'consulta'

  /*
    LA COMPRA DICHA SIN DECIR "COMPRA".

    "Apunta para Los Helechos toallas y sábanas" no lleva ninguna de
    las señales de la compra, así que caía en "recordatorio" y se
    convertía en una tarea con siete palabras raras.

    Si lo dicho son DOS O MÁS cosas que se compran, es una lista de la
    compra.

    ANTES SE EXIGÍA ADEMÁS QUE NO HUBIERA FECHA, y eso dejó de valer:
    ahora una compra puede llevar cuándo se va —"apunta leche y pan, y
    voy el sábado"— y la fecha es de la ida al súper, no de cada
    artículo. Con la regla vieja, decir la compra Y el día convertía
    todo en una tarea con siete palabras raras dentro… y sin la lista.

    Lo que manda es si se nombran COSAS QUE COMPRAR. Si no se nombra
    ninguna, "el jueves compra pan" sigue siendo una tarea.
  */
  if (!opciones.pista && accion === 'recordatorio') {
    const reconocidas = laCompra(opciones.frase).filter((c) =>
      COMPRABLES_ORDENADOS.some((x) => limpio(c.que).startsWith(limpio(x)))
    )
    if (reconocidas.length >= 2) accion = 'compra'
  }
  const cuando = elCuando(plano, opciones.hoy)
  const importe = elImporte(plano)
  const categoria_id = laCategoria(plano, opciones.categorias)

  const tareas: Tarea[] =
    accion === 'recordatorio'
      ? [
          {
            titulo: elTitulo(frase, opciones.personas, cuando, plano),
            nota: null,
            para: paraQuien(plano, opciones.personas),
            fecha: cuando.fecha,
            hora: cuando.hora,
            repite: laRepeticion(plano),
            repite_hasta: hastaCuando(plano, opciones.hoy),
          },
        ]
      : []

  /* Las palabras que sirven para buscar: se quitan los verbos de
     petición y el relleno, que no están escritos en ningún papel. */
  const busqueda =
    accion === 'buscar'
      ? plano
          .replace(/\b(busca|buscame|encuentra|ensename|muestrame|muestra|sacame|donde esta|donde estan|la|el|los|las|de|del|un|una|ultima|ultimo|todas|todos|papeles?|documentos?|factura de)\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() || null
      : null

  const periodo = /\btrimestre\b/.test(plano)
    ? 'trimestre'
    : /\ba[nñ]o\b/.test(plano)
      ? 'anio'
      : /\bmes\b/.test(plano)
        ? 'mes'
        : null

  const tipo_consulta = queSePregunta(plano)

  return {
    transcripcion: frase,
    tareas,
    accion,
    cual: accion === 'cambiar' || accion === 'borrar' ? deCual(plano) : null,
    compra: accion === 'compra' ? laCompra(frase) : [],
    compra_seccion: accion === 'compra' ? elDestino(plano, opciones.categorias) : null,
    repite: accion === 'cambiar' ? laRepeticion(plano) : null,
    repite_hasta: null,
    titulo: tareas[0]?.titulo ?? null,
    nota: null,
    para: tareas[0]?.para ?? null,
    fecha: cuando.fecha,
    hora: cuando.hora,
    importe,
    concepto: null,
    categoria_id,
    busqueda,
    periodo: accion === 'consulta' ? (periodo ?? 'trimestre') : null,
    tipo_consulta: accion === 'consulta' ? tipo_consulta : null,
    /*
      Nunca "alta".

      Esto acierta lo que acierta, y quien lo lea en pantalla tiene que
      saber que conviene repasarlo. Decir que se está muy seguro cuando
      se ha adivinado con reglas sería mentir justo en el sitio donde
      la persona decide si mirar o no mirar.
    */
    confianza: 'media',
  }
}

/*
  ¿Por qué se está preguntando?

  El orden importa y no es casual: lo MÁS ESPECÍFICO primero. "Cuánto
  he gastado en la compra del súper" lleva la palabra "compra", pero es
  una pregunta de dinero — por eso el dinero se mira antes que la
  lista. Al revés, contestaría con la lista de la compra a alguien que
  ha preguntado por sus gastos.
*/
/*
  "qué tengo programado para mañana", "dime qué hay puesto el martes",
  "qué nos toca esta semana". Lo de en medio da igual: lo que identifica
  la pregunta es el par —qué tengo/hay/toca … + un día o la agenda—.
*/
/*
  Pedir información sobre algo guardado.

  Dos mitades: la forma de pedir y la cosa pedida. Las dos tienen que
  estar, y en ese orden. "Apunta un ingreso de la finca" no la cumple
  —no empieza pidiendo—, y sigue siendo un apunte.
*/
const ES_UNA_PREGUNTA =
  /\b(dime|dinos|dame|ensename|cuanto|cuanta|cuantos|cuantas|cual|cuales|que tal|como va|como vamos)\b[\s\S]{0,50}\b(ingreso\w*|gasto\w*|balance|cuenta\w*|factura\w*|recibo\w*|papel\w*|documento\w*|poliza\w*|compra\w*|lista\w*|agenda|calendario|reserva\w*|noches?|beneficio\w*|rentabilidad)\b/

const PREGUNTA_POR_LA_AGENDA =
  /\b(que|dime)\b[\s\S]{0,30}\b(tengo|tenemos|tienes|hay|toca|tocan)\b[\s\S]{0,40}\b(hoy|manana|agenda|calendario|programad\w*|previst\w*|puest\w*|apuntad\w*|semana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/

function queSePregunta(
  plano: string
): 'gasto' | 'ingreso' | 'balance' | 'papel' | 'compra' | 'agenda' {
  /*
    1 · DINERO, Y VA PRIMERO A PROPÓSITO.

    "Dime los ingresos PREVISTOS de Los Helechos" lleva la palabra
    "previstos", que también es de la agenda. Si la agenda se mirara
    antes, contestaría con las citas del día a quien ha preguntado por
    sus cuentas. Lo específico manda: si se nombra dinero, es dinero.
  */
  /* "la cooperativa" es donde VENDEN, así que preguntar por ella es
     preguntar por ingresos. Sin esto, "cuánto llevamos de la
     cooperativa" contestaba con los gastos. */
  if (/\bingreso|ingresos|cobrado|cobros|vendido|ventas|cooperativa|alquiler|reservas?\b/.test(plano)) {
    return 'ingreso'
  }
  if (/\bbalance|como vamos|beneficio|rentabilidad\b/.test(plano)) return 'balance'
  if (/\bgasto|gastos|gastado|cuesta|costado\b/.test(plano)) return 'gasto'
  if (/\bcuanto (hemos|he|llevamos|se ha)\b/.test(plano)) return 'gasto'

  // 2 · Un papel guardado.
  if (/\bfactura|papel|documento|poliza|recibo|justificante\b/.test(plano)) return 'papel'

  // 3 · La lista de la compra.
  if (/\bcompra|comprar|lista\b/.test(plano)) return 'compra'

  // 4 · La agenda: qué hay que hacer un día.
  if (/\bcalendario|agenda|hoy|manana|semana|toca|programad|previst|puest|apuntad|lunes|martes|miercoles|jueves|viernes|sabado|domingo\b/.test(plano)) {
    return 'agenda'
  }

  return 'gasto'
}
