import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { hoyAqui } from '@/lib/tablon'
import { elLunesDe, laSemanaDe, esEnlace } from '@/lib/menus'

export const dynamic = 'force-dynamic'

/*
  LOS MENÚS DE LA SEMANA Y EL CAJÓN DE RECETAS.

  Todo con la sesión de quien pregunta: la frontera de la casa la pone
  la base de datos. Y aquí, a diferencia de la agenda o el corcho, la
  casa ENTERA lo ve —incluida quien ayuda—, porque quien cocina tiene
  que poder leer lo que toca hoy. Está explicado en el sql/48.
*/

// ── LA SEMANA ────────────────────────────────────────────────
export async function GET(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const pedida = new URL(peticion.url).searchParams.get('lunes') ?? ''
  const lunes = /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? elLunesDe(pedida) : elLunesDe(hoyAqui())
  const dias = laSemanaDe(lunes)

  const { data, error } = await supabase
    .from('menus')
    .select('id, fecha, momento, que, receta_id')
    .gte('fecha', dias[0])
    .lte('fecha', dias[6])

  if (error) {
    /* Sin las tablas todavía: se contesta vacío en vez de romper la
       pantalla. El sql/48 puede no estar ejecutado. */
    return NextResponse.json({ lunes, dias, menus: [], recetas: [], sinTablas: true })
  }

  const { data: recetas } = await supabase
    .from('recetas')
    .select('id, titulo, url, nota')
    .order('creado_en', { ascending: false })
    .limit(100)

  return NextResponse.json({ lunes, dias, menus: data ?? [], recetas: recetas ?? [] })
}

// ── PONER O CAMBIAR LO DE UN DÍA ─────────────────────────────
export async function PUT(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const cuerpo = (await peticion.json().catch(() => ({}))) as {
    fecha?: string
    momento?: string
    que?: string
    receta_id?: string | null
  }

  const fecha = String(cuerpo.fecha ?? '')
  const momento = cuerpo.momento === 'cena' ? 'cena' : 'comida'
  const que = String(cuerpo.que ?? '').trim().slice(0, 200)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'La fecha no es válida.' }, { status: 400 })
  }

  /*
    VACÍO SIGNIFICA QUITARLO.

    Es lo que espera cualquiera: borras el texto y ese día se queda sin
    nada. Guardar una cadena vacía dejaría un menú fantasma que ocupa
    sitio, sale en la pantalla como un renglón en blanco y encima
    bloquea el índice único de ese día.
  */
  if (!que) {
    const { error } = await supabase
      .from('menus')
      .delete()
      .eq('fecha', fecha)
      .eq('momento', momento)

    if (error) {
      return NextResponse.json(
        { error: 'No se ha podido quitar.', detalle: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json({ bien: true, quitado: true })
  }

  /*
    Se busca y se cambia, o se crea. Con `upsert` haría falta declarar
    el índice único aquí, y el día que ese índice cambie de nombre esto
    fallaría en silencio. Dos pasos son más largos y no dependen de
    cómo se llame nada.
  */
  const { data: yaHay } = await supabase
    .from('menus')
    .select('id')
    .eq('fecha', fecha)
    .eq('momento', momento)
    .maybeSingle()

  const campos = {
    fecha,
    momento,
    que,
    receta_id: cuerpo.receta_id ?? null,
    creado_por: user.id,
  }

  const { data, error } = yaHay
    ? await supabase.from('menus').update(campos).eq('id', yaHay.id).select('id')
    : await supabase.from('menus').insert(campos).select('id')

  /* Con `.select()`: un escrito que la seguridad no permite contesta
     «todo bien» habiendo tocado cero filas. */
  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido guardar.', detalle: error.message },
      { status: 500 }
    )
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido guardar. Los menús todavía no están disponibles en esta casa.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ bien: true, id: data[0].id })
}

// ── UNA IDEA NUEVA PARA EL CAJÓN ─────────────────────────────
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const cuerpo = (await peticion.json().catch(() => ({}))) as {
    titulo?: string
    url?: string
    nota?: string
  }

  const titulo = String(cuerpo.titulo ?? '').trim().slice(0, 120)
  const url = String(cuerpo.url ?? '').trim()

  if (titulo.length < 2) {
    return NextResponse.json({ error: 'Ponle un nombre para reconocerlo.' }, { status: 400 })
  }

  /* Un enlace que no lo es se rechaza aquí y se dice. Guardarlo y que
     luego no abra nada es peor: quien lo pegó ya no se acuerda de qué
     copió. */
  if (url && !esEnlace(url)) {
    return NextResponse.json(
      { error: 'Eso no parece un enlace. Tiene que empezar por https://' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('recetas')
    .insert({
      titulo,
      url: url || null,
      nota: String(cuerpo.nota ?? '').trim().slice(0, 500) || null,
      creado_por: user.id,
    })
    .select('id, titulo, url, nota')

  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido guardar.', detalle: error.message },
      { status: 500 }
    )
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido guardar. Los menús todavía no están disponibles en esta casa.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ bien: true, receta: data[0] })
}

// ── QUITAR UNA IDEA ──────────────────────────────────────────
export async function DELETE(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const id = new URL(peticion.url).searchParams.get('receta') ?? ''
  if (!id) return NextResponse.json({ error: 'Falta cuál.' }, { status: 400 })

  /* Los menús que la usaban NO se caen: `on delete set null`. Lo que se
     comió el martes se comió, aunque la receta ya no esté guardada. */
  const { data, error } = await supabase.from('recetas').delete().eq('id', id).select('id')

  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido quitar.', detalle: error?.message ?? 'Cero filas.' },
      { status: 500 }
    )
  }
  return NextResponse.json({ bien: true })
}
