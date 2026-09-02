import { NextResponse, after, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { deducirTipo, cuando } from '@/lib/tablon'
import { avisarA } from '@/lib/push'
import { ponerCita } from '@/lib/google/calendario'
import { clienteServidor } from '@/lib/supabase/servidor'

export const dynamic = 'force-dynamic'

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  type Entrada = {
    titulo?: string
    asignado_a?: string | null
    fecha?: string | null
    hora?: string | null
    nota?: string | null
    repite?: string | null
    repite_hasta?: string | null
    aviso_previo?: string
    tipo?: string
    documento_origen_id?: string | null
  }

  const cuerpo = (await peticion.json()) as Entrada & { tareas?: Entrada[] }

  /*
    Una o varias, por la misma puerta.

    Cuando se dicta "el lunes esto y el martes lo otro" llegan dos, y
    tienen que guardarse JUNTAS: o entran las dos o no entra ninguna.
    Guardar la primera y fallar con la segunda dejaría a alguien
    convencido de que apuntó dos cosas cuando solo hay una — y eso no
    se descubre hasta que ya es tarde.
  */
  const entradas = Array.isArray(cuerpo.tareas) && cuerpo.tareas.length > 0
    ? cuerpo.tareas
    : [cuerpo]

  const REPITES = ['diaria', 'semanal', 'mensual', 'anual']

  const filas = entradas
    .map((e) => {
      const titulo = (e.titulo ?? '').trim()
      if (!titulo) return null
      return {
        titulo,
        tipo: e.tipo === 'vencimiento' ? 'vencimiento' : deducirTipo(titulo),
        asignado_a: e.asignado_a || null,
        creado_por: user.id,
        fecha: e.fecha && /^\d{4}-\d{2}-\d{2}$/.test(e.fecha) ? e.fecha : null,
        hora: e.hora && /^\d{2}:\d{2}$/.test(e.hora) ? e.hora : null,
        nota: (e.nota ?? '').trim() || null,
        repite: e.repite && REPITES.includes(e.repite) ? e.repite : null,
        /* Hasta cuándo se repite. Solo tiene sentido si se repite: sin
           repetición, una fecha de fin no gobierna nada. */
        repite_hasta:
          e.repite && REPITES.includes(e.repite) && e.repite_hasta &&
          /^\d{4}-\d{2}-\d{2}$/.test(e.repite_hasta)
            ? e.repite_hasta
            : null,
        aviso_previo: e.aviso_previo ?? 'sin_aviso',
        documento_origen_id: e.documento_origen_id || null,
      }
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)

  if (filas.length === 0) {
    return NextResponse.json({ error: 'Falta decir qué hay que hacer.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('recordatorios')
    .insert(filas)
    .select('id, titulo, fecha, hora, nota, asignado_a')

  if (error || !data) {
    console.error('[HUBI] Fallo creando recordatorio:', error)
    return NextResponse.json({ error: 'No se ha podido guardar.' }, { status: 500 })
  }

  // ── Avisar a la otra persona, en el momento ────────────────
  // "Conchita te ha dejado una tarea". Es el aviso más útil de todo el
  // sistema: el que sustituye a la nota en la nevera. Si falla, el
  // recordatorio ya está guardado y aparecerá igual en el tablón.
  /*
    ═══════════════════════════════════════════════════════════
    POR QUÉ TODO ESTO VA DENTRO DE `after`, Y NO SUELTO.
    ═══════════════════════════════════════════════════════════

    Aquí estaba el fallo gordo de la sincronización con Google, y era
    invisible: las llamadas iban lanzadas «y que terminen solas»
    —`ponerCita(...).then(...)` sin esperar— y la respuesta se
    devolvía acto seguido.

    En el ordenador de uno eso funciona: el proceso sigue vivo. En
    Vercel NO. En cuanto se devuelve la respuesta, la función se
    congela. Lo que quedara a medias, ahí se queda: la cita no llega
    a crearse en Google, o se crea y no da tiempo a guardar su
    identificador. Y no salta ningún error en ninguna parte, porque
    desde fuera todo ha ido bien: la tarea está guardada en HUBI.

    Resultado: tareas en HUBI que no aparecen en el calendario, unas
    sí y otras no, sin ningún patrón. Justo lo que se estaba viendo.

    `after` es la forma correcta de decir «esto va después de
    contestar, pero TERMÍNALO»: la persona no espera a Google, y
    Vercel no mata el trabajo a medias.

    Lo que no cambia: si Google falla, la tarea ya está guardada. Esa
    regla sigue mandando.
  */
  after(async () => {
    for (const fila of data) {
      try {
        await avisarDeLoNuevo(user.id, fila.asignado_a, fila.titulo, fila.fecha, fila.hora)
      } catch (e) {
        console.error('[HUBI] Recordatorio creado sin aviso:', e)
      }
    }

    const enGoogle = clienteServidor()
    for (const fila of data) {
      if (!fila.fecha) continue
      try {
        const evento = await ponerCita({
          titulo: fila.titulo,
          fecha: fila.fecha,
          hora: fila.hora,
          nota: fila.nota,
          hecho: false,
        })
        if (evento) {
          await enGoogle.from('recordatorios').update({ evento_google: evento }).eq('id', fila.id)
        }
      } catch (e) {
        console.error('[HUBI] Tarea guardada sin cita en Google:', e)
      }
    }
  })

  // `id` a secas para quien solo mandó una: no se rompe nada de lo que
  // ya llamaba a esta ruta.
  return NextResponse.json({ id: data[0].id, ids: data.map((d) => d.id) })
}

async function avisarDeLoNuevo(
  quienLoCrea: string,
  asignadoA: string | null,
  titulo: string,
  fecha: string | null,
  hora: string | null
) {
  const supabase = await clienteSesion()

  const { data: perfiles } = await supabase.from('perfiles').select('id, nombre')
  if (!perfiles) return

  const autor = perfiles.find((p) => p.id === quienLoCrea)?.nombre ?? 'Alguien'

  // Para el otro, o para los dos: en ambos casos avisamos a quien no lo
  // ha escrito. Avisarse a uno mismo de lo que acaba de escribir sería absurdo.
  const destinatarios = perfiles
    .filter((p) => p.id !== quienLoCrea)
    .filter((p) => asignadoA === null || asignadoA === p.id)

  await Promise.all(
    destinatarios.map((p) =>
      avisarA(p.id, {
        titulo: `${autor} te ha dejado algo`,
        cuerpo: `${titulo}${fecha ? ` · ${cuando(fecha, hora)}` : ''}`,
        url: '/tablon',
        tag: 'tablon',
      })
    )
  )
}
