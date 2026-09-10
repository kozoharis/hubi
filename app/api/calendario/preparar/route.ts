import { NextResponse } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { mandaEnSuCasa, SIN_CASA } from '@/lib/hogar'
import { clienteServidor } from '@/lib/supabase/servidor'
import { compartirCon, estadoCalendario, NOMBRE_CALENDARIO } from '@/lib/google/calendario'
import { elEspacio } from '@/lib/espacio'

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

  const hogarId = await elEspacio(supabase)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 403 })

  if (!(await mandaEnSuCasa(supabase, user.id))) {
    return NextResponse.json(
      {
        error:
          'El calendario vive en la cuenta de Google de quien conectó Drive en tu casa, así que tiene que prepararlo esa persona.',
      },
      { status: 403 }
    )
  }

  const antes = await estadoCalendario(hogarId)
  if (!antes.puedeUsarse) {
    return NextResponse.json(
      {
        error:
          'Falta el permiso del calendario. Entra en Ajustes → Volver a conectar Google y acepta las dos casillas.',
      },
      { status: 409 }
    )
  }

  /*
    LOS CORREOS DE LOS DE SU CASA. SOLO LOS DE SU CASA.

    Aquí había una fuga esperando a la segunda familia: se leían TODOS
    los usuarios de HUBI y se compartía el calendario con todos. Con
    dos personas era correcto; con dos familias, la casa nueva habría
    invitado a Juan Miguel y a Conchita a su calendario sin querer, y
    ellos habrían visto sus citas médicas en el móvil.

    Se cruza con `miembros`: solo quien está en este hogar.
  */
  const admin = clienteServidor()

  const { data: gente } = await admin
    .from('miembros')
    .select('perfil_id')
    .eq('hogar_id', hogarId)

  const deLaCasa = new Set((gente ?? []).map((m) => m.perfil_id as string))

  const { data: usuarios, error } = await admin.auth.admin.listUsers()

  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido leer quién más usa HUBI.' },
      { status: 500 }
    )
  }

  const otros = usuarios.users
    .filter((u) => deLaCasa.has(u.id) && u.id !== user.id)
    .map((u) => u.email)
    .filter((c): c is string => Boolean(c))

  const compartido: string[] = []
  const aMano: string[] = []
  const fallidos: string[] = []

  for (const correo of otros) {
    const r = await compartirCon(correo, hogarId)
    if (r === 'compartido') compartido.push(correo)
    else if (r === 'a-mano') aMano.push(correo)
    else fallidos.push(correo)
  }

  const despues = await estadoCalendario(hogarId)

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
