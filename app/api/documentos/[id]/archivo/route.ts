import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { accesoDrive, descargarArchivo } from '@/lib/google/drive'

export const dynamic = 'force-dynamic'

/**
 * Sirve el archivo original desde nuestro servidor.
 *
 * Nunca se generan enlaces públicos de Drive. Si alguien copia esta
 * dirección y la abre sin sesión, no ve nada. Y si el documento es
 * privado de la otra persona, la propia base de datos lo oculta:
 * la consulta de abajo simplemente no lo devuelve.
 */
export async function GET(
  _peticion: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) return new NextResponse('Tienes que entrar primero.', { status: 401 })

  const { data: documento } = await supabase
    .from('documentos')
    .select('drive_file_id, tipo_mime, nombre_archivo')
    .eq('id', id)
    .maybeSingle()

  if (!documento) return new NextResponse('Documento no encontrado.', { status: 404 })

  try {
    const { acceso } = await accesoDrive()
    const respuesta = await descargarArchivo(acceso, documento.drive_file_id)

    if (!respuesta.ok || !respuesta.body) {
      return new NextResponse('El archivo no está disponible ahora mismo.', {
        status: 502,
      })
    }

    return new NextResponse(respuesta.body, {
      headers: {
        'Content-Type': documento.tipo_mime,
        'Content-Disposition': `inline; filename="${documento.nombre_archivo}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('[Family Hub] Fallo descargando de Drive:', e)
    return new NextResponse('No se ha podido abrir el documento.', { status: 502 })
  }
}
