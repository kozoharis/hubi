import type { SupabaseClient } from '@supabase/supabase-js'
import { hoyAqui } from './tablon'

/*
  ═══════════════════════════════════════════════════════════════
  EL PARTE DEL DÍA
  ═══════════════════════════════════════════════════════════════

  Cuántas horas estuvo y qué tiene que decir de ese día. Lo escribe
  ella y nadie más — ni siquiera quien creó la casa—, que es lo único
  que hace que el número valga algo a fin de mes.

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
  horas: number | null
  nota: string | null
  apuntado_en: string
}

/** El parte de una persona en un día. */
export async function parteDe(
  supabase: Cliente,
  quien: string,
  fecha?: string
): Promise<Parte | null> {
  try {
    const { data, error } = await supabase
      .from('dias_en_casa')
      .select('quien, fecha, horas, nota, apuntado_en')
      .eq('quien', quien)
      .eq('fecha', fecha ?? hoyAqui())
      .maybeSingle()

    if (error || !data) return null
    return data as Parte
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
    const { data, error } = await supabase
      .from('dias_en_casa')
      .select('quien, fecha, horas, nota, apuntado_en')
      .eq('quien', quien)
      .gte('fecha', desde)
      .order('fecha', { ascending: false })

    if (error || !data) return []
    return data as Parte[]
  } catch {
    return []
  }
}

/** «7,5 h» · «45 min». Nunca «7.5». */
export function enHoras(h: number | null): string {
  if (h == null) return ''
  if (h < 1) return `${Math.round(h * 60)} min`
  const texto = Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, '')
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
