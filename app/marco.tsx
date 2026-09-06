'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/*
  ═══════════════════════════════════════════════════════════════
  ARRIBA DEL TODO AL CAMBIAR DE PANTALLA
  ═══════════════════════════════════════════════════════════════

  Hace falta por lo mismo que arregló la barra de abajo: el que se
  desliza ya no es el documento, es `.marco`. Y Next, al navegar,
  sube la VENTANA — que ahora no se mueve, porque no es la que baja.

  Sin esto pasaría lo que pasa en cualquier aplicación mal hecha:
  entras a un documento desde el final de una lista larga y aparece a
  media página, con el título fuera de la pantalla. Se nota como que
  «no ha cargado».

  `instant` y no suave: al cambiar de pantalla no hay nada que seguir
  con la vista. Un desplazamiento animado de dos mil píxeles es un
  mareo, y encima tapa el primer instante de la pantalla nueva.
*/
export default function Marco({ children }: { children: React.ReactNode }) {
  const donde = usePathname()

  useEffect(() => {
    const marco = document.getElementById('marco')
    if (marco) marco.scrollTo({ top: 0, behavior: 'instant' })
  }, [donde])

  return (
    <div id="marco" className="marco">
      {children}
    </div>
  )
}
