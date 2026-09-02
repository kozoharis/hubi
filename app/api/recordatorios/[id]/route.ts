import { NextResponse, after, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { ponerCita, quitarCita } from '@/lib/google/calendario'
import { clienteServidor } from '@/lib/supabase/servidor'

export const dynamic = 'force-dynamic'

/**
 * Marcar como hecho, o deshacerlo.
 *
 * Nada se borra: el punto 5 pide que las acciones importantes sean
 * reversibles, así que "hecho" siempre se puede volver atrás.
 */
export async function PATCH(
  peticion: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const { estado } = (await peticion.json()) as { estado?: string }
  const hecho = estado === 'hecho'

  const { data, error } = await supabase
    .from('recordatorios')
    .update({
      estado: hecho ? 'hecho' : 'pendiente',
      hecho_en: hecho ? new Date().toISOString() : null,
      hecho_por: hecho ? user.id : null,
    })
    .eq('id', id)
    .select('id, titulo, tipo, fecha, hora, nota, asignado_a, repite, repite_hasta, evento_google')
    .maybeSingle()

  if (error) {
    console.error('[HUBI] Fallo actualizando recordatorio:', error)
    return NextResponse.json(
      { error: 'No se ha podido cambiar.', detalle: error.message },
      { status: 500 }
    )
  }

  /*
    LA MISMA COMPROBACIÓN QUE EL PUT DE ABAJO, Y AQUÍ FALTABA.

    Dos manejadores en el mismo archivo, y solo uno miraba si de verdad
    había cambiado alguna fila. Con las políticas por hogar puestas,
    tocar una tarea que no es tuya no da error: cambia CERO filas y
    devuelve que todo bien. La pantalla tachaba una tarea que seguía
    pendiente, y al recargar volvía a aparecer sin explicación.
  */
  if (!data) {
    return NextResponse.json(
      { error: 'Esa tarea ya no está, o no es de esta casa.' },
      { status: 409 }
    )
  }

  /*
    Si la tarea se repite, aquí nace la siguiente.

    No se generan las doce del año por adelantado a propósito. Con el
    futuro entero por delante, el calendario se llena de cosas que aún
    no han pasado y "hecho" deja de significar nada. Así cada tarea que
    se ve es real, tiene su día, y nunca hay dos iguales a la vez.

    Se crea al marcar HECHA, y solo entonces: deshacer un "hecho" no
    borra la siguiente —ya podría estar tocada— pero tampoco crea otra.
  */
  let siguiente: string | null = null
  let proximaFecha: string | null = null

  if (hecho && data?.repite && data.fecha) {
    const proxima = sumarUna(data.fecha, data.repite as Repeticion)

    const seAcabo = data.repite_hasta && proxima > data.repite_hasta
    if (!seAcabo) {
      const { data: nueva } = await supabase
        .from('recordatorios')
        .insert({
          titulo: data.titulo,
          tipo: data.tipo,
          asignado_a: data.asignado_a,
          creado_por: user.id,
          fecha: proxima,
          hora: data.hora,
          nota: data.nota,
          repite: data.repite,
          repite_hasta: data.repite_hasta,
          nace_de: data.id,
        })
        .select('id')
        .maybeSingle()

      siguiente = nueva?.id ?? null
      proximaFecha = siguiente ? proxima : null
    }
  }

  const r = data as {
    titulo: string
    tipo: string | null
    fecha: string | null
    hora: string | null
    nota: string | null
    evento_google: string | null
  } | null

  /*
    Google, después de contestar — pero SIN dejarlo a medias.

    Antes esto iba lanzado y sin esperar, y en Vercel eso significa
    que la función se congela al devolver la respuesta y el trabajo se
    queda donde estuviera. `after` lo hace después de contestar y lo
    termina de verdad.
  */
  after(async () => {
    const enGoogle = clienteServidor()

    // El evento lleva un ✓ delante cuando está hecho. No se borra: en
    // el calendario también vale saber qué se hizo y cuándo.
    if (r?.fecha) {
      try {
        const evento = await ponerCita(
          { titulo: r.titulo, fecha: r.fecha, hora: r.hora, nota: r.nota, hecho },
          r.evento_google
        )
        if (evento && evento !== r.evento_google) {
          await enGoogle.from('recordatorios').update({ evento_google: evento }).eq('id', id)
        }
      } catch (e) {
        console.error('[HUBI] No se ha podido actualizar el calendario:', e)
      }
    }

    /*
      Y LA SIGUIENTE DE UNA TAREA QUE SE REPITE, TAMBIÉN.

      Aquí faltaba entera. Al marcar hecha "pagar el agua, mensual"
      nacía la del mes siguiente en HUBI y NADIE la ponía en Google:
      solo la primera de la serie llegaba al calendario y las demás
      no existían allí. Quien mira el móvil ve una cosa y quien mira
      HUBI ve otra, que es la peor manera de tener dos sitios.
    */
    if (siguiente && proximaFecha && r) {
      try {
        const evento = await ponerCita({
          titulo: r.titulo,
          fecha: proximaFecha,
          hora: r.hora,
          nota: r.nota,
          hecho: false,
        })
        if (evento) {
          await enGoogle
            .from('recordatorios')
            .update({ evento_google: evento })
            .eq('id', siguiente)
        }
      } catch (e) {
        console.error('[HUBI] La siguiente repetición se ha quedado sin cita:', e)
      }
    }
  })

  return NextResponse.json({ ok: true, siguiente })
}

type Repeticion = 'diaria' | 'semanal' | 'mensual' | 'anual'

/**
 * La siguiente fecha.
 *
 * Ojo con los meses: el 31 de enero más un mes no es el 31 de febrero.
 * `setUTCMonth` se iría al 2 o 3 de marzo, y una tarea que se apuntó
 * "el último día del mes" acabaría el día 3. Aquí se recorta al último
 * día que exista, que es lo que cualquiera entiende por "el mes que
 * viene".
 */
function sumarUna(desde: string, cada: Repeticion): string {
  const f = new Date(desde + 'T12:00:00Z')

  if (cada === 'diaria') f.setUTCDate(f.getUTCDate() + 1)
  else if (cada === 'semanal') f.setUTCDate(f.getUTCDate() + 7)
  else {
    const saltoMeses = cada === 'mensual' ? 1 : 12
    const dia = f.getUTCDate()
    f.setUTCDate(1)
    f.setUTCMonth(f.getUTCMonth() + saltoMeses)

    const ultimoDelMes = new Date(
      Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0, 12)
    ).getUTCDate()

    f.setUTCDate(Math.min(dia, ultimoDelMes))
  }

  return f.toISOString().slice(0, 10)
}

/**
 * Cambiar una tarea ya creada.
 *
 * Hasta ahora solo se podía marcar hecha o deshacerla. Todo lo demás
 * —una fecha mal oída, un nombre equivocado, "el martes" que era el
 * jueves— había que borrarlo y volver a empezar, y en la práctica eso
 * significa que se queda mal.
 *
 * Solo se toca lo que llega. Mandar únicamente la fecha no vacía el
 * título ni la nota: lo que no viene, no se toca.
 */
export async function PUT(
  peticion: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const c = (await peticion.json()) as {
    titulo?: string
    asignado_a?: string | null
    fecha?: string | null
    hora?: string | null
    nota?: string | null
    repite?: string | null
    repite_hasta?: string | null
    aviso_previo?: string | null
  }

  const cambios: Record<string, unknown> = {}

  if (c.titulo !== undefined) {
    const t = c.titulo.trim()
    if (!t) {
      return NextResponse.json({ error: 'La tarea necesita decir qué hay que hacer.' }, { status: 400 })
    }
    cambios.titulo = t
  }
  if (c.asignado_a !== undefined) cambios.asignado_a = c.asignado_a || null
  if (c.fecha !== undefined) {
    cambios.fecha = c.fecha && /^\d{4}-\d{2}-\d{2}$/.test(c.fecha) ? c.fecha : null
  }
  if (c.hora !== undefined) {
    cambios.hora = c.hora && /^\d{2}:\d{2}$/.test(c.hora) ? c.hora : null
  }
  if (c.nota !== undefined) cambios.nota = c.nota?.trim() || null
  if (c.repite !== undefined) {
    cambios.repite = ['diaria', 'semanal', 'mensual', 'anual'].includes(c.repite ?? '')
      ? c.repite
      : null
    /* Si deja de repetirse, el "hasta cuándo" sobra. Dejarlo puesto es
       dejar una fecha que no gobierna nada y que dentro de un año
       nadie sabrá qué hacía ahí. */
    if (!cambios.repite) cambios.repite_hasta = null
  }
  if (c.repite_hasta !== undefined) {
    cambios.repite_hasta =
      c.repite_hasta && /^\d{4}-\d{2}-\d{2}$/.test(c.repite_hasta) ? c.repite_hasta : null
  }
  if (c.aviso_previo !== undefined) cambios.aviso_previo = c.aviso_previo || 'sin_aviso'

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ ok: true })
  }

  const { data, error } = await supabase
    .from('recordatorios')
    .update(cambios)
    .eq('id', id)
    .select('id, titulo, fecha, hora, nota, estado, evento_google')
    .maybeSingle()

  if (error) {
    console.error('[HUBI] Fallo editando recordatorio:', error)
    return NextResponse.json(
      { error: 'No se ha podido guardar el cambio.', detalle: error.message },
      { status: 500 }
    )
  }

  /* La misma comprobación que en el borrado, por el mismo motivo: sin
     permiso, un cambio afecta a cero filas y no da error. Si no ha
     vuelto la fila, no se ha cambiado nada — y hay que decirlo. */
  if (!data) {
    return NextResponse.json(
      { error: 'No se ha cambiado nada. Esa tarea ya no está, o falta el permiso.' },
      { status: 409 }
    )
  }

  /*
    Que el calendario de Google diga lo mismo que HUBI.

    Y CUANDO SE LE QUITA LA FECHA, QUE SE QUITE DEL CALENDARIO. Esto
    faltaba: una tarea a la que se le borraba el día seguía ocupando su
    hueco en Google para siempre. En el móvil salía una cita que en
    HUBI ya no tenía fecha, y no había forma de quitarla desde aquí.
  */
  after(async () => {
    const enGoogle = clienteServidor()

    if (!data.fecha) {
      if (data.evento_google) {
        try {
          await quitarCita(data.evento_google)
          await enGoogle.from('recordatorios').update({ evento_google: null }).eq('id', id)
        } catch (e) {
          console.error('[HUBI] La cita se ha quedado en Google sin fecha en HUBI:', e)
        }
      }
      return
    }

    try {
      const evento = await ponerCita(
        {
          titulo: data.titulo,
          fecha: data.fecha,
          hora: data.hora,
          nota: data.nota,
          hecho: data.estado === 'hecho',
        },
        data.evento_google
      )
      if (evento && evento !== data.evento_google) {
        await enGoogle.from('recordatorios').update({ evento_google: evento }).eq('id', id)
      }
    } catch (e) {
      console.error('[HUBI] Cambio guardado sin actualizar Google:', e)
    }
  })

  return NextResponse.json({ ok: true })
}

/**
 * Borrar una tarea.
 *
 * Aquí sí se borra de verdad, y es a propósito: una tarea equivocada
 * que se queda escondida "por si acaso" reaparece en las cuentas, en
 * el calendario o en un aviso a las tres de la mañana. Lo que no se
 * quiere, fuera — y su cita de Google detrás.
 *
 * Lo reversible es "hecho", que se puede deshacer siempre. Borrar se
 * pide aparte y con una pregunta clara delante.
 */
export async function DELETE(
  _peticion: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const { data: antes } = await supabase
    .from('recordatorios')
    .select('evento_google')
    .eq('id', id)
    .maybeSingle()

  /*
    EL `.select()` NO ES DECORACIÓN: ES LA COMPROBACIÓN.

    Aquí estuvo escondido el fallo. Con seguridad por filas, un borrado
    sin política no falla: borra CERO filas y devuelve que todo ha ido
    bien. La pantalla se cerraba, y la tarea seguía en la lista.

    Pidiendo las filas borradas, "cero" deja de parecer un éxito. Si no
    ha caído ninguna, se dice —y se dice que hay que ejecutar el SQL,
    porque es la única causa posible.
  */
  const { data: borradas, error } = await supabase
    .from('recordatorios')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('[HUBI] Fallo borrando recordatorio:', error)

    /* 23503: otra fila apunta a ésta. Le pasa a las tareas repetidas,
       porque la siguiente guarda de cuál nació. */
    if (error.code === '23503') {
      return NextResponse.json(
        {
          error: 'Esta tarea se repite y hay otra que nace de ella. Falta ejecutar el SQL 14.',
          detalle: error.message,
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'No se ha podido borrar.', detalle: error.message },
      { status: 500 }
    )
  }

  if (!borradas || borradas.length === 0) {
    return NextResponse.json(
      {
        error: 'No se ha borrado nada. Falta el permiso de borrado en la base de datos.',
        detalle: 'DELETE devolvió 0 filas: no hay política de borrado (SQL 14).',
      },
      { status: 409 }
    )
  }

  /* Después de contestar, pero terminándolo: sin `after`, en Vercel la
     función se congela al devolver la respuesta y la cita se quedaba
     en el calendario de Google para siempre, borrada en HUBI y viva en
     el móvil. */
  if (antes?.evento_google) {
    const evento = antes.evento_google
    after(async () => {
      try {
        await quitarCita(evento)
      } catch (e) {
        console.error('[HUBI] Borrado en HUBI pero no en Google:', e)
      }
    })
  }

  return NextResponse.json({ ok: true })
}
