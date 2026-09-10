'use client'

import NextLink from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ComponentProps, type ReactNode, useCallback } from 'react'
import { elTrozoDelEspacio } from '@/lib/api'
import { conElEspacio } from '@/lib/enlaces-comunes'

/*
  ═══════════════════════════════════════════════════════════════
  UN ENLACE QUE NO TE SACA DEL ESPACIO
  ═══════════════════════════════════════════════════════════════

  Desde que el espacio vive en la dirección, un enlace normal te echa
  de él:

      estás en   /e/<cliente>/papeles
      pulsas     <Link href="/agenda">
      acabas en  /agenda          ← sin espacio

  Y ahí vuelve a mandar `casa_activa`, el dato global que todo este
  trabajo existe para quitar. O sea: el espacio manda mientras no
  toques nada.

  ─────────────────────────────────────────────────────────────
  POR QUÉ ASÍ Y NO ENVOLVIENDO CADA `href`

  Porque envolver `href` uno por uno son ciento trece sitios, y cada
  uno necesita tener a mano de dónde sale el espacio. Se intentó y
  salió mal: ciento trece oportunidades de colocar mal una línea.

  Cambiando el `import`, son cuarenta archivos y una línea en cada uno.
  Y lo que se gana no es solo trabajo: a partir de ahora, un enlace
  nuevo escrito de la manera de siempre YA se queda en su espacio. No
  hay una regla nueva que recordar.

  ─────────────────────────────────────────────────────────────
  POR QUÉ `usePathname` Y NO `window.location`

  Un componente del navegador se pinta dos veces: una en el servidor,
  para que la pantalla aparezca ya escrita, y otra al llegar. En la
  primera no hay ventana.

  Con `window.location`, el enlace saldría sin espacio en el primer
  pintado y con espacio en el segundo. React llama a eso «hidratación
  que no coincide»: se ve como un parpadeo y, a veces, como un enlace
  que no lleva donde dice.

  ─────────────────────────────────────────────────────────────
  ESTE ARCHIVO ES DEL NAVEGADOR, Y LOS ENLACES DE LAS PANTALLAS DEL
  SERVIDOR TAMBIÉN PASAN POR AQUÍ

  Un componente del servidor puede usar uno del navegador; lo de dentro
  se sigue pintando en el servidor y viaja ya escrito. Lo único que se
  hace aquí es decidir la dirección, que es una línea.
*/

/** En qué espacio estamos, según la dirección. */
export function useEspacio(): string | null {
  const ruta = usePathname()
  const trozo = elTrozoDelEspacio(ruta ?? '')
  return trozo ? trozo.slice(3) : null
}

/**
 * El mismo `Link` de siempre, que además se queda en el espacio.
 *
 * Se usa igual: `<Link href="/agenda">`. Los caminos de fuera —entrar,
 * escritorio, términos— se quedan como están.
 */
export default function Link({
  href,
  children,
  ...resto
}: Omit<ComponentProps<typeof NextLink>, 'href'> & {
  href: string
  children?: ReactNode
}) {
  const espacio = useEspacio()
  return (
    <NextLink href={conElEspacio(espacio, href)} {...resto}>
      {children}
    </NextLink>
  )
}

/**
 * Y lo mismo para saltar desde el código.
 *
 *     const ir = useIr()
 *     ir.push('/agenda')
 */
export function useIr() {
  const router = useRouter()
  const espacio = useEspacio()

  const push = useCallback(
    (camino: string) => router.push(conElEspacio(espacio, camino)),
    [router, espacio]
  )
  const replace = useCallback(
    (camino: string) => router.replace(conElEspacio(espacio, camino)),
    [router, espacio]
  )

  return { push, replace, refresh: router.refresh, back: router.back }
}
