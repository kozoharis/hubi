import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { quien } from '@/lib/supabase/quien'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  CAMBIAR DE CASA · ACEPTAR O RECHAZAR UNA INVITACIÓN
  ═══════════════════════════════════════════════════════════════

  Las dos cosas que puede hacer una persona con las casas donde está,
  y las dos son suyas: nadie decide por ella cuál mira ni a cuál entra.

  Por eso van con la SESIÓN y no con la clave de servidor donde se
  puede. La clave de servidor se salta las políticas — y aquí las
  políticas son justo lo que impide que alguien active una casa donde
  no le han invitado.
*/

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { casa?: string; que?: string }
  try {
    cuerpo = (await peticion.json()) as { casa?: string; que?: string }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const casa = String(cuerpo.casa ?? '')
  if (!casa) return NextResponse.json({ error: 'Falta la casa.' }, { status: 400 })

  const que = cuerpo.que === 'aceptar' || cuerpo.que === 'rechazar' ? cuerpo.que : 'mirar'

  /*
    ¿ESTÁ ESTA PERSONA EN ESA CASA?

    Con la sesión: si no está, las políticas devuelven cero filas y
    aquí se acaba. Nunca se da por bueno un identificador que viene
    del navegador — es la puerta por la que alguien intentaría
    colarse en la casa de otro.
  */
  const { data: fila } = await supabase
    .from('miembros')
    .select('hogar_id, aceptado_en')
    .eq('perfil_id', user.id)
    .eq('hogar_id', casa)
    .maybeSingle()

  if (!fila) {
    return NextResponse.json({ error: 'No estás en esa casa.' }, { status: 403 })
  }

  // ── Rechazar: la fila se va y no queda rastro ─────────────
  if (que === 'rechazar') {
    if (fila.aceptado_en) {
      return NextResponse.json(
        { error: 'Ya estás dentro de esa casa. Para salir, pídeselo a quien la creó.' },
        { status: 409 }
      )
    }

    const admin = clienteServidor()
    await admin.from('permisos_carpeta').delete().eq('perfil_id', user.id).eq('hogar_id', casa)
    await admin.from('miembros').delete().eq('perfil_id', user.id).eq('hogar_id', casa)

    return NextResponse.json({ bien: true })
  }

  // ── Aceptar ───────────────────────────────────────────────
  if (que === 'aceptar') {
    if (!fila.aceptado_en) {
      const { data, error } = await supabase
        .from('miembros')
        .update({ aceptado_en: new Date().toISOString() })
        .eq('perfil_id', user.id)
        .eq('hogar_id', casa)
        .select('hogar_id')

      /* El `.select()`: sin él, un cambio que la base de datos no
         permita afecta a cero filas y contesta que todo bien. */
      if (error || !data || data.length === 0) {
        console.error('[HUBI] No se ha podido aceptar la invitación:', error)
        return NextResponse.json(
          {
            error: 'No se ha podido aceptar.',
            detalle: error?.message ?? 'Puede que falte ejecutar el SQL 34.',
          },
          { status: 500 }
        )
      }
    }
    /* Y se pasa a mirarla: quien acepta una invitación quiere entrar,
       no volver a buscarla en un menú. */
  }

  // ── Mirar esa casa ────────────────────────────────────────
  /*
    Se guarda en el perfil y no en una cookie: la base de datos tiene
    que poder leerlo para decidir qué enseña, y una cookie no llega
    ahí. Además así la elección viaja entre el móvil y el ordenador.

    Y no hace falta comprobar nada más: `mi_hogar()` solo devuelve
    esta casa si sigues siendo miembro ACEPTADO de ella. Un valor
    viejo apuntado aquí no abre ninguna puerta.
  */
  const { data: mirando, error: alMirar } = await supabase
    .from('perfiles')
    .update({ casa_activa: casa })
    .eq('id', user.id)
    .select('id')

  if (alMirar || !mirando || mirando.length === 0) {
    console.error('[HUBI] No se ha podido cambiar de casa:', alMirar)
    return NextResponse.json(
      {
        error: 'No se ha podido cambiar de casa.',
        detalle: alMirar?.message ?? 'Puede que falte ejecutar el SQL 34.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true })
}
