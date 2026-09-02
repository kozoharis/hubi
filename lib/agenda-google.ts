import { clienteServidor } from '@/lib/supabase/servidor'
import { descifrar } from '@/lib/cifrado'
import { leerICS, type CitaExterna } from '@/lib/ical'

/*
  Las citas de Google de la casa, listas para enseñar.

  Este archivo es el ÚNICO sitio donde la dirección secreta se
  descifra, y no sale de aquí: lo que devuelve son citas, nunca la
  dirección. Así no hay forma de que se cuele en una pantalla, en un
  registro o en una respuesta de la API por un descuido.

  QUIÉN VE QUÉ. El tuyo siempre. El del otro, SOLO si él lo ha
  encendido en sus Ajustes. Compartir un calendario personal lo decide
  su dueño: dentro van cosas de terceros —con quién se ve, dónde, a qué
  hora— y esa no es una decisión que pueda tomar nadie por él.

  REGLA DE ORO: SI GOOGLE FALLA, HUBI SIGUE.

  Si un archivo no se puede pedir, o llega roto, o tarda demasiado, esa
  persona se queda sin citas y las demás siguen saliendo. Un calendario
  ajeno que no responde no puede tumbar la pantalla donde están las
  tareas de la casa.
*/

export type CitaDeAlguien = CitaExterna & {
  /** De quién es. Va escrito al lado, no solo en el color. */
  de: string
  deId: string
  color: string
}

/* Google tarda en actualizar el archivo —a veces horas—, así que
   pedirlo más de una vez cada cuarto de hora no trae nada nuevo y solo
   hace la Agenda más lenta. */
const CADA = 900

/* Si Google no contesta en seis segundos, se sigue sin sus citas. Más
   vale una Agenda incompleta al momento que una Agenda completa que
   tarda en abrirse. */
const ESPERA = 6000

const COLOR_POR_DEFECTO = '#3B82F6'

/*
  La etiqueta con la que se marca lo guardado de cada calendario.

  Sirve para poder tirarlo a la basura cuando alguien pulsa
  "Actualizar": sin ella habría que esperar los quince minutos sí o sí,
  y un botón que no hace nada durante quince minutos es peor que no
  tener botón.
*/
export function etiquetaIcal(perfilId: string): string {
  return `ical-${perfilId}`
}

/** Quién tiene calendario y se puede enseñar a esta persona. */
export async function calendariosVisibles(
  miId: string
): Promise<{ id: string; nombre: string; color: string }[]> {
  try {
    const supa = clienteServidor()
    const { data, error } = await supa
      .from('perfiles')
      .select('id, nombre, color, ical_cifrado, ical_compartido')

    if (error || !data) return []

    return data
      .filter(
        (p) =>
          p.ical_cifrado &&
          /* El mío siempre; el de los demás, solo si lo han encendido. */
          (p.id === miId || p.ical_compartido === true)
      )
      .map((p) => ({
        id: p.id as string,
        nombre: (p.nombre as string) ?? '',
        color: (p.color as string) || COLOR_POR_DEFECTO,
      }))
  } catch {
    return []
  }
}

/**
 * Las citas de todos los calendarios que esta persona puede ver.
 *
 * Se puede pedir uno solo pasando `soloDe`: es lo que usan los botones
 * de la Agenda para mirar el calendario de uno o de otro.
 */
export async function citasDeLaFamilia(
  miId: string,
  desde: string,
  hasta: string,
  soloDe?: string | null,
  /* `true` = no mires lo guardado, ve a Google ahora. Lo usa el botón
     «Actualizar» y nadie más: sin esto, el botón tiraba lo guardado y
     acto seguido volvía a leer de lo guardado en la misma petición, así
     que el número que enseñaba era el viejo. */
  forzar = false
): Promise<CitaDeAlguien[]> {
  const gente = await calendariosVisibles(miId)
  const cuales = soloDe ? gente.filter((p) => p.id === soloDe) : gente
  if (cuales.length === 0) return []

  /* En paralelo: dos calendarios lentos, uno detrás de otro, son dos
     esperas. A la vez son una. */
  const tandas = await Promise.all(
    cuales.map(async (p) => {
      const citas = await deUnaPersona(p.id, desde, hasta, forzar)
      return citas.map((c) => ({
        ...c,
        de: p.nombre.split(' ')[0],
        deId: p.id,
        color: p.color,
      }))
    })
  )

  return tandas
    .flat()
    .sort(
      (a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? '')
    )
}

async function deUnaPersona(
  perfilId: string,
  desde: string,
  hasta: string,
  forzar = false
): Promise<CitaExterna[]> {
  try {
    const supa = clienteServidor()
    const { data, error } = await supa
      .from('perfiles')
      .select('ical_cifrado')
      .eq('id', perfilId)
      .maybeSingle()

    /* Si la columna todavía no existe —el SQL sin ejecutar— esto falla
       aquí y se acabó. No se lleva por delante la Agenda. */
    if (error || !data?.ical_cifrado) return []

    const url = descifrar(data.ical_cifrado)

    const respuesta = await fetch(url, {
      signal: AbortSignal.timeout(ESPERA),
      ...(forzar
        ? { cache: 'no-store' as const }
        : { next: { revalidate: CADA, tags: [etiquetaIcal(perfilId)] } }),
    })
    if (!respuesta.ok) {
      console.error('[HUBI] El calendario de Google responde', respuesta.status)
      return []
    }

    /*
      LO QUE PUSO HUBI NO VUELVE POR LA PUERTA DE ATRÁS.

      Si el calendario conectado es uno donde HUBI también escribe, sus
      propias tareas volverían aquí como si fueran citas de Google y
      saldrían DOS VECES en la Agenda: una como tarea, con su botón de
      "hecho", y otra como cita ajena que no se puede tocar. Se
      reconocen por la firma que HUBI deja en cada evento y se
      descartan.
    */
    return leerICS(await respuesta.text(), desde, hasta).filter((c) => !c.deHubi)
  } catch (e) {
    console.error('[HUBI] No se ha podido leer el calendario de Google:', e)
    return []
  }
}

/** ¿Tiene esta persona su calendario conectado, y lo comparte? */
export async function miCalendario(
  perfilId: string
): Promise<{ conectado: boolean; compartido: boolean; desde: string | null }> {
  try {
    const supa = clienteServidor()
    const { data } = await supa
      .from('perfiles')
      .select('ical_cifrado, ical_compartido, ical_desde')
      .eq('id', perfilId)
      .maybeSingle()

    return {
      conectado: Boolean(data?.ical_cifrado),
      compartido: data?.ical_compartido === true,
      desde: (data?.ical_desde as string | null) ?? null,
    }
  } catch {
    return { conectado: false, compartido: false, desde: null }
  }
}
