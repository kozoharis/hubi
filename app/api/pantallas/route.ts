import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { quien } from '@/lib/supabase/quien'
import { elEspacio } from '@/lib/espacio'
import { mandaEnSuCasa } from '@/lib/hogar'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  DAR DE ALTA UNA PANTALLA DE CASA
  ═══════════════════════════════════════════════════════════════

  Una tableta colgada en la cocina no es un aparato conectado a nada:
  es **un miembro más de la casa**, con su cuenta y su sesión, y con
  `clase = 'dispositivo'`. Eso es lo que hace que el modo casa sea una
  consecuencia de los permisos y no una capa de interfaz — un
  interruptor de pantalla protege de la mirada del que pasa; una
  sesión propia protege de quien toca.

  Lo que ve, lo decide `nivel_por_rol('casa', …)` más
  `visible_en_casa`. Aquí no se decide nada de eso.

  ─────────────────────────────────────────────────────────────
  LA CUENTA LA CREA HUBI

  Igual que al invitar a una persona (`app/api/miembros/route.ts:155`).
  No hay que entrar en ningún panel.

  ─────────────────────────────────────────────────────────────
  ⚠️  Y UN CORREO QUE NO EXISTA YA · ÉSTA ES LA REGLA IMPORTANTE

  Al invitar a una persona, si el correo ya tiene cuenta se reutiliza
  — es lo correcto: es ella.

  Aquí NO. Si se reutilizara, escribir por error el correo de alguien
  convertiría **su cuenta** en la pantalla de la cocina de esta casa:
  esa persona pasaría a ser un `dispositivo`, con el techo de permisos
  de un aparato, en una casa donde a lo mejor es la dueña. Y `clase`
  no se puede cambiar después ni a mano — lo impide el disparador del
  paso 66—, así que no habría vuelta atrás sin tocar la base.

  Una pantalla es algo nuevo. Se le da una dirección nueva.
*/

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const hogarId = await elEspacio(supabase)
  if (!hogarId) {
    return NextResponse.json({ error: 'No se sabe de qué casa.' }, { status: 403 })
  }

  /* La misma regla que para invitar a una persona: solo quien creó la
     casa. Colgar una pantalla en la cocina es enseñarle cosas de todos
     los que viven aquí a cualquiera que entre. */
  if (!(await mandaEnSuCasa(supabase, user.id))) {
    return NextResponse.json(
      { error: 'Solo quien creó esta casa puede poner una pantalla.' },
      { status: 403 }
    )
  }

  const cuerpo = (await peticion.json().catch(() => null)) as {
    correo?: string
    nombre?: string
  } | null

  if (!cuerpo) return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })

  const correo = String(cuerpo.correo ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return NextResponse.json({ error: 'Ese correo no parece correcto.' }, { status: 400 })
  }

  /* El nombre sale en la lista de quién vive aquí y en el aparato. Si
     no lo ponen, uno que se entiende. */
  const nombre =
    String(cuerpo.nombre ?? '').trim().replace(/\s+/g, ' ').slice(0, 40) || 'La pantalla de casa'

  const admin = clienteServidor()

  /*
    ¿EXISTE YA ESA CUENTA?

    Ojo con `perPage`: al invitar personas se leen las 200 primeras y
    ya, y eso es un fallo latente el día que haya más cuentas —a quien
    quedara fuera de esa página se le intentaría crear la cuenta otra
    vez y fallaría por correo duplicado—. Aquí se hace bien: se recorre
    hasta encontrarlo o hasta que se acaben.
  */
  let existe = false
  for (let pagina = 1; pagina <= 20 && !existe; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 })
    if (error) {
      console.error('[HUBI] No se ha podido leer las cuentas:', error.message)
      return NextResponse.json(
        { error: 'No se ha podido comprobar el correo. Inténtalo otra vez.' },
        { status: 500 }
      )
    }
    const gente = data?.users ?? []
    existe = gente.some((u) => (u.email ?? '').toLowerCase() === correo)
    if (gente.length < 200) break
  }

  if (existe) {
    return NextResponse.json(
      {
        error: 'Ese correo ya tiene cuenta en HUBI.',
        detalle:
          'Una pantalla necesita una dirección nueva, para su uso. Si usáramos la de una ' +
          'persona, su cuenta pasaría a ser la pantalla — y eso no se puede deshacer. ' +
          'Vale un alias del tuyo: si tu correo es nombre@gmail.com, sirve nombre+cocina@gmail.com.',
      },
      { status: 409 }
    )
  }

  const { data: creada, error: alCrear } = await admin.auth.admin.createUser({
    email: correo,
    email_confirm: true,
  })

  if (alCrear || !creada?.user?.id) {
    console.error('[HUBI] No se ha podido crear la cuenta de la pantalla:', alCrear)
    return NextResponse.json(
      { error: 'No se ha podido crear su cuenta.', detalle: alCrear?.message },
      { status: 500 }
    )
  }

  const id = creada.user.id

  const { error: alNombrar } = await admin
    .from('perfiles')
    .update({ nombre })
    .eq('id', id)
    .select('id')

  if (alNombrar) {
    console.error('[HUBI] La pantalla se ha quedado sin nombre:', alNombrar.message)
  }

  /*
    LA FILA, Y LAS TRES COSAS QUE TIENE QUE DECIR

      clase  'dispositivo'  · es lo que le pone el techo de permisos
      rol     null          · un aparato no lleva rol de persona
      papel  'miembro'      · nunca propietario

    Las tres las comprueba además el disparador del paso 66
    (`el_aparato_no_es_persona`), así que si esto se escribiera mal, la
    base lo rechaza en vez de dejar un aparato con permisos de persona.

    Y `aceptado_en` va puesto: una invitación se acepta pulsando un
    botón, y nadie va a pulsar «acepto» en una pantalla colgada de la
    pared. La acepta quien la cuelga, que es quien está decidiendo.
  */
  const { data: metida, error: alMeter } = await admin
    .from('miembros')
    .insert({
      hogar_id: hogarId,
      perfil_id: id,
      papel: 'miembro',
      rol: null,
      clase: 'dispositivo',
      aceptado_en: new Date().toISOString(),
    })
    .select('perfil_id')

  if (alMeter || !metida || metida.length === 0) {
    console.error('[HUBI] La pantalla no ha entrado en la casa:', alMeter)
    return NextResponse.json(
      {
        error: 'Se ha creado la cuenta pero no ha entrado en la casa.',
        detalle: alMeter?.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true, correo, nombre })
}
