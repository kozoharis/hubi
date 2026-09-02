import type { Categoria } from '@/lib/rutas'

/**
 * gemini-3.5-flash con razonamiento mínimo.
 *
 * Los modelos 3.6 y 3.7 traen el razonamiento activado en nivel medio y no
 * permiten bajarlo de "low": tardan mucho más para una tarea que no lo
 * necesita. Extraer el importe de una factura no requiere reflexión, requiere
 * lectura. Este modelo sí admite "minimal" y responde en pocos segundos.
 */
const MODELO = 'gemini-3.5-flash'
const RAZONAMIENTO = 'minimal'
const LIMITE_MS = 45_000

const API = 'https://generativelanguage.googleapis.com/v1beta/models'

export type Lectura = {
  tipo: string | null
  proveedor: string | null
  fecha: string | null
  importe: number | null
  vencimiento: string | null
  categoria_id: string | null
  titulo: string | null
  confianza: 'alta' | 'media' | 'baja'
  texto: string | null
  /* Solo cuando el papel es una reserva de Los Helechos: noches,
     personas, huésped y número. Va aparte y opcional porque el 95% de
     los papeles de una casa no son reservas. */
  reserva?: import('@/lib/reservas').Reserva | null
  /* ¿El proveedor es un nombre RECONOCIDO —ya archivado antes, o una
     empresa conocida— o una suposición sacada de las primeras líneas?
     De esto depende que HUBI se fíe de su lectura o pida ayuda. */
  conocido?: boolean
}

const ESQUEMA = {
  type: 'object',
  properties: {
    tipo: {
      type: 'string',
      nullable: true,
      description: 'Factura, Ticket, Póliza, Recibo, Informe médico, Receta, Contrato, Otro',
    },
    proveedor: {
      type: 'string',
      nullable: true,
      description: 'Empresa u organismo que emite el documento. Solo el nombre.',
    },
    fecha: {
      type: 'string',
      nullable: true,
      description: 'Fecha del documento en formato AAAA-MM-DD',
    },
    importe: {
      type: 'number',
      nullable: true,
      description: 'Importe total a pagar o cobrar, en euros. Solo el número.',
    },
    vencimiento: {
      type: 'string',
      nullable: true,
      description:
        'Fecha de vencimiento, caducidad o próxima renovación, en formato AAAA-MM-DD',
    },
    categoria_id: {
      type: 'string',
      nullable: true,
      description: 'El identificador exacto de la categoría más adecuada de la lista',
    },
    titulo: {
      type: 'string',
      nullable: true,
      description:
        'Descripción corta en español, máximo 8 palabras. En un ticket de tienda, di QUÉ se compró: "Stradivarius · 2 camisas".',
    },
    confianza: {
      type: 'string',
      enum: ['alta', 'media', 'baja'],
      description: 'Cómo de seguro estás de la lectura en conjunto',
    },
    texto: {
      type: 'string',
      nullable: true,
      description: 'Todo el texto legible del documento, para poder buscarlo después',
    },
  },
  required: ['confianza'],
}

function instrucciones(categorias: Categoria[], rutaDe: (c: Categoria) => string) {
  const lista = categorias
    .map((c) => `- ${c.id} → ${rutaDe(c)}`)
    .join('\n')

  return `Eres el asistente documental de una familia española. Vas a leer la fotografía o el PDF de un documento doméstico y extraer sus datos.

REGLAS:
- Responde solo con los datos que veas de verdad. Si algo no aparece, déjalo vacío. Nunca inventes ni deduzcas.
- El importe es el TOTAL del documento, en euros, como número. "127,43 €" es 127.43.
- Las fechas van en formato AAAA-MM-DD. Ojo: en España el formato es día/mes/año, así que 03/09/2026 es el 3 de septiembre.
- "vencimiento" solo si el documento indica expresamente una caducidad, renovación o próxima revisión.
- "titulo" debe ser algo que una persona mayor entienda de un vistazo: "Factura de la luz de agosto", "Seguro del coche", "Informe del cardiólogo".
- EN UN TICKET DE TIENDA lo que importa son cuatro cosas: el COMERCIO, la FECHA, el TOTAL y QUÉ se compró. El "proveedor" es el nombre del comercio tal y como está impreso arriba —"STRADIVARIUS", "Mercadona"—, nunca la razón social del pie ni el centro comercial. El "importe" es la línea TOTAL, no el precio de un artículo suelto. Y el "titulo" resume la compra: "Stradivarius · 2 camisas", "Mercadona · compra semanal".
- Si la foto está arrugada o con sombras, lee lo que puedas y baja la confianza. No te inventes un nombre porque una línea parezca uno: si no distingues el comercio, deja "proveedor" vacío.
- "texto" debe contener el texto legible más útil para buscar después (conceptos, referencias, nombres, números de póliza o contrato). Máximo 1200 caracteres: no hace falta transcribirlo todo.
- "confianza" es "baja" si la foto está borrosa, cortada o no distingues bien las cifras. Prefiere admitir dudas antes que acertar por casualidad.

CATEGORÍAS DISPONIBLES — elige el identificador de la más adecuada:

${lista}

Si ninguna encaja con claridad, deja categoria_id vacío.`
}

export async function leerDocumento(opciones: {
  contenido: ArrayBuffer
  tipoMime: string
  categorias: Categoria[]
  rutaDe: (c: Categoria) => string
}): Promise<Lectura> {
  const clave = process.env.GEMINI_API_KEY
  if (!clave) throw new Error('SIN_CLAVE_OCR')

  const base64 = Buffer.from(opciones.contenido).toString('base64')

  const contenido = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: opciones.tipoMime, data: base64 } },
          { text: instrucciones(opciones.categorias, opciones.rutaDe) },
        ],
      },
    ],
  }

  const ajustes = {
    temperature: 0,
    responseMimeType: 'application/json',
    responseSchema: ESQUEMA,
  }

  async function pedir(conRazonamientoMinimo: boolean) {
    const corte = AbortSignal.timeout(LIMITE_MS)

    return fetch(`${API}/${MODELO}:generateContent`, {
      method: 'POST',
      signal: corte,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave! },
      body: JSON.stringify({
        ...contenido,
        // El campo va en minúsculas con guion bajo: Google no reconoce
        // "thinkingLevel". El reintento de abajo cubre el caso de que
        // este modelo deje de admitirlo.
        generationConfig: conRazonamientoMinimo
          ? { ...ajustes, thinking_level: RAZONAMIENTO }
          : ajustes,
      }),
    })
  }

  let respuesta: Response
  try {
    respuesta = await pedir(true)

    // Si este modelo dejara de admitir el ajuste de razonamiento,
    // se reintenta sin él en vez de fallar.
    if (respuesta.status === 400) {
      const detalle = await respuesta.clone().text()
      if (/thinking/i.test(detalle)) respuesta = await pedir(false)
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') throw new Error('DEMASIADO_LENTO')
    throw e
  }

  if (!respuesta.ok) {
    const detalle = await respuesta.text()
    if (respuesta.status === 429) {
      throw new Error(porQueNoHayCupo(await respuesta.clone().text()))
    }
    throw new Error(`Gemini no responde (${respuesta.status}): ${detalle.slice(0, 300)}`)
  }

  const datos = (await respuesta.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }

  const bruto = datos.candidates?.[0]?.content?.parts?.[0]?.text
  if (!bruto) throw new Error('Gemini no ha devuelto nada legible')

  const leido = JSON.parse(bruto) as Partial<Lectura>

  return {
    tipo: leido.tipo ?? null,
    proveedor: leido.proveedor ?? null,
    fecha: fechaValida(leido.fecha),
    importe: typeof leido.importe === 'number' ? leido.importe : null,
    vencimiento: fechaValida(leido.vencimiento),
    categoria_id: leido.categoria_id ?? null,
    titulo: leido.titulo ?? null,
    confianza: leido.confianza ?? 'baja',
    texto: leido.texto ?? null,
    /* Un modelo que ha visto la foto no está adivinando el nombre a
       partir de la primera línea: lo ha leído. Aquí no hay suposición
       que marcar. */
    conocido: true,
  }
}

/** Descarta fechas imposibles o mal formadas antes de enseñárselas a nadie. */
function fechaValida(valor: string | null | undefined): string | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null

  const fecha = new Date(valor + 'T12:00:00Z')
  if (Number.isNaN(fecha.getTime())) return null

  const anio = fecha.getUTCFullYear()
  if (anio < 1990 || anio > 2100) return null

  return valor
}

/*
  Distinguir "se ha llenado el minuto" de "se ha acabado el día".

  Google devuelve un 429 para las dos cosas, y HUBI decía siempre "se
  ha agotado por hoy". Casi siempre era mentira: lo normal al probar es
  pasarse del cupo POR MINUTO, que se arregla esperando treinta
  segundos. Mandar a alguien a esperar hasta mañana cuando bastaba con
  contar hasta veinte es de las peores cosas que puede hacer un
  mensaje de error.

  El motivo viene dentro de la respuesta, en el identificador de la
  cuota: "...PerDay..." o "...PerMinute...".
*/
function porQueNoHayCupo(detalle: string): 'CUOTA_DIA' | 'CUOTA_MINUTO' {
  return /perday|per day|requests_per_day/i.test(detalle) ? 'CUOTA_DIA' : 'CUOTA_MINUTO'
}
