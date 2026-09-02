'use client'

import { useEffect, useState } from 'react'
import { Ico, type Icono } from './iconos'

/*
  Claro, oscuro, o el que tenga puesto el teléfono.

  Se guarda en el propio móvil, no en la base de datos: es una
  preferencia del aparato, no de la persona. Juan Miguel puede querer
  el móvil en oscuro por la noche y el ordenador en claro de día, y
  guardarlo en la cuenta le impediría tener las dos cosas.
*/

export type Tema = 'claro' | 'oscuro' | 'sistema'

export const LLAVE = 'hubi-tema'

const OPCIONES: { valor: Tema; texto: string; pie: string; icono: Icono }[] = [
  { valor: 'claro', texto: 'Claro', pie: 'Fondo blanco', icono: 'ojo' },
  { valor: 'oscuro', texto: 'Oscuro', pie: 'Fondo azul marino', icono: 'reloj' },
  { valor: 'sistema', texto: 'El del teléfono', pie: 'Cambia solo', icono: 'gente' },
]

export default function SelectorTema() {
  const [tema, setTema] = useState<Tema>('sistema')

  useEffect(() => {
    const guardado = document.documentElement.dataset.tema
    setTema(guardado === 'claro' || guardado === 'oscuro' ? guardado : 'sistema')
  }, [])

  function elegir(nuevo: Tema) {
    setTema(nuevo)
    try {
      if (nuevo === 'sistema') {
        localStorage.removeItem(LLAVE)
        delete document.documentElement.dataset.tema
      } else {
        localStorage.setItem(LLAVE, nuevo)
        document.documentElement.dataset.tema = nuevo
      }
    } catch {
      // Navegador con el almacenamiento cerrado: el cambio vale para
      // esta pantalla y no se recuerda. No es motivo para romper nada.
      if (nuevo === 'sistema') delete document.documentElement.dataset.tema
      else document.documentElement.dataset.tema = nuevo
    }
  }

  return (
    <div className="flex gap-2">
      {OPCIONES.map((o) => {
        const puesta = o.valor === tema
        return (
          <button
            key={o.valor}
            onClick={() => elegir(o.valor)}
            aria-pressed={puesta}
            className="flex h-[76px] flex-1 flex-col items-center justify-center gap-1 rounded-[18px] text-[14px] font-extrabold"
            style={
              puesta
                ? { background: '#14B8A6', color: '#0F172A' }
                : {
                    background: 'var(--t-superficie)',
                    border: '1px solid var(--t-borde)',
                    color: 'var(--t-tinta-suave)',
                  }
            }
          >
            <Ico nombre={o.icono} tam={22} grosor={2.1} />
            <span className="px-1 text-center leading-tight">{o.texto}</span>
          </button>
        )
      })}
    </div>
  )
}
