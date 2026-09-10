/*
  ═══════════════════════════════════════════════════════════════
  LO QUE VENCE, Y EL DÍA EN QUE HAY QUE HACER ALGO
  ═══════════════════════════════════════════════════════════════

  UNA SOLA VERDAD, Y ESTÁ EN EL PAPEL.

  El vencimiento vive en el documento. Los recordatorios que salen de él
  son un REFLEJO: se borran y se vuelven a hacer enteros cada vez que el
  papel cambia. Nunca se corrigen uno a uno.

  Parece más bruto y es mucho más seguro. Corregir avisos por partes
  —«éste sí, éste no, éste tenía otra fecha»— es como se llega a tener
  dos avisos del mismo seguro con fechas distintas y ninguna forma de
  saber cuál manda. Rehacerlos no puede desincronizarse: si el papel
  dice el 12 de noviembre, el aviso dice el 12 de noviembre, porque
  acaba de nacer de ahí.

  ─────────────────────────────────────────────────────────────
  LA FECHA QUE IMPORTA NO ES SIEMPRE LA DEL VENCIMIENTO

  Un contrato que se renueva solo salvo aviso con un mes de antelación
  no tiene una fecha importante: tiene dos, y la de verdad es la
  primera.

    vence el 8 de septiembre · preaviso de un mes
    → el día que hay que hacer algo es el 8 de AGOSTO

  Pasado el 8 de agosto ya estás dentro de otro año entero. Un aviso el
  día del vencimiento llega puntual y llega inútil.

  Por eso de un papel así salen DOS avisos, y el primero no dice una
  fecha: dice lo que hay que hacer.

  ─────────────────────────────────────────────────────────────
  Y SOLO SE BORRA LO QUE HUBI PUSO

  Los avisos que genera esto llevan `motivo`. Los que escribió una
  persona sobre el mismo papel —«llamar a Silvia por lo del seguro»— no
  lo llevan, y no se tocan jamás. Borrarle a alguien un recordatorio
  suyo porque corrigió una fecha es de las cosas que hacen desconfiar de
  una aplicación para siempre.
*/


export type Vencimiento = {
  /** El día que caduca. Sin esto no hay nada que avisar. */
  fecha_vencimiento: string | null
  /** Si no haces nada, ¿empieza otro periodo? */
  se_renueva: boolean
  /** Con cuántos días de antelación hay que avisar para cancelarlo. */
  preaviso_dias: number | null
  /** Cuánto antes quiere la familia que suene el teléfono. */
  avisar_con: 'sin_aviso' | '1_dia' | '1_semana' | '1_mes'
}

export const AVISOS = ['sin_aviso', '1_dia', '1_semana', '1_mes'] as const

export function esAviso(v: unknown): v is Vencimiento['avisar_con'] {
  return typeof v === 'string' && (AVISOS as readonly string[]).includes(v)
}

/*
  Restar días a una fecha sin que la zona horaria se meta.

  A mediodía a propósito. Con `new Date('2026-09-08')` JavaScript
  entiende medianoche EN LONDRES, y el servidor de HUBI está allí: en
  verano, restar treinta días desde medianoche cae en las 23:00 del día
  anterior y el aviso sale un día antes de lo que debería. A mediodía no
  hay hueco por el que se cuele ese fallo.
*/
export function diaLimite(vence: string, dias: number): string {
  const d = new Date(`${vence}T12:00:00`)
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

/** «12 de noviembre de 2026», para escribirlo dentro del aviso. */
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function enPalabras(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${a}`
}

/**
 * Qué avisos le tocan a este papel. Sin tocar la base de datos: así se
 * puede enseñar en la pantalla, antes de guardar, exactamente lo mismo
 * que se va a crear después.
 *
 * `hoy` se pasa desde fuera para poder probarlo sin depender del día.
 */
export function avisosDe(
  v: Vencimiento,
  titulo: string,
  hoy: string
): { motivo: 'vence' | 'preaviso'; titulo: string; fecha: string; nota: string | null }[] {
  if (!v.fecha_vencimiento) return []

  const lista: { motivo: 'vence' | 'preaviso'; titulo: string; fecha: string; nota: string | null }[] = []
  const nombre = titulo.trim() || 'este papel'

  /*
    EL PREAVISO VA PRIMERO PORQUE ES EL QUE SIRVE.

    Y solo se pone si aún se llega: un «último día para cancelar» con
    fecha pasada no es un aviso, es un reproche. Cuando ya no se llega,
    la pantalla lo dice a la cara al guardar — que es cuando todavía se
    puede hacer algo, como llamar hoy mismo.
  */
  if (v.se_renueva && v.preaviso_dias && v.preaviso_dias > 0) {
    const limite = diaLimite(v.fecha_vencimiento, v.preaviso_dias)
    if (limite >= hoy) {
      lista.push({
        motivo: 'preaviso',
        titulo: `Último día para cancelar: ${nombre}`,
        fecha: limite,
        nota: `Si no avisas antes de hoy, se renueva solo el ${enPalabras(v.fecha_vencimiento)}.`,
      })
    }
  }

  lista.push({
    motivo: 'vence',
    titulo: v.se_renueva ? `Se renueva: ${nombre}` : `Vence: ${nombre}`,
    fecha: v.fecha_vencimiento,
    nota: null,
  })

  return lista
}

/*
  ─────────────────────────────────────────────────────────────
  Y AHORA, CONTRA LA BASE DE DATOS

  El cliente se recibe sin tipar. `supabase-js` con tipos generados
  obligaría a arrastrar aquí el esquema entero, y esta función se llama
  desde sitios con clientes distintos (el de la sesión y el de
  servicio). Lo que importa —qué se borra y qué se crea— está a la
  vista.
*/
export async function rehacerAvisos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  datos: {
    documentoId: string
    espacio: string
    titulo: string
    creadoPor: string
    hoy: string
  } & Vencimiento
): Promise<{
  puestos: number
  fallo: string | null
  sinMarca?: string | null
  /** Entró uno y el otro no. El aviso existe, pero falta la mitad. */
  aMedias?: string | null
}> {
  const { documentoId, espacio, titulo, creadoPor, hoy } = datos

  /*
    Fuera los de antes. Solo los que puso HUBI (`motivo`) y solo los que
    están pendientes: uno ya marcado como hecho es historia de lo que
    pasó, y reescribir la historia porque hoy se corrige una fecha
    borraría la prueba de que aquel año sí se avisó a tiempo.
  */
  try {
    await supabase
      .from('recordatorios')
      .delete()
      .eq('hogar_id', espacio)
      .eq('documento_origen_id', documentoId)
      .not('motivo', 'is', null)
      .eq('estado', 'pendiente')
  } catch {
    /* Si la columna `motivo` todavía no existe —el SQL 43 sin ejecutar—
       esto falla y no se borra nada. Se sigue: es mejor que salgan dos
       avisos parecidos a que corregir un papel dé error. */
  }

  const nuevos = avisosDe(datos, titulo, hoy)
  if (nuevos.length === 0) return { puestos: 0, fallo: null }

  const filas = nuevos.map((a) => ({
    hogar_id: espacio,
    titulo: a.titulo,
    tipo: 'vencimiento',
    fecha: a.fecha,
    /* La hora va explícita aunque sea nula. Es un vencimiento: pasa el
       día entero, no a una hora. */
    hora: null,
    nota: a.nota,
    asignado_a: null,
    creado_por: creadoPor,
    aviso_previo: datos.avisar_con,
    documento_origen_id: documentoId,
  }))

  /*
    UNO A UNO, Y NO POR GUSTO.

    Iban los dos avisos en un solo insert, y eso los ataba: si la base
    de datos rechazaba una fila, se caían las dos. Fue exactamente lo
    que pasó — había un índice que solo dejaba UN aviso por documento,
    así que las dos filas nuevas chocaban ENTRE ELLAS y no se creaba
    ninguna. Un contrato que se renueva necesita dos.

    Aquí no vale la regla de «o entran todas o no entra ninguna» que sí
    gobierna las tareas dictadas de una vez. Aquello es una frase que
    alguien dijo entera y hay que respetarla entera; esto son dos hechos
    independientes sobre el mismo papel. Tener el aviso de cancelar sin
    el del vencimiento es peor que tener los dos, y muchísimo mejor que
    no tener ninguno.

    Y el preaviso va primero a propósito: si solo entra uno, que sea el
    que sirve para hacer algo.

    ─────────────────────────────────────────────────────────────
    Y DENTRO DE CADA UNO, DOS INTENTOS.

    La regla de este proyecto —una columna nueva nunca puede romper lo
    que ya funcionaba— la apliqué a todas las LECTURAS y no a esta
    escritura. Si `motivo` no está, el aviso no se crea. Ahora, si el
    primer intento se cae, va el segundo sin `motivo`: se pierde la
    marca —ese aviso habrá que corregirlo a mano el día que cambie la
    fecha— y NO se pierde el aviso, que es lo único que no se puede
    perder.
  */
  const fallos: string[] = []
  let puestos = 0
  let sinMarca: string | null = null

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]

    let { data, error } = await supabase
      .from('recordatorios')
      .insert({ ...fila, motivo: nuevos[i].motivo })
      .select('id')

    if (error) {
      sinMarca = error.message
      ;({ data, error } = await supabase.from('recordatorios').insert(fila).select('id'))
    }

    /* Con `.select()` a propósito. Un insert que la seguridad de la
       base de datos no permite devuelve «todo bien» habiendo escrito
       cero filas, y el aviso que nadie recibe es justo el fallo que no
       se descubre hasta que ya da igual. */
    if (error) fallos.push(`${nuevos[i].motivo}: ${error.message}`)
    else if (!data || data.length === 0) {
      fallos.push(`${nuevos[i].motivo}: la base de datos no ha dejado (cero filas, sin error)`)
    } else puestos++
  }

  /* Solo se llama fallo si no ha entrado NINGUNO. Si entró el que
     importa, decir «no se ha podido» sería mentir hacia el lado malo:
     quien lo lea irá a ponerlo a mano y acabará con dos. */
  if (puestos === 0 && fallos.length > 0) {
    return { puestos: 0, fallo: fallos.join(' · ') }
  }

  return {
    puestos,
    fallo: null,
    sinMarca,
    aMedias: fallos.length > 0 ? fallos.join(' · ') : null,
  }
}
