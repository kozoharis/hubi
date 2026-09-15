'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Fotos from './fotos'

/*
  ═══════════════════════════════════════════════════════════════
  EL DESCANSO · las fotos se quedan con la pared
  ═══════════════════════════════════════════════════════════════

  Salió de un problema de sitio y acabó siendo lo mejor de la pantalla.

  Haris quería que Hoy cupiera de una vez, sin desplazar. Nueve bloques
  no caben en una pantalla de 800 px, y el que más ocupaba era el
  tablón de fotos. La salida fácil era quitarlo.

  Pero las fotos son **lo que hace que alguien se quede mirando**, y una
  pared que no se mira deja de servir para lo demás. Quitarlas para
  ganar sitio habría sido cambiar lo único que da gusto por dos
  renglones más de lista.

  Así que no se quitan: se les da la pantalla ENTERA. A los tres
  minutos sin tocar nada, que es cuando no hay nadie delante leyendo
  nada. Es MÁS foto que antes, no menos.

  ─────────────────────────────────────────────────────────────
  LO QUE SE QUEDA ENCIMA

  Haris: *«lo que sí conservaría sobre ella la hora y el símbolo de
  MAPPEL, sólo el icono, algo más apagado, pero que esté ahí»*.

  La hora porque es lo que se mira desde la puerta y no puede
  desaparecer durante horas; el icono porque una pantalla llena de
  fotos sin nada más podría ser cualquier cosa, y en una casa con
  varias pantallas conviene saber cuál es ésta de un vistazo.

  Los dos apagados —blanco al 70 % y al 45 %— y sobre un degradado
  suave, no sobre la foto a pelo: en una foto de playa el blanco
  desaparece. La foto manda; esto acompaña.

  ─────────────────────────────────────────────────────────────
  POR QUÉ SOLO EN HOY

  Porque `vuelve-a-hoy.tsx` ya se encarga de las otras cuatro: a los
  tres minutos te devuelve a Hoy. Y una vez en Hoy, tres minutos
  después, entra el descanso.

  Van seguidos a propósito, y no a la vez: si el descanso saltara
  desde el Menú, volvería a Hoy AL TOCAR y nadie entendería por qué la
  pantalla cambió dos veces de sitio. Así, lo que pasa es siempre lo
  mismo: primero vuelve a casa, luego se duerme.

  ─────────────────────────────────────────────────────────────
  Y DE NOCHE NO ENCIENDE LA COCINA

  A partir de las once la pared entera baja a 45 % (`reloj.tsx`), y el
  carrusel se queda quieto en la foto que esté (`fotos.tsx`). El
  descanso hace lo tercero que faltaba: se pone casi negro y deja la
  foto muy apagada detrás de la hora.

  Una pantalla llena de foto a brillo de día, en una cocina a oscuras,
  se ve desde el pasillo y desde el dormitorio.
*/

const ESPERA = 3 * 60_000

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export default function Descanso() {
  const donde = usePathname() ?? '/casa'
  const [dormida, setDormida] = useState(false)
  const [ahora, setAhora] = useState<Date | null>(null)
  const cuenta = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Con el espacio en la dirección, Hoy es cualquier camino que
     TERMINE en `/casa`. La misma comprobación que `vuelve-a-hoy`. */
  const enHoy = /\/casa\/?$/.test(donde)

  useEffect(() => {
    if (!enHoy) {
      setDormida(false)
      return
    }

    function rearmar() {
      setDormida(false)
      if (cuenta.current) clearTimeout(cuenta.current)
      cuenta.current = setTimeout(() => setDormida(true), ESPERA)
    }

    rearmar()

    /* `pointerdown` y no `click`: la cuenta se reinicia en cuanto el
       dedo baja. Con `click`, deslizar una lista durante dos minutos no
       contaría como estar usándola. */
    const sucesos: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    for (const s of sucesos) window.addEventListener(s, rearmar, { passive: true })

    return () => {
      for (const s of sucesos) window.removeEventListener(s, rearmar)
      if (cuenta.current) clearTimeout(cuenta.current)
    }
  }, [enHoy])

  /* El reloj solo corre mientras se ve. Un intervalo despierto todo el
     día para pintar algo que no está en pantalla es trabajo por nada. */
  useEffect(() => {
    if (!dormida) return
    setAhora(new Date())
    const t = setInterval(() => setAhora(new Date()), 20_000)
    return () => clearInterval(t)
  }, [dormida])

  if (!dormida) return null

  const h = ahora?.getHours() ?? 12
  const deNoche = h >= 23 || h < 7

  const hh = ahora ? String(ahora.getHours()).padStart(2, '0') : '--'
  const mm = ahora ? String(ahora.getMinutes()).padStart(2, '0') : '--'

  return (
    /*
      Todo el telón es el botón de salir. No hay «cerrar» en una
      esquina: en una pared se toca donde se llega, muchas veces sin
      mirar, y una cruz de 44 px a dos metros no existe.

      No lleva `onClick`: quien lo cierra es el `pointerdown` de arriba,
      que ya está escuchando. Poner los dos haría que el primer toque
      contara dos veces.
    */
    <div
      className="fixed inset-0 z-[60] bg-black"
      role="presentation"
      aria-label="Fotos de la casa. Toca para volver."
    >
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: deNoche ? 0.28 : 1 }}
      >
        <Fotos pantallaCompleta />
      </div>

      {/*
        La hora, arriba a la izquierda y sobre un degradado. En el mismo
        sitio donde está cuando la pared está despierta: quien pase por
        la cocina la busca donde siempre, no donde toque hoy.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-14 pb-24 pt-12"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.55), transparent)' }}
      >
        <div>
          <p
            className="text-[76px] font-extrabold leading-none tabular-nums tracking-tight"
            style={{ color: 'rgba(255,255,255,.70)' }}
          >
            {hh}:{mm}
          </p>
          {ahora && (
            <p
              className="mt-2 text-[22px] font-extrabold"
              style={{ color: 'rgba(255,255,255,.45)' }}
            >
              {enMayuscula(
                `${DIAS[ahora.getDay()]} ${ahora.getDate()} de ${MESES[ahora.getMonth()]}`
              )}
            </p>
          )}
        </div>

        {/*
          Solo el icono, sin el nombre de la casa. El nombre es una
          etiqueta y aquí no hay nada que etiquetar; el icono es una
          firma, y una firma sí cabe encima de una foto.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-mappel.png"
          alt="mappel"
          className="block h-[34px] w-auto"
          style={{ opacity: 0.45 }}
        />
      </div>
    </div>
  )
}

/** «domingo 13 de septiembre» → «Domingo 13 de septiembre». Solo la primera. */
function enMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
