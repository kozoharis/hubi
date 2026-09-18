'use client'

import { useEffect } from 'react'

/*
  ═══════════════════════════════════════════════════════════════
  EL ALTO QUE DE VERDAD SE VE
  ═══════════════════════════════════════════════════════════════

  Haris, con la tableta delante: *«la pantalla de inicio corta la parte
  baja… vamos, que se ajuste al espacio que brinde cualquier
  dispositivo»*.

  Y lleva razón en las dos mitades de la frase, porque son dos cosas
  distintas:

    · que la pantalla REPARTA lo que hay — eso se arregla en
      `page.tsx`, quitando los altos escritos a mano;
    · que la pantalla sepa CUÁNTO hay — que es esto.

  ─────────────────────────────────────────────────────────────
  POR QUÉ `100dvh` NO SIEMPRE ES LO QUE SE VE

  La pared mide `h-dvh`, o sea `100dvh`, que es «el alto de la ventana
  ahora mismo». Es lo correcto y arregló lo de `100vh` en su día.

  Pero en Android hay un caso en el que sigue mintiendo: la barra de
  gestos —esa rayita de abajo— se dibuja ENCIMA de la página y el
  navegador declara la ventana como si no estuviera. Es exactamente lo
  que ya nos pasó en el teléfono y está escrito en `barra.tsx`:

      «en Android `env(safe-area-inset-bottom)` es CERO».

  O sea que no hay ninguna medida del sistema que avise. La página
  cree tener 924 px, tiene 880, y los 40 que faltan son justo los de
  abajo: el colchón del borde se come, y la foto y la lista de la
  compra acaban pegadas al canto de la pantalla. Lo que se ve es que
  «corta por abajo», y no es que corte: es que la pared estaba
  midiendo con una cinta más larga que la pared.

  ─────────────────────────────────────────────────────────────
  LO QUE SÍ SABE LA VERDAD

  `visualViewport.height` es lo que el navegador está ENSEÑANDO de
  verdad, no lo que cree que tiene. Existe desde 2018 en todas partes.

  Se apunta en una variable de CSS y la pared mide por ella. Y la
  variable nace con `100dvh` dentro, así que antes de que esto llegue a
  ejecutarse la pared ya mide bien de la manera de siempre: si esto
  fallara, o si el aparato no tuviera `visualViewport`, no se rompe
  nada — se queda como estaba.

  ─────────────────────────────────────────────────────────────
  Y SE VUELVE A MEDIR CUANDO CAMBIA ALGO

  Girar la tableta, entrar en pantalla completa al primer toque
  (`pantalla-completa.tsx`), que Android esconda o saque su barra. Los
  tres cambian el alto visible sin recargar nada.

  No escribe en ningún estado de React: escribe en el `<html>`, que es
  un sistema de fuera. Es justo para lo que sirve un efecto.
*/

export default function AltoDeVerdad() {
  useEffect(() => {
    const raiz = document.documentElement

    function medir() {
      /* `visualViewport` manda; si no está, `innerHeight`, que es lo
         que había. Nunca se pone un alto de cero: un número raro
         durante un giro dejaría la pared en blanco. */
      const alto = Math.round(window.visualViewport?.height ?? window.innerHeight)
      if (alto > 200) raiz.style.setProperty('--alto-pared', `${alto}px`)
    }

    medir()

    /* Un respiro después del primer pintado: al entrar en pantalla
       completa, Android tarda un momento en devolver el alto nuevo. */
    const luego = setTimeout(medir, 400)

    window.addEventListener('resize', medir)
    window.addEventListener('orientationchange', medir)
    document.addEventListener('fullscreenchange', medir)
    window.visualViewport?.addEventListener('resize', medir)

    return () => {
      clearTimeout(luego)
      window.removeEventListener('resize', medir)
      window.removeEventListener('orientationchange', medir)
      document.removeEventListener('fullscreenchange', medir)
      window.visualViewport?.removeEventListener('resize', medir)
      raiz.style.removeProperty('--alto-pared')
    }
  }, [])

  return null
}
