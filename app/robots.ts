import type { MetadataRoute } from 'next'

/*
  ═══════════════════════════════════════════════════════════════
  QUE MAPPEL NO SALGA EN GOOGLE
  ═══════════════════════════════════════════════════════════════

  Esto no existía, y significaba que MAPPEL estaba **abierto a los
  buscadores**. Todo lo de dentro pide sesión, así que Google no
  podría leer ni un papel ni una nota — eso lo para el proxy, no
  esto.

  Lo que sí podía salir es lo que está abierto por necesidad: la
  puerta (`/entrar`), la privacidad y los términos. Y con eso basta
  para que, buscando el nombre, aparezca la dirección de la casa
  digital de una familia y un formulario donde escribir su correo.

  No es una brecha. Es que **una casa privada no tiene por qué estar
  en la guía telefónica**, y el punto 27 del planteamiento dice que
  no se usen direcciones públicas sin necesidad.

  ─────────────────────────────────────────────────────────────
  Y ESTO NO ES UNA CERRADURA

  Un `robots.txt` es una petición educada: los buscadores serios la
  respetan y un robot que venga a hacer daño ni la lee. Lo que
  protege de verdad sigue siendo lo de siempre —el proxy y la RLS—.

  Por eso va acompañado de `robots: { index: false }` en el
  `layout.tsx`, que es la cabecera que sí obedecen incluso cuando
  llegan a la página por un enlace de fuera.
*/

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  }
}
