import type { NextConfig } from 'next'

/*
  ═══════════════════════════════════════════════════════════════
  LAS CABECERAS DE SEGURIDAD
  ═══════════════════════════════════════════════════════════════

  Este archivo estaba VACÍO —«config options here»— y eso significaba
  que MAPPEL se servía sin una sola cabecera de seguridad. El navegador
  no sabe nada por su cuenta: lo que no se le dice, no lo hace.

  Cada una de las de abajo cierra una puerta concreta. No son cinco
  líneas de manual: son cinco cosas que hoy se podían hacer y a partir
  de ahora no.

  ─────────────────────────────────────────────────────────────
  1 · `frame-ancestors 'none'` — QUE NADIE META MAPPEL EN SU PÁGINA

  Sin esto, cualquiera puede montar una página suya con MAPPEL dentro,
  en un marco invisible, y poner sus propios botones encima. La
  persona cree que pulsa en la web del otro y en realidad está
  pulsando «Quitarlo» dentro de su MAPPEL. Se llama *clickjacking* y
  es la más barata de las que hay.

  `frame-ancestors` es la forma moderna de `X-Frame-Options`, y va
  dentro de una CSP porque `X-Frame-Options` no entiende de matices.

  ⚠️  OJO: esto controla quién puede meternos a NOSOTROS en un marco.
  No afecta a la ventana de recetas —ahí somos nosotros los que
  metemos a YouTube, que es al revés—.

  ─────────────────────────────────────────────────────────────
  2 · `Referrer-Policy` — QUE NO SE FILTRE POR DÓNDE ANDAS

  Cuando desde MAPPEL se abre un enlace de fuera, el navegador le cuenta
  al destino DE DÓNDE VIENES. Por defecto le manda la dirección
  entera, y en MAPPEL las direcciones dicen cosas:

      /documentos/9f3c…   ·   /seccion/…/ajustes   ·   /horas/conchita

  Con `strict-origin-when-cross-origin`, a un sitio de fuera solo le
  llega `https://…vercel.app` — el dominio, nunca la ruta. Dentro de
  MAPPEL se sigue mandando entera, que es lo que hace falta.

  Es la misma decisión que se tomó en la ventana de recetas, y por el
  mismo motivo.

  ─────────────────────────────────────────────────────────────
  3 · `X-Content-Type-Options: nosniff`

  Impide que el navegador se ponga a ADIVINAR qué es un archivo
  cuando el tipo declarado no le convence. En MAPPEL se suben fotos y
  PDFs: un archivo que dice ser una foto y que el navegador decide
  tratar como JavaScript es el camino corto para ejecutar algo que
  nadie ha querido ejecutar.

  ─────────────────────────────────────────────────────────────
  4 · `Permissions-Policy` — EL MICRÓFONO Y LA CÁMARA, SOLO NOSOTROS

  MAPPEL usa micrófono (hablar) y cámara (fotos de la pared, guardar un
  papel). Esta cabecera dice que **solo MAPPEL** puede pedirlos, y que
  nada que venga metido dentro —la ventana de una receta, por
  ejemplo— puede ni preguntar.

  La localización se cierra del todo: MAPPEL no la usa. El tiempo sale
  de unas coordenadas escritas a mano en `lib/tiempo.ts`, y esa fue
  una decisión a propósito.

  ─────────────────────────────────────────────────────────────
  ⚠️  LO QUE ESTO **NO** ES

  Esto NO es una CSP completa. Una CSP de verdad —decir de dónde
  puede venir cada script— es lo que de verdad para un ataque de
  inyección, y en una aplicación de Next hecha lleva su trabajo:
  Next mete scripts en línea y hay que firmarlos uno a uno con un
  `nonce`. Puesta a medias rompe la aplicación entera en producción
  sin avisar en desarrollo.

  Está en el informe como lo siguiente que hacer, con su plan. Aquí
  se pone lo que se puede poner **sin riesgo de romper nada**, que ya
  es la diferencia entre no tener nada y tener cuatro puertas
  cerradas.
*/

const CABECERAS = [
  {
    key: 'Content-Security-Policy',
    value: [
      /* Que nadie nos meta en un marco. */
      "frame-ancestors 'none'",
      /* Y que no se pueda inyectar una `<base>` que reescriba a dónde
         van todos los enlaces relativos de la página. */
      "base-uri 'self'",
      /* Ni mandar un formulario de MAPPEL a un servidor de fuera. */
      "form-action 'self'",
    ].join('; '),
  },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  {
    key: 'Permissions-Policy',
    value: [
      'microphone=(self)',
      'camera=(self)',
      'geolocation=()',
      /* La pared se pone a pantalla completa para que Android le quite
         las barras. Va explícito aunque el valor por defecto ya sea
         éste: una cabecera que enumera unas y calla otras invita a
         suponer que lo callado está prohibido. */
      'fullscreen=(self)',
      'payment=()',
      'usb=()',
      /* Que nadie pueda medir desde fuera cuánto tarda MAPPEL en pintar
         una pantalla, que es una manera indirecta de averiguar si una
         persona tiene o no tiene algo guardado. */
      'interest-cohort=()',
    ].join(', '),
  },
  /*
    HSTS. Vercel ya sirve MAPPEL solo por HTTPS, pero esta cabecera
    hace que el NAVEGADOR se niegue a intentarlo por HTTP siquiera —
    incluso la primera vez de un día, incluso si alguien escribe la
    dirección a mano en una red de un aeropuerto.

    Dos años y subdominios incluidos, que es lo que piden las listas
    de precarga.
  */
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  /*
    Los mapas de código quedan desactivados (es lo que hace Next si no
    se dice nada, y conviene que quede escrito para que nadie los
    encienda «para depurar en producción»).

    Con ellos, quien abra las herramientas del navegador vería el
    código fuente ORIGINAL, con los comentarios incluidos. Sin ellos
    ve el compilado, que es ilegible y no dice de dónde sale nada.
  */
  productionBrowserSourceMaps: false,

  /* Que no se anuncie qué versión de Next corre por debajo. No abre
     ninguna puerta; simplemente no hay motivo para contarlo. */
  poweredByHeader: false,

  async headers() {
    return [{ source: '/:camino*', headers: CABECERAS }]
  },
}

export default nextConfig
