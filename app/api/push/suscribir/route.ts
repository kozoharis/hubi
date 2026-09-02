import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { clienteServidor } from '@/lib/supabase/servidor'

export const dynamic = 'force-dynamic'

/** Guarda la dirección de aviso de este teléfono. */
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const cuerpo = (await peticion.json()) as {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
    dispositivo?: string
  }

  if (!cuerpo.endpoint || !cuerpo.keys?.p256dh || !cuerpo.keys?.auth) {
    return NextResponse.json({ error: 'Suscripción incompleta.' }, { status: 400 })
  }

  const admin = clienteServidor()
  const { error } = await admin.from('suscripciones_push').upsert(
    {
      perfil_id: user.id,
      endpoint: cuerpo.endpoint,
      p256dh: cuerpo.keys.p256dh,
      auth: cuerpo.keys.auth,
      dispositivo: (cuerpo.dispositivo ?? '').slice(0, 120) || null,
      fallos: 0,
      ultimo_error: null,
    },
    { onConflict: 'endpoint' }
  )

  if (error) {
    console.error('[Family Hub] Fallo guardando suscripción:', error)
    return NextResponse.json({ error: 'No se ha podido activar.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** Desactivar los avisos en este teléfono. */
export async function DELETE(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const { endpoint } = (await peticion.json()) as { endpoint?: string }
  if (!endpoint) return NextResponse.json({ error: 'Falta el dato.' }, { status: 400 })

  const admin = clienteServidor()
  await admin
    .from('suscripciones_push')
    .delete()
    .eq('endpoint', endpoint)
    .eq('perfil_id', user.id)

  return NextResponse.json({ ok: true })
}
