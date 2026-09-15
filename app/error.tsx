'use client'

import Link from '@/app/enlace'
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
    console.error('[MAPPEL] Fallo en pantalla:', error)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-16">
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

        {/* El mensaje de la excepción llega en inglés y con jerga, o
            sea que no se enseña: mappel no escribe en pantalla nada
            que haya que traducir. Lo que sí queda es el código, que es
            corto y sirve para localizar el fallo si alguien pregunta. */}
        {error.digest ? (
          <p className="mt-10 break-words text-[13px] leading-relaxed text-tenue">
            Si hace falta contarlo, el código es {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  )
}
