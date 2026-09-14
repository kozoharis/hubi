import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  QUÉ LISTA DE LA COMPRA SE VE EN LA COCINA
  ═══════════════════════════════════════════════════════════════

  Haris: *«es importante que las listas de la compra se puedan asignar
  o decir si quieres que se visualicen en la cocina»*.

  Una casilla por lista, y se marca desde el móvil — no desde la
  pared. La pared ENSEÑA lo que se haya decidido; decidirlo es de quien
  lleva la compra.

  ─────────────────────────────────────────────────────────────
  POR QUÉ ESTO NO PASA POR UNA FUNCIÓN DE LA BASE

  Lo de al lado —qué tipos de recordatorio se ven— sí pasa por una
  (`poner_al_dia_la_cocina`), y por un motivo concreto: allí hay DOS
  escrituras que tienen que ir juntas o la casa queda diciendo una cosa
  mientras la pantalla enseña otra.

  Aquí hay una sola columna en una sola fila. Envolverla en una función
  de la base sería ceremonia: una regla más que mantener para proteger
  algo que no se puede romper a medias.

  ─────────────────────────────────────────────────────────────
  Y EL PERMISO TAMPOCO SE COMPRUEBA AQUÍ

  Lo comprueba la RLS de `listas_compra`, que es la que manda. Si
  escribe una pantalla de cocina o alguien de otra casa, el `update` no
  toca ninguna fila y esto contesta que no se ha podido. Repetir la
  regla aquí sería tener dos que mantener a la vez.

  ─────────────────────────────────────────────────────────────
  SIN EL PASO 77, SE DICE

  La columna es del sql/77. Si todavía no está dado, Postgres rechaza
  la escritura y aquí se contesta con la frase que hay que leer, no con
  un 500 mudo.
*/

export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { lista_id?: string; visible?: boolean }
  try {
    cuerpo = (await peticion.json()) as { lista_id?: string; visible?: boolean }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const listaId = String(cuerpo.lista_id ?? '').trim()
  if (!listaId) {
    return NextResponse.json({ error: 'No se ha dicho qué lista.' }, { status: 400 })
  }

  /* Ni `true` ni `false`: se guarda lo que venga como booleano, y lo
     que no sea booleano se toma por «no». Nunca se escribe null desde
     aquí — null significa «todavía no se ha decidido», y esto ES
     decidir. */
  const visible = cuerpo.visible === true

  const { data, error } = await supabase
    .from('listas_compra')
    .update({ visible_en_casa: visible })
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('id', listaId)
    .select('id, nombre, visible_en_casa')
    .maybeSingle()

  if (error) {
    console.error('[MAPPEL] Fallo marcando una lista para la cocina:', error)
    return NextResponse.json(
      {
        error: /visible_en_casa/.test(error.message)
          ? 'Esta casa todavía no puede elegir qué listas se ven en la cocina.'
          : 'No se ha podido guardar.',
        detalle: error.message,
      },
      { status: 500 }
    )
  }

  if (!data) {
    /* Cero filas y sin error es la RLS diciendo que no, o una lista que
       no es de esta casa. Las dos se leen igual desde fuera y está
       bien: no hace falta contar cuál de las dos. */
    return NextResponse.json(
      { error: 'Esa lista no es tuya o no se puede cambiar.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true, lista: data })
}
