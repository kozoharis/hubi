import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { urlDeConsentimiento } from '@/lib/google/oauth'

export const dynamic = 'force-dynamic'

/**
 * Manda a Juan Miguel a dar permiso a Google.
 * Solo él: Conchita nunca conecta nada.
 */
export async function GET(peticion: NextRequest) {
  const supabase = await clienteSesion()

  const user = await quien(supabase)

  if (!user) {
    return NextResponse.redirect(new URL('/entrar', peticion.url))
  }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('es_propietario_drive')
    .eq('id', user.id)
    .single()

  if (!perfil?.es_propietario_drive) {
    return NextResponse.redirect(new URL('/?drive=no-eres-tu', peticion.url))
  }

  // Un valor de un solo uso que viaja a Google y vuelve: si al volver no
  // coincide con el que guardamos, la petición no la hemos iniciado nosotros.
  const estado = crypto.randomBytes(16).toString('hex')

  const respuesta = NextResponse.redirect(urlDeConsentimiento(estado))
  respuesta.cookies.set('fh_estado', estado, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return respuesta
}
