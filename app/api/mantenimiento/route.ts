import { NextResponse, type NextRequest } from 'next/server'
import { clienteServidor } from '@/lib/supabase/servidor'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LA LIMPIEZA
  ═══════════════════════════════════════════════════════════════

  Una vez por semana. Borra los sucesos de hace más de dos años y no
  hace nada más.

  ─────────────────────────────────────────────────────────────
  POR QUÉ 24 MESES

  Las tres preguntas que contesta `sucesos` miran ventanas de 7 días,
  30 días y 4 semanas. Dos años es holgadísimo para todas, y permite
  además comparar un trimestre con el mismo del año anterior.

  Guardar más no contesta nada nuevo y deja creciendo para siempre una
  tabla que sí relaciona personas con espacios. Lo que no hace falta no
  se guarda.

  ─────────────────────────────────────────────────────────────
  CÓMO ESTÁ CERRADA ESTA PUERTA

  Es el mismo patrón que ya funciona en `app/api/push/diario`:

    · Vercel manda `Authorization: Bearer <CRON_SECRET>`. Cualquier
      otra cosa recibe un 401 y no se toca nada.

    · NO ACEPTA NINGÚN PARÁMETRO. No hay forma de apuntarla a otra
      tabla, a otra fecha ni a otro espacio: la consulta está escrita
      aquí dentro y no se construye con nada que venga de fuera.

    · Es idempotente. Borra lo que pase de 24 meses. Ejecutarla diez
      veces seguidas hace exactamente lo mismo que ejecutarla una.

  Y no borra nada más. `documentos`, `notas`, `recordatorios` y todo lo
  demás son de la familia y no caducan.
*/

const MESES = 24

export async function GET(peticion: NextRequest) {
  const esperada = process.env.CRON_SECRET
  const recibida = peticion.headers.get('authorization')

  if (esperada && recibida !== `Bearer ${esperada}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const limite = new Date()
  limite.setMonth(limite.getMonth() - MESES)

  const supa = clienteServidor()

  /* espacio: a propósito — la limpieza es de TODA la base, por fecha.
     No hay sesión, no hay espacio del que filtrar, y filtrar por uno
     dejaría los de los demás creciendo para siempre. */
  const { data, error } = await supa
    .from('sucesos')
    .delete()
    .lt('cuando', limite.toISOString())
    .select('id')

  if (error) {
    console.error('[MAPPEL] No se ha podido limpiar sucesos:', error)
    return NextResponse.json({ error: 'No se ha podido limpiar.' }, { status: 500 })
  }

  const borrados = data?.length ?? 0
  console.log(`[MAPPEL] Limpieza: ${borrados} suceso(s) de antes de ${limite.toISOString()}.`)

  return NextResponse.json({ bien: true, borrados })
}
