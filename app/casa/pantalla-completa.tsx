'use client'

import { useEffect } from 'react'

/*
  ═══════════════════════════════════════════════════════════════
  LA PARED, SIN LAS BARRAS DE ANDROID
  ═══════════════════════════════════════════════════════════════

  Haris: *«cuando instalo la aplicación en la tableta, se me sigue
  viendo el menú de arriba y el de abajo de Android»*.

  La barra de estado —hora, batería, wifi— y la de navegación —los
  tres botones—. En un móvil eso está bien y hace falta. En una
  tableta colgada de la pared de una cocina son dos franjas negras que
  no sirven para nada, que estropean la banda de arriba que acabamos
  de cuadrar al píxel, y que además invitan a que alguien le dé al
  botón de atrás y saque la pared de mappel.

  ─────────────────────────────────────────────────────────────
  HACEN FALTA LAS DOS COSAS, Y CADA UNA ARREGLA UN TROZO

  **1 · El manifiesto de la pared** (`public/pared.webmanifest`).
  Declara `display: "fullscreen"` en vez de `standalone`. Es lo que
  hace que, al ABRIR la aplicación instalada, Android no le ponga
  barras. Pero sólo vale si la tableta se instaló **desde la pared**:
  el navegador se queda con el manifiesto que encuentra en la página
  desde la que se instala, y el de la aplicación normal dice
  `standalone` — que es lo correcto para un teléfono, donde esconder
  la hora y la batería sería quitar algo que hace falta.

  **2 · Esto.** Pide pantalla completa al primer toque. Sirve para dos
  casos que el manifiesto no cubre: la tableta que YA estaba instalada
  antes de este cambio, y la pared abierta en una pestaña del
  navegador sin instalar nada.

  ─────────────────────────────────────────────────────────────
  ⚠️  Y NO SE PUEDE PEDIR AL CARGAR. NUNCA

  Ningún navegador deja entrar en pantalla completa por su cuenta: si
  se pudiera, cualquier página podría tapar el teléfono entero sin que
  nadie la hubiera tocado. Hace falta **un gesto de la persona**, y
  por eso esto espera al primer toque en vez de intentarlo al cargar
  —donde fallaría siempre y en silencio—.

  En la pared ese primer toque llega solo: es una pantalla que se toca.

  ─────────────────────────────────────────────────────────────
  Y SI ALGUIEN SALE, NO SE LE VUELVE A METER

  Deslizando desde el borde, Android saca las barras y se sale de
  pantalla completa. Si esto lo volviera a pedir al toque siguiente,
  estaría peleándose con quien tiene el dedo encima — y ganaría
  siempre la aplicación, que es exactamente la clase de pantalla que
  la gente acaba odiando.

  Se intenta UNA vez por carga. Quien quiera volver a pantalla
  completa, toca después de que la pared se refresque, o la cierra y
  la abre.
*/

export default function PantallaCompleta() {
  useEffect(() => {
    /* Sin soporte no se hace nada: en un iPad, por ejemplo, esto no
       existe y la pared se ve igual de bien con su barra. */
    const raiz = document.documentElement
    if (!raiz.requestFullscreen) return

    let pedido = false
    let salio = false

    function alSalir() {
      if (!document.fullscreenElement && pedido) salio = true
    }

    function pedir() {
      if (pedido || salio) return
      pedido = true
      /*
        `navigationUI: 'hide'` es lo que pide que se esconda TAMBIÉN la
        barra de los tres botones, no sólo la de la hora. Lo entienden
        Chrome y los navegadores de Android; donde no, se ignora y se
        esconde sólo la de arriba.

        La promesa se recoge y se calla: si el navegador dice que no
        —porque el gesto ya no cuenta, o porque la política del sitio
        no lo permite—, la pared sigue funcionando igual. Una pared que
        se cae por no poder esconder una barra sería peor que la barra.
      */
      raiz.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
    }

    /* `pointerdown` y no `click`: el gesto vale desde que el dedo
       baja, y así entra en pantalla completa antes de que se pinte lo
       que se haya tocado. */
    const sucesos: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart']
    for (const s of sucesos) window.addEventListener(s, pedir, { passive: true, once: true })
    document.addEventListener('fullscreenchange', alSalir)

    return () => {
      for (const s of sucesos) window.removeEventListener(s, pedir)
      document.removeEventListener('fullscreenchange', alSalir)
    }
  }, [])

  return null
}
