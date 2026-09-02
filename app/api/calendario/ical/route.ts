import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { quien } from '@/lib/supabase/quien'
import { cifrar } from '@/lib/cifrado'
import { esDireccionDeCalendario, leerICS } from '@/lib/ical'
import { idCalendarioHubi } from '@/lib/google/calendario'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/*
  CONECTAR (Y DESCONECTAR) EL CALENDARIO DE GOOGLE.

  Se guarda la dirección secreta en formato iCal, cifrada. Nunca vuelve
  a salir: ni en esta respuesta, ni en ninguna pantalla.

  ─────────────────────────────────────────────────────────────
  NO SE GUARDA SIN PROBARLA. Ésta es la regla que manda aquí.

  El punto 26 del planteamiento lo dice sin rodeos: "no simules una
  conexión diciendo que funciona". Guardar una dirección y contestar
  "conectado" sin haber ido a buscarla es exactamente eso — y el fallo
  aparecería días después, en forma de una Agenda a la que le faltan
  citas y nadie sabe por qué.

  Así que antes de guardar nada se pide el archivo de verdad y se lee.
  Si Google no contesta, o contesta otra cosa, se dice AHORA y no se
  guarda. Y de paso se puede confirmar con un dato concreto: cuántas
  citas se han encontrado.

  ─────────────────────────────────────────────────────────────
  Y SOLO DIRECCIONES DE GOOGLE, POR HTTPS.

  No es cerrazón. Es una dirección que va a pedir NUESTRO SERVIDOR: si
  se aceptara cualquiera, HUBI se convertiría en un recadero que va a
  donde le manden —a la red interna de Vercel, por ejemplo, donde viven
  cosas que no debe tocar nadie desde fuera—.
*/

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { url?: unknown }
  try {
    cuerpo = (await peticion.json()) as { url?: unknown }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido la dirección.' }, { status: 400 })
  }

  const url = String(cuerpo.url ?? '').trim()

  if (!url) {
    return NextResponse.json({ error: 'Pega la dirección del calendario.' }, { status: 400 })
  }

  if (!esDireccionDeCalendario(url)) {
    return NextResponse.json(
      {
        error:
          'Esa no parece la dirección secreta de un calendario de Google. Tiene que empezar por https://calendar.google.com y terminar en .ics',
      },
      { status: 400 }
    )
  }

  /*
    ── Y QUE NO SEA EL PROPIO CALENDARIO HUBI ──

    Es el error fácil de cometer: entrar en Google, ver el calendario
    llamado HUBI y copiar SU dirección secreta. Parecería lo correcto y
    sería justo lo contrario: todas las tareas de HUBI volverían por
    aquí como si fueran citas de Google y saldrían dos veces en la
    Agenda, una tocable y otra no.

    Al leer ya se descartan por la firma, pero eso es la red de abajo.
    Aquí se dice A LA CARA, en el momento, y con la solución delante:
    la que hay que pegar es la del calendario PERSONAL.
  */
  const hubi = await idCalendarioHubi()
  if (hubi && decodeURIComponent(url).includes(hubi)) {
    return NextResponse.json(
      {
        error:
          'Esa es la dirección del calendario HUBI, y ése ya lo llenamos nosotros. Lo que hay que pegar aquí es la dirección de tu calendario PERSONAL, el que usas tú, para que sus citas se vean también en HUBI.',
      },
      { status: 400 }
    )
  }

  // ── Se prueba de verdad, antes de guardar nada ──
  let cuantas = 0
  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(12000) })

    if (!respuesta.ok) {
      return NextResponse.json(
        {
          error:
            respuesta.status === 404
              ? 'Google dice que esa dirección no existe. Vuelve a copiarla entera desde los ajustes de tu calendario.'
              : `Google responde ${respuesta.status} a esa dirección. Comprueba que la has copiado entera.`,
        },
        { status: 400 }
      )
    }

    const texto = await respuesta.text()
    if (!texto.includes('BEGIN:VCALENDAR')) {
      return NextResponse.json(
        { error: 'Esa dirección no devuelve un calendario. Comprueba que es la de formato iCal.' },
        { status: 400 }
      )
    }

    /* Un año por delante: solo para poder decir cuántas citas hay y que
       la confirmación sea un dato y no una promesa. */
    const hoy = new Date()
    const dentroDeUnAnio = new Date(hoy)
    dentroDeUnAnio.setFullYear(hoy.getFullYear() + 1)
    cuantas = leerICS(texto, dia(hoy), dia(dentroDeUnAnio)).length
  } catch (e) {
    console.error('[HUBI] No se ha podido probar el calendario:', e)
    return NextResponse.json(
      { error: 'No se ha podido conectar con esa dirección. Inténtalo de nuevo.' },
      { status: 502 }
    )
  }

  /*
    Se escribe con la clave de servidor, no con la sesión.

    Aquí no se está saltando ningún permiso: la fila es la de quien ha
    entrado —`user.id`, y no hay forma de que sea otra—. Es que esta
    columna guarda una contraseña, y las contraseñas no se tocan desde
    el lado de las políticas: se tocan desde el servidor, como el
    permiso de Drive.
  */
  const admin = clienteServidor()
  const { data, error } = await admin
    .from('perfiles')
    .update({ ical_cifrado: cifrar(url), ical_desde: new Date().toISOString() })
    .eq('id', user.id)
    .select('id')

  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes('ical_cifrado')
          ? 'Falta ejecutar sql/21-calendario-google.sql en la base de datos.'
          : 'No se ha podido guardar.',
        detalle: error.message,
      },
      { status: 500 }
    )
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'No se ha podido guardar.' }, { status: 409 })
  }

  return NextResponse.json({ bien: true, citas: cuantas })
}

// ── Compartirlo con la casa, o dejar de compartirlo ──────────
/*
  Lo decide EL DUEÑO DEL CALENDARIO y nadie más. Se escribe siempre en
  la fila de quien tiene la sesión abierta (`user.id`), así que no hay
  manera de encenderle el calendario a otra persona ni de apagárselo.
*/
export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { compartido?: unknown }
  try {
    cuerpo = (await peticion.json()) as { compartido?: unknown }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const admin = clienteServidor()
  const { data, error } = await admin
    .from('perfiles')
    .update({ ical_compartido: cuerpo.compartido === true })
    .eq('id', user.id)
    .select('id')

  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes('ical_compartido')
          ? 'Falta ejecutar sql/22-calendario-compartido.sql en la base de datos.'
          : 'No se ha podido guardar.',
      },
      { status: 500 }
    )
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'No se ha podido guardar.' }, { status: 409 })
  }

  return NextResponse.json({ bien: true })
}

// ── Desconectar ──────────────────────────────────────────────
export async function DELETE() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const admin = clienteServidor()
  const { error } = await admin
    .from('perfiles')
    .update({ ical_cifrado: null, ical_desde: null })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: 'No se ha podido desconectar.' }, { status: 500 })
  }

  return NextResponse.json({ bien: true })
}

function dia(f: Date): string {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}
