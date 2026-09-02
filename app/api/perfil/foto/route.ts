import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'

export const dynamic = 'force-dynamic'

/*
  Cambiar o quitar la foto de perfil.

  La foto llega ya reducida desde el navegador: un cuadrado de 256 px
  en JPEG, unos 20 KB. Aun así el servidor no se fía y comprueba el
  tamaño y el formato — el navegador es de quien envía, no nuestro.

  Cada uno solo puede cambiar la suya: se escribe en la fila de quien
  ha iniciado sesión, nunca en la del otro.
*/

const TOPE = 100_000 // caracteres de base64 · ~75 KB de imagen

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { foto?: string | null }
  try {
    cuerpo = (await peticion.json()) as { foto?: string | null }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido la foto.' }, { status: 400 })
  }

  const foto = cuerpo.foto ?? null

  if (foto !== null) {
    if (typeof foto !== 'string' || !foto.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Eso no parece una foto. Prueba con otra.' },
        { status: 400 }
      )
    }
    if (foto.length > TOPE) {
      return NextResponse.json(
        { error: 'La foto es demasiado grande. Prueba con otra.' },
        { status: 400 }
      )
    }
  }

  const { error } = await supabase.from('perfiles').update({ foto }).eq('id', user.id)

  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido guardar la foto.', detalle: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true })
}
