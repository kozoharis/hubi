import { NextResponse, type NextRequest } from 'next/server'
import { clienteServidor } from '@/lib/supabase/servidor'
import { avisarA } from '@/lib/push'
import { hoyAqui } from '@/lib/tablon'

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

  const { data: perfiles } = await supa.from('perfiles').select('id, nombre')
  const todos = (perfiles ?? []).map((p) => p.id)

  const { data: pendientes } = await supa
    .from('recordatorios')
    .select('id, titulo, tipo, asignado_a, fecha, hora, aviso_previo, ultimo_aviso')
    .eq('estado', 'pendiente')
    .is('eliminado_en', null)
    .not('fecha', 'is', null)

  let avisados = 0
  const detalle: string[] = []

  for (const r of pendientes ?? []) {
    if (r.ultimo_aviso === hoy) continue // ya se avisó hoy de esto

    const faltan = diasHasta(hoy, r.fecha as string)
    const destinatarios = r.asignado_a ? [r.asignado_a] : todos

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

  return NextResponse.json({ fecha: hoy, avisos_entregados: avisados, detalle })
}

function diasHasta(desde: string, hasta: string): number {
  const a = new Date(desde + 'T12:00:00Z').getTime()
  const b = new Date(hasta + 'T12:00:00Z').getTime()
  return Math.round((b - a) / 86_400_000)
}
