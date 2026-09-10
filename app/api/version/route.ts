import { NextResponse } from 'next/server'

/*
  ═══════════════════════════════════════════════════════════════
  QUÉ VERSIÓN ESTÁ PUBLICADA
  ═══════════════════════════════════════════════════════════════

  Esto no lo pidió nadie, y es de las cosas más útiles del proyecto.

  Llevamos varias sesiones con el mismo baile: se arregla algo, se
  manda, y al probarlo sigue fallando. ¿Está desplegado? ¿Se aplicó el
  parche? ¿Es otro fallo? No había forma de saberlo desde fuera, así
  que se probaba a ciegas — y una vez resultó que el parche llevaba
  cuatro rondas sin llegar a la carpeta.

  Con esto, la pregunta «¿está subido lo último?» se contesta en un
  segundo en vez de en tres mensajes.

  ─────────────────────────────────────────────────────────────
  `force-static`: LA FECHA ES LA DE LA CONSTRUCCIÓN

  Es la clave de que esto sirva. Siendo estática, la ruta se calcula
  UNA VEZ al construir y `new Date()` se congela en ese instante. Si
  fuera dinámica devolvería la hora de ahora en cada visita, que es
  exactamente el dato inútil: siempre parecería recién publicada.

  ─────────────────────────────────────────────────────────────
  Y NO LLEVA NADA PRIVADO

  Una fecha y, si Vercel lo pone, los siete primeros caracteres del
  identificador del commit. Nada de eso dice quién es la familia, ni
  qué guarda, ni abre ninguna puerta. Es pública a propósito: si
  hiciera falta entrar para verla, no serviría para comprobar si la
  sesión de alguien está en la versión vieja.
*/

export const dynamic = 'force-static'

const CONSTRUIDA = new Date().toISOString()

export async function GET() {
  return NextResponse.json({
    construida: CONSTRUIDA,
    /* Vercel lo rellena solo cuando despliega desde una carpeta que es
       un repositorio de git, que es nuestro caso. Si algún día no
       estuviera, la fecha sola ya distingue una versión de otra. */
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || null,
  })
}
