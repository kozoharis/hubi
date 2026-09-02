import type { Lectura } from '@/lib/ocr'
import { leerReserva } from '@/lib/reservas'

/*
  Entender un papel sin preguntarle a nadie.

  Esto es lo que antes hacía la IA. La sorpresa, al mirarlo de cerca,
  es cuánto de aquello no necesitaba una IA para nada:

  - El importe es un número con un € al lado, casi siempre debajo de
    la palabra TOTAL.
  - La fecha es un patrón de día, mes y año.
  - Y el proveedor y su carpeta salen de MIRAR LO QUE YA HABÉIS
    GUARDADO. En una casa son siempre las mismas cinco o seis empresas
    mandando el mismo papel cada mes. Si ENDESA ha ido doce veces a
    Finca → Gastos → Luz, no hay nada que deducir: ya está decidido.

  Eso significa que la primera factura de cada empresa la clasificas
  tú, y a partir de esa, sola. HUBI no se vuelve más listo porque le
  pongamos un modelo mejor: se vuelve más listo porque vosotros lo
  usáis. Y nada de esto sale del servidor.

  Cuando no da con algo, no inventa: lo deja vacío y la persona lo
  rellena en la pantalla de siempre. Es exactamente lo que ya pasaba
  cuando la IA no se aclaraba.
*/

export type Conocido = {
  proveedor: string
  categoria_id: string
  veces: number
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/* Empresas y organismos que aparecen en casi cualquier casa española.
   Solo sirven de arranque: en cuanto guardáis un papel de alguien que
   no está aquí, ese alguien pasa a estar en vuestra propia lista. */
const DE_SIEMPRE = [
  'endesa', 'iberdrola', 'naturgy', 'repsol', 'holaluz', 'totalenergies',
  'movistar', 'vodafone', 'orange', 'yoigo', 'digi', 'jazztel',
  'mapfre', 'axa', 'allianz', 'zurich', 'generali', 'linea directa',
  'mutua madrileña', 'sanitas', 'adeslas', 'asisa', 'dkv', 'caser',
  'canal de isabel ii', 'aqualia', 'emasa', 'hidraqua', 'aguas',
  'seguridad social', 'agencia tributaria', 'hacienda', 'catastro',
  'iberia', 'correos', 'itv',
]

const TIPOS: { clave: string; palabras: string[] }[] = [
  { clave: 'Factura', palabras: ['factura', 'facturación', 'periodo de consumo'] },
  /* Un ticket de tienda. No es una factura —no lleva ni cliente ni
     NIF del comprador— y hasta ahora se quedaba sin tipo, con lo que
     ni siquiera se le exigía tener importe. */
  { clave: 'Ticket', palabras: ['ud', 'unidades', 'precio', 'articulo', 'artículo', 'caja', 'tarjeta', 'efectivo', 'gracias por su compra', 'ticket', 'devoluciones'] },
  { clave: 'Recibo', palabras: ['recibo', 'justificante de pago', 'domiciliado'] },
  { clave: 'Póliza', palabras: ['póliza', 'poliza', 'condiciones particulares', 'asegurado', 'prima'] },
  { clave: 'Informe médico', palabras: ['informe', 'diagnóstico', 'paciente', 'servicio de', 'consulta externa'] },
  { clave: 'Receta', palabras: ['receta', 'prescripción', 'posología'] },
  { clave: 'Contrato', palabras: ['contrato', 'cláusula', 'clausula', 'las partes'] },
  { clave: 'ITV', palabras: ['inspección técnica', 'itv', 'ficha técnica'] },
  /* Va el último: un billete lleva muchas palabras que suenan a otras
     cosas, y solo debe ganar si no encaja nada más concreto. */
  { clave: 'Billete', palabras: ['billete', 'embarque', 'pasajeros', 'localizador', 'vuelo', 'trayecto'] },
]

function limpio(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/*
  ¿Aparece esta palabra ENTERA?

  Antes se usaba `includes` a secas, y eso busca trozos. Con un billete
  de barco de verdad, "digi" —la compañía de teléfono— apareció dentro
  de "digital", y HUBI dijo que el proveedor del billete era Digi. Lo
  mismo hacía "prima" dentro de "primera", que convertía cualquier
  papel en una póliza de seguros.

  Un nombre suelto dentro de otra palabra no significa nada. Se pide
  que esté rodeado de algo que no sea letra ni número.
*/
function contienePalabra(texto: string, palabra: string): boolean {
  const p = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9ñ])${p}($|[^a-z0-9ñ])`).test(texto)
}

/** ¿Está esta palabra cerca de esta posición? */
function cerca(texto: string, palabras: string[], donde: number, radio = 90): boolean {
  const trozo = texto.slice(Math.max(0, donde - radio), donde + radio)
  return palabras.some((p) => trozo.includes(p))
}

/*
  Igual, pero mirando SOLO hacia atrás.

  En un papel, la etiqueta va delante del dato: "Fecha de emisión:
  14/08/2026". Mirando a los dos lados, la palabra "fecha" de una línea
  se cuela en la siguiente y todo parece una fecha de emisión.

  Pasó de verdad en la primera prueba: una factura de Endesa se fechó
  el 1 de julio —el inicio del periodo de consumo— en vez del 14 de
  agosto. No es un detalle: la fecha decide el trimestre, y el
  trimestre decide en qué carpeta de Drive acaba y en qué columna de
  las cuentas de la finca suma.
*/
function justoAntes(texto: string, palabras: string[], donde: number, largo = 46): boolean {
  const trozo = texto.slice(Math.max(0, donde - largo), donde)
  return palabras.some((p) => trozo.includes(p))
}

// ── El dinero ─────────────────────────────────────────────
/*
  Se buscan todos los números con pinta de euros y gana el que esté
  al lado de la palabra TOTAL. Si ninguno lo está, gana el mayor:
  en una factura el total siempre es la cifra más grande de la hoja.

  Ojo con el formato español — 1.234,56 son mil doscientos y pico, no
  uno coma veintitrés. Confundirlos metería un gasto de un euro donde
  había mil.
*/
function elImporte(texto: string, plano: string): number | null {
  const patron = /(\d{1,3}(?:[.\s]\d{3})*|\d+)[,.](\d{2})\s*(?:€|eur|euros)?/g
  const candidatos: { valor: number; donde: number; conEuro: boolean }[] = []

  for (const m of texto.matchAll(patron)) {
    const entera = m[1].replace(/[.\s]/g, '')
    const valor = Number(`${entera}.${m[2]}`)
    if (!Number.isFinite(valor) || valor <= 0 || valor > 500_000) continue

    candidatos.push({
      valor,
      donde: m.index ?? 0,
      conEuro: /€|eur/i.test(m[0]),
    })
  }

  if (candidatos.length === 0) return null

  /*
    Por puntos, no por tamaño.

    Antes ganaba el MAYOR de los que tuvieran cerca "total" o
    "importe". Con un billete de barco eso falló feo: el papel decía
    "Importe 16,34 €" y también "El importe de las tasas es de
    26,98 €". Los dos llevaban la palabra "importe" al lado, así que
    ganaba el más grande — y HUBI apuntó las tasas como si fuera lo
    pagado.

    Ahora cada cifra suma o resta según lo que tiene escrito JUSTO
    DELANTE. "Total" pesa más que "importe", y todo lo que suena a
    trozo de la cuenta —tasas, IVA, base imponible, descuento— resta.
    Es la misma idea que ya se usa con las fechas.
  */
  const puntuados = candidatos.map((c) => {
    let p = 0
    if (justoAntes(plano, ['total', 'total a pagar', 'importe total'], c.donde, 40)) p += 5
    if (justoAntes(plano, ['a pagar', 'a abonar', 'liquido', 'cargo realizado'], c.donde, 46)) p += 3
    if (justoAntes(plano, ['importe', 'precio', 'cuota', 'prima'], c.donde, 34)) p += 2
    if (justoAntes(plano, ['tasa', 'tasas', 'iva', 'igic', 'impuesto', 'base imponible',
                           'descuento', 'subvencion', 'retencion', 'comision', 'unidades',
                           'alquiler', 'subtotal'], c.donde, 46)) p -= 4
    if (c.conEuro) p += 1
    return { ...c, p }
  })

  const mejorPunto = Math.max(...puntuados.map((c) => c.p))
  const finalistas = puntuados.filter((c) => c.p === mejorPunto)

  // A igualdad de razones, la cifra mayor: el total de una factura
  // siempre es más grande que cualquiera de sus partes.
  return finalistas.reduce((a, b) => (b.valor > a.valor ? b : a)).valor
}

// ── Las fechas ────────────────────────────────────────────
type Fechada = { iso: string; donde: number }

function lasFechas(texto: string, plano: string): Fechada[] {
  const encontradas: Fechada[] = []

  // 14/08/2026 · 14-08-26 · 14.08.2026
  for (const m of texto.matchAll(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g)) {
    const iso = armar(Number(m[1]), Number(m[2]), Number(m[3]))
    if (iso) encontradas.push({ iso, donde: m.index ?? 0 })
  }

  // 2026-08-14
  for (const m of texto.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const iso = armar(Number(m[3]), Number(m[2]), Number(m[1]))
    if (iso) encontradas.push({ iso, donde: m.index ?? 0 })
  }

  // 14 de agosto de 2026
  const conLetra = new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MESES.join('|')})\\s+de\\s+(\\d{4})`, 'g')
  for (const m of plano.matchAll(conLetra)) {
    const iso = armar(Number(m[1]), MESES.indexOf(m[2]) + 1, Number(m[3]))
    if (iso) encontradas.push({ iso, donde: m.index ?? 0 })
  }

  return encontradas
}

/*
  En España es día/mes/año. 03/09/2026 es el 3 de septiembre, no el 9
  de marzo. Leerlo al revés cambiaría el trimestre de una factura y
  descuadraría las cuentas de la finca sin que nadie sepa por qué.
*/
function armar(dia: number, mes: number, anio: number): string | null {
  if (anio < 100) anio += anio > 70 ? 1900 : 2000
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  if (anio < 1990 || anio > 2100) return null

  const f = new Date(Date.UTC(anio, mes - 1, dia, 12))
  if (f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null

  return f.toISOString().slice(0, 10)
}

// ── Quién lo manda ────────────────────────────────────────
function elProveedor(plano: string, conocidos: Conocido[]): string | null {
  /* Primero los vuestros, del más usado al menos: si "aguas" aparece
     en dos sitios, gana el que ya habéis archivado veinte veces. */
  const mios = [...conocidos].sort((a, b) => b.veces - a.veces)

  for (const c of mios) {
    if (contienePalabra(plano, limpio(c.proveedor))) return c.proveedor
  }

  for (const nombre of DE_SIEMPRE) {
    if (contienePalabra(plano, nombre)) {
      return nombre.replace(/\b\w/g, (l) => l.toUpperCase())
    }
  }

  return null
}

/*
  El que emite, cuando no lo conocemos de nada.

  Casi todas las facturas llevan arriba del todo quién las manda:
  "PIENSOS AGUAMANSA, S.L.". No hace falta reconocer el nombre — basta
  con leer las primeras líneas y quedarse con la que tiene pinta de
  empresa y no de etiqueta.

  Esto importa más de lo que parece, porque es la PRIMERA factura de
  cada proveedor: la vez que la persona le enseña a HUBI dónde va. Si
  el nombre ya viene puesto, solo tiene que elegir carpeta. Y desde la
  segunda, HUBI lo reconoce por su cuenta.
*/
const NO_ES_EMPRESA = [
  'factura', 'fecha', 'original', 'copia', 'codigo', 'descripcion',
  'cliente', 'total', 'subtotal', 'importe', 'base imponible', 'iva',
  'igic', 'nif', 'cif', 'direccion', 'telefono', 'presupuesto', 'albaran',
  'recibo', 'numero', 'pagina',
]

/*
  ¿Esto se puede pronunciar?

  Un reconocedor de texto, cuando mira algo que no es texto —el dibujo
  de un mantel, una arruga, una sombra— no devuelve nada: devuelve
  letras al azar. Y las letras al azar no forman palabras: salen
  cuatro consonantes seguidas, o ninguna vocal.

  Ninguna palabra española tiene cuatro consonantes seguidas. Es una
  regla del idioma, no un parche para este ticket — y por eso vale
  igual para el siguiente.
*/
function sePuedePronunciar(linea: string): boolean {
  const palabras = linea
    .split(/\s+/)
    .map((p) => p.replace(/[^a-záéíóúñA-ZÁÉÍÓÚÑ]/g, ''))
    .filter((p) => p.length >= 4)

  if (palabras.length === 0) return false

  return palabras.some((bruta) => {
    const p = limpio(bruta)
    if (/[bcdfghjklmnpqrstvwxyz]{4,}/.test(p)) return false
    const vocales = (p.match(/[aeiou]/g) ?? []).length
    return vocales >= p.length * 0.25
  })
}

function elQueLoEmite(texto: string): string | null {
  const lineas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8)

  for (const linea of lineas) {
    if (linea.length < 4 || linea.length > 44) continue

    const suave = limpio(linea)
    if (NO_ES_EMPRESA.some((p) => suave.startsWith(p))) continue

    // Una línea de cifras o de códigos no es el nombre de nadie.
    const letras = (linea.match(/[a-záéíóúñA-ZÁÉÍÓÚÑ]/g) ?? []).length
    if (letras < linea.length * 0.5) continue

    /*
      Y TAMPOCO LO ES UN MONTÓN DE RUIDO.

      Aquí se colaba lo peor que puede pasar. En la foto de un ticket
      encima de un mantel estampado, la primera línea que sale del
      reconocedor no es el comercio: son los dibujos del mantel
      convertidos en letras sueltas. "EF» PO PI" pasaba todas las
      comprobaciones —bastantes letras, todo mayúsculas— y se guardaba
      como el nombre de la tienda.

      Y lo grave no era el nombre feo: era que, con un proveedor
      "encontrado", HUBI se creía que había leído bien el papel y NO
      pedía ayuda. Un dato inventado tapaba el fallo entero.

      Un nombre de verdad tiene una palabra seguida de cuatro letras
      como mínimo —"Endesa", "Stradivarius", "Mapfre"— y no lleva
      símbolos raros por medio.
    */
    if (!/[a-záéíóúñA-ZÁÉÍÓÚÑ]{4,}/.test(linea)) continue
    if (/[»«|_~^*<>{}[\]\\/]/.test(linea)) continue

    /* Muchas palabras de una o dos letras seguidas es ruido, no un
       nombre: "Ef Po Pi", "A o e e o SS". */
    const palabras = linea.split(/\s+/).filter(Boolean)
    const cortas = palabras.filter((p) => p.replace(/[^a-záéíóúñA-ZÁÉÍÓÚÑ]/g, '').length <= 2)
    if (palabras.length >= 3 && cortas.length > palabras.length / 2) continue

    /* Y que se pueda pronunciar. En español no hay palabras con cuatro
       consonantes seguidas ni sin vocales: "Qdbxiea" no es el nombre
       de ninguna tienda, es el mantel de la mesa leído como letras. */
    if (!sePuedePronunciar(linea)) continue

    /* Las empresas se escriben en mayúsculas en casi todas las
       facturas, y además suelen llevar su forma jurídica detrás. */
    const enMayusculas = linea === linea.toUpperCase()
    const conForma = /\b(s\.?l\.?u?|s\.?a\.?|c\.?b\.?|s\.?c\.?|sociedad)\b/i.test(linea)

    if (enMayusculas || conForma) {
      // Se quita la coma y la forma jurídica: "Piensos Aguamansa".
      const limpia = linea
        .replace(/[,.]?\s*(s\.?l\.?u?|s\.?a\.?|c\.?b\.?|s\.?c\.?)\.?\s*$/i, '')
        .trim()

      if (limpia.length >= 4) {
        return limpia
          .toLowerCase()
          .replace(/(^|\s)\w/g, (l) => l.toUpperCase())
      }
    }
  }

  return null
}

export function entenderPapel(
  texto: string,
  conocidos: Conocido[]
): Lectura {
  const plano = limpio(texto)

  /*
    ¿Es una reserva de Los Helechos?

    Se mira lo primero porque una captura de Airbnb no se parece nada
    a una factura: no tiene emisor, ni CIF, ni "TOTAL" debajo de una
    tabla. Leerla con las reglas de una factura da un resultado malo
    con toda la seguridad del mundo.

    Si lo es, manda ella en el importe y en el título. Si no —el 95%
    de los papeles de una casa— aquí no ha pasado nada y se sigue
    como siempre.
  */
  const reserva = leerReserva(texto)

  const importe = elImporte(texto, plano)
  const fechas = lasFechas(texto, plano)

  /*
    La fecha del documento, por puntos.

    Filtrar no bastaba: en una factura hay cuatro o cinco fechas y
    varias llevan la palabra "fecha" cerca. Así que cada una suma o
    resta según lo que tenga escrito JUSTO DELANTE, y gana la mejor.

    Restan las del periodo facturado, la del cargo en el banco y la
    del vencimiento: son fechas de verdad, pero no son la del papel.
  */
  const puntos = fechas.map((f) => {
    let p = 0
    if (justoAntes(plano, ['fecha de emision', 'fecha emision', 'fecha factura', 'fecha de factura', 'expedicion', 'fecha de expedicion'], f.donde)) p += 4
    if (justoAntes(plano, ['fecha', 'emitida', 'emision'], f.donde, 24)) p += 2
    if (justoAntes(plano, ['periodo', 'consumo', 'desde', 'hasta', 'entre el'], f.donde, 60)) p -= 4
    if (justoAntes(plano, ['cargo', 'domiciliacion', 'pago el', 'cobro'], f.donde, 40)) p -= 3
    if (justoAntes(plano, ['vencimiento', 'vence', 'caduca', 'renovacion', 'efecto'], f.donde, 40)) p -= 3
    return { ...f, p }
  })

  const mejorPunto = puntos.length > 0 ? Math.max(...puntos.map((f) => f.p)) : 0
  const fecha =
    puntos.length > 0
      ? puntos
          .filter((f) => f.p === mejorPunto)
          .map((f) => f.iso)
          .sort()[0]
      : null

  /* El vencimiento solo si el papel lo dice con esas palabras. Nunca
     se deduce: un aviso inventado que salta un martes a las ocho es
     peor que no tener aviso. */
  const deVencimiento = fechas.filter((f) =>
    justoAntes(
      plano,
      ['vencimiento', 'vence el', 'vence', 'caduca', 'caducidad', 'renovacion', 'valido hasta', 'proxima revision', 'proxima itv'],
      f.donde,
      44
    )
  )
  const vencimiento =
    deVencimiento.length > 0 ? deVencimiento.map((f) => f.iso).sort().reverse()[0] : null

  /*
    DOS MANERAS DE SACAR EL PROVEEDOR, Y NO VALEN LO MISMO.

    `elProveedor` lo reconoce: o ya lo habéis archivado antes, o es una
    de las empresas que salen en cualquier casa española. Eso es un
    nombre de verdad.

    `elQueLoEmite` lo DEDUCE de las primeras líneas. Acierta con una
    factura limpia y se equivoca con la foto de un ticket arrugado
    encima de un mantel — de ahí salió "Ef» Po Pi".

    La diferencia se guarda, porque de ella depende algo importante:
    con un nombre deducido, HUBI no puede fiarse de su propia lectura
    y tiene que pedir ayuda. Un dato inventado que tapa un fallo es
    peor que un hueco vacío.
  */
  const reconocido = elProveedor(plano, conocidos)
  const proveedor = reconocido ?? elQueLoEmite(texto)

  const tipo = elTipo(plano)

  /* La carpeta: la que más veces ha usado ese mismo proveedor. Sin
     historia todavía, se queda vacía y la elige la persona — que es
     justo la vez que enseña a HUBI dónde va. */
  /* En una reserva el "proveedor" es la plataforma: es lo que se
     repite reserva tras reserva, y por tanto lo que enseña la carpeta.
     La primera de Airbnb la clasificáis vosotros; de la segunda en
     adelante viene puesta. */
  const deQuien = reserva?.plataforma ?? proveedor

  const suya = deQuien
    ? [...conocidos]
        .filter((c) => limpio(c.proveedor) === limpio(deQuien))
        .sort((a, b) => b.veces - a.veces)[0]
    : undefined

  const titulo = elTitulo(tipo, proveedor, fecha)

  /*
    La confianza, contando lo que de verdad se ha encontrado.

    Es más honesta que la de antes: aquella era la opinión del modelo
    sobre sí mismo. Ésta cuenta datos.
  */
  const aciertos = [importe, fecha, proveedor].filter(Boolean).length
  const confianza: Lectura['confianza'] =
    aciertos >= 2 && texto.length > 40 ? 'alta' : aciertos >= 1 ? 'media' : 'baja'

  /*
    Si era una reserva, sus datos pisan a los generales.

    El importe: en una captura de Airbnb "Precio total" es lo cobrado,
    y las reglas de factura podrían quedarse con la limpieza o la
    comisión, que también son números con euros al lado.

    El proveedor: la plataforma. Y con eso la carpeta se acierta sola
    a partir de la segunda reserva, igual que con Endesa.

    El título: el nombre de quien viene, que es como se reconoce una
    reserva de un vistazo. "Reserva · Oliver Gregorio Ramos Mesa"
    dice mucho más que "Recibo · agosto".
  */
  if (reserva) {
    const quien = reserva.huesped ?? reserva.referencia
    return {
      tipo: 'Reserva',
      proveedor: reserva.plataforma ?? proveedor,
      fecha,
      importe: reserva.importe ?? importe,
      vencimiento: null,
      categoria_id: suya?.categoria_id ?? null,
      titulo: quien ? `Reserva · ${quien}` : 'Reserva',
      confianza: reserva.importe != null ? 'alta' : 'media',
      texto: texto.slice(0, 1200) || null,
      reserva,
      conocido: true,
    }
  }

  return {
    tipo,
    proveedor,
    fecha,
    importe,
    vencimiento,
    categoria_id: suya?.categoria_id ?? null,
    titulo,
    confianza,
    // Lo que se guarda para buscar después. Recortado: el buscador no
    // necesita las diez páginas de condiciones de una póliza.
    texto: texto.slice(0, 1200) || null,
    reserva: null,
    conocido: reconocido != null,
  }
}

/* Un título que se entienda de un vistazo, sin haber visto el papel.
   "Factura de Endesa · agosto", no "DOC_2026_08". */
function elTitulo(
  tipo: string | null,
  proveedor: string | null,
  fecha: string | null
): string | null {
  const mes = fecha ? MESES[Number(fecha.slice(5, 7)) - 1] : null

  if (tipo && proveedor) return `${tipo} de ${proveedor}${mes ? ` · ${mes}` : ''}`
  if (proveedor) return `${proveedor}${mes ? ` · ${mes}` : ''}`
  if (tipo) return `${tipo}${mes ? ` de ${mes}` : ''}`
  return null
}

/*
  Qué clase de papel es — por mayoría, no por orden.

  Antes ganaba el PRIMER tipo de la lista que coincidiera en una sola
  palabra. Con el billete de barco de Fred. Olsen salió "Póliza",
  porque en la letra pequeña aparecía "condiciones particulares" — una
  frase de contrato que está en medio mundo. Y Póliza iba antes que
  Billete en la lista, así que ganaba con una coincidencia floja
  mientras Billete tenía tres claras: billete, embarque y pasajeros.

  Ahora cada tipo suma una por palabra encontrada y gana el que más
  tenga. Una palabra suelta ya no decide nada frente a tres.
*/
function elTipo(plano: string): string | null {
  let mejor: { clave: string; puntos: number } | null = null

  for (const t of TIPOS) {
    const puntos = t.palabras.filter((p) => contienePalabra(plano, limpio(p))).length
    if (puntos > 0 && (!mejor || puntos > mejor.puntos)) {
      mejor = { clave: t.clave, puntos }
    }
  }

  return mejor?.clave ?? null
}
