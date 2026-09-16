'use client'

import { useEffect, useState } from 'react'
import { esDeNoche } from '@/lib/noche'

/*
  ═══════════════════════════════════════════════════════════════
  LA PARED DE NOCHE
  ═══════════════════════════════════════════════════════════════

  ⚠️  ESTO ARREGLA UN FALLO QUE SE VEÍA TODAS LAS NOCHES

  Haris, a la una y media de la madrugada: *«se ve rarísimo… como si
  tuviera un velo blanco encima… muy raro, sin vida»*.

  No era la pantalla nueva: era **cómo se bajaba el brillo**. Desde el
  principio, `reloj.tsx` hacía esto a partir de las once:

      document.getElementById('la-pared').style.opacity = '0.45'

  Y `opacity` no apaga nada. Lo que hace es **mezclar** el elemento con
  lo que tiene detrás — y detrás de la pared está el papel de MAPPEL,
  que es claro y cálido. Así que a las once de la noche la pared no se
  oscurecía: se desteñía hacia el beis. Los colores perdían fuerza, la
  tinta se volvía gris claro, las fotos se lavaban. Exactamente un velo
  blanco por encima.

  En una interfaz oscura el truco cuela, porque detrás hay negro y
  mezclar con negro sí oscurece. En una clara hace lo contrario de lo
  que se quería.

  ─────────────────────────────────────────────────────────────
  LO QUE HACE UN REGULADOR DE VERDAD

  Poner algo NEGRO delante, translúcido. Eso sí baja la luz que sale de
  la pantalla, que es de lo que se trataba: *«una tableta a brillo de
  día en una cocina a oscuras es una farola»*. Los colores se apagan
  todos por igual y la pantalla sigue pareciendo lo que es.

  ─────────────────────────────────────────────────────────────
  Y SE DESPIERTA AL TOCARLA

  Lo otro que faltaba, y es lo que Haris estaba haciendo cuando lo vio:
  **mirarla**. Una pared apagada al 40 % está bien cuando no hay nadie
  delante; cuando alguien baja a la cocina a las dos de la mañana, lo
  que tiene que hacer es encenderse.

  Cualquier toque la despierta un minuto entero. Después vuelve sola a
  apagarse, sin que nadie tenga que acordarse de nada.

  ─────────────────────────────────────────────────────────────
  POR QUÉ VA AQUÍ Y NO DENTRO DE `#la-pared`

  Por lo mismo que el descanso: `descanso.tsx` ya se apaga por su
  cuenta al 28 % cuando es de noche. Si este velo lo cubriera también,
  las dos cosas se sumarían y las fotos de la familia quedarían negras.

  Cada uno apaga lo suyo. Por eso el velo va a `z-55`: por encima de
  todo lo de la pared —incluido el micrófono, que de noche también
  alumbra— y por debajo del descanso, que es `z-60`.
*/

/** Lo que se queda encendida después de tocarla. */
const DESPIERTA = 60_000

/** Cuánto se apaga. Ni tanto que no se lea, ni tan poco que no sirva. */
const CUANTO = 0.4

export default function Noche() {
  const [apagada, setApagada] = useState(false)

  useEffect(() => {
    let vuelta: ReturnType<typeof setTimeout> | null = null
    let tocada = 0

    function mirar() {
      const reciente = Date.now() - tocada < DESPIERTA
      setApagada(esDeNoche() && !reciente)
    }

    function tocar() {
      tocada = Date.now()
      mirar()
      if (vuelta) clearTimeout(vuelta)
      /* Y se vuelve a mirar cuando se acabe el minuto: si no, la pared
         se quedaría encendida hasta el siguiente latido. */
      vuelta = setTimeout(mirar, DESPIERTA + 500)
    }

    mirar()
    /* Cada minuto, para que las once en punto no dependan de que
       alguien pase por la cocina. */
    const latido = setInterval(mirar, 60_000)

    const sucesos: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    for (const s of sucesos) window.addEventListener(s, tocar, { passive: true })

    return () => {
      clearInterval(latido)
      if (vuelta) clearTimeout(vuelta)
      for (const s of sucesos) window.removeEventListener(s, tocar)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[55] bg-black transition-opacity duration-[900ms]"
      style={{ opacity: apagada ? CUANTO : 0 }}
    />
  )
}
