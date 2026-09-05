import { NextResponse, type NextRequest } from 'next/server'
import { clienteServidor } from '@/lib/supabase/servidor'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  MIRAR CON QUÉ BASE DE DATOS HABLA HUBI DE VERDAD
  ═══════════════════════════════════════════════════════════════

  Esto está aquí porque nos hemos pasado tres intentos discutiendo
  algo que se contesta mirando: la aplicación decía que una cuenta se
  había creado y el panel de Supabase no la tenía. Una de las dos
  estaba hablando de otro sitio, y desde fuera no hay forma de saber
  cuál.

  No devuelve NINGÚN secreto. Devuelve:

  · `proyecto` — el nombre del proyecto de Supabase, que está en la
    dirección `https://XXXX.supabase.co` y es público de por sí: viaja
    en cada petición del navegador.
  · `clave` — la FORMA de la clave de servidor, no la clave. Sirve
    para ver de un vistazo si es la secreta o si alguien pegó la
    pública por error, que es un fallo que no da ningún síntoma
    claro.
  · `cuentas` — cuántas ve, y si ve la que se está buscando.

  Va detrás de la palabra de invitación. Y aun así: **cambia la
  palabra cuando terminemos**, porque una palabra que ha viajado en la
  barra de direcciones queda escrita en los registros del servidor.
*/
export async function GET(peticion: NextRequest) {
  const esperada = process.env.PALABRA_DE_ALTA
  const url = new URL(peticion.url)
  const palabra = (url.searchParams.get('palabra') ?? '').trim()

  if (!esperada || palabra.toLowerCase() !== esperada.trim().toLowerCase()) {
    return NextResponse.json({ error: 'No.' }, { status: 403 })
  }

  const direccion = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const secreta = process.env.SUPABASE_SECRET_KEY ?? ''
  const buscado = (url.searchParams.get('correo') ?? '').trim().toLowerCase()

  const respuesta: Record<string, unknown> = {
    proyecto: direccion.replace(/^https?:\/\//, '').replace(/\.supabase\.co.*$/, '') || null,
    clave: !secreta
      ? 'NO ESTÁ PUESTA'
      : secreta.startsWith('sb_secret_')
        ? 'sb_secret_… (secreta, forma nueva)'
        : secreta.startsWith('sb_publishable_')
          ? '⚠ sb_publishable_… ¡ES LA PÚBLICA, NO LA SECRETA!'
          : secreta.startsWith('eyJ')
            ? 'eyJ… (forma antigua: puede ser la service_role o la anon)'
            : 'forma desconocida',
  }

  try {
    const admin = clienteServidor()
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })

    if (error) {
      respuesta.cuentas = `no se pueden leer: ${error.message}`
    } else {
      const correos = (data?.users ?? []).map((u) => (u.email ?? '').toLowerCase())
      respuesta.cuentas = correos.length
      if (buscado) respuesta.estaEsaCuenta = correos.includes(buscado)
    }
  } catch (e) {
    respuesta.cuentas = `error: ${e instanceof Error ? e.message : 'desconocido'}`
  }

  return NextResponse.json(respuesta, {
    headers: { 'Cache-Control': 'no-store, private' },
  })
}

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

  const { data: creada, error } = await admin.auth.admin.createUser({
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

  /*
    ═══════════════════════════════════════════════════════════
    AQUÍ HABÍA UN FALLO MÍO, Y ES EL QUE PROHÍBE EL PUNTO 26
    ═══════════════════════════════════════════════════════════

    Esto decía antes: si el error de Google… perdón, de Supabase,
    contiene «already», «registered» o «exists», entonces la cuenta ya
    existía y todo va bien. Y contestaba `bien: true`.

    Es adivinar leyendo un texto. Si el error dice otra cosa —o si el
    texto cambia con una versión de Supabase— esta ruta responde «todo
    bien» sobre una cuenta QUE NO SE HA CREADO. Y lo siguiente que pasa
    es que se pide el número, Supabase contesta «ese usuario no
    existe», y la pantalla le echa la culpa al correo de quien está
    intentando entrar: «este correo no tiene acceso a HUBI».

    Media hora buscando un fallo en un correo bien escrito. Eso es
    exactamente «simular una conexión diciendo que funciona».

    Ahora NO se adivina: se pregunta si la cuenta está.
  */
  let existe = Boolean(creada?.user?.id)

  if (!existe) {
    const { data: lista, error: alBuscar } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })

    if (alBuscar) {
      console.error('[HUBI] No se ha podido comprobar si la cuenta existe:', alBuscar)
    }

    existe = (lista?.users ?? []).some((u) => (u.email ?? '').toLowerCase() === correo)
  }

  if (!existe) {
    console.error('[HUBI] La cuenta no se ha creado:', error)

    /*
      El motivo de verdad, en la pantalla. No es un descuido: a esta
      línea solo llega quien ya ha acertado la palabra de invitación,
      y es quien está montando esto. Un «inténtalo en un minuto» aquí
      manda a esperar por algo que no se arregla esperando.
    */
    return NextResponse.json(
      {
        error: 'No se ha podido crear la cuenta.',
        detalle: error?.message ?? 'Supabase no ha devuelto ningún motivo.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true })
}
