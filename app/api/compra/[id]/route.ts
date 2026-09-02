import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'

export const dynamic = 'force-dynamic'

/** Tachar, o destachar. */
export async function PATCH(
  peticion: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const { comprado } = (await peticion.json()) as { comprado?: boolean }
  const hecho = comprado !== false

  const { data, error } = await supabase
    .from('compra')
    .update({
      comprado: hecho,
      comprado_en: hecho ? new Date().toISOString() : null,
      comprado_por: hecho ? user.id : null,
    })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[HUBI] Fallo tachando en la compra:', error)
    return NextResponse.json(
      { error: 'No se ha podido cambiar.', detalle: error.message },
      { status: 500 }
    )
  }

  /* Cero filas cambiadas no es un éxito. Ya nos costó una tarde
     descubrirlo con el borrado de las tareas. */
  if (!data) {
    return NextResponse.json({ error: 'Esa cosa ya no está en la lista.' }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}

/** Quitarlo de la lista. Aquí sí se borra: nadie quiere un histórico
 *  de las veces que apuntó pan por error. */
export async function DELETE(
  _peticion: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const { data, error } = await supabase.from('compra').delete().eq('id', id).select('id')

  if (error) {
    console.error('[HUBI] Fallo quitando de la compra:', error)
    return NextResponse.json(
      { error: 'No se ha podido quitar.', detalle: error.message },
      { status: 500 }
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      {
        error: 'No se ha quitado nada. Falta el permiso de borrado en la base de datos.',
        detalle: 'DELETE devolvió 0 filas (SQL 16).',
      },
      { status: 409 }
    )
  }

  return NextResponse.json({ ok: true })
}
