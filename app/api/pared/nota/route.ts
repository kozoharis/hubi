import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacio } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  CLAVAR UNA NOTA EN EL CORCHO, DESDE LA PARED
  ═══════════════════════════════════════════════════════════════

  «He dejado los papeles del seguro en la mesa.» Se escribe en la
  cocina, que es donde ha estado siempre el corcho de una casa.

  ─────────────────────────────────────────────────────────────
  POR QUÉ UNA RUTA PROPIA Y NO `/api/notas`

  El mismo motivo que en `/api/pared`: la nota que deja una pared tiene
  una forma exacta —para la casa, visible en la pared— que es la que
  exige la política del paso 78. La ruta general acepta además `para`,
  y eso es superficie que una pared no usa y que, si un día se
  descuidara una comprobación, estaría ahí.

  ─────────────────────────────────────────────────────────────
  LOS DOS CAMPOS NO SON OPCIONALES, Y CONVIENE ENTENDER POR QUÉ

  `visible_en_casa: true` no es una preferencia. La restrictiva del
  paso 63 dice que una pantalla solo LEE lo que está marcado para la
  casa; sin esto, la pared guardaría una nota y no volvería a verla
  nunca. Se guarda bien y desaparece, que es el peor fallo posible
  porque parece que ha funcionado.

  `para: null` tampoco: una nota dirigida y a la vez colgada en la
  cocina es una contradicción. Está razonado en el `sql/78`.

  Aquí se escriben los dos porque son parte de lo que ESTO significa,
  no por precaución: la política los volvería a exigir de todas formas.

  ─────────────────────────────────────────────────────────────
  Y AQUÍ NO SE COMPRUEBA QUIÉN ERES

  Manda la base. Si quien pregunta no es una pantalla, la política del
  78 no deja pasar la fila y esto contesta que no.
*/

/* Lo mismo que en el móvil: una nota es un recado, no una carta. */
const LARGO = 500

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const hogarId = await elEspacio(supabase)
  if (!hogarId) return NextResponse.json({ error: 'No se sabe de qué casa.' }, { status: 403 })

  const cuerpo = (await peticion.json().catch(() => null)) as { texto?: string } | null

  const texto = String(cuerpo?.texto ?? '').trim().replace(/\s+/g, ' ')
  if (texto.length < 2) {
    return NextResponse.json({ error: 'La nota está vacía.' }, { status: 400 })
  }
  if (texto.length > LARGO) {
    return NextResponse.json(
      { error: `La nota es muy larga. Máximo ${LARGO} letras.` },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('notas')
    .insert({
      hogar_id: hogarId,
      texto,
      escrita_por: user.id,
      para: null,
      visible_en_casa: true,
    })
    .select('id, texto, creada_en')
    .maybeSingle()

  if (error) {
    console.error('[MAPPEL] La pared no ha podido dejar una nota:', error)
    return NextResponse.json(
      {
        /* Si es la política la que dice que no, se dice con palabras.
           «new row violates row-level security policy» en una pared de
           una cocina no le sirve a nadie. */
        error: /row-level security|policy/i.test(error.message)
          ? 'Esta pantalla todavía no puede dejar notas.'
          : 'No se ha podido dejar la nota.',
        detalle: error.message,
      },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true, nota: data })
}

/*
  ═══════════════════════════════════════════════════════════════
  Y RETIRARLA DEL CORCHO
  ═══════════════════════════════════════════════════════════════

  Haris: *«las notas desde la cocina, si están asignadas a la pared
  deberían poder darse por buenas y eliminarlas»*.

  Un corcho del que no se puede quitar nada acaba siendo una pared de
  papeles viejos que ya nadie lee — y entonces tampoco se lee el que
  importa. Está razonado entero en el `sql/86`.

  ─────────────────────────────────────────────────────────────
  QUITAR NO BORRA

  Pone fecha en `guardada_en`, que es exactamente lo que hace «Quitar»
  desde el móvil. La nota sale de la pared, sigue guardada, y desde el
  móvil se ve y se recupera.

  Una pantalla colgada en una cocina la toca cualquiera que entre en la
  casa. Un botón de borrar de verdad ahí es un botón que un día se
  lleva por delante el único sitio donde estaba escrito algo.

  ─────────────────────────────────────────────────────────────
  Y AQUÍ TAMPOCO SE COMPRUEBA QUIÉN ERES

  Manda la base: la política del 86 solo deja tocar las notas que
  cuelgan de esa pared, y el disparador solo deja tocar `guardada_en`.
  Si mañana se quitara, esto empezaría a fallar solo — que es lo que
  tiene que pasar.
*/
export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const hogarId = await elEspacio(supabase)
  if (!hogarId) return NextResponse.json({ error: 'No se sabe de qué casa.' }, { status: 403 })

  const cuerpo = (await peticion.json().catch(() => null)) as
    | { id?: string; que?: string }
    | null

  const id = String(cuerpo?.id ?? '')
  if (!id) return NextResponse.json({ error: 'Falta la nota.' }, { status: 400 })

  const que = String(cuerpo?.que ?? '')
  if (que !== 'quitar' && que !== 'volver-a-ponerla') {
    return NextResponse.json({ error: 'No sé qué hacer con esa nota.' }, { status: 400 })
  }

  /*
    Con `.select()`: un cambio que la seguridad no permite no da error
    en Postgres, cambia CERO filas y calla. Sin esto, la pared diría
    «hecho» y la nota seguiría colgada.
  */
  const { data, error } = await supabase
    .from('notas')
    .update({ guardada_en: que === 'quitar' ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('hogar_id', hogarId)
    .select('id')

  if (error) {
    console.error('[MAPPEL] La pared no ha podido retirar una nota:', error)
    return NextResponse.json(
      {
        error: /row-level security|policy|check_violation/i.test(error.message)
          ? 'Esta pantalla todavía no puede quitar notas.'
          : 'No se ha podido quitar la nota.',
        detalle: error.message,
      },
      { status: 403 }
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'Esa nota no cuelga de esta pared.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true })
}
