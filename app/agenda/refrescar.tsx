'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'

/*
  El botón de traer las citas de Google otra vez.

  Pequeño y al lado de los calendarios, no en medio de la pantalla:
  esto no es una acción que se haga todos los días, es la salida para
  cuando uno acaba de poner una cita en el móvil y quiere verla ya.

  LO IMPORTANTE ES LO QUE DICE DESPUÉS.

  Quitamos NUESTRO retraso —los quince minutos que HUBI guarda lo
  traído— pero no el de Google, que republica el archivo cuando le
  parece y puede tardar horas. Así que la respuesta nunca es
  "sincronizado": es cuántas citas hay ahora, y si no ha cambiado nada
  se dice que Google todavía no lo ha publicado.

  Prometer una sincronización que no controlamos sería exactamente el
  punto 26 del planteamiento: no simular que una conexión funciona.
*/
export default function Refrescar({ cuantasHabia }: { cuantasHabia: number }) {
  const router = useRouter()
  const [yendo, setYendo] = useState(false)
  const [dicho, setDicho] = useState<string | null>(null)

  async function traer() {
    setDicho(null)
    setYendo(true)

    try {
      const r = await fetch('/api/calendario/refrescar', { method: 'POST' })
      const d = (await r.json().catch(() => ({}))) as { error?: string; citas?: number }

      if (!r.ok) {
        setDicho(d.error ?? 'No se ha podido actualizar.')
      } else if ((d.citas ?? 0) === cuantasHabia) {
        setDicho(
          'Ya está al día. Si acabas de poner una cita en el móvil, Google puede tardar un rato largo en publicarla.'
        )
      } else {
        setDicho('Actualizado.')
      }
      router.refresh()
    } catch {
      setDicho('No hay conexión.')
    }

    setYendo(false)
  }

  return (
    <>
      <button
        onClick={traer}
        disabled={yendo}
        aria-label="Traer las citas de Google otra vez"
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-borde bg-superficie px-3.5 text-[14px] font-extrabold text-tinta-suave disabled:opacity-50"
      >
        <Ico
          nombre="refrescar"
          tam={17}
          grosor={2.3}
          className={yendo ? 'animate-spin' : undefined}
        />
        {yendo ? 'Buscando…' : 'Actualizar'}
      </button>

      {dicho && (
        <p className="mt-2 w-full text-[14.5px] font-semibold leading-snug text-tenue">{dicho}</p>
      )}
    </>
  )
}
