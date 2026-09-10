'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteNavegador } from '@/lib/supabase/navegador'
import { BotonDestructivo } from './piezas'

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
    <BotonDestructivo onClick={salir} desactivado={saliendo}>
      {saliendo ? 'Cerrando…' : 'Salir de HUBI'}
    </BotonDestructivo>
  )
}
