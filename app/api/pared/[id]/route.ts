import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacio } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  CAMBIAR Y QUITAR DESDE LA PARED
  ═══════════════════════════════════════════════════════════════

  Haris: *«sería bueno poder eliminar, cambiar o añadir desde la
  cocina»*. Añadir es `/api/pared`. Esto es lo otro.

  ─────────────────────────────────────────────────────────────
  ⚠️  QUITAR NO BORRA

  Pone fecha en `eliminado_en`, que es la papelera que ya existe. Desde
  el móvil se ve y se recupera.

  Y no es prudencia de más: una pantalla colgada en una cocina la toca
  cualquiera que entre en la casa. Un botón de borrar de verdad ahí es
  un botón que un día se lleva por delante la cita del médico. El punto
  5 del planteamiento lo pide con estas palabras: «acciones importantes
  fácilmente reversibles».

  Por eso aquí no hay `DELETE`. Ni lo hay en la base: el paso 79 no le
  da a la pantalla ninguna política de borrar, así que un `delete` desde
  una pared no borraría nada aunque alguien lo intentara.

  ─────────────────────────────────────────────────────────────
  LOS CAMPOS SE FILTRAN AQUÍ, PERO NO ES AQUÍ DONDE SE DECIDE

  Esta ruta solo deja pasar cinco: título, día, hora, de quién es, y
  quitarlo. Quien lo decide de verdad es el disparador del paso 79, que
  cierra por defecto —lo que no está en su lista, no se toca— y que
  rechazaría cualquier otra columna aunque esta ruta la mandara.

  El filtro de aquí existe para que el mensaje de error sea legible, no
  para proteger nada.
*/

export async function PATCH(
  peticion: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const hogarId = await elEspacio(supabase)
  if (!hogarId) return NextResponse.json({ error: 'No se sabe de qué casa.' }, { status: 403 })

  const cuerpo = (await peticion.json().catch(() => null)) as {
    titulo?: string
    fecha?: string | null
    hora?: string | null
    para?: string | null
    quitar?: boolean
  } | null

  if (!cuerpo) return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })

  // ── Quitar: una fecha en la papelera, y nada más ──
  if (cuerpo.quitar === true) {
    const { data, error } = await supabase
      .from('recordatorios')
      .update({ eliminado_en: new Date().toISOString() })
      .eq('hogar_id', hogarId)
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return elFallo(error)
    if (!data) {
      return NextResponse.json({ error: 'Esto no se puede quitar desde aquí.' }, { status: 403 })
    }
    return NextResponse.json({ ok: true, quitado: true })
  }

  // ── Cambiar ──
  const cambios: Record<string, unknown> = {}

  if (typeof cuerpo.titulo === 'string') {
    const t = cuerpo.titulo.trim().replace(/\s+/g, ' ').slice(0, 200)
    if (t.length < 2) {
      return NextResponse.json({ error: 'Ponle un texto.' }, { status: 400 })
    }
    cambios.titulo = t
  }

  /* La fecha se comprueba de forma antes de mandarla: una fecha torcida
     en un `update` la rechaza Postgres con un error que en una pared no
     se puede leer. */
  if (cuerpo.fecha !== undefined) {
    const f = cuerpo.fecha
    if (f !== null && !/^\d{4}-\d{2}-\d{2}$/.test(f)) {
      return NextResponse.json({ error: 'Esa fecha no vale.' }, { status: 400 })
    }
    cambios.fecha = f
  }

  if (cuerpo.hora !== undefined) {
    const h = cuerpo.hora
    if (h !== null && !/^\d{2}:\d{2}$/.test(h)) {
      return NextResponse.json({ error: 'Esa hora no vale.' }, { status: 400 })
    }
    cambios.hora = h
  }

  /* De quién es. Aquí no se comprueba que sea de la casa: lo comprueba
     la política del paso 79 con `es_persona_de_la_casa`, y repetirlo
     sería tener dos reglas que mantener a la vez. */
  if (cuerpo.para !== undefined) cambios.asignado_a = cuerpo.para || null

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: 'No has cambiado nada.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('recordatorios')
    .update(cambios)
    .eq('hogar_id', hogarId)
    .eq('id', id)
    .select('id, titulo, fecha, hora, asignado_a')
    .maybeSingle()

  if (error) return elFallo(error)
  if (!data) {
    return NextResponse.json({ error: 'Esto no se puede cambiar desde aquí.' }, { status: 403 })
  }

  return NextResponse.json({ ok: true, cosa: data })
}

/*
  El error de la base, traducido. El disparador del paso 79 ya escribe
  su mensaje en castellano y pensado para leerse de pie en una cocina,
  así que ése se deja pasar tal cual; los demás no se enseñan.
*/
function elFallo(error: { message: string }) {
  console.error('[HUBI] La pared no ha podido cambiar algo:', error)

  const suyo = /pantalla de la cocina/i.test(error.message)

  return NextResponse.json(
    {
      error: suyo
        ? error.message
        : /row-level security|policy/i.test(error.message)
          ? 'Esta pantalla todavía no puede cambiar cosas.'
          : 'No se ha podido guardar.',
      detalle: error.message,
    },
    { status: 403 }
  )
}
