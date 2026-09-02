'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AccionHecho({
  id,
  hecho,
}: {
  id: string
  hecho: boolean
}) {
  const router = useRouter()
  const [cambiando, setCambiando] = useState(false)

  async function cambiar() {
    setCambiando(true)
    await fetch(`/api/recordatorios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: hecho ? 'pendiente' : 'hecho' }),
    })
    router.refresh()
    setCambiando(false)
  }

  return (
    <button
      onClick={cambiar}
      disabled={cambiando}
      className={`w-full rounded-2xl px-6 py-6 text-2xl font-semibold disabled:opacity-50 ${
        hecho
          ? 'border-2 border-borde bg-superficie text-tinta-suave'
          : 'bg-verde text-white'
      }`}
    >
      {cambiando ? '…' : hecho ? 'Deshacer' : 'Marcar como hecho'}
    </button>
  )
}
