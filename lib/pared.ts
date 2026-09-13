import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacioO } from '@/lib/espacio'

/*
  ═══════════════════════════════════════════════════════════════
  LO QUE COMPARTEN LAS CINCO PANTALLAS DE LA PARED
  ═══════════════════════════════════════════════════════════════

  La pantalla de la cocina dejó de ser un cartel y pasó a ser una
  aplicación con sus cinco sitios —Hoy, Semana, Menú, Tareas, Notas—.
  Las cinco necesitan exactamente lo mismo antes de poder pintar nada:
  saber de qué casa hablan y comprobar que quien mira es de verdad una
  pantalla.

  Estaba escrito dentro de `casa/page.tsx`. Copiarlo cinco veces es la
  manera de que dentro de un mes cuatro digan una cosa y la quinta otra.

  ─────────────────────────────────────────────────────────────
  Y NO ES UNA COMPROBACIÓN DE SEGURIDAD

  Conviene decirlo porque se parece mucho a una. Que una persona no
  entre aquí no protege nada: esta pantalla no enseña nada que ella no
  pueda ver en su HUBI. Lo que protege es la BASE, con el techo de la
  clase `dispositivo` y las restrictivas de `visible_en_casa`.

  Esto es una comprobación de SITIO: quien tiene manos quiere la
  aplicación, no un cartel de pared.
*/
export async function laPared(): Promise<{
  supabase: SupabaseClient
  casa: string
  nombre: string
}> {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const casa = await elEspacioO(supabase)

  const [{ data: mio }, { data: laCasa }] = await Promise.all([
    supabase
      .from('miembros')
      .select('clase')
      .eq('perfil_id', user.id)
      .eq('hogar_id', casa)
      .maybeSingle(),
    supabase.from('hogares').select('nombre').eq('id', casa).maybeSingle(),
  ])

  if ((mio?.clase as string | null) !== 'dispositivo') redirect('/')

  return {
    supabase: supabase as unknown as SupabaseClient,
    casa,
    nombre: (laCasa?.nombre as string | null) ?? 'En casa',
  }
}

/*
  ── LO QUE SE PIDE, Y LO QUE NO SE FILTRA ──

  Sin una sola condición de visibilidad, A PROPÓSITO. Lo pone la base:
  `recordatorios_solo_lo_de_la_casa_en_la_pantalla` (paso 63) y
  `notas_solo_lo_de_la_casa_en_la_pantalla` (paso 64) ya filtran por
  `visible_en_casa`, y el techo de la clase lo aplica `nivel_en`.

  Si estas pantallas filtraran por su cuenta habría dos reglas para lo
  mismo, y la de arriba —la de verdad— dejaría de ser la única. El día
  que una se olvide, que se olvide la que no protege.
*/

export type CosaDeLaPared = {
  id: string
  titulo: string
  fecha: string | null
  hora: string | null
  estado: 'pendiente' | 'hecho'
}

/** Lo apuntado entre dos fechas, ambas incluidas. */
export async function loApuntado(
  supabase: SupabaseClient,
  casa: string,
  desde: string,
  hasta: string
): Promise<CosaDeLaPared[]> {
  const { data } = await supabase
    .from('recordatorios')
    .select('id, titulo, fecha, hora, estado')
    .eq('hogar_id', casa)
    .is('eliminado_en', null)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true, nullsFirst: true })
    .limit(200)

  return (data ?? []) as CosaDeLaPared[]
}

export type MenuDelDia = { fecha: string; momento: string; que: string | null }

/** Los menús de una semana. Vacío y sin ruido si el sql/48 no está. */
export async function losMenus(
  supabase: SupabaseClient,
  casa: string,
  desde: string,
  hasta: string
): Promise<MenuDelDia[]> {
  try {
    const { data, error } = await supabase
      .from('menus')
      .select('fecha, momento, que')
      .eq('hogar_id', casa)
      .gte('fecha', desde)
      .lte('fecha', hasta)
    if (error) return []
    return (data ?? []) as MenuDelDia[]
  } catch {
    return []
  }
}
