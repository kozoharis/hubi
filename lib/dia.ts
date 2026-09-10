import type { SupabaseClient } from '@supabase/supabase-js'
import { hoyAqui } from './tablon'
import { elEspacioO } from './espacio'

/*
  ═══════════════════════════════════════════════════════════════
  EL PARTE DEL DÍA
  ═══════════════════════════════════════════════════════════════

  Las horas de MÁS y lo que tenga que contar de ese día. Lo escribe
  ella y nadie más — ni siquiera quien creó la casa—, que es lo único
  que hace que el número valga algo a fin de mes.

  ─────────────────────────────────────────────────────────────
  LO NORMAL NO SE APUNTA

  El horario está acordado: viene lunes, miércoles y viernes de nueve
  a una. Eso no cambia y pedirle que lo escriba cada día es dar
  trabajo a cambio de un dato que ya saben los dos.

  Lo que se apunta es lo que se SALE de lo acordado: el día que se
  quedó una hora más. Y el efecto es el que importa — el estado normal
  pasa a ser no escribir nada. Un campo que hay que rellenar todos los
  días se rellena mal a la tercera semana.

  ─────────────────────────────────────────────────────────────
  APUNTES PARA CUADRAR EL MES, NO UN REGISTRO DE JORNADA

  Se dice aquí y se dice en la pantalla. Un registro de jornada tiene
  requisitos legales que HUBI no cumple, y fingir que los cumple sería
  peor que no tenerlo.

  ─────────────────────────────────────────────────────────────
  TODO ENVUELTO

  La tabla es del SQL 40. Sin ella esto devuelve «no hay parte» y
  ninguna pantalla se rompe.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

export type Parte = {
  quien: string
  fecha: string
  /** Horas de MÁS sobre lo acordado. Nulo = un día normal. */
  extra: number | null
  nota: string | null
  apuntado_en: string
}

const CAMPOS = 'quien, fecha, horas_extra, nota, apuntado_en'
/* Cómo se llamaba antes del SQL 41, por si todavía no se ha ejecutado. */
const VIEJOS = 'quien, fecha, horas, nota, apuntado_en'

/* La fila tal y como viene, antes de ponerle nuestros nombres. */
type Fila = {
  quien: string
  fecha: string
  horas_extra?: number | string | null
  horas?: number | string | null
  nota: string | null
  apuntado_en: string
}

function comoParte(f: Fila): Parte {
  const bruto = f.horas_extra ?? f.horas ?? null
  return {
    quien: f.quien,
    fecha: f.fecha,
    extra: bruto == null ? null : Number(bruto),
    nota: f.nota,
    apuntado_en: f.apuntado_en,
  }
}

/** El parte de una persona en un día. */
export async function parteDe(
  supabase: Cliente,
  quien: string,
  fecha?: string
): Promise<Parte | null> {
  try {
    const dia = fecha ?? hoyAqui()
    const espacio = await elEspacioO(supabase)

    /* Dos intentos: `horas_extra` es del SQL 41 y, si no está,
       Postgres rechaza la consulta ENTERA en vez de decir «esa columna
       no existe». La misma trampa de siempre. */
    const pedir = (campos: string) =>
      supabase
        .from('dias_en_casa')
        .select(campos)
        .eq('hogar_id', espacio)
        .eq('quien', quien)
        .eq('fecha', dia)
        .maybeSingle()

    let fila = await pedir(CAMPOS)
    if (fila.error) fila = await pedir(VIEJOS)

    if (fila.error || !fila.data) return null
    return comoParte(fila.data as unknown as Fila)
  } catch {
    return null
  }
}

/** Los últimos partes de una persona, para cuadrar el mes. */
export async function partesDe(
  supabase: Cliente,
  quien: string,
  desde: string
): Promise<Parte[]> {
  try {
    const espacio = await elEspacioO(supabase)
    const pedir = (campos: string) =>
      supabase
        .from('dias_en_casa')
        .select(campos)
        .eq('hogar_id', espacio)
        .eq('quien', quien)
        .gte('fecha', desde)
        .order('fecha', { ascending: false })

    let filas = await pedir(CAMPOS)
    if (filas.error) filas = await pedir(VIEJOS)

    if (filas.error || !filas.data) return []
    return (filas.data as unknown as Fila[]).map(comoParte)
  } catch {
    return []
  }
}

/**
 * «1 h» · «1,5 h» · «30 min». Nunca «1.5».
 *
 * La coma y no el punto: en un móvil español, «1.5 h» se lee mal por
 * la misma razón por la que aquí se escribe 1.500 para mil quinientos.
 */
export function enHoras(h: number | null): string {
  if (h == null) return ''
  if (h < 1) return `${Math.round(h * 60)} min`
  const texto = Number.isInteger(h) ? String(h) : String(Number(h.toFixed(2)))
  return `${texto.replace('.', ',')} h`
}

/**
 * El primer día del mes de una fecha.
 *
 * Nunca `new Date()` a secas para esto: la hora del servidor puede ir
 * un día por delante de la de aquí, y el día 1 a las once de la noche
 * eso cambiaría de mes.
 */
export function primeroDelMes(iso?: string): string {
  const [a, m] = (iso ?? hoyAqui()).split('-')
  return `${a}-${m}-01`
}
