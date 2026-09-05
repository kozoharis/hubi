import { NextResponse, type NextRequest } from 'next/server'
import { clienteServidor } from '@/lib/supabase/servidor'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  DARSE DE ALTA
  ═══════════════════════════════════════════════════════════════

  Hasta hoy no existía: `signInWithOtp` iba con
  `shouldCreateUser: false`, así que entrar solo podía quien ya
  estuviera dentro. Esta ruta abre la puerta, pero con llave.

  ─────────────────────────────────────────────────────────────
  POR QUÉ LA PALABRA SE COMPRUEBA AQUÍ Y NO EN LA PANTALLA

  Porque una comprobación en el navegador no es una comprobación: es
  una sugerencia. Cualquiera abre las herramientas del navegador, ve
  la palabra escrita en el código y entra igual. Y peor: la palabra
  habría viajado a todos los navegadores del mundo.

  Aquí la palabra vive en una variable de Vercel —`PALABRA_DE_ALTA`,
  SIN `NEXT_PUBLIC_`, que es lo que la mantiene fuera del navegador— y
  la comprobación ocurre en el servidor. Lo único que sale de aquí es
  «sí» o «no».

  ─────────────────────────────────────────────────────────────
  POR QUÉ HAY PALABRA, HABIENDO QUERIDO QUE CUALQUIERA SE APUNTE

  Es temporal y por dos razones concretas, las dos del punto 27:

  · Los códigos de entrada salen hoy del Gmail personal de Juan
    Miguel. Que un desconocido haga salir un correo desde su cuenta no
    se sostiene.
  · Google tiene HUBI sin verificar: tope de 100 usuarios. Un tope que
    se gasta solo no se recupera.

  Cuando haya remitente propio y verificación, esto se quita cambiando
  una línea.

  ─────────────────────────────────────────────────────────────
  Y NO SE DICE QUIÉN TIENE CUENTA Y QUIÉN NO

  Si el correo ya existe, esta ruta contesta lo mismo que si acabara
  de crearlo. Contestar «ese correo ya está registrado» le confirma a
  cualquiera con la palabra quién usa HUBI, y eso no se cuenta.
*/

export async function POST(peticion: NextRequest) {
  const esperada = process.env.PALABRA_DE_ALTA

  /* Sin variable puesta, el alta está cerrada. Y se dice claro, en vez
     de dejar pasar a todo el mundo por descuido: una puerta que se
     abre sola porque falta una variable es exactamente el fallo que
     nadie ve venir. */
  if (!esperada) {
    return NextResponse.json(
      { error: 'Las altas están cerradas ahora mismo.' },
      { status: 503 }
    )
  }

  let cuerpo: { correo?: string; palabra?: string }
  try {
    cuerpo = (await peticion.json()) as { correo?: string; palabra?: string }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const correo = String(cuerpo.correo ?? '').trim().toLowerCase()
  const palabra = String(cuerpo.palabra ?? '').trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return NextResponse.json({ error: 'Ese correo no parece correcto.' }, { status: 400 })
  }

  if (palabra.toLowerCase() !== esperada.trim().toLowerCase()) {
    return NextResponse.json(
      { error: 'Esa palabra de invitación no vale. Compruébala con quien te invitó.' },
      { status: 403 }
    )
  }

  const admin = clienteServidor()

  const { error } = await admin.auth.admin.createUser({
    email: correo,
    /*
      CONFIRMADA DESDE EL PRINCIPIO, Y NO ES UN AGUJERO.

      Suena a que sí: «crear la cuenta ya confirmada dejaría entrar a
      quien escriba el correo de otro». No. Confirmar el correo NO da
      acceso a nada — para entrar sigue haciendo falta el número que
      Supabase manda A ESE BUZÓN. Quien no lo abra, no entra.

      Lo que sí evita es un fallo real: una cuenta sin confirmar
      recibe un código de tipo «alta», distinto del de siempre, y ahí
      es donde el camino se separa del que lleva un año funcionando
      con Juan Miguel y Conchita. Un código que no vale, en la primera
      pantalla de alguien que acaba de llegar, es el peor sitio
      posible para descubrir una diferencia así.

      Así el alta y la entrada de siempre recorren exactamente el
      mismo camino.
    */
    email_confirm: true,
  })

  if (error) {
    /* Ya existía. Se contesta que bien: puede entrar con el camino
       normal, y aquí no se le dice a nadie quién está registrado. */
    const yaEstaba = /already|registered|exists/i.test(error.message)
    if (!yaEstaba) {
      console.error('[HUBI] Fallo creando la cuenta:', error)
      return NextResponse.json(
        { error: 'No se ha podido crear la cuenta. Inténtalo en un minuto.' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ bien: true })
}
