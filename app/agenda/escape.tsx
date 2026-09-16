'use client'

import { useEffect } from 'react'
import { useIr } from '@/app/enlace'

/*
  ═══════════════════════════════════════════════════════════════
  ESCAPE CIERRA
  ═══════════════════════════════════════════════════════════════

  Nueve líneas de navegador para la tecla que todo el mundo prueba.

  La ficha de la Agenda se puede cerrar de tres maneras —con la equis,
  volviendo a pulsar la tarjeta elegida, o con Escape— y las dos
  primeras son enlaces, así que la pantalla entera sigue siendo del
  servidor. Sólo esta necesita estar en el navegador.

  ── POR QUÉ SÓLO MIENTRAS HAY ALGO ABIERTO ──

  Este componente no se pinta cuando no hay nada elegido, así que el
  escuchador ni siquiera existe. Un escuchador de teclado permanente
  en una pantalla donde no hay nada que cerrar es una manera silenciosa
  de romper otra cosa más adelante: el día que alguien meta un campo de
  texto aquí, Escape haría dos cosas a la vez.

  ── POR QUÉ `replace` Y NO `push` ──

  Porque cerrar no es un sitio nuevo. Con `push`, la flecha de volver
  del navegador tendría que deshacer un cierre —que no se ve— antes de
  llevarte a la semana anterior. Abrir sí es un sitio: ése es el enlace
  de la tarjeta, y ése sí empuja.
*/
export default function EscapeCierra({ a }: { a: string }) {
  /* Sacado del objeto, y no `ir` entero: `useIr()` devuelve uno nuevo
     en cada pintado, así que con `[a, ir]` el escuchador se quitaría y
     se volvería a poner sin parar. `replace` sí es estable. */
  const { replace } = useIr()

  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if (e.key === 'Escape') replace(a)
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [a, replace])

  return null
}
