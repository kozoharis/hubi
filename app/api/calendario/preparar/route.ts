import { NextResponse } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { clienteServidor } from '@/lib/supabase/servidor'
import { compartirCon, estadoCalendario, NOMBRE_CALENDARIO } from '@/lib/google/calendario'

export const dynamic = 'force-dynamic'

/*
  Poner en marcha el calendario HUBI.

  Crea el calendario dentro de la cuenta de Juan Miguel —si no existía—
  y lo comparte con la otra persona. Solo lo puede lanzar él: es su
  cuenta de Google la que lo aloja.

  Se puede pulsar las veces que haga falta: crear un calendario que ya
  existe no crea otro, y compartirlo con quien ya lo tiene devuelve un
  409 que tratamos como éxito.
*/

export async function POST() {
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
      { error: 'Solo Juan Miguel puede preparar el calendario: está en su cuenta de Google.' },
      { status: 403 }
    )
  }

  const antes = await estadoCalendario()
  if (!antes.puedeUsarse) {
    return NextResponse.json(
      {
        error:
          'Falta el permiso del calendario. Entra en Ajustes → Volver a conectar Google y acepta las dos casillas.',
      },
      { status: 409 }
    )
  }

  // Los correos de los demás. Se sacan de la lista de usuarios, no de
  // una constante escrita a mano: si algún día entra alguien más, esto
  // sigue funcionando sin tocarlo.
  const admin = clienteServidor()
  const { data: usuarios, error } = await admin.auth.admin.listUsers()

  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido leer quién más usa HUBI.' },
      { status: 500 }
    )
  }

  const otros = usuarios.users
    .map((u) => u.email)
    .filter((c): c is string => Boolean(c) && c !== user.email)

  const compartido: string[] = []
  const aMano: string[] = []
  const fallidos: string[] = []

  for (const correo of otros) {
    const r = await compartirCon(correo)
    if (r === 'compartido') compartido.push(correo)
    else if (r === 'a-mano') aMano.push(correo)
    else fallidos.push(correo)
  }

  const despues = await estadoCalendario()

  if (!despues.creado) {
    return NextResponse.json(
      { error: 'Google no ha dejado crear el calendario. Vuelve a intentarlo en un minuto.' },
      { status: 502 }
    )
  }

  return NextResponse.json({
    bien: true,
    calendario: NOMBRE_CALENDARIO,
    yaExistia: antes.creado,
    compartido,
    aMano,
    fallidos,
  })
}
