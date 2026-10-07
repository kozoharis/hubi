import type { SupabaseClient } from '@supabase/supabase-js'
import { hoyAqui } from './tablon'

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
  /** Cada cuántas semanas vuelve: 1, 2, 3 o 4. Del sql/97. */
  cada_semanas: number
  /** Desde qué semana se cuenta. Del sql/97. */
  desde: string | null
}

/* Lo que se pide a la base. Separado en dos porque las columnas del
   sql/97 pueden no estar todavía: si no están, Postgres rechaza la
   consulta ENTERA y la casa se quedaría sin rutinas por una casilla
   que aún no existe. Es la misma red que ya hay en los menús. */
const CAMPOS = 'id, que, dia, hora, para, activa, orden, cada_semanas, desde'
const CAMPOS_SIN = 'id, que, dia, hora, para, activa, orden'

/** Lo que falta cuando el sql/97 todavía no se ha ejecutado. */
function comoSiFueraSemanal(filas: unknown[]): Rutina[] {
  return (filas as Rutina[]).map((r) => ({
    ...r,
    cada_semanas: r.cada_semanas ?? 1,
    desde: r.desde ?? null,
  }))
}

/* ───────────────────────────────────────────────────────────── */

/** El lunes de la semana en que cae esa fecha. */
function elLunesDe(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(a, m - 1, d)
  f.setDate(f.getDate() - ((f.getDay() + 6) % 7))
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`
}

/**
 * ¿Toca esta semana?
 *
 * Una rutina no tiene fecha —sólo día de la semana—, así que «cada dos
 * semanas» no significa nada hasta que se dice DESDE cuál. Con el
 * ancla, la cuenta es una resta: semanas enteras entre su lunes y el
 * lunes de hoy, y el resto de dividir por el periodo.
 *
 * Se cuenta de lunes a lunes y no en días sueltos: así da igual que el
 * ancla se guardara un miércoles — la semana es la misma. Y se hace
 * con fechas a mediodía, por lo de siempre: el servidor está en
 * Londres y la casa en Canarias.
 *
 * Sin ancla o con periodo 1, toca siempre. Es lo que hace que una
 * rutina de antes del sql/97 se comporte exactamente igual que ayer.
 *
 * La misma cuenta está en `toca_esta_semana()` del sql/97, para poder
 * comprobarla contra los datos desde Supabase el día que algo no
 * cuadre.
 */
export function tocaEstaSemana(
  desde: string | null,
  cada: number | null,
  fecha: string
): boolean {
  const n = cada ?? 1
  if (n <= 1 || !desde) return true

  const a = new Date(`${elLunesDe(desde)}T12:00:00`)
  const b = new Date(`${elLunesDe(fecha)}T12:00:00`)
  const semanas = Math.round((b.getTime() - a.getTime()) / (7 * 86_400_000))

  /* `%` de JavaScript conserva el signo, así que una rutina anclada en
     el futuro daría un resto negativo y no casaría nunca. Se suma el
     periodo antes de tomar el resto. */
  return (((semanas % n) + n) % n) === 0
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
export async function planDeLaCasa(supabase: Cliente, espacio: string): Promise<Rutina[]> {
  try {
    const pedir = (campos: string) =>
      supabase
        .from('rutinas')
        .select(campos)
        .eq('hogar_id', espacio)
        .order('dia')
        .order('orden')
        .order('hora', { ascending: true, nullsFirst: true })

    const { data, error } = await pedir(CAMPOS)
    if (!error && data) return comoSiFueraSemanal(data)

    /* Sin el sql/97 todavía: se vuelve a pedir sin las dos columnas
       nuevas y el plan sale igual que ayer. */
    const segunda = await pedir(CAMPOS_SIN)
    if (segunda.error || !segunda.data) return []
    return comoSiFueraSemanal(segunda.data)
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
  espacio: string,
  deQuien?: string | null,
  fecha?: string
): Promise<RutinaHoy[]> {
  try {
    const dia = fecha ?? hoyAqui()

    const pedir = (campos: string) => {
      let q = supabase
        .from('rutinas')
        .select(campos)
        .eq('hogar_id', espacio)
        .eq('dia', diaDe(dia))
        .eq('activa', true)
        .order('orden')
        .order('hora', { ascending: true, nullsFirst: true })

      /* Las suyas Y las de la casa sin dueño: si «sacar la basura» no
         tiene nombre puesto, es de quien esté. Esconderla a todos sería
         la manera más segura de que no la haga nadie. */
      if (deQuien) q = q.or(`para.eq.${deQuien},para.is.null`)
      return q
    }

    let crudas: unknown[] | null = null
    const primera = await pedir(CAMPOS)
    if (!primera.error && primera.data) crudas = primera.data
    else {
      /* Sin el sql/97 todavía. Se pide sin las columnas nuevas y todo
         se comporta como antes: cada semana. */
      const segunda = await pedir(CAMPOS_SIN)
      if (segunda.error || !segunda.data) return []
      crudas = segunda.data
    }

    /*
      ── Y AQUÍ SE DECIDE SI ESTA SEMANA TOCA ──

      Se filtra en MAPPEL y no en la consulta a propósito. La cuenta
      —semanas enteras entre dos lunes— necesita saber qué día es
      HOY donde vive la familia, y eso lo sabe `hoyAqui()`, no
      Postgres: el servidor va en hora de Londres y una rutina de un
      domingo por la noche se contaría en la semana siguiente.

      Y porque este es el ÚNICO sitio desde el que se pregunta qué
      toca: seis pantallas llaman aquí. Filtrando dentro, las seis se
      enteran de las semanas sin tocar una línea.
    */
    const todas = comoSiFueraSemanal(crudas)
    const data = todas.filter((r) => tocaEstaSemana(r.desde, r.cada_semanas, dia))

    const ids = data.map((r) => r.id)
    if (ids.length === 0) return []

    const { data: hechas } = await supabase
      .from('rutinas_hechas')
      .select('rutina_id, quien')
      .eq('hogar_id', espacio)
      .eq('fecha', dia)
      .in('rutina_id', ids)

    const marcada = new Map(
      (hechas ?? []).map((h: { rutina_id: string; quien: string | null }) => [h.rutina_id, h.quien])
    )

    return data.map((r) => ({
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
