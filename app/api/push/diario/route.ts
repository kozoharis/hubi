import { NextResponse, type NextRequest } from 'next/server'
import { clienteServidor } from '@/lib/supabase/servidor'
import { avisarA } from '@/lib/push'
import { hoyAqui } from '@/lib/tablon'
import { pagosAlDia, papelesQueFaltan } from '@/lib/pagos-al-dia'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DIAS_ANTES: Record<string, number> = {
  '1_mes': 30,
  '1_semana': 7,
  '1_dia': 1,
}

/**
 * El repaso diario.
 *
 * Lo llama Vercel una vez al día. Mira qué toca hoy y qué vence pronto,
 * y avisa. Nada más: no es un servidor encendido esperando, es una
 * visita corta una vez al día.
 *
 * De paso, mantiene viva la base de datos: el plan gratuito de Supabase
 * pausa los proyectos que no reciben actividad durante una semana.
 */
export async function GET(peticion: NextRequest) {
  const esperada = process.env.CRON_SECRET
  const recibida = peticion.headers.get('authorization')

  if (esperada && recibida !== `Bearer ${esperada}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const supa = clienteServidor()
  /* El día de hoy donde viven ellos, no donde está el servidor. */
  const hoy = hoyAqui()

  /*
    QUIÉN VIVE EN CADA CASA.

    Aquí estaba el aviso que cruzaba familias. Una tarea sin persona
    asignada —«recoger la medicación», para quien pueda— se le mandaba
    a `todos`, y `todos` era, con la clave de servidor, TODOS los
    usuarios de HUBI. La segunda familia habría hecho sonar el
    teléfono de Juan Miguel y Conchita con sus recados.

    Se agrupa por hogar y cada tarea avisa solo a los suyos.
  */
  const { data: gente } = await supa.from('miembros').select('perfil_id, hogar_id')

  const deCadaCasa = new Map<string, string[]>()
  for (const m of gente ?? []) {
    const casa = m.hogar_id as string
    if (!casa) continue
    deCadaCasa.set(casa, [...(deCadaCasa.get(casa) ?? []), m.perfil_id as string])
  }

  const { data: pendientes } = await supa
    .from('recordatorios')
    .select('id, titulo, tipo, asignado_a, fecha, hora, aviso_previo, ultimo_aviso, hogar_id')
    .eq('estado', 'pendiente')
    .is('eliminado_en', null)
    .not('fecha', 'is', null)

  let avisados = 0
  const detalle: string[] = []

  for (const r of pendientes ?? []) {
    if (r.ultimo_aviso === hoy) continue // ya se avisó hoy de esto

    const faltan = diasHasta(hoy, r.fecha as string)

    /* Sin persona concreta, va a los de SU casa. Y si la tarea no
       tiene casa apuntada, no se avisa a nadie: es preferible un aviso
       que no suena a un aviso que suena en el móvil de otra familia. */
    const suCasa = (r.hogar_id as string | null) ?? null
    const destinatarios = r.asignado_a
      ? [r.asignado_a]
      : suCasa
        ? (deCadaCasa.get(suCasa) ?? [])
        : []

    let titulo: string | null = null
    let cuerpo = ''
    let url = '/tablon'

    if (r.tipo === 'vencimiento') {
      const antelacion = DIAS_ANTES[r.aviso_previo ?? 'sin_aviso']

      // Se avisa el día que ellos eligieron, y también el día del vencimiento.
      const tocaHoy = faltan === 0
      const tocaAntes = antelacion !== undefined && faltan === antelacion

      if (!tocaHoy && !tocaAntes) continue

      titulo = String(r.titulo).replace(/^Vence:\s*/i, '')
      cuerpo = tocaHoy ? 'Vence hoy.' : `Vence dentro de ${faltan} días.`
      url = '/calendario'
    } else if (faltan === 0) {
      titulo = r.titulo
      cuerpo = r.hora ? `Hoy a las ${String(r.hora).slice(0, 5)}` : 'Hoy'
    }

    if (!titulo) continue

    for (const quien of destinatarios) {
      avisados += await avisarA(quien, {
        titulo,
        cuerpo,
        url,
        tag: `r-${r.id}`,
      })
    }

    await supa.from('recordatorios').update({ ultimo_aviso: hoy }).eq('id', r.id)
    detalle.push(`${titulo} → ${destinatarios.length}`)
  }

  /*
    ═══════════════════════════════════════════════════════════════
    Y LOS PAGOS FIJOS, AL DÍA
    ═══════════════════════════════════════════════════════════════

    Aquí y no en un cron nuevo: esta visita ya existe, ya recorre todas
    las casas y ya tiene la clave de servidor. Montar una segunda tarea
    diaria para esto sería una pieza más que mantener a cambio de nada.

    Va AL FINAL a propósito. Los avisos de tareas y vencimientos son lo
    que hace que suene el teléfono a la hora que alguien espera; si
    esto fallara —la tabla sin crear, una categoría borrada— no puede
    llevarse por delante el aviso de la medicación. Todo lo de arriba
    ya está entregado cuando esto empieza.
  */
  let apuntados = 0
  const faltanPapeles: string[] = []

  try {
    const { puestos } = await pagosAlDia(supa, hoy)
    apuntados = puestos.length

    /*
      ── EL PAPEL QUE FALTA ──

      Solo se avisa el día 5 y el día 20 de cada mes. Y esto merece
      explicación: un aviso DIARIO de que falta la factura de Movistar
      se convierte en ruido en tres días, y a la semana nadie lo mira —
      con lo que el día que de verdad importa tampoco se mira.

      Dos veces al mes es suficiente para no olvidarse y poco para
      molestar. El 5 porque ya han llegado casi todas las de principio
      de mes, y el 20 como segunda oportunidad antes de que acabe.
    */
    const diaDelMes = Number(hoy.slice(8, 10))
    if (diaDelMes === 5 || diaDelMes === 20) {
      const faltan = await papelesQueFaltan(supa, hoy)

      /* Agrupadas por casa: el aviso va a quien vive en ella, y nunca
         a la familia de al lado. Es la misma regla que gobierna todo
         lo de arriba. */
      const porCasa = new Map<string, string[]>()
      for (const f of faltan) {
        const { data: pf } = await supa
          .from('pagos_fijos')
          .select('hogar_id')
          .eq('id', f.pago_id)
          .maybeSingle()
        if (!pf?.hogar_id) continue
        porCasa.set(pf.hogar_id, [...(porCasa.get(pf.hogar_id) ?? []), `${f.que} · ${f.como}`])
      }

      for (const [casa, cuales] of porCasa) {
        faltanPapeles.push(...cuales)
        const gente = deCadaCasa.get(casa) ?? []
        for (const quien of gente) {
          avisados += await avisarA(quien, {
            titulo: cuales.length === 1 ? 'Falta una factura' : `Faltan ${cuales.length} facturas`,
            cuerpo: cuales.slice(0, 3).join(' · '),
            url: '/pagos',
            tag: `papeles-${casa}`,
          })
        }
      }
    }
  } catch (e) {
    /* Sin el sql/47 esto no existe todavía. No es una avería. */
    console.warn('[HUBI] Pagos fijos: no se han podido poner al día:', e)
  }

  return NextResponse.json({
    fecha: hoy,
    avisos_entregados: avisados,
    pagos_apuntados: apuntados,
    papeles_que_faltan: faltanPapeles,
    detalle,
  })
}

function diasHasta(desde: string, hasta: string): number {
  const a = new Date(desde + 'T12:00:00Z').getTime()
  const b = new Date(hasta + 'T12:00:00Z').getTime()
  return Math.round((b - a) / 86_400_000)
}
