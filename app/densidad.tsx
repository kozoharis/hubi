'use client'

import { useEffect, useState } from 'react'

/*
  ═══════════════════════════════════════════════════════════════
  ¿CUÁNTAS COSAS QUIERES VER A LA VEZ?
  ═══════════════════════════════════════════════════════════════

  El sistema de densidad lleva puesto desde el primer paso del
  escritorio —tres variables en `globals.css`, `--fila`, `--hueco` y
  `--toque`— pero hasta ahora no había manera de elegirla: la ponía el
  puntero y se acabó. Esto es el interruptor que faltaba.

  ─────────────────────────────────────────────────────────────
  LA PALABRA «DENSIDAD» NO SALE

  Ni aquí ni en ningún sitio que vea una persona. «Densidad» es una
  palabra de la fontanería, como «unidad» o «espacio»: la usamos
  nosotros para entendernos entre nosotros.

  Lo que se pregunta es lo que de verdad se decide:

      ¿Cuántas cosas quieres ver a la vez?
      Pocas y grandes · Normal · Muchas

  ─────────────────────────────────────────────────────────────
  Y EL DEDO SIGUE MANDANDO POR ENCIMA DE ESTO

  Elegir «Muchas» en una tablet de cocina no la pone en 48 px: la
  regla de `(pointer: coarse)` de `globals.css` va después y devuelve
  los 72 y los 48 de objetivo. O sea que esto NO puede dejar a nadie
  con botones que no se pueden tocar con el dedo, que es exactamente
  lo que hay que impedir en una aplicación para gente mayor.

  Por eso la frase de debajo dice la verdad: en el móvil no cambia
  nada.

  ─────────────────────────────────────────────────────────────
  SE GUARDA EN EL APARATO, NO EN LA CUENTA

  Igual que el tema, y por lo mismo: es una preferencia del APARATO.
  Juan Miguel puede querer ver muchas cosas en el ordenador grande y
  pocas y gordas en la tablet, y guardarlo en la cuenta le obligaría a
  elegir una de las dos.
*/

export type Densidad = 'touch' | 'comfortable' | 'work'

export const LLAVE = 'mappel-densidad'

const OPCIONES: { valor: Densidad; texto: string; pie: string }[] = [
  { valor: 'touch', texto: 'Pocas y grandes', pie: 'Todo más separado' },
  { valor: 'comfortable', texto: 'Normal', pie: 'Lo de siempre' },
  { valor: 'work', texto: 'Muchas', pie: 'Listas más apretadas' },
]

export default function SelectorDensidad() {
  const [densidad, setDensidad] = useState<Densidad>('comfortable')

  /*
    Se lee del <html>, que ya lo tiene puesto por el guion del
    `layout` antes de pintar. No se puede leer al construir el estado:
    en el servidor no hay documento, y React compararía «comfortable»
    con lo que hubiera guardado y avisaría de que no coinciden.
  */
  useEffect(() => {
    const guardada = document.documentElement.dataset.densidad
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDensidad(guardada === 'touch' || guardada === 'work' ? guardada : 'comfortable')
  }, [])

  function elegir(nueva: Densidad) {
    setDensidad(nueva)
    /* «Normal» es lo de serie, así que elegirla es borrar la
       preferencia: deja el <html> sin atributo, que es exactamente el
       estado de quien nunca ha entrado aquí. */
    try {
      if (nueva === 'comfortable') {
        localStorage.removeItem(LLAVE)
        delete document.documentElement.dataset.densidad
      } else {
        localStorage.setItem(LLAVE, nueva)
        document.documentElement.dataset.densidad = nueva
      }
    } catch {
      /* Navegador con el almacenamiento cerrado: el cambio vale para
         esta pantalla y no se recuerda. No es motivo para romper
         nada. */
      if (nueva === 'comfortable') delete document.documentElement.dataset.densidad
      else document.documentElement.dataset.densidad = nueva
    }
  }

  return (
    <div className="flex gap-2">
      {OPCIONES.map((o) => {
        const puesta = o.valor === densidad
        return (
          <button
            key={o.valor}
            onClick={() => elegir(o.valor)}
            aria-pressed={puesta}
            className="flex h-[76px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[18px] px-1 text-center text-[14px] font-extrabold leading-tight"
            style={
              puesta
                ? { background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }
                : {
                    background: 'var(--t-superficie)',
                    border: '1px solid var(--t-borde)',
                    color: 'var(--t-tinta-suave)',
                  }
            }
          >
            <span>{o.texto}</span>
            <span className={'text-[12px] font-bold ' + (puesta ? 'opacity-80' : 'text-tenue')}>
              {o.pie}
            </span>
          </button>
        )
      })}
    </div>
  )
}
