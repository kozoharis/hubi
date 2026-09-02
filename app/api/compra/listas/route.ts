import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'

export const dynamic = 'force-dynamic'

/*
  LAS LISTAS DE LA COMPRA.

  Crear una, ponerle día y quitarla. La fecha vive AQUÍ y no en la
  Agenda: la tarea de la Agenda es el reflejo, y esta ruta se encarga
  de que sean la misma cosa.

  LA REGLA QUE MANDA: UNA LISTA, UNA TAREA.

  Cambiar el día de una compra tiene que CAMBIAR su tarea, no crear
  otra. Sin esto, tocar tres veces la fecha deja tres "hacer la compra"
  en la misma semana y quien las ve no sabe cuál vale. Por eso se
  guarda el identificador de la tarea y, cuando ya hay una, se
  modifica.
*/

type Entrada = {
  nombre?: string
  seccion_id?: string | null
  fecha?: string | null
  hora?: string | null
  asignado_a?: string | null
  aviso_previo?: string
}

function fechaOnula(v: unknown): string | null {
  const s = String(v ?? '')
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

// ── Crear una lista ──────────────────────────────────────────
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: Entrada
  try {
    cuerpo = (await peticion.json()) as Entrada
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const nombre = String(cuerpo.nombre ?? '').trim().slice(0, 60)
  if (nombre.length < 2) {
    return NextResponse.json({ error: 'Ponle un nombre a la lista.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('listas_compra')
    .insert({
      nombre,
      seccion_id: cuerpo.seccion_id || null,
      creada_por: user.id,
    })
    .select('id, nombre, seccion_id, fecha, hora, asignado_a')
    .single()

  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes('listas_compra')
          ? 'Falta ejecutar sql/23-listas-compra.sql en la base de datos.'
          : 'No se ha podido crear la lista.',
        detalle: error.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true, lista: data })
}

// ── Ponerle día, hora y responsable ──────────────────────────
export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: Entrada & { id?: string }
  try {
    cuerpo = (await peticion.json()) as Entrada & { id?: string }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const id = String(cuerpo.id ?? '')
  if (!id) return NextResponse.json({ error: 'Falta la lista.' }, { status: 400 })

  const { data: antes } = await supabase
    .from('listas_compra')
    .select('id, nombre, seccion_id, recordatorio_id')
    .eq('id', id)
    .maybeSingle()

  if (!antes) {
    return NextResponse.json({ error: 'Esa lista ya no está.' }, { status: 404 })
  }

  const nombre = cuerpo.nombre != null ? String(cuerpo.nombre).trim().slice(0, 60) : antes.nombre
  const fecha = fechaOnula(cuerpo.fecha)
  const hora = /^\d{2}:\d{2}/.test(String(cuerpo.hora ?? '')) ? String(cuerpo.hora).slice(0, 5) : null
  const asignado = cuerpo.asignado_a || null

  /* Cuántas cosas hay, para que la tarea de la Agenda lo diga. Una
     tarea que pone "Hacer la compra de casa · 12 cosas" se entiende
     sin abrirla. */
  const { count } = await supabase
    .from('compra')
    .select('id', { count: 'exact', head: true })
    .eq('lista_id', id)
    .is('archivado_en', null)
    .eq('comprado', false)

  const cuantas = count ?? 0
  const donde = antes.seccion_id ? '' : ' de casa'
  const titulo = `${antes.nombre}${donde}`.trim()
  const nota = `${cuantas} ${cuantas === 1 ? 'cosa' : 'cosas'} en la lista.`

  // ── La tarea de la Agenda ──
  let recordatorioId = antes.recordatorio_id as string | null

  if (fecha) {
    if (recordatorioId) {
      /* Ya tenía tarea: se CAMBIA. Aquí estaría el fallo de crear una
         nueva cada vez que se toca la fecha. */
      const r = await fetch(new URL(`/api/recordatorios/${recordatorioId}`, peticion.url), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: peticion.headers.get('cookie') ?? '',
        },
        body: JSON.stringify({ titulo, fecha, hora, asignado_a: asignado, nota }),
      })
      /* Si la tarea se borró desde la Agenda, ya no está: se hace una
         nueva en vez de dejar la lista con una fecha que no avisa. */
      if (!r.ok) recordatorioId = null
    }

    if (!recordatorioId) {
      const r = await fetch(new URL('/api/recordatorios', peticion.url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: peticion.headers.get('cookie') ?? '',
        },
        body: JSON.stringify({
          titulo,
          fecha,
          hora,
          asignado_a: asignado,
          aviso_previo: hora ? (cuerpo.aviso_previo ?? '1h') : 'ninguno',
          nota,
        }),
      })
      if (r.ok) {
        const d = (await r.json().catch(() => ({}))) as { ids?: string[]; id?: string }
        recordatorioId = d.ids?.[0] ?? d.id ?? null
      } else {
        return NextResponse.json(
          { error: 'No se ha podido poner la compra en la Agenda.' },
          { status: 502 }
        )
      }
    }
  }

  const { data, error } = await supabase
    .from('listas_compra')
    .update({ nombre, fecha, hora, asignado_a: asignado, recordatorio_id: recordatorioId })
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'No se ha podido guardar.' }, { status: 500 })
  }

  return NextResponse.json({ bien: true, cuantas })
}

// ── Quitar una lista ─────────────────────────────────────────
/*
  Se archiva, no se borra, y LAS COSAS QUE TENÍA DENTRO SE QUEDAN.

  Vuelven a la lista general de su categoría en vez de desaparecer con
  ella. Quitar una lista es decir "esta tanda ya no la organizo aparte",
  no "tira lo que había apuntado" — y si alguien pierde así la mitad de
  su compra, no vuelve a fiarse de esta pantalla.
*/
export async function DELETE(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const id = new URL(peticion.url).searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'Falta la lista.' }, { status: 400 })

  await supabase.from('compra').update({ lista_id: null }).eq('lista_id', id)

  const { data, error } = await supabase
    .from('listas_compra')
    .update({ archivada_en: new Date().toISOString() })
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'No se ha podido quitar.' }, { status: 500 })
  }

  return NextResponse.json({ bien: true })
}
