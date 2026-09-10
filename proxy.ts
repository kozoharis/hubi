import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { elTrozoDelEspacio } from '@/lib/api'

/**
 * Se ejecuta antes de cada página.
 *
 *  1. Renueva la sesión para que Juan Miguel y Conchita no tengan
 *     que volver a entrar durante meses.
 *  2. Impide el acceso a cualquier pantalla sin haber entrado.
 *
 * En Next.js 16 esta pieza se llama "proxy" (antes era "middleware").
 */

const RUTAS_ABIERTAS = [
  '/entrar',
  /* La comprobación deja de estar abierta: ahora pide sesión, como
     todo lo demás. Enseñaba a cualquiera con la dirección cuántas
     familias, cuántos miembros y cuántos papeles hay dentro. */
  '/privacidad',
  '/terminos',

  // El repaso diario lo llama Vercel, que no tiene sesión iniciada.
  // No queda desprotegido: esa ruta comprueba su propia llave (CRON_SECRET)
  // y rechaza a quien no la traiga.
  '/api/push/diario',

  /*
    QUÉ VERSIÓN ESTÁ PUBLICADA. Abierta a propósito: sirve para
    comprobar desde fuera si lo último ha llegado, y si hiciera falta
    entrar para verla no serviría para eso. Devuelve una fecha y siete
    letras del commit — nada de la familia, nada que abra ninguna
    puerta.
  */
  '/api/version',

  /*
    ═══════════════════════════════════════════════════════════
    EL ALTA, POR DEFINICIÓN, LA PIDE ALGUIEN SIN SESIÓN
    ═══════════════════════════════════════════════════════════

    Esto faltaba, y costó una tarde. Sin esta línea, la llamada a
    `/api/alta` no llegaba nunca a la ruta: el proxy la redirigía a
    `/entrar`, y lo que volvía era LA PÁGINA DE ENTRAR con un 200
    perfectamente correcto.

    Y ahí está lo venenoso: el navegador sigue las redirecciones sin
    avisar, así que desde la pantalla la respuesta parecía buena. Se
    daba la cuenta por creada, se pedía el número, y Supabase decía la
    verdad —«ese usuario no existe»— sobre una cuenta que nadie había
    intentado crear.

    Tres pantallas de error distintas, ninguna señalando aquí.

    Como la de arriba, no queda desprotegida: comprueba su propia
    palabra (PALABRA_DE_ALTA) y rechaza a quien no la traiga.
  */
  '/api/alta',
]

/*
  ═══════════════════════════════════════════════════════════════
  EL ESPACIO, EN LA DIRECCIÓN
  ═══════════════════════════════════════════════════════════════

      /e/2f1c…/papeles   →   por dentro, /papeles
                             y una cabecera que dice el espacio

  La dirección de la barra NO cambia —esto reescribe por dentro, no
  redirige—, así que la persona ve en todo momento en qué espacio está,
  y dos pestañas con dos espacios distintos ya no pueden pisarse: cada
  petición lleva el suyo escrito.

  ─────────────────────────────────────────────────────────────
  LA CABECERA QUE VIENE DE FUERA SE TIRA. SIEMPRE.

  `x-espacio` la pone ESTE archivo leyendo la dirección, y nadie más.
  Sin la línea que la borra, cualquiera podría mandarla a mano desde
  el navegador y elegir espacio por su cuenta.

  Se borra antes de mirar la dirección y se borra también cuando la
  dirección no lleva espacio, que es el caso que se olvida.

  ─────────────────────────────────────────────────────────────
  Y AUNQUE SE COLARA, NO ABRE NADA

  Las políticas preguntan `soy_de(<ese espacio>)`. La cabecera elige
  entre TUS espacios; no te mete en uno ajeno. Esto es una comodidad
  para que cada pestaña sepa dónde está, no una llave.
*/
export async function proxy(peticion: NextRequest) {
  const cabeceras = new Headers(peticion.headers)
  cabeceras.delete('x-espacio')

  /* La misma función que usa el navegador para poner el espacio en las
     llamadas al API. Dos copias de esta regla acabarían diciendo cosas
     distintas el día que alguien cambiara una. */
  const trozo = elTrozoDelEspacio(peticion.nextUrl.pathname)
  const espacio = trozo ? trozo.slice(3) : null
  if (espacio) cabeceras.set('x-espacio', espacio)

  /* Lo que la aplicación cree que le han pedido: la dirección sin el
     trozo del espacio. Es lo que se compara con las rutas abiertas y lo
     que se reescribe al final. */
  const dentro = trozo
    ? peticion.nextUrl.pathname.slice(trozo.length) || '/'
    : peticion.nextUrl.pathname

  let respuesta = NextResponse.next({ request: { headers: cabeceras } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
    {
      cookies: {
        getAll() {
          return peticion.cookies.getAll()
        },
        setAll(lista) {
          lista.forEach(({ name, value }) => peticion.cookies.set(name, value))
          respuesta = NextResponse.next({ request: { headers: cabeceras } })
          lista.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  /*
    Aquí estaba el freno principal de toda la aplicación.

    `getUser()` no lee la cookie: pregunta por internet al servidor de
    Supabase si el usuario es auténtico. Y como este proxy se ejecuta
    ANTES de cada pantalla, y cada pantalla volvía a preguntarlo por su
    cuenta, cada toque en el menú costaba dos viajes de ida y vuelta
    antes de leer el primer dato.

    `getClaims()` comprueba la firma del token con la llave pública de
    Supabase, guardada en memoria. Igual de seguro y, con llaves
    asimétricas activadas, sin salir a la red.
  */
  const { data: credencial } = await supabase.auth.getClaims()
  const user = credencial?.claims?.sub ? credencial.claims : null

  /* Se mira la ruta DE DENTRO. Si no, `/e/<espacio>/entrar` no sería
     una ruta abierta y quien no ha entrado se quedaría dando vueltas. */
  const esAbierta = RUTAS_ABIERTAS.some((r) => dentro.startsWith(r))

  if (!user && !esAbierta) {
    const destino = peticion.nextUrl.clone()
    destino.pathname = '/entrar'
    return NextResponse.redirect(destino)
  }

  if (user && dentro.startsWith('/entrar')) {
    const destino = peticion.nextUrl.clone()
    destino.pathname = '/'
    return NextResponse.redirect(destino)
  }

  if (!espacio) return respuesta

  /*
    Y la reescritura.

    Las galletas de la sesión las ha ido dejando Supabase en
    `respuesta` mientras se renovaba el testigo. Si se devolviera una
    respuesta nueva sin copiarlas, la sesión se perdería cada vez que
    tocara renovarla — y eso son unas horas, así que parecería que HUBI
    echa a la gente sola de vez en cuando.
  */
  const destino = peticion.nextUrl.clone()
  destino.pathname = dentro

  const reescrita = NextResponse.rewrite(destino, {
    request: { headers: cabeceras },
  })
  for (const galleta of respuesta.cookies.getAll()) reescrita.cookies.set(galleta)

  return reescrita
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
