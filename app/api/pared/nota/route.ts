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
    console.error('[HUBI] La pared no ha podido dejar una nota:', error)
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
