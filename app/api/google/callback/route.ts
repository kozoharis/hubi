import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { clienteServidor } from '@/lib/supabase/servidor'
import { canjearCodigo, correoDeLaCuenta } from '@/lib/google/oauth'
import { asegurarRaiz } from '@/lib/google/drive'
import { cifrar } from '@/lib/cifrado'

export const dynamic = 'force-dynamic'

/**
 * Google devuelve aquí a Juan Miguel después de dar permiso.
 *
 * Aquí ocurre lo importante de todo el proyecto: recibimos un permiso de
 * larga duración, lo ciframos y lo guardamos en una tabla que ningún
 * navegador puede leer. A partir de este momento, los dos usuarios pueden
 * guardar documentos en el Drive de Juan Miguel sin volver a pedirle nada.
 */
export async function GET(peticion: NextRequest) {
  const url = new URL(peticion.url)
  const codigo = url.searchParams.get('code')
  const estado = url.searchParams.get('state')
  const errorGoogle = url.searchParams.get('error')

  const volver = (motivo: string) =>
    NextResponse.redirect(new URL(`/?drive=${motivo}`, peticion.url))

  if (errorGoogle) return volver('cancelado')
  if (!codigo || !estado) return volver('error')

  const guardado = peticion.cookies.get('fh_estado')?.value
  if (!guardado || guardado !== estado) return volver('estado')

  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) return NextResponse.redirect(new URL('/entrar', peticion.url))

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('es_propietario_drive')
    .eq('id', user.id)
    .single()

  if (!perfil?.es_propietario_drive) return volver('no-eres-tu')

  try {
    const tokens = await canjearCodigo(codigo)

    // Sin refresh_token no hay permiso duradero: casi siempre significa
    // que la cuenta ya había autorizado antes y Google no lo repite.
    if (!tokens.refresh_token) return volver('sin-permiso')

    const correo = await correoDeLaCuenta(tokens.access_token)
    const raiz = await asegurarRaiz(tokens.access_token)

    const admin = clienteServidor()
    const { error } = await admin
      .from('conexion_drive')
      .update({
        refresh_token_cifrado: cifrar(tokens.refresh_token),
        email_cuenta: correo,
        // Qué nos dio Google exactamente. Sin guardarlo no hay forma de
        // saber si este permiso incluye el calendario o es uno viejo.
        alcances: tokens.scope ?? null,
        carpeta_raiz_id: raiz,
        estado: 'activa',
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', 1)

    if (error) throw error

    const respuesta = volver('conectado')
    respuesta.cookies.delete('fh_estado')
    return respuesta
  } catch (e) {
    console.error('[HUBI] Fallo conectando Drive:', e)
    return volver('error')
  }
}
