import type { SupabaseClient } from '@supabase/supabase-js'

/*
  ═══════════════════════════════════════════════════════════════
  LAS CASAS DE UNA PERSONA
  ═══════════════════════════════════════════════════════════════

  Casi todo el mundo tendrá una y no verá nada de esto nunca. Pero el
  hijo que tiene su HUBI y además ayuda con el de sus padres tiene dos,
  y necesita saber cuál está mirando y poder cambiar.

  ─────────────────────────────────────────────────────────────
  TODO ESTO VA ENVUELTO

  `aceptado_en` y `casa_activa` son columnas nuevas. Si el SQL 34 no se
  ha ejecutado, Postgres no dice «esa columna no existe»: rechaza la
  consulta ENTERA. Y esto lo lee la cabecera, que sale en todas las
  pantallas — un fallo aquí dejaría a alguien sin poder navegar.

  Sin las columnas se comporta como antes: una casa, sin selector.
*/

export type Casa = {
  id: string
  nombre: string
  /** La que está mirando ahora mismo. */
  mirando: boolean
  /** Se la han ofrecido y todavía no ha contestado. */
  pendiente: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

export async function casasDe(supabase: Cliente, perfilId: string): Promise<Casa[]> {
  try {
    const { data: filas, error } = await supabase
      .from('miembros')
      .select('hogar_id, aceptado_en')
      .eq('perfil_id', perfilId)
      .order('unido_en')

    if (error || !filas || filas.length === 0) return []

    const ids = filas.map((m: { hogar_id: string }) => m.hogar_id)

    const { data: casas } = await supabase.from('hogares').select('id, nombre').in('id', ids)

    const nombreDe = new Map(
      (casas ?? []).map((h: { id: string; nombre: string }) => [h.id, h.nombre])
    )

    /* Cuál mira. Si no ha elegido ninguna, la primera aceptada — que
       es exactamente lo que contesta `mi_hogar()`. Las dos reglas
       tienen que decir lo mismo o la cabecera enseñaría una casa y la
       aplicación estaría en otra. */
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('casa_activa')
      .eq('id', perfilId)
      .maybeSingle()

    const aceptadas = filas.filter((m: { aceptado_en: string | null }) => m.aceptado_en)

    const elegida =
      (perfil?.casa_activa as string | null) &&
      aceptadas.some((m: { hogar_id: string }) => m.hogar_id === perfil?.casa_activa)
        ? (perfil?.casa_activa as string)
        : (aceptadas[0]?.hogar_id ?? null)

    return filas.map((m: { hogar_id: string; aceptado_en: string | null }) => ({
      id: m.hogar_id,
      nombre: nombreDe.get(m.hogar_id) ?? 'Una casa',
      mirando: m.hogar_id === elegida,
      pendiente: !m.aceptado_en,
    }))
  } catch {
    return []
  }
}
