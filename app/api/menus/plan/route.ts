import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { hoyAqui } from '@/lib/tablon'
import { losDiasDelPlan, SEMANAS_POR_DELANTE } from '@/lib/menus'
import { elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  UNA TANDA DE MENÚS
  ═══════════════════════════════════════════════════════════════

  Haris: *«poder crearlo en un solo sitio y luego asignarle el día o
  días que se repite en la semana, si es comida o cena y si se repite
  cada semana, cada dos semanas o tres»*.

  Aquí se escriben los días de golpe. El porqué de escribirlos en vez
  de guardar una regla está en el sql/81, y el resumen es que un menú
  no se marca hecho y verlo por delante ES la función.

  ─────────────────────────────────────────────────────────────
  TRES COSAS QUE NO SON OBVIAS

  **El título sale de la receta, no del navegador.** Se lee de la base
  con la sesión de quien pide. Si viniera del cuerpo de la petición,
  cualquiera podría escribir un menú que dice una cosa y apunta a otra.

  **Lo que ya está puesto no se toca.** Si el viernes ya tiene cena, se
  salta y se cuenta. Una regla no borra lo que decidió una persona.

  **Y se dice cuántos se saltaron.** Poner veinte y que salgan
  diecisiete sin explicación es la clase de silencio que hace dudar de
  si la pantalla funciona.
*/

type Cuerpo = {
  receta_id?: string | null
  /* Por si se quiere una tanda de algo que no está en el cajón. */
  titulo?: string
  dias?: number[]
  momento?: string
  cada_semanas?: number
  desde?: string
}

// ── PONER UNA TANDA ──────────────────────────────────────────
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const casa = await elEspacioO(supabase)
  const cuerpo = (await peticion.json().catch(() => ({}))) as Cuerpo

  const momento = cuerpo.momento === 'cena' ? 'cena' : 'comida'
  const cada = ([1, 2, 3] as const).includes(cuerpo.cada_semanas as 1 | 2 | 3)
    ? (cuerpo.cada_semanas as 1 | 2 | 3)
    : 1

  const dias = (cuerpo.dias ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  if (dias.length === 0) {
    return NextResponse.json({ error: 'Elige al menos un día de la semana.' }, { status: 400 })
  }

  const hoy = hoyAqui()
  const desde =
    typeof cuerpo.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cuerpo.desde) && cuerpo.desde > hoy
      ? cuerpo.desde
      : hoy

  // ── De dónde sale el nombre ──
  let titulo = String(cuerpo.titulo ?? '').trim().slice(0, 200)
  const recetaId = cuerpo.receta_id || null

  if (recetaId) {
    const { data: laReceta } = await supabase
      .from('recetas')
      .select('id, titulo')
      .eq('hogar_id', casa)
      .eq('id', recetaId)
      .maybeSingle()

    if (!laReceta) {
      return NextResponse.json({ error: 'Ese plato ya no está guardado.' }, { status: 404 })
    }
    titulo = String(laReceta.titulo)
  }

  if (titulo.length < 2) {
    return NextResponse.json({ error: 'Ponle un nombre al plato.' }, { status: 400 })
  }

  // ── Las fechas ──
  const fechas = losDiasDelPlan(desde, dias, cada, SEMANAS_POR_DELANTE)
  if (fechas.length === 0) {
    return NextResponse.json({ error: 'No sale ningún día con eso.' }, { status: 400 })
  }

  /*
    Lo que ya hay en esos días y ese momento. Se pregunta por el rango
    entero y se filtra aquí: una consulta con noventa `or` es más
    frágil que traerse las que haya en tres meses, que son pocas.
  */
  const { data: puestos } = await supabase
    .from('menus')
    .select('fecha')
    .eq('hogar_id', casa)
    .eq('momento', momento)
    .gte('fecha', fechas[0])
    .lte('fecha', fechas[fechas.length - 1])

  const ocupados = new Set((puestos ?? []).map((p) => String(p.fecha)))
  const libres = fechas.filter((f) => !ocupados.has(f))

  if (libres.length === 0) {
    return NextResponse.json({
      bien: true,
      puestos: 0,
      saltados: fechas.length,
      /* No es un error: es que ya estaba todo ocupado, y hay que
         decirlo con palabras en vez de contestar «hecho». */
      nada: true,
    })
  }

  const grupo = crypto.randomUUID()
  const hasta = libres[libres.length - 1]

  const filas = libres.map((fecha) => ({
    hogar_id: casa,
    fecha,
    momento,
    que: titulo,
    receta_id: recetaId,
    grupo_id: grupo,
    cada_semanas: cada,
    repite_hasta: hasta,
    creado_por: user.id,
  }))

  let { data, error } = await supabase.from('menus').insert(filas).select('id')

  /*
    LA RED DE SIEMPRE. Si el sql/81 no está dado, Postgres rechaza la
    fila ENTERA por las columnas nuevas —no las ignora— y el resultado
    no sería «la repetición no va»: sería que no se puede poner ningún
    menú. Una columna nueva nunca puede ser obligatoria para lo que ya
    funcionaba.

    Sin el paso 81 se ponen los días igual, sueltos, y se avisa.
  */
  let sinRepeticion = false
  if (error && /grupo_id|cada_semanas|repite_hasta/.test(error.message)) {
    sinRepeticion = true
    const sueltas = libres.map((fecha) => ({
      hogar_id: casa,
      fecha,
      momento,
      que: titulo,
      receta_id: recetaId,
      creado_por: user.id,
    }))
    ;({ data, error } = await supabase.from('menus').insert(sueltas).select('id'))
  }

  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido guardar la tanda.', detalle: error.message },
      { status: 500 }
    )
  }

  /* Con `.select()`: un escrito que la seguridad no permite contesta
     «todo bien» habiendo tocado cero filas. */
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido guardar. Los menús todavía no están disponibles en esta casa.' },
      { status: 409 }
    )
  }

  return NextResponse.json({
    bien: true,
    grupo: sinRepeticion ? null : grupo,
    puestos: data.length,
    saltados: fechas.length - libres.length,
    hasta,
    sinRepeticion,
  })
}

// ── ALARGAR OTROS TRES MESES ─────────────────────────────────
/*
  No es automático a propósito. Un plan que se extiende solo para
  siempre es un plan que nadie revisa nunca, y en tres meses una casa
  cambia de costumbres.
*/
export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const casa = await elEspacioO(supabase)
  const { grupo } = (await peticion.json().catch(() => ({}))) as { grupo?: string }
  if (!grupo) return NextResponse.json({ error: 'Falta cuál.' }, { status: 400 })

  /* De la tanda se lee lo que ES la tanda: qué plato, qué momento,
     cada cuánto y hasta dónde llegó. No se pide nada de eso al
     navegador. */
  const { data: laTanda, error: falloTanda } = await supabase
    .from('menus')
    .select('que, momento, receta_id, cada_semanas, fecha')
    .eq('hogar_id', casa)
    .eq('grupo_id', grupo)
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (falloTanda || !laTanda) {
    return NextResponse.json({ error: 'Esa tanda ya no está.' }, { status: 404 })
  }

  const cada = ([1, 2, 3] as const).includes(laTanda.cada_semanas as 1 | 2 | 3)
    ? (laTanda.cada_semanas as 1 | 2 | 3)
    : 1

  /* Se sigue desde el día siguiente al último que hay, con los mismos
     días de la semana que ya tenía. */
  const ultimo = String(laTanda.fecha)
  const { data: losDias } = await supabase
    .from('menus')
    .select('fecha')
    .eq('hogar_id', casa)
    .eq('grupo_id', grupo)

  const diasSemana = [
    ...new Set(
      (losDias ?? []).map((d) => (new Date(`${String(d.fecha)}T12:00:00`).getDay() + 6) % 7)
    ),
  ]

  const siguiente = new Date(`${ultimo}T12:00:00`)
  siguiente.setDate(siguiente.getDate() + 1)
  const desde = siguiente.toISOString().slice(0, 10)

  const fechas = losDiasDelPlan(desde, diasSemana, cada, SEMANAS_POR_DELANTE)
  if (fechas.length === 0) {
    return NextResponse.json({ bien: true, puestos: 0, saltados: 0, nada: true })
  }

  const { data: puestos } = await supabase
    .from('menus')
    .select('fecha')
    .eq('hogar_id', casa)
    .eq('momento', laTanda.momento)
    .gte('fecha', fechas[0])
    .lte('fecha', fechas[fechas.length - 1])

  const ocupados = new Set((puestos ?? []).map((p) => String(p.fecha)))
  const libres = fechas.filter((f) => !ocupados.has(f))

  if (libres.length === 0) {
    return NextResponse.json({ bien: true, puestos: 0, saltados: fechas.length, nada: true })
  }

  const hasta = libres[libres.length - 1]
  const { data, error } = await supabase
    .from('menus')
    .insert(
      libres.map((fecha) => ({
        hogar_id: casa,
        fecha,
        momento: laTanda.momento,
        que: laTanda.que,
        receta_id: laTanda.receta_id,
        grupo_id: grupo,
        cada_semanas: cada,
        repite_hasta: hasta,
        creado_por: user.id,
      }))
    )
    .select('id')

  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido alargar.', detalle: error?.message ?? 'Cero filas.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    bien: true,
    puestos: data.length,
    saltados: fechas.length - libres.length,
    hasta,
  })
}

// ── QUITAR LO QUE QUEDA POR VENIR ────────────────────────────
/*
  Solo de hoy en adelante. Lo de atrás es lo que se comió, y borrarlo
  sería reescribir la historia para arreglar el futuro.
*/
export async function DELETE(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const casa = await elEspacioO(supabase)
  const grupo = new URL(peticion.url).searchParams.get('grupo') ?? ''
  if (!grupo) return NextResponse.json({ error: 'Falta cuál.' }, { status: 400 })

  const { data, error } = await supabase
    .from('menus')
    .delete()
    .eq('hogar_id', casa)
    .eq('grupo_id', grupo)
    .gte('fecha', hoyAqui())
    .select('id')

  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido quitar.', detalle: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true, quitados: data?.length ?? 0 })
}
