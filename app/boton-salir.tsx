'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteNavegador } from '@/lib/supabase/navegador'
import { BotonDestructivo } from './piezas'
import { refrescar } from '@/lib/refrescar'

export default function BotonSalir() {
  const router = useRouter()
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    await clienteNavegador().auth.signOut()
    router.push('/entrar')
    refrescar(router)
  }

  return (
    <BotonDestructivo onClick={salir} desactivado={saliendo}>
      {saliendo ? 'Cerrando…' : 'Salir de mappel'}
    </BotonDestructivo>
  )
}
