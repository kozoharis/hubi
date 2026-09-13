'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

/*
  ═══════════════════════════════════════════════════════════════
  QUÉ LISTAS DE LA COMPRA SE VEN EN LA COCINA
  ═══════════════════════════════════════════════════════════════

  Haris: *«en la compra veo que no hay listas… es importante que las
  listas de la compra se puedan asignar o decir si quieres que se
  visualicen en la cocina»*.

  ─────────────────────────────────────────────────────────────
  UNA CASILLA POR LISTA, Y SE GUARDA AL TOCARLA

  Sin botón de guardar. La decisión de al lado —qué recordatorios se
  ven— sí lo lleva, porque son siete interruptores que se miran juntos
  y hay que poder arrepentirse antes de aplicar la regla a cientos de
  filas. Aquí cada lista es independiente de las demás: marcarla es la
  decisión entera, y un botón de guardar solo añadiría un paso que se
  olvida.

  ─────────────────────────────────────────────────────────────
  LA COMPRA DE LA CASA NO SALE AQUÍ, Y ES A PROPÓSITO

  Lo que no está en ninguna lista —la leche, el pan— se ve SIEMPRE en
  la pared. Es para lo que sirve tener una tableta en una cocina, y
  poder apagarlo sería poder dejar la pared sin su única función útil.

  Lo que se decide aquí son las listas con nombre: «El sábado», «La
  ferretería», «La finca».
*/

export type LaLista = {
  id: string
  nombre: string
  /** Null = nadie lo ha decidido todavía. Se lee como «no sale». */
  visible: boolean | null
  /** Cuántas cosas tiene pendientes, para saber de qué se está hablando. */
  cuantas: number
}

export default function Listas({ listas }: { listas: LaLista[] }) {
  const [estado, setEstado] = useState<Record<string, boolean>>(
    Object.fromEntries(listas.map((l) => [l.id, l.visible === true]))
  )
  const [fallo, setFallo] = useState<string | null>(null)

  async function tocar(l: LaLista) {
    const antes = estado[l.id] ?? false

    /* Se pinta ya: un interruptor que tarda medio segundo en moverse se
       vuelve a tocar, y entonces se guarda lo contrario de lo que se
       quería. */
    setEstado((e) => ({ ...e, [l.id]: !antes }))
    setFallo(null)

    try {
      const r = await fetch(api('/api/cocina/listas'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lista_id: l.id, visible: !antes }),
      })
      const d = (await r.json().catch(() => null)) as { error?: string } | null
      if (!r.ok) {
        setEstado((e) => ({ ...e, [l.id]: antes }))
        setFallo(d?.error ?? 'No se ha podido guardar.')
      }
    } catch {
      setEstado((e) => ({ ...e, [l.id]: antes }))
      setFallo('No se ha podido guardar.')
    }
  }

  if (listas.length === 0) return null

  const cuantas = listas.filter((l) => estado[l.id]).length

  return (
    <div className="mt-8">
      <h2 className="rotulo">Las listas de la compra</h2>
      <p className="t-apoyo mt-1.5 leading-snug">
        Lo que apuntáis sin lista —la leche, el pan— se ve siempre en la cocina. Aquí eliges
        cuáles de las listas con nombre salen también.
      </p>

      <ul className="mt-3 space-y-2">
        {listas.map((l) => {
          const puesto = estado[l.id] ?? false
          return (
            <li
              key={l.id}
              className="flex items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-4 py-3"
            >
              <span className="text-[26px] leading-none" aria-hidden>
                🛒
              </span>

              <span className="min-w-0 flex-1">
                <span className="t-cuerpo block font-extrabold">{l.nombre}</span>
                <span className="t-apoyo mt-0.5 block">
                  {l.cuantas === 0
                    ? 'Vacía'
                    : `${l.cuantas} ${l.cuantas === 1 ? 'cosa' : 'cosas'} por comprar`}
                  {l.visible === null && ' · sin decidir'}
                </span>
              </span>

              <button
                onClick={() => tocar(l)}
                role="switch"
                aria-checked={puesto}
                aria-label={`${puesto ? 'Quitar' : 'Poner'} ${l.nombre} en la pantalla de la cocina`}
                className="relative h-[34px] w-[58px] shrink-0 rounded-full transition"
                style={{ background: puesto ? 'var(--t-boton)' : 'var(--t-borde)' }}
              >
                <span
                  className="absolute top-[3px] h-[28px] w-[28px] rounded-full bg-white transition-all"
                  style={{ left: puesto ? 27 : 3 }}
                />
              </button>
            </li>
          )
        })}
      </ul>

      {fallo && (
        <p className="t-apoyo mt-2.5 px-1 font-bold" style={{ color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}

      <p className="t-apoyo mt-2.5 px-1 leading-snug">
        {cuantas === 0
          ? 'Ahora mismo en la cocina solo se ve la compra de la casa.'
          : `En la cocina se verían ${cuantas} ${cuantas === 1 ? 'lista' : 'listas'} además de la compra de la casa.`}
      </p>
    </div>
  )
}
