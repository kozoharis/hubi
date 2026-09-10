import { NextResponse, after, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { deducirTipo, cuando } from '@/lib/tablon'
import { avisarA } from '@/lib/push'
import { ponerCita } from '@/lib/google/calendario'
import { clienteServidor } from '@/lib/supabase/servidor'
import { elEspacio, elEspacioO } from '@/lib/espacio'

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
    /* Varias personas. Ver más abajo por qué convive con `asignado_a`
       en vez de sustituirlo. */
    para?: string[]
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

  /*
    ═══════════════════════════════════════════════════════════
    UNA COSA PARA VARIAS PERSONAS SON VARIAS FILAS
    ═══════════════════════════════════════════════════════════

    Porque se decidió que **cada uno marca la suya**: que Juan Miguel
    firme los papeles no los firma por Conchita. Y con esa decisión,
    una tarea para dos personas ES dos tareas — dos estados, dos
    avisos al móvil, dos fechas de hecho.

    Nacen con el mismo `grupo_id` para saber que se apuntaron juntas.

    `asignado_a` no se jubila: sigue siendo lo que lee toda la casa
    —la agenda, el mes, el día, los avisos, los vencimientos— y una
    fila hermana es, para todos ellos, una fila con nombre y dueño
    como cualquier otra. Nada de eso hubo que tocarlo.

    Y `para: []` vacío no es lo mismo que no mandarlo: quien no manda
    `para` sigue mandando `asignado_a`, que es lo que hacen las
    pantallas viejas y lo que significa «de la casa» cuando va nulo.
  */
  const espacio = await elEspacioO(supabase)

  const filas = entradas
    .flatMap((e) => {
      const titulo = (e.titulo ?? '').trim()
      if (!titulo) return []

      const dichas = Array.isArray(e.para)
        ? [...new Set(e.para.filter((x): x is string => typeof x === 'string' && x.length > 0))]
        : []

      /* Con dos o más, una fila por persona y un grupo que las une.
         Con una sola, no hay grupo que valga: es una tarea normal. */
      const grupo = dichas.length > 1 ? crypto.randomUUID() : null
      const dueños: (string | null)[] =
        dichas.length > 0 ? dichas : [e.asignado_a || null]

      return dueños.map((dueño) => ({
        hogar_id: espacio,
        titulo,
        tipo: e.tipo === 'vencimiento' ? 'vencimiento' : deducirTipo(titulo),
        asignado_a: dueño,
        grupo_id: grupo,
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
      }))
    })

  if (filas.length === 0) {
    return NextResponse.json({ error: 'Falta decir qué hay que hacer.' }, { status: 400 })
  }

  /*
    ── Y SI EL SQL 51 NO SE HA EJECUTADO TODAVÍA ──

    Postgres no perdona una columna que no existe: rechaza el INSERT
    ENTERO, no la columna. Sin este respaldo, el día que se publique
    esto y antes de tocar la base de datos, NADIE podría apuntar nada
    en toda la casa — ni a mano ni hablando.

    Es la misma trampa de siempre (`ve_todo`, `lleva_cuentas`), y se
    resuelve igual: se intenta con la columna nueva y, si la base de
    datos dice que no la conoce, se vuelve a intentar sin ella. Lo que
    se pierde entonces es solo saber que dos tareas nacieron juntas;
    las dos tareas se guardan igual.
  */
  let { data, error } = await supabase
    .from('recordatorios')
    .insert(filas)
    .select('id, titulo, fecha, hora, nota, asignado_a')

  if (error && /grupo_id/.test(error.message ?? '')) {
    const sinGrupo = filas.map((f) => {
      const copia: Record<string, unknown> = { ...f }
      delete copia.grupo_id
      return copia
    })
    ;({ data, error } = await supabase
      .from('recordatorios')
      .insert(sinGrupo)
      .select('id, titulo, fecha, hora, nota, asignado_a'))
  }

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
  /* De qué casa es esta tarea, resuelto AQUÍ y no dentro del `after`.
     Dentro ya no hay sesión garantizada, y el calendario al que va la
     cita es el de esta casa: sin el dato, la cita se escribiría en el
     calendario de quien fuera. */
  const hogarId = await elEspacio(supabase)

  after(async () => {
    for (const fila of data) {
      try {
        await avisarDeLoNuevo(user.id, fila.asignado_a, fila.titulo, fila.fecha, fila.hora)
      } catch (e) {
        console.error('[HUBI] Recordatorio creado sin aviso:', e)
      }
    }

    if (!hogarId) return

    const enGoogle = clienteServidor()
    for (const fila of data) {
      if (!fila.fecha) continue
      try {
        const evento = await ponerCita(
          {
            titulo: fila.titulo,
            fecha: fila.fecha,
            hora: fila.hora,
            nota: fila.nota,
            hecho: false,
          },
          hogarId
        )
        if (evento) {
          await enGoogle
            .from('recordatorios')
            .update({ evento_google: evento })
            .eq('hogar_id', hogarId)
            .eq('id', fila.id)
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
