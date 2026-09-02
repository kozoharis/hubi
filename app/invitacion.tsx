'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Ico } from './iconos'

/*
  La invitación del inicio.

  Debajo del saludo, una barra que va cambiando de frase sola. No es
  decoración: es la única parte de HUBI que les enseña qué se le puede
  pedir. Nadie lee un manual, pero todo el mundo lee una frase que se
  mueve delante de sus ojos.

  Las frases son ejemplos de verdad, escritos tal cual se dirían.
*/

const FRASES = [
  '¿Qué necesitas que hagamos hoy?',
  '«Apunta un gasto de 40 € de productos»',
  '«¿Cuánto llevamos gastado en luz?»',
  '«Recuérdale a Conchita lo del médico»',
  '«Busca la última factura del seguro»',
]

const QUIETA = 3800
const CAMBIO = 400

export default function Invitacion() {
  const [i, setI] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const reposo = setTimeout(() => setVisible(false), QUIETA)
    const salto = setTimeout(() => {
      setI((n) => (n + 1) % FRASES.length)
      setVisible(true)
    }, QUIETA + CAMBIO)
    return () => {
      clearTimeout(reposo)
      clearTimeout(salto)
    }
  }, [i])

  return (
    <Link
      href="/hablar"
      className="mt-3.5 flex h-[74px] items-center gap-3 rounded-[22px] border border-borde bg-superficie pl-4 pr-3"
    >
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[17px] font-bold leading-snug text-tinta"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(-6px)',
            transition: `opacity ${CAMBIO}ms ease, transform ${CAMBIO}ms ease`,
          }}
        >
          {FRASES[i]}
        </span>
        <span className="mt-1 block text-[14.5px] font-bold text-tenue">
          Pulsa y háblame
        </span>
      </span>

      <span
        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-white"
        style={{
          background: 'linear-gradient(140deg,#2DD4BF,#14B8A6 45%,#3B82F6)',
          boxShadow: '0 8px 20px rgba(20,184,166,.35)',
        }}
      >
        <Ico nombre="onda" tam={24} grosor={2.4} />
      </span>
    </Link>
  )
}
