'use client'

import { useEffect } from 'react'

/*
  El color de la barra de estado del móvil.

  En la app instalada, la franja de arriba —hora, cobertura, batería—
  la pinta iOS, no nosotros, con el color que declaramos en el
  manifiesto. Si una pantalla tiene un fondo distinto de ese color, se
  ve una costura horizontal justo debajo del reloj.

  Este componente cambia ese color mientras la pantalla está puesta y
  lo devuelve al salir. Es la única forma de que el arranque llegue de
  verdad hasta el borde de arriba.
*/
export default function ColorDeBarra({ color }: { color: string }) {
  useEffect(() => {
    const etiqueta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!etiqueta) return

    const antes = etiqueta.content
    etiqueta.content = color
    return () => {
      etiqueta.content = antes
    }
  }, [color])

  return null
}
