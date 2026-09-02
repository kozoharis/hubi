'use client'

import { useEffect, useState } from 'react'
import { Logo } from './iconos'
import ColorDeBarra from './color-barra'

/*
  La pantalla de arranque.

  Solo el logotipo sobre el azul marino, con las manchas de color yendo
  a la deriva por detrás. Aparece al abrir la aplicación y se va sola.

  Vive solo en la pantalla de Inicio. Estaba en el layout y salía al
  entrar en cualquier sitio —al abrir un documento, al cambiar de
  pestaña—, y eso convertía la bienvenida en un peaje.
*/

const VISIBLE = 4000
const DESVANECE = 600
const YAVISTA = 'hubi-arranque'

export default function Arranque() {
  /*
    Empieza fuera y solo se enciende si toca.

    Antes cada llegada a Inicio la volvía a poner, porque cada toque en
    el menú recargaba la aplicación entera. Ahora que la navegación es
    instantánea, esos cuatro segundos serían un peaje por volver a
    casa: la bienvenida se convertiría en lo más lento de HUBI.

    Con `sessionStorage`, sale una vez al abrir la aplicación y no
    vuelve hasta que se cierra del todo. Que es lo que uno espera de
    una pantalla de bienvenida.
  */
  const [fase, setFase] = useState<'puesta' | 'yendose' | 'fuera'>('fuera')

  useEffect(() => {
    let yaVista = false
    try {
      yaVista = sessionStorage.getItem(YAVISTA) === '1'
      sessionStorage.setItem(YAVISTA, '1')
    } catch {
      // Navegador con el almacenamiento capado: que salga, no pasa nada.
    }
    if (yaVista) return

    setFase('puesta')
    const a = setTimeout(() => setFase('yendose'), VISIBLE)
    const b = setTimeout(() => setFase('fuera'), VISIBLE + DESVANECE)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])

  if (fase === 'fuera') return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: '#01071B',
        opacity: fase === 'yendose' ? 0 : 1,
        transition: `opacity ${DESVANECE}ms ease-out`,
      }}
    >
      {/* El color, moviéndose despacio */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="mancha deriva-1" style={{ width: 330, height: 330, left: -130, top: -100, background: 'rgba(20,184,166,.40)' }} />
        <span className="mancha deriva-3" style={{ width: 320, height: 320, right: -135, top: 0, background: 'rgba(249,115,22,.34)' }} />
        <span className="mancha deriva-2" style={{ width: 360, height: 360, right: -120, bottom: -130, background: 'rgba(236,72,110,.30)' }} />
        <span className="mancha deriva-4" style={{ width: 320, height: 320, left: -120, bottom: -110, background: 'rgba(59,130,246,.30)' }} />
        <span
          className="brillo absolute"
          style={{
            inset: '-20%',
            background:
              'linear-gradient(115deg,transparent 38%,rgba(255,255,255,.05) 50%,transparent 62%)',
          }}
        />
        <span
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(74% 46% at 50% 40%, rgba(1,7,27,.94) 0%, rgba(1,7,27,.55) 55%, transparent 100%)',
          }}
        />
      </div>

      <ColorDeBarra color="#01071B" />

      <div className="relative flex flex-col items-center">
        <Logo tam={172} oscuro />
        <p className="mt-6 text-[44px] font-extrabold tracking-[0.25em] text-white">
          <span className="ml-[0.25em]">HUBI</span>
        </p>
        <span
          className="mt-4 block h-[3px] w-[132px] rounded-sm"
          style={{
            background: 'linear-gradient(90deg,#14B8A6,#3B82F6,#8B5CF6,#FF6B6B,#F59E0B)',
          }}
        />
        <p className="mt-6 text-center text-[18px] font-semibold leading-relaxed text-slate-300">
          Todo lo importante,
          <br />
          en un mismo lugar.
        </p>
      </div>
    </div>
  )
}
