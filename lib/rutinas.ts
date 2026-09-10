import type { SupabaseClient } from '@supabase/supabase-js'
import { hoyAqui } from './tablon'
import { elEspacioO } from './espacio'

/*
  ═══════════════════════════════════════════════════════════════
  LO DE CADA SEMANA
  ═══════════════════════════════════════════════════════════════

  El plan de la casa: qué se hace cada día y quién lo hace. Cambiar
  las sábanas los lunes, regar los miércoles, la basura a diario.

  ─────────────────────────────────────────────────────────────
  UNA RUTINA SIN MARCAR NO ES UNA DEUDA

  Es la diferencia con una tarea, y es toda la razón de que esto sea
  una tabla aparte. Una tarea sin hacer se arrastra en rojo hasta que
  se hace — y debe hacerlo, porque la ITV no se olvida sola. Un lunes
  en que no se cambiaron las sábanas, en cambio, es un lunes que pasó:
  el lunes que viene vuelve.

  Si esto fueran tareas repetidas, seis trabajos por tres días serían
  dieciocho al mes, y bastaría olvidarse de marcar un par para que la
  agenda se llenara de rojo. Y una lista que siempre tiene rojo deja
  de mirarse — con lo que se pierde también el rojo que sí importaba.

  ─────────────────────────────────────────────────────────────
  TODO VA ENVUELTO

  Las tablas son del SQL 38. Sin ellas, esto contesta «no hay nada» y
  ninguna pantalla se rompe.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

export type Rutina = {
  id: string
  que: string
  /** 1 = lunes … 7 = domingo. */
  dia: number
  hora: string | null
  para: string | null
  activa: boolean
  orden: number
}

export type RutinaHoy = Rutina & {
  hecha: boolean
  /** Quién la marcó, si alguien lo hizo. */
  quien: string | null
}

/* En lunes y no en domingo: en España la semana empieza en lunes, y
   estos números los lee gente en una pantalla, no un informe. */
export const DIAS = [
  { n: 1, corto: 'L', largo: 'lunes' },
  { n: 2, corto: 'M', largo: 'martes' },
  { n: 3, corto: 'X', largo: 'miércoles' },
  { n: 4, corto: 'J', largo: 'jueves' },
  { n: 5, corto: 'V', largo: 'viernes' },
  { n: 6, corto: 'S', largo: 'sábado' },
  { n: 7, corto: 'D', largo: 'domingo' },
]

/** Qué día de la semana es una fecha, en nuestra numeración. */
export function diaDe(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  const js = new Date(a, m - 1, d).getDay() // 0 = domingo
  return js === 0 ? 7 : js
}

/** Todo el plan de la casa. Para la pantalla que lo monta. */
export async function planDeLaCasa(supabase: Cliente): Promise<Rutina[]> {
  try {
    const { data, error } = await supabase
      .from('rutinas')
      .select('id, que, dia, hora, para, activa, orden')
      .eq('hogar_id', await elEspacioO(supabase))
      .order('dia')
      .order('orden')
      .order('hora', { ascending: true, nullsFirst: true })

    if (error || !data) return []
    return data as Rutina[]
  } catch {
    return []
  }
}

/**
 * Lo que toca hoy, ya con quién la ha marcado.
 *
 * `deQuien` recorta a las de una persona. Se usa en el Inicio de quien
 * ayuda en casa: ahí lo suyo es lo único que importa, y ver también
 * las de los demás convertiría su pantalla en la de otro.
 */
export async function loDeHoy(
  supabase: Cliente,
  deQuien?: string | null,
  fecha?: string
): Promise<RutinaHoy[]> {
  try {
    const dia = fecha ?? hoyAqui()

    let q = supabase
      .from('rutinas')
      .select('id, que, dia, hora, para, activa, orden')
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('dia', diaDe(dia))
      .eq('activa', true)
      .order('orden')
      .order('hora', { ascending: true, nullsFirst: true })

    /* Las suyas Y las de la casa sin dueño: si «sacar la basura» no
       tiene nombre puesto, es de quien esté. Esconderla a todos sería
       la manera más segura de que no la haga nadie. */
    if (deQuien) q = q.or(`para.eq.${deQuien},para.is.null`)

    const { data, error } = await q
    if (error || !data) return []

    const ids = (data as Rutina[]).map((r) => r.id)
    if (ids.length === 0) return []

    const { data: hechas } = await supabase
      .from('rutinas_hechas')
      .select('rutina_id, quien')
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('fecha', dia)
      .in('rutina_id', ids)

    const marcada = new Map(
      (hechas ?? []).map((h: { rutina_id: string; quien: string | null }) => [h.rutina_id, h.quien])
    )

    return (data as Rutina[]).map((r) => ({
      ...r,
      hecha: marcada.has(r.id),
      quien: marcada.get(r.id) ?? null,
    }))
  } catch {
    return []
  }
}

/*
  ─────────────────────────────────────────────────────────────
  LO QUE SE OFRECE AL EMPEZAR

  Una pantalla en blanco que dice «añade tu primera rutina» no la
  rellena casi nadie: hay que pensarlas todas de golpe y escribirlas
  una a una, y eso se deja para luego y luego no llega.

  Con la lista puesta se toca lo que valga y se quita lo que no, que
  es MUCHO más fácil que inventar de cero. No son las de nadie en
  concreto: son las que aparecen en cualquier casa, y por eso valen
  como punto de partida y no como plantilla que haya que respetar.
*/
export const DE_SIEMPRE: { que: string; dias: number[] }[] = [
  { que: 'Cambiar las sábanas', dias: [1] },
  { que: 'Poner la lavadora', dias: [1, 4] },
  { que: 'Planchar', dias: [3] },
  { que: 'Limpieza general', dias: [2, 5] },
  { que: 'Baños', dias: [2, 5] },
  { que: 'Cocina a fondo', dias: [5] },
  { que: 'Sacar la basura', dias: [1, 2, 3, 4, 5] },
  { que: 'Regar las plantas', dias: [1, 4] },
  { que: 'Hacer la compra', dias: [3] },
]
