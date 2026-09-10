import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { quien } from '@/lib/supabase/quien'
import { mandaEnSuCasa, SIN_CASA } from '@/lib/hogar'
import { elEspacio } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  QUIÉN VE QUÉ CARPETA
  ═══════════════════════════════════════════════════════════════

  Se manda la foto ENTERA de lo que puede una persona, no un cambio
  suelto. O sea: «Marta ve Casa y Vehículos, y guarda solo en Casa»,
  todo de una vez.

  Podría ser un interruptor por llamada, que es más fácil de escribir.
  Y sería peor: quien reparte permisos toca tres o cuatro seguidos, y
  con una llamada por toque acaba habiendo un momento —el que va entre
  la segunda y la tercera— en el que la persona tiene una mezcla que
  nadie ha decidido. Si además se cae la conexión ahí, se queda así.

  Con la foto entera, o se aplica todo o no se aplica nada.

  ─────────────────────────────────────────────────────────────
  Y SOLO PUEDE HACERLO QUIEN CREÓ LA CASA

  No es jerarquía por gusto: aquí se reparte el acceso a las facturas
  y los informes médicos de todos los que ya están dentro.
*/

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const hogarId = await elEspacio(supabase)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 403 })

  if (!(await mandaEnSuCasa(supabase, user.id))) {
    return NextResponse.json(
      { error: 'Solo quien creó esta casa puede repartir el acceso.' },
      { status: 403 }
    )
  }

  let cuerpo: {
    perfil_id?: string
    ve_todo?: boolean
    escribe_todo?: boolean
    carpetas?: { id?: string; ver?: boolean; escribir?: boolean }[]
  }
  try {
    cuerpo = await peticion.json()
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const perfilId = String(cuerpo.perfil_id ?? '')
  if (!perfilId) return NextResponse.json({ error: 'Falta la persona.' }, { status: 400 })

  const admin = clienteServidor()

  /* ¿Está de verdad en esta casa? Con la clave de servidor no hay
     políticas que lo garanticen, así que se comprueba a mano: si no,
     este identificador podría ser el de cualquiera. */
  const { data: miembro } = await admin
    .from('miembros')
    .select('perfil_id, papel')
    .eq('hogar_id', hogarId)
    .eq('perfil_id', perfilId)
    .maybeSingle()

  if (!miembro) {
    return NextResponse.json({ error: 'Esa persona no está en tu casa.' }, { status: 404 })
  }

  /*
    A QUIEN CREÓ LA CASA NO SE LE RECORTA NADA.

    Su Google Drive es donde viven los documentos de todos. Dejarle
    sin acceso a una carpeta suya sería, además de absurdo, la forma
    de que la casa entera se quedara sin poder abrir un papel — y de
    que nadie pudiera deshacerlo, porque el único que puede repartir
    permisos sería él.
  */
  if (miembro.papel === 'propietario') {
    return NextResponse.json(
      { error: 'Quien creó la casa ve todo siempre: su Drive guarda los papeles.' },
      { status: 400 }
    )
  }

  const veTodo = cuerpo.ve_todo !== false
  const escribeTodo = cuerpo.escribe_todo !== false

  /* Las carpetas que existen de verdad en esta casa. Nunca se guarda
     un identificador que venga del navegador sin comprobarlo. */
  const { data: raices } = await admin
    .from('categorias')
    .select('id')
    .eq('hogar_id', hogarId)
    .is('padre_id', null)

  const existen = new Set((raices ?? []).map((c) => c.id as string))

  const filas = (cuerpo.carpetas ?? [])
    .filter((c) => c.id && existen.has(String(c.id)))
    .map((c) => ({
      perfil_id: perfilId,
      categoria_id: String(c.id),
      hogar_id: hogarId,
      ver: c.ver === true,
      escribir: c.escribir === true,
    }))

  const { data: cambiado, error: alMarcar } = await admin
    .from('miembros')
    .update({ ve_todo: veTodo, escribe_todo: escribeTodo })
    .eq('hogar_id', hogarId)
    .eq('perfil_id', perfilId)
    .select('perfil_id')

  if (alMarcar || !cambiado || cambiado.length === 0) {
    console.error('[HUBI] No se han podido guardar los permisos:', alMarcar)
    return NextResponse.json(
      {
        error: 'No se han podido guardar los permisos.',
        detalle: alMarcar?.message ?? 'Esto todavía no está disponible en esta casa.',
      },
      { status: 500 }
    )
  }

  /*
    Y las concesiones: fuera las de antes y dentro las nuevas.

    Borrar primero y escribir después deja un instante sin permisos.
    Es aceptable aquí y no lo sería al revés: un instante de MENOS
    acceso no enseña nada que no deba verse; un instante de MÁS, sí.
    Cuando hay que elegir entre fallar abierto y fallar cerrado, se
    falla cerrado.
  */
  await admin.from('permisos_carpeta').delete().eq('perfil_id', perfilId)

  if (filas.length > 0) {
    const { error: alConceder } = await admin.from('permisos_carpeta').insert(filas)
    if (alConceder) {
      console.error('[HUBI] Permisos a medias:', alConceder)
      return NextResponse.json(
        {
          error: 'Los permisos se han guardado a medias. Vuelve a repasarlos.',
          detalle: alConceder.message,
        },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ bien: true })
}
