'use client'

import { useCallback, useEffect, useState } from 'react'

/*
  ═══════════════════════════════════════════════════════════════
  LA PANTALLA DE ARRANQUE
  ═══════════════════════════════════════════════════════════════

  El símbolo entra, se traza la raya, aparece la palabra y se va.
  Dos segundos y medio en total.

  ─────────────────────────────────────────────────────────────
  POR QUÉ YA NO ES AZUL MARINO

  Era el logotipo sobre `#01071B` con cuatro manchas de color yendo a
  la deriva por detrás, y estuvo bien mientras HUBI fue oscuro. Pero
  HUBI es de papel crema desde la Fase 1, y un arranque oscuro delante
  de una aplicación clara produce un fogonazo justo en el momento en
  que se entra: cuatro segundos de noche y de golpe el día.

  El fondo del arranque es ahora `--t-fondo`, el mismo papel exacto de
  la pantalla que hay debajo. Cuando el fundido termina no cambia
  nada: solo desaparece lo que estaba encima. Y en modo oscuro pasa lo
  mismo, porque el token va con el modo.

  ─────────────────────────────────────────────────────────────
  Y LA RAYA ES EL ÚNICO SITIO CON DEGRADADO

  A propósito, y es la regla que más fácil sería romper. Si el
  degradado está además en el fondo, o en la palabra, o detrás del
  símbolo, deja de significar «aquí hay inteligencia» y pasa a ser
  decoración. Va en la raya y en ningún otro sitio de esta pantalla.

  ─────────────────────────────────────────────────────────────
  SALE UNA VEZ

  Con `sessionStorage`, al abrir la aplicación y no más. Antes cada
  llegada a Inicio la volvía a poner, porque cada toque en el menú
  recargaba HUBI entera; ahora que la navegación es instantánea, esos
  segundos serían un peaje por volver a casa.

  Y un toque la salta en cualquier momento.
*/

const VISIBLE = 2400
const DESVANECE = 620
const YAVISTA = 'hubi-arranque'

/*
  En qué modo está la casa. Se mira una vez, al montar, y no en el
  servidor —que no sabe en qué modo está el teléfono—: en el servidor
  devuelve `false` y da igual, porque en ese primer dibujado el
  arranque todavía está fuera y no se pinta ninguna imagen.
*/
function esDeNoche() {
  try {
    const puesto = document.documentElement.dataset.tema
    if (puesto === 'oscuro') return true
    if (puesto === 'claro') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export default function Arranque() {
  const [fase, setFase] = useState<'puesta' | 'yendose' | 'fuera'>('fuera')
  /* Sobre papel crema va el símbolo a color; sobre el azul de la
     noche iría en azul marino y se perdería, así que ahí va el crema. */
  const [oscuro] = useState(esDeNoche)

  useEffect(() => {
    let vivo = true
    let a: ReturnType<typeof setTimeout>
    let b: ReturnType<typeof setTimeout>

    /* El encendido va en un microtask y no aquí mismo porque cambiar
       el estado dentro del efecto encadena dos dibujados —React avisa
       de ello— y esto pasa en Inicio, la pantalla que más se abre. */
    queueMicrotask(() => {
      if (!vivo) return
      let yaVista = false
      try {
        yaVista = sessionStorage.getItem(YAVISTA) === '1'
        sessionStorage.setItem(YAVISTA, '1')
      } catch {
        /* Navegador con el almacenamiento capado: que salga, no pasa nada. */
      }
      if (yaVista) return

      setFase('puesta')
      a = setTimeout(() => setFase('yendose'), VISIBLE)
      b = setTimeout(() => setFase('fuera'), VISIBLE + DESVANECE)
    })

    return () => {
      vivo = false
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])

  /* El toque no acorta el fundido: lo adelanta. Cortar en seco una
     pantalla que se está yendo se ve como un error de la aplicación. */
  const saltar = useCallback(() => {
    setFase((f) => (f === 'puesta' ? 'yendose' : f))
    setTimeout(() => setFase('fuera'), DESVANECE)
  }, [])

  if (fase === 'fuera') return null

  return (
    <div
      aria-hidden
      onClick={saltar}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        background: 'var(--t-fondo)',
        opacity: fase === 'yendose' ? 0 : 1,
        transition: `opacity ${DESVANECE}ms cubic-bezier(.22,.61,.36,1)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={oscuro ? '/logo-hubi-oscuro.png' : '/logo-hubi.png'}
        alt=""
        className="hubi-marca block"
        style={{ width: 104, height: 'auto' }}
      />

      <span
        className="hubi-linea mt-[26px] block h-[2px] w-[148px] rounded-sm"
        style={{
          transformOrigin: 'center',
          background: 'linear-gradient(140deg,#2DD4BF,#14B8A6 45%,#3B82F6)',
        }}
      />

      <span
        className="hubi-palabra mt-[26px] block text-[15px] font-extrabold text-tinta"
        style={{ letterSpacing: '0.3em', paddingLeft: '0.3em' }}
      >
        HUBI
      </span>
    </div>
  )
}
