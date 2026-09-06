import type { SupabaseClient } from '@supabase/supabase-js'

/*
  ═══════════════════════════════════════════════════════════════
  LAS NOTAS DE LA CASA
  ═══════════════════════════════════════════════════════════════

  El papel de la nevera. Sin fecha, sin «hecho», sin caducidad:

      "La llave del garaje está en el cajón de la entrada"
      "El del agua viene los martes por la mañana"
      "He dejado los papeles del seguro encima de la mesa"

  Nada de esto es una tarea. Si estuviera en la Agenda saldría en
  «Por hacer · 14» hasta el fin de los tiempos, y una lista de tareas
  que nunca baja de catorce deja de mirarse a la semana.

  ─────────────────────────────────────────────────────────────
  TODO ESTO VA ENVUELTO

  La tabla es del SQL 35. Si no se ha ejecutado, Postgres no dice
  «esa tabla no existe» de una manera que se pueda ignorar: revienta
  la consulta. Y esto lo lee el Inicio, que es la primera pantalla de
  la mañana. Sin tabla, se comporta como si no hubiera notas.
*/

export type Nota = {
  id: string
  texto: string
  /** Nulo = para toda la casa. Con alguien = se la han dejado a él. */
  para: string | null
  escrita_por: string
  creada_en: string
  cambiada_en: string | null
  vista_en: string | null
  guardada_en: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

/**
 * Las notas de la casa. `guardadas` decide cuáles: las puestas en el
 * corcho, o las que alguien apartó.
 */
export async function notasDe(
  supabase: Cliente,
  guardadas = false
): Promise<Nota[]> {
  try {
    const q = supabase
      .from('notas')
      .select('id, texto, para, escrita_por, creada_en, cambiada_en, vista_en, guardada_en')
      .order('creada_en', { ascending: false })
      .limit(guardadas ? 60 : 100)

    const { data, error } = guardadas
      ? await q.not('guardada_en', 'is', null)
      : await q.is('guardada_en', null)

    if (error || !data) return []
    return data as Nota[]
  } catch {
    return []
  }
}

/**
 * Lo que necesita el rótulo del Inicio: cuántas hay puestas y cuántas
 * son para ti y todavía no has dicho que las has visto.
 *
 * Las dos en UNA consulta, y sin traerse el texto: el Inicio ya hace
 * seis, y el texto de cincuenta notas para escribir un número sería
 * traerse la pantalla entera para no enseñarla.
 */
export async function cuantasNotas(
  supabase: Cliente,
  perfilId: string
): Promise<{ puestas: number; paraMi: number }> {
  const nada = { puestas: 0, paraMi: 0 }

  try {
    const { data, error } = await supabase
      .from('notas')
      .select('id, para, vista_en')
      .is('guardada_en', null)
      .limit(200)

    if (error || !data) return nada

    return {
      puestas: data.length,
      paraMi: data.filter(
        (n: { para: string | null; vista_en: string | null }) =>
          n.para === perfilId && !n.vista_en
      ).length,
    }
  } catch {
    return nada
  }
}

/**
 * Las notas que te están esperando A TI.
 *
 * Es lo único del Inicio que va dirigido a una persona en concreto, y
 * hasta ahora solo salía como un número —«2 · una es para ti»—. Un
 * número no dice qué te han dejado, así que había que entrar a
 * mirarlo; y una nota que hay que ir a buscar es una nota que a veces
 * no se lee.
 *
 * Solo las NO VISTAS: en cuanto dices que la has visto deja de
 * reclamarte. Si siguiera saliendo, el Inicio acabaría con una lista
 * fija que se deja de mirar en una semana.
 */
export async function paraMi(
  supabase: Cliente,
  perfilId: string,
  cuantas = 3
): Promise<Nota[]> {
  try {
    const { data, error } = await supabase
      .from('notas')
      .select('id, texto, para, escrita_por, creada_en, cambiada_en, vista_en, guardada_en')
      .eq('para', perfilId)
      .is('vista_en', null)
      .is('guardada_en', null)
      .order('creada_en', { ascending: false })
      .limit(cuantas)

    if (error || !data) return []
    return data as Nota[]
  } catch {
    return []
  }
}

/**
 * Una nota con su fecha ya escrita en palabras.
 *
 * El texto se calcula EN EL SERVIDOR y viaja hecho. Calcularlo en el
 * navegador significaría llamar a `Date.now()` mientras se pinta, y
 * entonces el servidor escribe «Hace 4 minutos», el móvil escribe
 * «Hace 5» y React se queja de que no coinciden.
 */
export type NotaVista = Nota & { cuando: string }

export function conFecha(notas: Nota[]): NotaVista[] {
  return notas.map((n) => ({ ...n, cuando: cuandoSePuso(n.creada_en) }))
}

/*
  ─────────────────────────────────────────────────────────────
  «Hace un rato» · «Ayer» · «El 3 de agosto»

  Una nota no tiene hora a la que pase nada, así que la fecha exacta
  no importa casi nunca: lo que se quiere saber es si es de hoy o
  lleva ahí un mes. Se dice en palabras, y solo se pone la fecha
  entera cuando ya es vieja de verdad.
*/
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function cuandoSePuso(iso: string): string {
  const entonces = new Date(iso)
  if (Number.isNaN(entonces.getTime())) return ''

  const minutos = Math.round((Date.now() - entonces.getTime()) / 60_000)

  if (minutos < 2) return 'Ahora mismo'
  if (minutos < 60) return `Hace ${minutos} minutos`

  const horas = Math.round(minutos / 60)
  if (horas < 5) return horas === 1 ? 'Hace una hora' : `Hace ${horas} horas`

  const hoy = new Date()
  const mismoDia =
    entonces.getFullYear() === hoy.getFullYear() &&
    entonces.getMonth() === hoy.getMonth() &&
    entonces.getDate() === hoy.getDate()
  if (mismoDia) return 'Hoy'

  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1)
  const fueAyer =
    entonces.getFullYear() === ayer.getFullYear() &&
    entonces.getMonth() === ayer.getMonth() &&
    entonces.getDate() === ayer.getDate()
  if (fueAyer) return 'Ayer'

  const dias = Math.round((hoy.getTime() - entonces.getTime()) / 86_400_000)
  if (dias < 7) return `Hace ${dias} días`

  const dia = `${entonces.getDate()} de ${MESES[entonces.getMonth()]}`
  return entonces.getFullYear() === hoy.getFullYear() ? `El ${dia}` : `El ${dia} de ${entonces.getFullYear()}`
}
