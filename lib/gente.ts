import type { SupabaseClient } from '@supabase/supabase-js'

/*
  ═══════════════════════════════════════════════════════════════
  QUIÉN ES QUIÉN, Y DE QUÉ COLOR
  ═══════════════════════════════════════════════════════════════

  En una casa con cuatro personas dentro, todo lo que hacen se mezcla
  en las mismas listas: la agenda, el corcho, lo de hoy. Saber QUIÉN
  ha dejado cada cosa obliga hoy a leerse la letra pequeña de cada
  línea, una por una.

  Un color por persona contesta eso sin leer. Es lo que hace cualquier
  calendario compartido, y funciona porque el color se reconoce de
  reojo y el nombre no.

  ─────────────────────────────────────────────────────────────
  EL COLOR ES DE LA PERSONA, NO DEL PAPEL

  Sale del papel —la ayuda de un color, el asesor de otro— pero se
  guarda por persona. Dos asesores del mismo color no se distinguen
  entre sí, que es justo lo que veníamos a resolver.

  ─────────────────────────────────────────────────────────────
  Y SI FALTA LA COLUMNA, HAY COLOR IGUAL

  `miembros.color` es del SQL 39. Sin él, cada uno recibe el de su
  papel: se pierde el poder distinguir a dos personas del mismo papel,
  pero ninguna pantalla se queda en blanco por eso.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

export type Quien = {
  id: string
  nombre: string
  rol: string | null
  color: string
  /** Invitado pero todavía sin aceptar. */
  pendiente: boolean
}

/*
  La paleta. Colores que se leen igual en claro y en oscuro: nada de
  pastel, que a catorce píxeles es gris.

  Es la misma lista que usa el SQL 39 al repartirlos, y las dos tienen
  que moverse juntas.
*/
export const COLORES = [
  '#14B8A6', // turquesa
  '#0EA5E9', // azul cielo
  '#F59E0B', // ámbar
  '#8B5CF6', // morado
  '#EC4899', // rosa
  '#3B82F6', // azul
  '#F97316', // naranja
  '#10B981', // verde
  '#64748B', // pizarra
]

/** El color de salida de un papel, cuando no hay otro guardado. */
export function colorDeRol(rol: string | null | undefined): string {
  switch (rol) {
    case 'ayuda':
      return '#0EA5E9'
    case 'asesor':
      return '#F59E0B'
    case 'mirar':
      return '#64748B'
    default:
      return '#14B8A6'
  }
}

/**
 * Los de esta casa, con su papel y su color.
 *
 * Con la SESIÓN: las políticas por hogar son justamente lo que hace
 * que aquí salgan los tuyos y no los de otra casa. Y con `hogar_id`
 * explícito además, porque las políticas dejan ver también TUS filas
 * en otras casas —hacen falta para las invitaciones— y quien tenga
 * dos se vería a sí mismo dos veces.
 */
export async function genteDeLaCasa(
  supabase: Cliente,
  hogarId: string | null
): Promise<Quien[]> {
  if (!hogarId) return []

  try {
    /* `color` y `rol` son columnas nuevas. Si el SQL 39 no se ha
       ejecutado, Postgres no dice «esa columna no existe»: rechaza la
       consulta ENTERA. Por eso el segundo intento. */
    let filas: {
      perfil_id: string
      rol?: string | null
      color?: string | null
      aceptado_en?: string | null
    }[] = []

    const completa = await supabase
      .from('miembros')
      .select('perfil_id, rol, color, aceptado_en')
      .eq('hogar_id', hogarId)
      .order('unido_en')

    if (completa.error) {
      const basica = await supabase
        .from('miembros')
        .select('perfil_id')
        .eq('hogar_id', hogarId)
        .order('unido_en')
      filas = (basica.data ?? []) as typeof filas
    } else {
      filas = (completa.data ?? []) as typeof filas
    }

    const ids = filas.map((m) => m.perfil_id)
    if (ids.length === 0) return []

    const { data: perfiles } = await supabase
      .from('perfiles')
      .select('id, nombre')
      .in('id', ids)

    const nombreDe = new Map(
      (perfiles ?? []).map((p: { id: string; nombre: string }) => [p.id, p.nombre])
    )

    return filas.map((m) => ({
      id: m.perfil_id,
      nombre: nombreDe.get(m.perfil_id) ?? 'Alguien',
      rol: m.rol ?? null,
      color: m.color ?? colorDeRol(m.rol),
      pendiente: m.aceptado_en === null,
    }))
  } catch {
    return []
  }
}

/** El asesor de la casa, si hay alguno dentro. */
export function elAsesor(gente: Quien[]): Quien | null {
  return gente.find((g) => g.rol === 'asesor' && !g.pendiente) ?? null
}
