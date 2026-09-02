'use client'

import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Se muestra cuando una pantalla falla.
 *
 * Sin esto, un fallo deja la página en blanco: ni el usuario sabe qué ha
 * pasado ni nosotros podemos averiguarlo. Una pantalla en blanco es el
 * peor error posible, porque no se puede ni contar.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Family Hub] Fallo en pantalla:', error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-md text-center">
        <h1 className="font-titulo text-[2.5rem] leading-tight text-tinta">
          Algo no ha ido bien
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-tinta-suave">
          No es culpa tuya y no se ha perdido nada. Prueba a volver a cargar la
          pantalla.
        </p>

        <div className="mt-12 space-y-4">
          <button
            onClick={reset}
            className="w-full rounded-2xl bg-verde px-6 py-6 text-2xl font-semibold text-white"
          >
            Volver a intentarlo
          </button>
          <Link
            href="/"
            className="block rounded-2xl border-2 border-borde px-6 py-5 text-xl font-medium text-tinta-suave"
          >
            Ir al inicio
          </Link>
          <Link
            href="/entrar"
            className="block rounded-2xl border-2 border-borde px-6 py-5 text-xl font-medium text-tinta-suave"
          >
            Entrar de nuevo
          </Link>
        </div>

        <p className="mt-10 break-words text-xs leading-relaxed text-tenue">
          {error.message}
          {error.digest ? ` · ${error.digest}` : ''}
        </p>
      </div>
    </main>
  )
}
