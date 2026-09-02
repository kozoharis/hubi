import { NextResponse } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { quien } from '@/lib/supabase/quien'
import { descifrar } from '@/lib/cifrado'
import { accesoDesdePermiso } from '@/lib/google/oauth'

export const dynamic = 'force-dynamic'

/*
  Un permiso corto para abrir el buscador de Drive.

  El buscador de Google (el «Picker») se dibuja en el navegador, así
  que necesita una credencial ahí. Esto es lo más delicado de toda la
  función y por eso está encerrado con tres llaves:

  1. SOLO JUAN MIGUEL. El permiso abre SU Drive. En su propio móvil
     eso es su cuenta y su Drive, y no hay nada que objetar. En el
     móvil de Conchita sería darle la llave del Drive personal de otra
     persona — no solo de la carpeta de HUBI. Así que si quien pide
     esto no es el propietario, se le dice que no.

  2. DURA UNA HORA. No se manda el permiso duradero —el que está
     cifrado en la base de datos, el que abre la puerta para siempre—
     sino un pase temporal que Google caduca solo.

  3. NO PUEDE MÁS DE LO QUE YA PODÍA. El pase hereda el mismo alcance
     que tiene HUBI, `drive.file`: los archivos que HUBI ha creado y
     los que la persona elija a mano en el buscador. Ni un archivo más.

  Nunca se guarda en el navegador ni se escribe en ningún sitio: se
  pide, se usa para abrir el buscador y se olvida.
*/

export async function GET() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('es_propietario_drive')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil?.es_propietario_drive) {
    return NextResponse.json(
      { error: 'Solo Juan Miguel puede buscar en el Drive: la cuenta es suya.' },
      { status: 403 }
    )
  }

  const admin = clienteServidor()
  const { data: conexion } = await admin
    .from('conexion_drive')
    .select('refresh_token_cifrado, estado')
    .eq('id', 1)
    .maybeSingle()

  if (conexion?.estado !== 'activa' || !conexion.refresh_token_cifrado) {
    return NextResponse.json(
      { error: 'El Drive no está conectado.' },
      { status: 409 }
    )
  }

  try {
    const acceso = await accesoDesdePermiso(descifrar(conexion.refresh_token_cifrado))
    return NextResponse.json(
      { acceso },
      // Que no se quede en ninguna caché por el camino.
      { headers: { 'Cache-Control': 'no-store, private' } }
    )
  } catch {
    return NextResponse.json(
      { error: 'Google no ha dado paso. Prueba a volver a conectar en Ajustes.' },
      { status: 502 }
    )
  }
}
