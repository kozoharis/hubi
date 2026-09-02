'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteNavegador } from '@/lib/supabase/navegador'

export default function BotonSalir() {
  const router = useRouter()
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    await clienteNavegador().auth.signOut()
    router.push('/entrar')
    router.refresh()
  }

  return (
    <button
      onClick={salir}
      disabled={saliendo}
      className="flex h-[56px] w-full items-center justify-center rounded-[18px] border border-borde bg-superficie text-[17px] font-extrabold text-coral disabled:opacity-40"
    >
      {saliendo ? 'Cerrando…' : 'Salir de HUBI'}
    </button>
  )
}
