import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
]

export async function proxy(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion })

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
          respuesta = NextResponse.next({ request: peticion })
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

  const ruta = peticion.nextUrl.pathname
  const esAbierta = RUTAS_ABIERTAS.some((r) => ruta.startsWith(r))

  if (!user && !esAbierta) {
    const destino = peticion.nextUrl.clone()
    destino.pathname = '/entrar'
    return NextResponse.redirect(destino)
  }

  if (user && ruta.startsWith('/entrar')) {
    const destino = peticion.nextUrl.clone()
    destino.pathname = '/'
    return NextResponse.redirect(destino)
  }

  return respuesta
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
