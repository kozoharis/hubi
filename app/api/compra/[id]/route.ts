import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  CAMBIAR UNA COSA DE LA COMPRA
  ═══════════════════════════════════════════════════════════════

  Dos cosas distintas por el mismo sitio, y conviene saber por qué:

    · **Tacharla.** `{ comprado: true }`. Es lo de siempre y es lo que
      se hace mil veces: un toque en la pared.

    · **Asignarla.** `{ lista_id }`, `{ para }`, `{ para_menu_id }`.
      Haris: *«desde la cocina, la tablet, sería bueno poder asignar
      las compras también si fuera necesario»*. Es raro, deliberado, y
      se hace desde un panel.

  Van juntas porque son la misma fila y el mismo permiso —`compra`
  entera se escribe con `puedo_escribir`, desde el paso 71—, y separarlo
  en dos rutas sería dos sitios donde acordarse del hogar y del 409.

  ─────────────────────────────────────────────────────────────
  SOLO SE TOCA LO QUE VIENE

  Se mira `in` y no el valor: `{ para: null }` es «ya no le toca a
  nadie» y tiene que poder guardarse, mientras que no mandar `para` es
  «esto no lo cambies». Con un `if (cuerpo.para)` las dos cosas serían
  la misma y no se podría quitar a nadie nunca.

  ─────────────────────────────────────────────────────────────
  Y LA RED DE SIEMPRE

  `para` es del paso 89 y `para_menu_id` del 87. Si la base todavía no
  los tiene, Postgres no ignora la columna: **rechaza la consulta
  entera**, y entonces tachar la leche dejaría de funcionar por una
  casilla que no existe. Así que si falla nombrando una de las dos, se
  repite sin ellas y se dice con todas las letras qué no se ha
  guardado.

  Una columna nueva nunca puede romper lo que ya funcionaba.
*/
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

  const cuerpo = (await peticion.json().catch(() => ({}))) as {
    comprado?: boolean
    lista_id?: string | null
    para?: string | null
    para_menu_id?: string | null
  }

  /* Lo que de verdad va a cambiar. Se arma por partes porque cada
     campo puede venir o no venir, y no venir no es lo mismo que venir
     vacío. */
  const cambios: Record<string, unknown> = {}

  if ('comprado' in cuerpo) {
    const hecho = cuerpo.comprado !== false
    cambios.comprado = hecho
    cambios.comprado_en = hecho ? new Date().toISOString() : null
    cambios.comprado_por = hecho ? user.id : null
  }

  if ('lista_id' in cuerpo) cambios.lista_id = cuerpo.lista_id || null

  /* Estos dos son los que pueden no existir en la base. */
  const nuevos: Record<string, unknown> = {}
  if ('para' in cuerpo) nuevos.para = cuerpo.para || null
  if ('para_menu_id' in cuerpo) nuevos.para_menu_id = cuerpo.para_menu_id || null

  if (Object.keys(cambios).length === 0 && Object.keys(nuevos).length === 0) {
    return NextResponse.json({ error: 'No hay nada que cambiar.' }, { status: 400 })
  }

  const hogarId = await elEspacioO(supabase)

  const cambiar = (campos: Record<string, unknown>) =>
    supabase
      .from('compra')
      .update(campos)
      .eq('hogar_id', hogarId)
      .eq('id', id)
      .select('id')
      .maybeSingle()

  let { data, error } = await cambiar({ ...cambios, ...nuevos })

  /* ¿Ha fallado por una de las columnas nuevas? Se repite sin ellas:
     más vale tachar la leche y avisar de que la asignación no se ha
     guardado que no hacer nada y decir «algo ha ido mal». */
  let sinGuardar: string[] = []
  if (error && Object.keys(nuevos).length > 0 && /para_menu_id|\bpara\b/.test(error.message)) {
    sinGuardar = Object.keys(nuevos)
    ;({ data, error } = await cambiar(cambios))

    if (!error && Object.keys(cambios).length === 0) {
      return NextResponse.json(
        {
          error: 'Falta un paso en la base de datos.',
          detalle: `No se ha podido guardar: ${sinGuardar.join(' y ')}. Ejecuta los pasos 87 y 89.`,
        },
        { status: 409 }
      )
    }
  }

  if (error) {
    console.error('[MAPPEL] Fallo cambiando en la compra:', error)
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

  return NextResponse.json(sinGuardar.length > 0 ? { ok: true, sinGuardar } : { ok: true })
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

  const { data, error } = await supabase
    .from('compra')
    .delete()
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('[MAPPEL] Fallo quitando de la compra:', error)
    return NextResponse.json(
      { error: 'No se ha podido quitar.', detalle: error.message },
      { status: 500 }
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      {
        error: 'No se ha quitado nada. Falta el permiso de borrado en la base de datos.',
        detalle: 'No se ha podido quitar: la base de datos no ha dejado.',
      },
      { status: 409 }
    )
  }

  return NextResponse.json({ ok: true })
}
