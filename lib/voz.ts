import type { Categoria } from '@/lib/rutas'

const MODELO = 'gemini-3.5-flash'
const RAZONAMIENTO = 'minimal'
const LIMITE_MS = 45_000
const API = 'https://generativelanguage.googleapis.com/v1beta/models'

export type Tarea = {
  titulo: string
  nota: string | null
  para: string | null
  fecha: string | null
  hora: string | null
  repite: 'diaria' | 'semanal' | 'mensual' | 'anual' | null
  /* Hasta cuándo se repite. Vacío = para siempre, que es lo normal en
     una casa: el agua, la basura y regar no tienen fecha de fin. */
  repite_hasta: string | null
}

export type Entendido = {
  transcripcion: string | null
  /* Una frase puede traer más de una cosa que recordar. Antes solo
     cabía una y las demás se perdían por el camino, sin avisar. */
  tareas: Tarea[]
  accion:
    | 'recordatorio' | 'gasto' | 'ingreso' | 'buscar'
    | 'consulta' | 'cambiar' | 'borrar' | 'compra' | 'nada'
  /* Lo que hay que comprar. Una entrada por cosa: "apunta leche, pan
     y huevos" son TRES, no una con comas. */
  compra: { que: string; cantidad: string | null }[]
  /* Para qué sección es la compra: la finca, Los Helechos, la casa.
     Es de la lista entera, no de cada artículo. */
  compra_seccion: string | null
  /* Solo en una consulta por un papel: cuál es, para poder ofrecer
     verlo después de habérselo contado en voz alta. */
  papel_id?: string | null
  /* De qué tarea ya apuntada se habla, con las palabras que se hayan
     dicho: "la de la farmacia", "lo del médico del martes". Solo para
     cambiar y borrar. HUBI la busca con esto. */
  cual: string | null
  titulo: string | null
  nota: string | null
  para: string | null
  fecha: string | null
  hora: string | null
  importe: number | null
  concepto: string | null
  categoria_id: string | null
  busqueda: string | null
  repite: 'diaria' | 'semanal' | 'mensual' | 'anual' | null
  repite_hasta: string | null
  periodo: 'mes' | 'trimestre' | 'anio' | null
  /*
    QUÉ SE ESTÁ PREGUNTANDO.

    Todo lo que HUBI guarda tiene que poder preguntarse en voz alta —
    si algo se puede apuntar y no se puede preguntar, la mitad de la
    función está sin hacer. Hoy son cinco:

      gasto · ingreso · balance   las cuentas
      papel                       un documento guardado
      compra                      la lista de la compra
      agenda                      lo que hay que hacer un día
  */
  tipo_consulta:
    | 'gasto' | 'ingreso' | 'balance' | 'papel' | 'compra' | 'agenda' | null
  /* A dónde lleva el botón de después de contestar: al sitio de lo que
     se acaba de preguntar, no siempre a la Finca. */
  ir_a?: string | null
  confianza: 'alta' | 'media' | 'baja'
}

const ESQUEMA = {
  type: 'object',
  properties: {
    transcripcion: { type: 'string', nullable: true, description: 'Lo que se ha dicho, palabra por palabra' },
    accion: {
      type: 'string',
      enum: [
        'recordatorio', 'gasto', 'ingreso', 'buscar',
        'consulta', 'cambiar', 'borrar', 'compra', 'nada',
      ],
    },
    compra_seccion: {
      type: 'string',
      nullable: true,
      description:
        'Solo para accion "compra". Identificador de la SECCIÓN a la que va la compra, SOLO si lo dicen expresamente: "para la finca", "esto es de Los Helechos". La compra de casa NO lleva sección: es lo normal, y no hace falta decirlo. Nunca pongas secciones que no sean sitios donde se gasta (Seguros, Salud, Documentos y Personal no son destinos de una compra). Vacío si no lo dicen.',
    },
    compra: {
      type: 'array',
      nullable: true,
      description:
        'Solo para accion "compra". Una entrada por CADA cosa que hay que comprar.',
      items: {
        type: 'object',
        properties: {
          que: { type: 'string', description: 'El artículo, en singular y sin cantidad: "leche"' },
          cantidad: {
            type: 'string',
            nullable: true,
            description: 'La cantidad tal y como se dijo: "2 kg", "una docena". Vacío si no se dice.',
          },
        },
        required: ['que'],
      },
    },
    cual: {
      type: 'string',
      nullable: true,
      description:
        'Solo para cambiar o borrar: las palabras que identifican la tarea de la que hablan, sin el verbo. "la de la farmacia" → "farmacia".',
    },
    titulo: {
      type: 'string',
      nullable: true,
      description:
        'La acción completa: verbo y complemento. "Llamar al médico para pedir cita", no "Médico".',
    },
    nota: {
      type: 'string',
      nullable: true,
      description: 'Todo el detalle adicional que se haya dicho y no quepa en el título',
    },
    tareas: {
      type: 'array',
      nullable: true,
      description:
        'Una entrada por CADA cosa distinta que hay que recordar. Solo para accion "recordatorio".',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'La acción completa: verbo y complemento' },
          nota: { type: 'string', nullable: true, description: 'El detalle que no quepa en el título' },
          para: { type: 'string', nullable: true, description: 'Nombre de la persona, o "los dos"' },
          fecha: { type: 'string', nullable: true, description: 'AAAA-MM-DD' },
          hora: { type: 'string', nullable: true, description: 'HH:MM en 24 horas' },
          repite: {
            type: 'string',
            nullable: true,
            description: 'diaria, semanal, mensual o anual. Vacío si no se repite.',
          },
          repite_hasta: {
            type: 'string',
            nullable: true,
            description:
              'AAAA-MM-DD. Último día en que se repite, si han dicho hasta cuándo. Vacío si no tiene fin.',
          },
        },
        required: ['titulo'],
      },
    },
    para: { type: 'string', nullable: true, description: 'Nombre de la persona, o "los dos"' },
    fecha: { type: 'string', nullable: true, description: 'AAAA-MM-DD' },
    hora: { type: 'string', nullable: true, description: 'HH:MM en 24 horas' },
    importe: { type: 'number', nullable: true },
    concepto: { type: 'string', nullable: true, description: 'De qué es el gasto o ingreso' },
    categoria_id: {
      type: 'string',
      nullable: true,
      description:
        'Identificador exacto de la lista. Para gastos e ingresos, una carpeta final. Para buscar, cualquiera, también una carpeta madre.',
    },
    busqueda: { type: 'string', nullable: true, description: 'Qué documento se busca' },
    repite: { type: 'string', nullable: true, description: 'diaria, semanal, mensual o anual' },
    repite_hasta: { type: 'string', nullable: true, description: 'AAAA-MM-DD, último día de la repetición' },
    // Estos dos van como texto libre y no como lista cerrada: Gemini no
    // acepta que un campo sea a la vez opcional y de valores limitados.
    // Se validan abajo, al recibirlos.
    periodo: { type: 'string', nullable: true, description: 'mes, trimestre o anio' },
    tipo_consulta: {
      type: 'string',
      nullable: true,
      description:
        'Solo para accion "consulta". Uno de: gasto, ingreso, balance (preguntas de dinero); papel (por un documento guardado: "dime la última factura"); compra (por la lista de la compra: "qué hay en la compra"); agenda (por lo que hay que hacer un día: "qué tengo mañana").',
    },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
  },
  required: ['accion', 'confianza'],
}

function instrucciones(opciones: {
  personas: { nombre: string }[]
  categorias: Categoria[]
  rutaDe: (c: Categoria) => string
  hoy: string
  diaSemana: string
}) {
  const gente = opciones.personas.map((p) => p.nombre).join(' y ')
  const lista = opciones.categorias.map((c) => `- ${c.id} → ${opciones.rutaDe(c)}`).join('\n')

  return `Eres el asistente de una familia española formada por ${gente}. Vas a escuchar una frase dicha en voz alta y decidir qué quieren.

HOY ES ${opciones.diaSemana} ${opciones.hoy}. Úsalo para resolver "mañana", "el martes", "este trimestre".

LAS OCHO COSAS QUE PUEDEN PEDIR:

1. "recordatorio" — apuntar algo que hay que hacer o recordar.

   TODO va dentro de "tareas", que es una LISTA. Una frase puede traer
   varias cosas y no se puede perder ninguna:

   "Recuérdale a Juan Miguel mañana a las diez que recoja la medicación"
   → tareas: [ { titulo: "Recoger la medicación en la farmacia",
                 para: "Juan Miguel", fecha: mañana, hora: "10:00" } ]

   "Apunta que el lunes Conchita llame al médico y el martes yo lleve
   los papeles a Silvia"
   → tareas: [
       { titulo: "Llamar al médico", para: "Conchita", fecha: el lunes },
       { titulo: "Llevar los papeles a Silvia", fecha: el martes }
     ]

   Una tarea por cada cosa DISTINTA que haya que hacer. Dos acciones en
   días o sitios distintos son dos tareas. Una sola acción contada con
   muchos detalles es UNA tarea con su nota.

   REPETICIÓN. Si dicen cada cuánto vuelve, ponlo en "repite":
   "todos los días" → "diaria"
   "todas las semanas", "los jueves", "cada lunes" → "semanal"
   "todos los meses", "el día 5 de cada mes" → "mensual"
   "todos los años", "cada año" → "anual"

   Si no dicen que se repita, déjalo vacío. No lo supongas NUNCA: una
   tarea que vuelve sola sin haberlo pedido es una molestia permanente
   que nadie sabe de dónde ha salido.

   Con repetición, "fecha" es la PRIMERA vez.

   HASTA CUÁNDO. Si dicen dónde acaba, ponlo en "repite_hasta" como
   fecha. Si no dicen final, déjalo vacío: se repite para siempre.

   "Todos los lunes del 1 de septiembre al 30 de octubre"
   → fecha: el primer lunes desde el 1 de septiembre,
     repite: "semanal", repite_hasta: 2026-10-30

   "Riega cada día durante dos semanas"
   → fecha: hoy, repite: "diaria", repite_hasta: dentro de 14 días

   "Una cita diaria pero solo durante una semana"
   → fecha: hoy, repite: "diaria", repite_hasta: dentro de 7 días

   "Todos los días, solo esta semana"
   → repite: "diaria", repite_hasta: el domingo de esta semana

   OJO: "solo", "únicamente" y "nada más" delante de una duración NO
   la anulan — la refuerzan. "Solo durante una semana" ES un final.

   "Dale la pastilla todas las mañanas hasta fin de mes"
   → repite: "diaria", repite_hasta: el último día de este mes

   Si no dicen para quién, deja "para" vacío.
   Si no dicen cuándo, deja "fecha" vacía. No inventes una fecha.

   El "titulo" es LA ACCIÓN, no una etiqueta. "Llamar al médico para pedir
   cita", nunca "Médico". Debe entenderse solo, sin haber oído la frase.

   Y todo lo demás que se haya dicho va en "nota", con sus palabras:
   nombres, motivos, direcciones, advertencias, teléfonos. Ejemplo:
   "Recuérdale a Conchita que mañana llame al médico, que es para los
   análisis y hay que ir en ayunas, y que pregunte por la doctora Pérez"
   → titulo: "Llamar al médico"
   → nota: "Es para los análisis, hay que ir en ayunas. Preguntar por la doctora Pérez."

   Nunca tires nada de lo que se ha dicho. Si dudas de si algo sobra,
   ponlo en la nota.

2. "gasto" — apuntar dinero que sale.
   "Apunta un gasto de 85 euros de productos de la finca"
   → importe: 85, concepto: "Productos", categoria_id: el de Finca → Gastos → Productos

3. "ingreso" — apuntar dinero que entra.
   "Hemos cobrado 1200 euros de la cooperativa"
   → importe: 1200, concepto: "Venta cooperativa", categoria_id: el de ventas cooperativa

4. "buscar" — encontrar uno o VARIOS documentos.

   Si nombran una carpeta —"la finca", "los seguros", "salud",
   "vehículos", "luz", "agua"— pon su identificador en "categoria_id".
   Vale cualquier carpeta de la lista, también las que tienen otras
   dentro: "Finca" incluye todo lo suyo.

   Con la carpeta puesta, HUBI enseña TODOS los papeles que hay
   dentro. Es exacto: no se busca por palabras, se abre la carpeta.

   "Enséñame todas las facturas de la finca"
   → categoria_id: el de Finca, busqueda: null
   "Todos los papeles del coche"
   → categoria_id: el de Vehículos, busqueda: null

   Si NO nombran una carpeta, deja "categoria_id" vacío y pon en
   "busqueda" solo las palabras que sirven para encontrarlo, sin
   relleno:
   "Busca la última factura del seguro del coche"
   → busqueda: "seguro coche"

   Si nombran carpeta Y algo más concreto, pon las dos cosas.

   Nunca pongas en "busqueda" palabras como "todas", "muéstrame",
   "enséñame" o "papeles": no están escritas en ningún documento y
   solo estorban.

5. "consulta" — preguntar, y que HUBI conteste en voz alta.

   POR LAS CUENTAS:
   "¿Cuánto hemos gastado este trimestre en agua?"
   → periodo: "trimestre", tipo_consulta: "gasto", categoria_id: el de agua
   "¿Cómo vamos este año?" → periodo: "anio", tipo_consulta: "balance"

   POR UN PAPEL GUARDADO — tipo_consulta: "papel":
   "Dime la última factura que he subido"      → tipo_consulta: "papel"
   "¿Cuál fue la última factura de la luz?"    → tipo_consulta: "papel",
                                                 categoria_id: el de luz
   "¿Cuánto fue lo último de Leroy Merlin?"    → tipo_consulta: "papel",
                                                 busqueda: "Leroy Merlin"

   POR LA LISTA DE LA COMPRA — tipo_consulta: "compra":
   "Dime la lista de la compra"          → tipo_consulta: "compra"
   "¿Qué hay en la compra de la casa?"   → tipo_consulta: "compra"
   "¿Qué falta por comprar de la finca?" → tipo_consulta: "compra",
                                            compra_seccion: la finca

   POR LA AGENDA — tipo_consulta: "agenda":
   "¿Qué tengo mañana?"                  → tipo_consulta: "agenda",
                                            fecha: mañana
   "Dime qué hay en el calendario el martes" → tipo_consulta: "agenda",
                                            fecha: el martes
   "¿Qué tenemos hoy?"                   → tipo_consulta: "agenda",
                                            fecha: hoy
   Si no dicen día, es hoy.

   UNA PREGUNTA NUNCA ES UNA TAREA. Si la frase empieza pidiendo
   información —dime, dame, cuánto, cuál, qué tal— y nombra algo que
   HUBI guarda —ingresos, gastos, balance, facturas, la compra, la
   agenda, las reservas—, es SIEMPRE accion "consulta". Nunca
   "recordatorio". Apuntarle a alguien su propia pregunta en el
   calendario es el peor error que puedes cometer aquí: no contestas y
   además le ensucias la agenda.

   "Dime los ingresos previstos de Los Helechos tres"
   → accion: "consulta", tipo_consulta: "ingreso",
     categoria_id: el de Los Helechos
   "¿Cuánto llevamos de la cooperativa este año?"
   → accion: "consulta", tipo_consulta: "ingreso", periodo: "anio"

   LA DIFERENCIA CON "buscar", que es la que más se confunde:
   - "BUSCA la factura del seguro"  → accion "buscar": quiere VERLA, y
     HUBI le abre la lista de papeles.
   - "DIME cuál fue la última factura" → accion "consulta" con
     tipo_consulta "papel": quiere que se lo CUENTEN, en voz alta,
     porque está conduciendo o con las manos ocupadas.
   Si la frase empieza por dime, cuál, cuánto o qué, es una consulta.

6. "cambiar" — corregir algo que YA está apuntado.

   Lo que se cambia va en los campos de siempre —"fecha", "hora",
   "para", "titulo"— y en "cual" van las palabras que dicen DE QUÉ
   tarea hablan, sin el verbo ni el relleno:

   "Cambia lo del médico al jueves"
   → accion: "cambiar", cual: "médico", fecha: el jueves
   "La medicación de la farmacia que la recoja Conchita"
   → accion: "cambiar", cual: "medicación farmacia", para: "Conchita"
   "Lo de Silvia mejor a las seis"
   → accion: "cambiar", cual: "Silvia", hora: "18:00"

   En "cual" solo van las palabras que estarían escritas en la tarea.
   Nunca "la tarea", "lo de", "eso", "aquello": no identifican nada.

   Deja vacío TODO lo que no vayan a cambiar. Un campo con un valor
   inventado pisaría el que ya estaba bien.

7. "borrar" — quitar algo apuntado.

   "Borra lo de la farmacia" → accion: "borrar", cual: "farmacia"
   "Quita la cita del médico" → accion: "borrar", cual: "cita médico"
   "Ya no hace falta lo de Silvia" → accion: "borrar", cual: "Silvia"

   CUIDADO CON LA DIFERENCIA. "Ya lo he hecho", "ya está recogido" o
   "eso está hecho" NO es borrar: es marcarlo hecho. Usa accion
   "cambiar" con "cual" y no toques nada más — HUBI ya sabe. Borrar es
   solo cuando la cosa NO hay que hacerla: se ha anulado, era un
   error, o ya no hace falta.

8. "compra" — apuntar en la LISTA DE LA COMPRA.

   "Apunta leche, pan y huevos en la compra"
   → compra: [{que:"Leche"}, {que:"Pan"}, {que:"Huevos"}]
   "Añade a la compra dos kilos de naranjas"
   → compra: [{que:"Naranjas", cantidad:"2 kg"}]
   "Que hay que comprar papel de cocina"
   → compra: [{que:"Papel de cocina"}]

   SOLO COSAS QUE SE COMPRAN: alimentos, productos, cosas de casa.
   NUNCA metas en "compra" el verbo con el que se ha pedido ("apunta",
   "añade"), un día ("el sábado"), el nombre de quien va ("Conchita")
   ni relleno ("por favor", "del súper"). Eso no se compra. Si de una
   frase solo sacas basura, deja "compra" vacía.

   UNA ENTRADA POR CADA COSA. "Leche, pan y huevos" son tres, no una.

   SE DICTA DE CORRIDO, SIN COMAS. Nadie dice "coma" al hablar, y el
   teléfono no las pone. Vas a recibir cosas como:

     "apunta leche pan huevos tomates papel de cocina y detergente"
     → seis cosas: Leche, Pan, Huevos, Tomates, Papel de cocina,
       Detergente

   Separar bien es tu trabajo principal aquí, y la clave es reconocer
   PRODUCTOS: "papel de cocina" es UNO, no "papel" y "cocina". "Leche
   entera" es uno. "Aceite de oliva" es uno. Ante la duda, junta lo
   que sea un producto de verdad y separa lo que no.

   CORRIGE LO QUE EL TELÉFONO OYE MAL. La transcripción del móvil
   destroza los nombres de comida —los oye sin contexto y a menudo con
   ruido de cocina o de calle—. En "que" pon el PRODUCTO DE VERDAD,
   escrito bien, aunque suene distinto a lo transcrito:

     "leche de sementera" → Leche semidesnatada
     "papel dealuminio"   → Papel de aluminio
     "cola cao"           → Colacao
     "suavisante"         → Suavizante
     "una barra de bimbo" → Pan de molde

   Esto NO contradice la regla de no inventar: no estás añadiendo nada
   que no se haya dicho, estás escribiendo bien lo que se dijo. (La
   "transcripcion" sigue yendo tal cual se oyó, sin tocar.)

   SON DE CANARIAS. Usa sus palabras, no las de la Península:
   papas (no patatas), millo (no maíz), gofio, plátanos (no bananas),
   bocadillo, potaje, mojo, queso fresco, cochino. Si dicen "papas",
   apunta "Papas".

   El "que" va en singular y SIN la cantidad: "Naranjas", no "dos
   kilos de naranjas". La cantidad va en su campo, con las palabras
   que se hayan dicho: "2 kg", "una docena", "tres".

   Y SE PUEDE DECIR TODO DE GOLPE: qué comprar y cuándo se va.

   "Apunta leche, pan y huevos y recuérdame ir el sábado a las diez"
   → accion "compra", con las tres cosas Y ADEMÁS fecha: el sábado,
     hora: "10:00". HUBI apunta la compra y pone la ida en la Agenda.
   "Añade lechuga y tomate para la finca, que voy mañana"
   → accion "compra", compra_seccion: la finca, fecha: mañana.
   "Apunta pan y que vaya Conchita el viernes"
   → accion "compra", fecha: el viernes, para: "Conchita".

   Cuando lleva un cuándo, la fecha y la hora son PARA IR A COMPRAR,
   no para cada artículo.

   CUIDADO CON LA DIFERENCIA, que es la que más se confunde:
   - "Apunta leche en la compra" → accion "compra".
   - "Recuérdame llamar al médico mañana" → accion "recordatorio": no
     hay nada que comprar, es una tarea suelta.
   - "Apunta 40 euros de la compra del súper" → accion "gasto": lleva
     dinero ya pagado.

   La regla: si se nombran COSAS QUE COMPRAR, es "compra" — lleve o no
   lleve fecha. Si no se nombra ninguna, es un recordatorio normal.

Si no entiendes qué quieren, o el audio está vacío o es ruido, usa accion "nada".

REGLAS:
- "transcripcion" debe recoger exactamente lo que se ha dicho, sin corregir ni resumir.
- Nunca inventes datos que no se hayan dicho. Es mejor dejar un campo vacío.
- "confianza" es "baja" si el audio se oye mal o la frase es ambigua.
- Las cantidades en euros van como número: "ochenta y cinco euros" es 85.

CATEGORÍAS DISPONIBLES:

${lista}`
}

export async function escuchar(opciones: {
  /* Dos maneras de llegar aquí, y una es mucho más rápida.

     `texto` — el móvil ya ha transcrito lo dicho por su cuenta.
     Entonces esto solo tiene que INTERPRETAR una frase corta: una
     petición de texto, un segundo largo.

     `audio` — el móvil no sabe transcribir, así que sube la grabación
     y Gemini hace las dos cosas. Funciona igual de bien, pero antes
     hay que subir un archivo de un megabyte desde un teléfono. */
  texto?: string
  audio?: ArrayBuffer
  tipoMime?: string
  /* Lo que la persona ha dicho que era, cuando se le han ofrecido
     opciones porque no estaba claro. */
  pista?: Entendido['accion']
  personas: { nombre: string }[]
  categorias: Categoria[]
  rutaDe: (c: Categoria) => string
  hoy: string
  diaSemana: string
}): Promise<Entendido> {
  const clave = process.env.GEMINI_API_KEY
  if (!clave) throw new Error('SIN_CLAVE_OCR')

  const dicho = opciones.texto?.trim()

  const partes: Record<string, unknown>[] = dicho
    ? [
        {
          text:
            `${instrucciones(opciones)}\n\n` +
            `ESTO ES LO QUE HA DICHO, ya transcrito por el teléfono:\n"${dicho}"\n\n` +
            'La transcripción puede traer erratas de oído: números escritos ' +
            'con letra, nombres propios mal puestos, acentos raros. ' +
            'Interpreta la intención, no la letra. Copia la frase tal cual ' +
            'en "transcripcion", sin arreglarla.',
        },
      ]
    : [
        {
          inline_data: {
            mime_type: opciones.tipoMime ?? 'audio/wav',
            data: Buffer.from(opciones.audio!).toString('base64'),
          },
        },
        { text: instrucciones(opciones) },
      ]

  if (opciones.pista) {
    partes.push({
      text:
        `La persona YA HA CONFIRMADO que esto es de tipo "${opciones.pista}". ` +
        'No lo pongas en duda: usa esa acción y dedícate a sacar bien los ' +
        'datos que la acompañan.',
    })
  }

  const contenido = { contents: [{ parts: partes }] }

  const ajustes = {
    temperature: 0,
    responseMimeType: 'application/json',
    responseSchema: ESQUEMA,
  }

  // El campo va en minúsculas con guion bajo: Google no reconoce
  // "thinkingLevel". Y si algún día este modelo dejara de admitirlo,
  // se reintenta sin él en vez de fallar.
  async function pedir(conRazonamientoMinimo: boolean) {
    return fetch(`${API}/${MODELO}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(LIMITE_MS),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave! },
      body: JSON.stringify({
        ...contenido,
        generationConfig: conRazonamientoMinimo
          ? { ...ajustes, thinking_level: RAZONAMIENTO }
          : ajustes,
      }),
    })
  }

  let respuesta = await pedir(true)

  if (respuesta.status === 400) {
    const detalle = await respuesta.clone().text()
    if (/thinking/i.test(detalle)) respuesta = await pedir(false)
  }

  if (!respuesta.ok) {
    if (respuesta.status === 429) {
      throw new Error(porQueNoHayCupo(await respuesta.clone().text()))
    }
    throw new Error(`Gemini no responde (${respuesta.status}): ${(await respuesta.text()).slice(0, 300)}`)
  }

  const datos = (await respuesta.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }

  const bruto = datos.candidates?.[0]?.content?.parts?.[0]?.text
  if (!bruto) throw new Error('No se ha entendido nada')

  const leido = JSON.parse(bruto) as Partial<Entendido>

  /*
    Las tareas.

    Si el modelo ha usado la lista, se limpia una por una. Si ha
    contestado con los campos sueltos de siempre —puede pasar con una
    frase muy simple—, se envuelve en una lista de uno. Así de aquí en
    adelante solo existe un formato y nadie tiene que preguntarse cuál
    toca mirar.
  */
  const brutas = Array.isArray(leido.tareas) ? leido.tareas : []
  let tareas: Tarea[] = brutas
    .map((t) => ({
      titulo: (t?.titulo ?? '').trim(),
      nota: t?.nota?.trim() || null,
      para: t?.para?.trim() || null,
      fecha: fechaValida(t?.fecha),
      hora: horaValida(t?.hora),
      repite: unaDe(t?.repite, ['diaria', 'semanal', 'mensual', 'anual']),
      repite_hasta: fechaValida(t?.repite_hasta),
    }))
    .filter((t) => t.titulo.length > 0)

  if (tareas.length === 0 && leido.accion === 'recordatorio' && leido.titulo?.trim()) {
    tareas = [
      {
        titulo: leido.titulo.trim(),
        nota: leido.nota?.trim() || null,
        para: leido.para?.trim() || null,
        fecha: fechaValida(leido.fecha),
        hora: horaValida(leido.hora),
        repite: unaDe(leido.repite, ['diaria', 'semanal', 'mensual', 'anual']),
        repite_hasta: fechaValida(leido.repite_hasta),
      },
    ]
  }

  return {
    // Si lo transcribió el móvil, manda lo suyo: es literal.
    transcripcion: dicho ?? leido.transcripcion ?? null,
    tareas,
    accion: leido.accion ?? 'nada',
    titulo: leido.titulo ?? null,
    nota: leido.nota ?? null,
    para: leido.para ?? null,
    fecha: fechaValida(leido.fecha),
    hora: horaValida(leido.hora),
    importe: typeof leido.importe === 'number' ? leido.importe : null,
    concepto: leido.concepto ?? null,
    categoria_id: leido.categoria_id ?? null,
    busqueda: leido.busqueda ?? null,
    cual: leido.cual?.trim() || null,
    compra: Array.isArray(leido.compra)
      ? leido.compra
          .map((c) => ({
            que: (c?.que ?? '').trim().slice(0, 120),
            cantidad: c?.cantidad?.trim().slice(0, 40) || null,
          }))
          .filter((c) => c.que.length > 0)
      : [],
    compra_seccion: leido.compra_seccion?.trim() || null,
    repite: unaDe(leido.repite, ['diaria', 'semanal', 'mensual', 'anual']),
    repite_hasta: fechaValida(leido.repite_hasta),
    periodo: unaDe(leido.periodo, ['mes', 'trimestre', 'anio']),
    tipo_consulta: unaDe(leido.tipo_consulta, [
      'gasto', 'ingreso', 'balance', 'papel', 'compra', 'agenda',
    ]),
    confianza: leido.confianza ?? 'baja',
  }
}

function fechaValida(v: string | null | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const f = new Date(v + 'T12:00:00Z')
  if (Number.isNaN(f.getTime())) return null
  const anio = f.getUTCFullYear()
  return anio >= 2020 && anio <= 2100 ? v : null
}

function horaValida(v: string | null | undefined): string | null {
  return v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null
}

/** Acepta el valor solo si está en la lista; si no, lo descarta. */
function unaDe<T extends string>(v: unknown, permitidos: readonly T[]): T | null {
  return typeof v === 'string' && (permitidos as readonly string[]).includes(v)
    ? (v as T)
    : null
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
