/*
  ═══════════════════════════════════════════════════════════════
  LOS ENLACES DE LA AGENDA, SIN PERDER DÓNDE ESTABAS
  ═══════════════════════════════════════════════════════════════

  Todos los enlaces de la Agenda estaban escritos a mano y enteros:
  `/agenda`, `/agenda?ver=hechas`, `/agenda?vista=mes`. Cada uno era
  una dirección completa, así que al pulsarlo se llevaba por delante
  TODO lo demás que había en la URL.

  Lo que pasaba de verdad, y no es teórico:

    · Estabas mirando marzo, pulsabas «Mes» y volvías al mes actual.
    · Estabas en la semana del 20 con el calendario de una persona
      filtrado, pulsabas «Por hacer» y volvías a esta semana y a
      «Los dos».
    · Estabas en «Hechas», filtrabas por una persona, y volvías a
      «Por hacer».

  Nada de eso avisa. Simplemente pierdes lo que habías puesto, y la
  segunda vez que te pasa dejas de fiarte de los botones.

  Esto no es un problema de diseño: es la pantalla deshaciendo el
  trabajo de quien la usa. Se arregla en un sitio — una función que
  parte de lo que HAY y solo cambia lo que se le pida.

  El orden de los parámetros es fijo para que la misma pantalla dé
  siempre la misma dirección: si no, dos rutas idénticas se leerían
  como distintas y se perdería la caché del navegador.
*/

export type ParamsAgenda = {
  vista?: string | null
  ver?: string | null
  mes?: string | null
  dia?: string | null
  semana?: string | null
  de?: string | null
}

const ORDEN = ['vista', 'ver', 'mes', 'dia', 'semana', 'de'] as const

/**
 * La dirección de la Agenda partiendo de la actual.
 *
 * `cambios` manda: poner `null` en algo lo quita, y lo que no se
 * nombra se conserva tal cual estaba.
 *
 *   enlaceAgenda(actuales, { ver: 'hechas' })   → cambia solo la pestaña
 *   enlaceAgenda(actuales, { de: null })        → quita solo el filtro
 */
export function enlaceAgenda(actuales: ParamsAgenda, cambios: ParamsAgenda = {}): string {
  const junto: ParamsAgenda = { ...actuales, ...cambios }

  const partes: string[] = []
  for (const clave of ORDEN) {
    const valor = junto[clave]
    if (valor === null || valor === undefined || valor === '') continue
    partes.push(`${clave}=${encodeURIComponent(valor)}`)
  }

  return partes.length > 0 ? `/agenda?${partes.join('&')}` : '/agenda'
}

/**
 * El lunes de la semana de esa fecha, en texto.
 *
 * Sirve para que al pasar de un día a la vista de semana se llegue a
 * LA SEMANA DE ESE DÍA, y no a la de hoy.
 *
 * Se calcula a mediodía a propósito: sumar o restar días a medianoche
 * se rompe la noche que cambia la hora, porque veinticuatro horas
 * después de las 00:00 pueden ser las 23:00 del mismo día.
 */
export function lunesDeISO(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null

  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null

  /* getDay() da 0 en domingo; en España la semana empieza en lunes. */
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))

  const dos = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}
