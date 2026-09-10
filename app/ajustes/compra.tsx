'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/*
  ¿Esta casa usa la lista de la compra?

  Ocupa el primer sitio del inicio, encima de todo. A quien no hace la
  compra con el móvil le sale ahí cada día una tarjeta que no va a
  tocar nunca — y el primer sitio de la pantalla principal es el más
  caro que hay.

  No se borra nada al apagarla: la lista se queda como estaba y vuelve
  entera si se enciende.
*/
export default function Compra({ puesta }: { puesta: boolean }) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function cambiar() {
    setFallo(null)
    setOcupado(true)

    const r = await fetch('/api/casa', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usa_compra: !puesta }),
    })

    const d = (await r.json().catch(() => null)) as { bien?: boolean; error?: string } | null
    setOcupado(false)

    if (!r.ok || d?.bien !== true) {
      setFallo(d?.error ?? 'No se ha podido cambiar.')
      return
    }
    router.refresh()
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-[20px] border border-borde bg-superficie px-4 py-3">
        <span className="text-[24px] leading-none">🛒</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-extrabold tracking-tight">La compra</span>
          <span className="mt-0.5 block text-[14.5px] font-bold text-tenue">
            {puesta ? 'Sale la primera en el inicio' : 'Apagada · la lista sigue guardada'}
          </span>
        </span>

        <button
          onClick={cambiar}
          disabled={ocupado}
          role="switch"
          aria-checked={puesta}
          aria-label={puesta ? 'Apagar la compra' : 'Encender la compra'}
          className="relative h-[34px] w-[58px] shrink-0 rounded-full transition disabled:opacity-50"
          style={{ background: puesta ? 'var(--t-boton)' : 'var(--t-borde)' }}
        >
          <span
            className="absolute top-[3px] h-[28px] w-[28px] rounded-full bg-white transition-all"
            style={{ left: puesta ? 27 : 3 }}
          />
        </button>
      </div>

      {fallo && (
        <p className="mt-2.5 t-apoyo rounded-[16px] border px-4 py-3"
          style={{ background: 'var(--t-alerta-velo)', borderColor: 'color-mix(in srgb, var(--t-alerta) 45%, transparent)', color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}
    </>
  )
}
