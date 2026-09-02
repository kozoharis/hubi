import { NextResponse } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { avisarA } from '@/lib/push'

export const dynamic = 'force-dynamic'

/** Manda un aviso de prueba a quien lo pide, para comprobar que llegan. */
export async function POST() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  try {
    const entregados = await avisarA(user.id, {
      titulo: 'Family Hub',
      cuerpo: 'Los avisos funcionan. Así te llegarán los recordatorios.',
      url: '/',
      tag: 'prueba',
    })

    if (entregados === 0) {
      return NextResponse.json(
        { error: 'No hay ningún teléfono activado todavía.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ entregados })
  } catch (e) {
    const motivo = e instanceof Error ? e.message : ''
    if (motivo === 'SIN_CLAVES_VAPID') {
      return NextResponse.json(
        { error: 'Los avisos no están configurados todavía.' },
        { status: 503 }
      )
    }
    console.error('[Family Hub] Fallo enviando aviso de prueba:', e)
    return NextResponse.json({ error: 'No se ha podido enviar.' }, { status: 500 })
  }
}
