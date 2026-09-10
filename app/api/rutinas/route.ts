import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { miHogar, mandaEnSuCasa, SIN_CASA } from '@/lib/hogar'
import { hoyAqui } from '@/lib/tablon'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LO DE CADA SEMANA
  ═══════════════════════════════════════════════════════════════

  Dos cosas muy distintas, y por eso van separadas hasta en el verbo:

    POST    monta o cambia el plan  — solo quien creó la casa
    PATCH   marca o desmarca un día — quien trabaja

  Quien ayuda en casa marca lo suyo como hecho, pero no se añade ni se
  quita trabajos. No es jerarquía por gusto: decidir qué se hace y qué
  días es la relación laboral, no una preferencia de la aplicación.

  Todo con la SESIÓN. Las políticas del SQL 38 dicen exactamente lo
  mismo — esto no las sustituye, las acompaña con un mensaje que se
  entienda.
*/

// ── Montar o cambiar el plan ───────────────────────────────
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 403 })

  if (!(await mandaEnSuCasa(supabase, user.id))) {
    return NextResponse.json(
      { error: 'El plan de la semana lo monta quien creó la casa.' },
      { status: 403 }
    )
  }

  let cuerpo: {
    /** Las rutinas que debe haber, tal cual. Reemplazan a las de esa persona. */
    rutinas?: { que?: string; dia?: number; hora?: string | null }[]
    /** De quién son. Nulo = de la casa. */
    para?: string | null
  }
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const para = String(cuerpo.para ?? '').trim() || null

  /*
    SE MANDA EL PLAN ENTERO, no una rutina suelta.

    La pantalla es una lista de casillas: se marcan y se desmarcan
    varias antes de guardar. Mandar cada cambio por separado sería
    quince peticiones y quince maneras de quedarse a medias —con la
    mitad del plan puesto y la otra mitad no, sin que nadie lo note.

    Aquí se borra lo de esa persona y se pone lo que venga. Es una
    operación entera: o queda el plan nuevo, o queda el viejo.
  */
  const filas = (cuerpo.rutinas ?? [])
    .map((r) => ({
      que: String(r.que ?? '').trim().slice(0, 80),
      dia: Number(r.dia),
      hora: typeof r.hora === 'string' && /^\d{2}:\d{2}/.test(r.hora) ? r.hora.slice(0, 5) : null,
    }))
    .filter((r) => r.que.length > 0 && r.dia >= 1 && r.dia <= 7)

  if (filas.length > 120) {
    return NextResponse.json(
      { error: 'Son demasiadas. El plan de una semana no llega a cien cosas.' },
      { status: 400 }
    )
  }

  /* Se borra lo de ESA persona, no todo el plan de la casa: si el
     plan de Marta se guardara borrando también el de la casa, montar
     el suyo se llevaría por delante el de los demás. */
  let borrar = supabase.from('rutinas').delete().eq('hogar_id', hogarId)
  borrar = para ? borrar.eq('para', para) : borrar.is('para', null)

  const { error: alBorrar } = await borrar

  if (alBorrar) {
    console.error('[HUBI] No se ha podido rehacer el plan:', alBorrar)
    return NextResponse.json(
      {
        error: 'No se ha podido guardar el plan.',
        detalle: alBorrar.message ?? 'Esto todavía no está disponible en esta casa.',
      },
      { status: 500 }
    )
  }

  if (filas.length === 0) return NextResponse.json({ bien: true, cuantas: 0 })

  const { data, error } = await supabase
    .from('rutinas')
    .insert(
      filas.map((r, i) => ({
        hogar_id: hogarId,
        que: r.que,
        dia: r.dia,
        hora: r.hora,
        para,
        orden: i,
        creada_por: user.id,
      }))
    )
    .select('id')

  /* El `.select()`: sin él, un insert que las políticas no permitan
     mete cero filas y contesta que todo ha ido bien. */
  if (error || !data || data.length === 0) {
    console.error('[HUBI] El plan no ha entrado:', error)
    return NextResponse.json(
      {
        error: 'No se ha podido guardar el plan.',
        detalle: error?.message ?? 'Esto todavía no está disponible en esta casa.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true, cuantas: data.length })
}

// ── Marcar o desmarcar lo de un día ────────────────────────
/*
  Esto SÍ lo hace quien trabaja. Y se puede desmarcar: marcar por
  error algo que no se ha hecho y no poder deshacerlo obliga a mentir
  en la pantalla o a llamar a alguien. El punto 5 pide que lo
  importante sea reversible, y aquí lo importante es que lo que ponga
  sea verdad.
*/
export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 403 })

  let cuerpo: { id?: string; hecha?: boolean; fecha?: string }
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const id = String(cuerpo.id ?? '')
  if (!id) return NextResponse.json({ error: 'Falta la rutina.' }, { status: 400 })

  /* La fecha la pone el servidor salvo que se pida otra concreta, y
     nunca `new Date()` a secas: la hora del servidor puede ir un día
     por delante de la de aquí y una rutina de las once de la noche se
     marcaría en el día siguiente. */
  const fecha =
    typeof cuerpo.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cuerpo.fecha)
      ? cuerpo.fecha
      : hoyAqui()

  if (cuerpo.hecha === false) {
    const { error } = await supabase
      .from('rutinas_hechas')
      .delete()
      .eq('rutina_id', id)
      .eq('fecha', fecha)

    if (error) {
      console.error('[HUBI] No se ha podido desmarcar:', error)
      return NextResponse.json(
        { error: 'No se ha podido desmarcar.', detalle: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json({ bien: true, hecha: false })
  }

  /* `upsert` y no `insert`: dos toques seguidos —o el mismo móvil
     reintentando con mala cobertura— darían un error de clave
     repetida, y la pantalla diría que ha fallado algo que en realidad
     estaba hecho. */
  const { data, error } = await supabase
    .from('rutinas_hechas')
    .upsert(
      { rutina_id: id, fecha, hogar_id: hogarId, quien: user.id },
      { onConflict: 'rutina_id,fecha' }
    )
    .select('rutina_id')

  if (error || !data || data.length === 0) {
    console.error('[HUBI] No se ha podido marcar:', error)
    return NextResponse.json(
      {
        error: 'No se ha podido marcar.',
        detalle: error?.message ?? 'Esto todavía no está disponible en esta casa.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true, hecha: true })
}
