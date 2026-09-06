import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { avisarA } from '@/lib/push'
import { deducirTipo } from '@/lib/tablon'

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

  let cuerpo: Entrada & { id?: string; ticket_id?: string | null }
  try {
    cuerpo = (await peticion.json()) as Entrada & { id?: string; ticket_id?: string | null }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const id = String(cuerpo.id ?? '')
  if (!id) return NextResponse.json({ error: 'Falta la lista.' }, { status: 400 })

  /*
    ── ENGANCHAR EL TICKET ──

    Un camino corto y aparte del resto: viene de la pantalla de
    guardar un documento, justo después de subir el ticket del súper,
    y no toca ni el nombre ni la fecha ni la tarea de la Agenda.

    Mezclarlo con lo de abajo obligaría a mandar el resto de campos
    para no borrarlos, desde una pantalla que no los conoce.

    El ticket es un documento de los de siempre: aquí solo se guarda
    la referencia. Duplicar el archivo sería tener dos sitios donde
    mirar y uno de los dos quedaría desactualizado.
  */
  if (cuerpo.ticket_id !== undefined) {
    const ticket = String(cuerpo.ticket_id ?? '') || null

    const { data, error } = await supabase
      .from('listas_compra')
      .update({ ticket_id: ticket })
      .eq('id', id)
      .select('id')

    if (error || !data || data.length === 0) {
      console.error('[HUBI] No se ha podido enganchar el ticket:', error)
      return NextResponse.json(
        {
          error: 'No se ha podido guardar el ticket en la lista.',
          detalle: error?.message ?? 'Puede que falte ejecutar el SQL 40.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, ticket_id: ticket })
  }

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
  /*
    ═══════════════════════════════════════════════════════════
    LA TAREA DE LA AGENDA SE ESCRIBE AQUÍ, NO LLAMÁNDONOS A NOSOTROS
    ═══════════════════════════════════════════════════════════

    Aquí había un `fetch` a nuestra propia ruta `/api/recordatorios`,
    reenviando la cookie de la sesión. Se veía elegante —reutilizar la
    ruta que ya sabe crear tareas— y es de las cosas que fallan en
    producción y no en el ordenador de uno:

      · el servidor tiene que poder llamarse a sí mismo por HTTP, que
        depende del despliegue y no de nuestro código;
      · `peticion.url` en Vercel no siempre es la dirección pública;
      · y si la cookie no viaja tal cual, la llamada vuelve como «no
        has entrado» — sobre una petición que SÍ tiene sesión.

    Y lo que veía la persona era «No se ha podido poner la compra en la
    Agenda» sobre una compra perfectamente guardada. Pasó de verdad.

    Ahora se escribe en la tabla directamente, con la misma sesión que
    ya tenemos aquí: mismas políticas, mismo resultado, un viaje menos
    y una manera menos de fallar.
  */
  let recordatorioId = antes.recordatorio_id as string | null

  if (fecha) {
    const laTarea = {
      titulo,
      /* El mismo que pondría la ruta de tareas: lo deduce del título
         para que en la Agenda salga con su icono, como todo lo demás.
         `'compra'` no es un tipo que HUBI conozca. */
      tipo: deducirTipo(titulo),
      asignado_a: asignado,
      fecha,
      hora,
      nota,
      aviso_previo: hora ? (cuerpo.aviso_previo ?? '1h') : 'sin_aviso',
    }

    if (recordatorioId) {
      /* Ya tenía tarea: se CAMBIA. Aquí estaría el fallo de crear una
         nueva cada vez que se toca el día. */
      const { data: cambiada } = await supabase
        .from('recordatorios')
        .update(laTarea)
        .eq('id', recordatorioId)
        .select('id')

      /* Si se borró desde la Agenda ya no está: se hace una nueva en
         vez de dejar la lista con una fecha que no avisa. */
      if (!cambiada || cambiada.length === 0) recordatorioId = null
    }

    if (!recordatorioId) {
      const { data: creada, error: alCrear } = await supabase
        .from('recordatorios')
        .insert({ ...laTarea, creado_por: user.id })
        .select('id')
        .maybeSingle()

      if (alCrear || !creada?.id) {
        console.error('[HUBI] No se ha podido poner la compra en la Agenda:', alCrear)
        return NextResponse.json(
          {
            error: 'No se ha podido poner la compra en la Agenda.',
            /* El motivo de verdad. Sin él, esto era un cartel rojo sin
               nada que investigar. */
            detalle: alCrear?.message,
          },
          { status: 500 }
        )
      }

      recordatorioId = creada.id as string
    }

    /*
      Y se avisa a quien le toca ir. Sin esperarlo: la compra ya está
      programada, y un aviso que no sale no puede tumbar lo que sí se
      ha guardado.
    */
    if (asignado && asignado !== user.id) {
      avisarA(asignado, {
        titulo: 'La compra',
        cuerpo: `${titulo} · ${cuandoEnPalabras(fecha, hora)}`,
        url: '/compra',
      }).catch((e) => console.error('[HUBI] Programada sin avisar:', e))
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

/** «mañana a las 10:00» · «el 12 de septiembre». Para el aviso. */
function cuandoEnPalabras(fecha: string, hora: string | null): string {
  const meses = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre',
  ]
  const [a, m, d] = fecha.split('-').map(Number)
  const cuando = a && m && d ? `${d} de ${meses[m - 1]}` : fecha
  return hora ? `${cuando} a las ${hora}` : cuando
}
