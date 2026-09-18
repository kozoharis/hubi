import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacioO } from '@/lib/espacio'
import { aqui } from '@/lib/enlaces'

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
  pueda ver en su MAPPEL. Lo que protege es la BASE, con el techo de la
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

  /*
    ── Y SI NO ES UNA PANTALLA, SE LE DICE ──

    Aquí ponía `redirect('/')`, sin una palabra. Costó una tarde: se
    publicaron tres funciones nuevas de la pared, Haris la abrió con su
    cuenta, aterrizó en la aplicación de siempre y la conclusión
    razonable fue «no se ha subido nada». Se revisó el despliegue, el
    commit, el service worker y la base de datos. Todo estaba bien.

    Una redirección silenciosa es una mentira educada: te lleva a un
    sitio correcto sin decirte que no llegaste a donde ibas, y entonces
    lo que ves —que es cierto— contesta a una pregunta que no hiciste.

    El porqué largo, y cómo se entra de verdad, en
    `app/en-la-cocina/page.tsx`.
  */
  if ((mio?.clase as string | null) !== 'dispositivo') {
    redirect(await aqui('/en-la-cocina'))
  }

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
  /* De quién es. Hace falta desde el paso 79: para poder cambiarlo
     desde la pared hay que saber primero qué pone ahora. */
  asignado_a?: string | null
  /*
    ── Y DE QUIÉNES, EN PLURAL ──

    Una cosa para dos personas son dos filas que se juntan en una sola
    para enseñarla (`unaSolaVez`), y al juntarlas se perdía a todas
    menos a la primera. Daba igual mientras la pared no dijera de quién
    es nada; desde que lleva el color de cada uno, no: «Presentación
    del cole de Paula» saldría con la cara de Julia como si fuera sólo
    suya.

    Aquí van todos los dueños de la cosa, sin repetir y sin los nulos.
    Vacío = de la casa, de nadie en concreto.
  */
  dequienes?: string[]
}

/*
  ═══════════════════════════════════════════════════════════════
  ⚠️  UNA COSA PARA DOS PERSONAS SE ENSEÑA UNA VEZ
  ═══════════════════════════════════════════════════════════════

  Lo vio Haris en la pared: «Presentación del cole de Paula» salía DOS
  VECES, el mismo día y a la misma hora. Parecía un duplicado en la base
  y no lo era.

  En MAPPEL, **una tarea para dos personas SON dos filas**. Está decidido
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
  const donde = new Map<string, number>()
  const salida: CosaDeLaPared[] = []

  for (const c of cosas) {
    const clave = c.grupo_id ?? c.id
    const ya = donde.get(clave)

    /*
      Si ya estaba, no se descarta a secas: se le suma su dueño a la
      que sobrevive. Descartarla y ya —que es lo que hacía— tiraba la
      única información que distinguía las dos filas.
    */
    if (ya !== undefined) {
      if (c.asignado_a && !salida[ya].dequienes!.includes(c.asignado_a)) {
        salida[ya].dequienes!.push(c.asignado_a)
      }
      continue
    }

    donde.set(clave, salida.length)
    salida.push({ ...c, dequienes: c.asignado_a ? [c.asignado_a] : [] })
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
    .select('id, titulo, fecha, hora, estado, grupo_id, asignado_a')
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
      .select('id, titulo, fecha, hora, estado, grupo_id, asignado_a')
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
    .select('id, titulo, fecha, hora, estado, grupo_id, asignado_a')
    .eq('hogar_id', casa)
    .is('eliminado_en', null)
    .is('fecha', null)
    .neq('estado', 'hecho')
    .order('creado_en', { ascending: false })
    .limit(12)

  return unaSolaVez((data ?? []) as CosaDeLaPared[])
}

export type MenuDelDia = {
  fecha: string
  momento: string
  que: string | null
  /* Desde que la cocina también comprueba los ingredientes hace falta
     saber CUÁL es el menú y de qué receta sale. Pueden no venir: si el
     paso 81 no está dado, se piden sin ellos. */
  id?: string
  receta_id?: string | null
  comprobado_en?: string | null
  faltan?: string[] | null
}

/** Los menús de una semana. Vacío y sin ruido si el sql/48 no está. */
export async function losMenus(
  supabase: SupabaseClient,
  casa: string,
  desde: string,
  hasta: string
): Promise<MenuDelDia[]> {
  /*
    LA RED DE SIEMPRE, Y VAN CUATRO.

    Postgres rechaza la consulta ENTERA cuando falta una columna, no esa
    columna. O sea que pedir `comprobado_en` antes de dar el paso 81 no
    dejaría la pared sin esa casilla: la dejaría **sin menús**, y encima
    en silencio, porque el fallo se recoge en un `data` nulo que la
    pantalla lee como «no hay nada puesto».
  */
  const CON = 'id, fecha, momento, que, receta_id, comprobado_en, faltan'
  const SIN = 'fecha, momento, que'

  try {
    /* Ordenados por cuándo se escribieron: desde el paso 85 en una
       comida caben varios platos, y ése es el orden en que se comen. */
    const { data, error } = await supabase
      .from('menus')
      .select(CON)
      .eq('hogar_id', casa)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('creado_en', { ascending: true })

    if (!error) return (data ?? []) as MenuDelDia[]

    const segunda = await supabase
      .from('menus')
      .select(SIN)
      .eq('hogar_id', casa)
      .gte('fecha', desde)
      .lte('fecha', hasta)

    if (segunda.error) return []
    return (segunda.data ?? []) as MenuDelDia[]
  } catch {
    return []
  }
}

/** Las listas de la compra abiertas de la casa, para poder mandarles
    lo que falte de un menú desde la propia cocina. */
export async function lasListasDeCompra(
  supabase: SupabaseClient,
  casa: string
): Promise<{ id: string; nombre: string; fecha: string | null; hora: string | null; asignado_a: string | null }[]> {
  try {
    const { data, error } = await supabase
      .from('listas_compra')
      /* `hora` y `asignado_a` viajan aunque no se pinten: si desde aquí
         se le pone día a la lista, hay que devolverle a su API TODO lo
         que ya tenía — gobierna las tres cosas a la vez. */
      .select('id, nombre, fecha, hora, asignado_a')
      .eq('hogar_id', casa)
      .is('archivada_en', null)
      .order('creada_en', { ascending: true })
      .limit(30)
    if (error) return []
    return (data ?? []) as {
      id: string
      nombre: string
      fecha: string | null
      hora: string | null
      asignado_a: string | null
    }[]
  } catch {
    return []
  }
}

/*
  ═══════════════════════════════════════════════════════════════
  QUÉ LISTAS DE LA COMPRA SE VEN EN LA COCINA
  ═══════════════════════════════════════════════════════════════

  ⚠️  ESTO ARREGLA EL FALLO DE «APUNTO LA LECHE Y NO SALE»

  Haris lo dijo dos veces, y las dos veces tenía razón y las dos veces
  arreglé otra cosa: *«le digo que falta algo, lo añado, y no se ve en
  la pantalla… pero sí que lo registra, lo veo en el móvil»*.

  La primera vez arreglé la copia congelada de `lib/al-dia.ts`. Era un
  fallo de verdad, pero no ERA ÉSTE. Éste estaba más abajo y es de los
  que sólo se ven leyendo las dos puntas a la vez.

  ─────────────────────────────────────────────────────────────
  LO QUE PASABA

  Cuando se apunta algo sin decir en qué lista, `/api/compra` **no lo
  deja suelto**: busca la lista de siempre de la casa —la que no es de
  ninguna sección— y, si no hay ninguna, la crea. Lo hace a propósito y
  está explicado allí: lo dictado por voz quedaría suelto y podía no
  salir en ninguna pantalla.

  Y la pared, por su parte, enseñaba dos cosas: lo que no está en
  ninguna lista, y las listas marcadas con `visible_en_casa` (paso 77).

  O sea que la pared **apuntaba en un sitio y miraba en otro**. La
  leche entraba en «La compra» de la casa, esa lista no estaba marcada
  para verse en la cocina, y por tanto no salía. En el móvil sí, porque
  el móvil no filtra por esa casilla.

  Lo peor del fallo es que se comportaba como un fallo de refresco: se
  apuntaba, desaparecía el botón, no pasaba nada, y al recargar seguía
  sin estar. Cualquiera habría mirado donde miré yo.

  ─────────────────────────────────────────────────────────────
  LA REGLA QUE SALE DE AQUÍ

      UNA PANTALLA TIENE QUE ENSEÑAR AQUELLO EN LO QUE ESCRIBE.

  Así que la lista donde la pared apunta se ve en la pared SIEMPRE, esté
  marcada o no. `visible_en_casa` sigue mandando en todas las demás —la
  del sábado, la de la ferretería, la de la finca—, que es para lo que
  se hizo.
*/
export async function lasQueSeVenEnLaCocina(
  supabase: SupabaseClient,
  casa: string
): Promise<{ id: string; nombre: string | null }[]> {
  /*
    La de siempre de la casa: sin sección y la más antigua. Es
    exactamente la que busca `/api/compra` cuando nadie dice en cuál
    va, y tiene que ser la misma consulta o volvemos a tener dos sitios
    que se creen el mismo.
  */
  const laDeSiempre = async () => {
    try {
      const { data, error } = await supabase
        .from('listas_compra')
        .select('id, nombre')
        .eq('hogar_id', casa)
        .is('archivada_en', null)
        .is('seccion_id', null)
        .order('creada_en', { ascending: true })
        .limit(1)
      if (error) return null
      return (data?.[0] ?? null) as { id: string; nombre: string | null } | null
    } catch {
      return null
    }
  }

  /*
    Las marcadas. Envuelto: sin el paso 77 la columna no existe y
    Postgres rechaza la consulta ENTERA — la pared se quedaría sin
    compra por una casilla que todavía no está.
  */
  const lasMarcadas = async () => {
    try {
      const { data, error } = await supabase
        .from('listas_compra')
        .select('id, nombre')
        .eq('hogar_id', casa)
        .is('archivada_en', null)
        .eq('visible_en_casa', true)
        .order('fecha', { ascending: true, nullsFirst: false })
      if (error) return []
      return (data ?? []) as { id: string; nombre: string | null }[]
    } catch {
      return []
    }
  }

  const [siempre, marcadas] = await Promise.all([laDeSiempre(), lasMarcadas()])

  /* La de siempre primero: es donde va la leche, y es lo que se apunta
     desde aquí. Y sin repetirla si además estaba marcada. */
  const salida = siempre ? [siempre] : []
  for (const l of marcadas) {
    if (!salida.some((x) => x.id === l.id)) salida.push(l)
  }
  return salida
}
