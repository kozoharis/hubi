import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacio } from '@/lib/espacio'
import { deducirTipo } from '@/lib/tablon'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  APUNTAR ALGO DESDE LA PARED
  ═══════════════════════════════════════════════════════════════

  «El jueves viene el fontanero.» Se escribe en la cocina, de pie, donde
  se está teniendo la conversación.

  ─────────────────────────────────────────────────────────────
  POR QUÉ UNA RUTA PROPIA Y NO `/api/recordatorios`

  Porque lo que apunta una pared no es un recordatorio cualquiera: es
  uno con una forma exacta —visible en la casa, pendiente, y con dueño
  solo si es alguien de esta casa— que exigen las políticas de los pasos
  75 y 76. Meter esas condiciones
  dentro de la ruta general sería añadirle a un sitio que ya hace
  bastante un caso especial que solo vale para un aparato.

  Y hay una razón mejor: la ruta general acepta `asignado_a`, `para`,
  `repite`, `aviso_previo`… Todo eso es superficie que una pared no usa
  y que, si un día se descuidara una comprobación, estaría ahí.

  ─────────────────────────────────────────────────────────────
  AQUÍ NO SE COMPRUEBA QUIÉN ERES

  Se manda con la SESIÓN y manda la base. Si quien pregunta no es una
  pantalla, la política del 75 no deja pasar la fila y esto contesta que
  no. Comprobar aquí además que `clase = 'dispositivo'` sería una
  segunda regla para lo mismo — y el día que una se olvide, conviene que
  se olvide la que no protege.
*/

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const hogarId = await elEspacio(supabase)
  if (!hogarId) return NextResponse.json({ error: 'No se sabe de qué casa.' }, { status: 403 })

  const cuerpo = (await peticion.json().catch(() => null)) as {
    titulo?: string
    fecha?: string
    hora?: string | null
    para?: string | null
  } | null

  const titulo = String(cuerpo?.titulo ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
  if (titulo.length < 2) {
    return NextResponse.json({ error: 'Escribe qué hay que recordar.' }, { status: 400 })
  }

  const fecha = String(cuerpo?.fecha ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'No se sabe para qué día.' }, { status: 400 })
  }

  /* La hora es opcional y tiene que tener forma de hora. Vacía es
     válida: «el jueves viene el fontanero» no tiene hora, y obligar a
     poner una en una pared sería pedir un dato que nadie sabe. */
  const hora = String(cuerpo?.hora ?? '').trim()
  const laHora = /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ? hora : null

  /*
    De quién es. Vacío = de la casa, de nadie en concreto.

    Aquí solo se comprueba la FORMA, no quién es: que sea alguien de
    esta casa y que sea una persona lo decide la política del paso 76,
    con `es_persona_de_la_casa`. Comprobarlo también aquí sería una
    segunda regla para lo mismo — y el día que una se olvide, conviene
    que se olvide la que no protege.
  */
  /* `deQuien` y no `quien`: `quien` ya es la función que dice de quién
     es la sesión, importada arriba. Dos cosas con el mismo nombre en el
     mismo fichero es la manera de leer mal una de las dos. */
  const deQuien = String(cuerpo?.para ?? '').trim()
  const paraQuien = /^[0-9a-f-]{36}$/i.test(deQuien) ? deQuien : null

  const { error } = await supabase
    .from('recordatorios')
    .insert({
      hogar_id: hogarId,
      titulo,
      /* El tipo lo deduce el sistema de lo que se ha escrito, igual que
         en el resto de MAPPEL. Pedirle a una pared que elija categoría
         sería exactamente la complejidad que no queremos trasladar. */
      tipo: deducirTipo(titulo),
      fecha,
      hora: laHora,
      creado_por: user.id,
      estado: 'pendiente',
      /* Las ataduras de los pasos 75 y 76. Van también aquí porque la
         política las EXIGE: mandarlas mal sería un rechazo seguro, y
         más vale que este fichero diga en voz alta cuáles son. */
      visible_en_casa: true,
      asignado_a: paraQuien,
    })
    .select('id')

  if (error) {
    console.error('[MAPPEL] La pared no ha podido apuntar:', error.message)
    return NextResponse.json(
      {
        error: 'No se ha podido apuntar.',
        /* Si falta el paso 75, el mensaje de Postgres lo dice, y eso es
           mejor que un «algo ha ido mal». */
        detalle: error.message,
      },
      { status: 403 }
    )
  }

  return NextResponse.json({ bien: true })
}
