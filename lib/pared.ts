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
  grupo_id?: string | null
}

/*
  ═══════════════════════════════════════════════════════════════
  ⚠️  UNA COSA PARA DOS PERSONAS SE ENSEÑA UNA VEZ
  ═══════════════════════════════════════════════════════════════

  Lo vio Haris en la pared: «Presentación del cole de Paula» salía DOS
  VECES, el mismo día y a la misma hora. Parecía un duplicado en la base
  y no lo era.

  En HUBI, **una tarea para dos personas SON dos filas**. Está decidido
  y bien decidido (`app/api/recordatorios/route.ts`): cada uno marca la
  suya, porque que Juan Miguel firme los papeles no los firma por
  Conchita. Nacen con el mismo `grupo_id` para saber que se apuntaron
  juntas.

  En el teléfono eso se lee sin problema: cada fila lleva el nombre de
  su dueño al lado, así que dos filas son dos personas.

  **En la pared no.** La pared no dice de quién es nada —a propósito:
  lo ve cualquiera que entre en la casa— así que las dos filas se ven
  idénticas y parecen un fallo.

  Se junta aquí, en el sitio por donde pasan las cinco pantallas, y no
  en cada una. Y se junta por `grupo_id`, no por título: dos recados que
  se llamen igual el mismo día son dos recados de verdad y tienen que
  salir los dos.

      LA CLAVE ES `grupo_id ?? id` — las filas antiguas no tienen
      grupo, y ésas cada una es la suya.
*/
function unaSolaVez(cosas: CosaDeLaPared[]): CosaDeLaPared[] {
  const vistos = new Set<string>()
  const salida: CosaDeLaPared[] = []

  for (const c of cosas) {
    const clave = c.grupo_id ?? c.id
    if (vistos.has(clave)) continue
    vistos.add(clave)
    salida.push(c)
  }

  return salida
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
    .select('id, titulo, fecha, hora, estado, grupo_id')
    .eq('hogar_id', casa)
    .is('eliminado_en', null)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true, nullsFirst: true })
    .limit(200)

  return unaSolaVez((data ?? []) as CosaDeLaPared[])
}

/*
  ── LO DESTACADO ──

  Va en su propia consulta y envuelta, y no añadiendo `destacado` al
  `select` de arriba. La razón es concreta: mientras el paso 72 no esté
  dado, esa columna no existe, y Postgres rechaza la consulta ENTERA en
  vez de decir «esa columna no existe» — o sea que pedirla de más
  dejaría la pared en blanco, las cinco pantallas, por una casilla que
  todavía no está.

  Es la misma trampa que ya se sorteó en Ajustes con `ve_todo`. Aquí
  otra vez: lo nuevo se pide aparte.
*/
export async function loDestacado(
  supabase: SupabaseClient,
  casa: string
): Promise<CosaDeLaPared[]> {
  try {
    const { data, error } = await supabase
      .from('recordatorios')
      .select('id, titulo, fecha, hora, estado, grupo_id')
      .eq('hogar_id', casa)
      .is('eliminado_en', null)
      .eq('destacado', true)
      .neq('estado', 'hecho')
      .order('fecha', { ascending: true, nullsFirst: false })
      .limit(12)

    if (error) return []
    return unaSolaVez((data ?? []) as CosaDeLaPared[])
  } catch {
    return []
  }
}

/*
  ── LO QUE NO TIENE DÍA ──

  Existe desde siempre y hasta ahora no salía en ninguna parte de la
  pared: `loApuntado` pide por rango de fechas, y lo que no tiene fecha
  no cae en ningún rango.

  Se notaba poco mientras hubo una pestaña de Tareas. Al fundirla con el
  Calendario —«tareas y calendario para mí es lo mismo»— habría
  desaparecido del todo, y eso sí es perder algo.

  Así que va debajo de la semana, al lado de lo destacado: las dos cosas
  que hay que recordar y que el tiempo no ordena.
*/
export async function loSinFecha(
  supabase: SupabaseClient,
  casa: string
): Promise<CosaDeLaPared[]> {
  const { data } = await supabase
    .from('recordatorios')
    .select('id, titulo, fecha, hora, estado, grupo_id')
    .eq('hogar_id', casa)
    .is('eliminado_en', null)
    .is('fecha', null)
    .neq('estado', 'hecho')
    .order('creado_en', { ascending: false })
    .limit(12)

  return unaSolaVez((data ?? []) as CosaDeLaPared[])
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
