'use client'

import { useEffect, useState } from 'react'
import { Ico, type Icono } from './iconos'

/*
  Claro, oscuro, o el que tenga puesto el teléfono.

  Se guarda en el propio móvil, no en la base de datos: es una
  preferencia del aparato, no de la persona. Juan Miguel puede querer
  el móvil en oscuro por la noche y el ordenador en claro de día, y
  guardarlo en la cuenta le impediría tener las dos cosas.

  ─────────────────────────────────────────────────────────────
  EL DE SERIE ES «CLARO», Y «EL DEL TELÉFONO» YA NO LO ES

  Antes, no elegir nada quería decir «el del teléfono», y eso dejaba
  mappel en azul marino a casi todo el mundo sin haberlo pedido. Ahora
  no elegir nada quiere decir CLARO, y seguir al teléfono es una de
  las tres opciones —hay que pedirla, y se guarda como `sistema`.

  Que también cambia lo que se guarda: antes «El del teléfono» BORRABA
  la preferencia, porque era lo mismo que no haber elegido. Ahora son
  cosas distintas y se guarda igual que las otras dos.
*/

export type Tema = 'claro' | 'oscuro' | 'sistema'

export const LLAVE = 'mappel-tema'

const OPCIONES: { valor: Tema; texto: string; pie: string; icono: Icono }[] = [
  { valor: 'claro', texto: 'Claro', pie: 'El de siempre', icono: 'sol' },
  { valor: 'oscuro', texto: 'Oscuro', pie: 'Fondo azul marino', icono: 'luna' },
  { valor: 'sistema', texto: 'El del teléfono', pie: 'Cambia solo', icono: 'contraste' },
]

export default function SelectorTema() {
  const [tema, setTema] = useState<Tema>('claro')

  useEffect(() => {
    const guardado = document.documentElement.dataset.tema
    setTema(guardado === 'oscuro' || guardado === 'sistema' ? guardado : 'claro')
  }, [])

  function elegir(nuevo: Tema) {
    setTema(nuevo)
    /* `claro` es lo de serie, así que elegirlo es borrar la
       preferencia: deja el <html> sin atributo, que es exactamente el
       estado de quien nunca ha entrado aquí. */
    try {
      if (nuevo === 'claro') {
        localStorage.removeItem(LLAVE)
        delete document.documentElement.dataset.tema
      } else {
        localStorage.setItem(LLAVE, nuevo)
        document.documentElement.dataset.tema = nuevo
      }
    } catch {
      // Navegador con el almacenamiento cerrado: el cambio vale para
      // esta pantalla y no se recuerda. No es motivo para romper nada.
      if (nuevo === 'claro') delete document.documentElement.dataset.tema
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
                /* Era el azul-negro de la paleta vieja escrito a
                   mano. El botón de acción tiene su propia tinta. */
                ? {
                    background: 'var(--color-accion)',
                    color: 'var(--color-accion-tinta)',
                  }
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
