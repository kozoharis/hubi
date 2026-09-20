'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Ico } from '../../iconos'
import { refrescar } from '@/lib/refrescar'

/*
  ═══════════════════════════════════════════════════════════════
  DEJAR UNA NOTA EN EL CORCHO, DESDE LA COCINA
  ═══════════════════════════════════════════════════════════════

  Esta pestaña solo leía, y era media pared: enseñaba el corcho de la
  casa y no dejaba clavar nada en él.

  Haris: *«lo de las notas y el calendario sería bueno que pueda
  apuntarse… y también por voz»*.

  ─────────────────────────────────────────────────────────────
  LO QUE SE DEJA AQUÍ ES DE LA CASA

  No lleva «para quién», y no es por desconfiar de la pared —eso ya se
  decidió en el paso 76, y al revés—. Es que una nota **dirigida** y a
  la vez **colgada en la cocina** no significa nada: dirigirla sirve
  para que la vea quien tiene que verla, y colgarla hace que la vea
  cualquiera que entre en la casa.

  El corcho de una cocina es para la casa. Una nota para una persona
  se deja desde el móvil. Está razonado entero en el `sql/78`.

  ─────────────────────────────────────────────────────────────
  Y EL MICRÓFONO NO ESTÁ AQUÍ: ESTÁ EN LA PARED ENTERA

  Llegó a haber uno metido en este formulario, y otro en la compra, y
  otro en el día. Tres botones distintos en tres pantallas obligaban a
  aprender dónde se puede hablar.

  Ahora hay UNO, en el armazón, abajo a la derecha en las cinco
  pestañas — y entiende «ponle que he dejado los papeles en la mesa»
  igual de bien. Está en `app/casa/microfono.tsx`.

  Esto se queda para escribirlo a mano, que es lo que hace falta
  cuando hay alguien durmiendo o la cocina está con la freidora puesta.
*/

export default function Apuntar() {
  const router = useRouter()

  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function guardar() {
    const que = texto.trim()
    if (que.length < 2) return

    setFallo(null)
    setOcupado(true)

    try {
      const r = await fetch(api('/api/pared/nota'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: que }),
      })
      const d = (await r.json().catch(() => null)) as { error?: string } | null

      if (!r.ok) {
        setFallo(d?.error ?? 'No se ha podido dejar la nota.')
        return
      }

      setTexto('')
      setAbierto(false)
      refrescar(router)
    } catch {
      setFallo('No se ha podido dejar la nota.')
    } finally {
      setOcupado(false)
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="tocable mt-8 flex h-[80px] w-full items-center justify-center gap-3 rounded-[24px] border-2 border-dashed text-[24px] font-extrabold text-tinta-suave"
        style={{ borderColor: 'var(--t-borde)' }}
      >
        <Ico nombre="mas" tam={28} grosor={2.6} />
        Dejar una nota
      </button>
    )
  }

  return (
    <div className="mt-8 rounded-[28px] border border-borde bg-superficie px-7 py-6">
      <label
        htmlFor="la-nota"
        className="block text-[19px] font-extrabold uppercase tracking-[0.14em] text-tenue"
      >
        Qué quieres dejar dicho
      </label>

      {/* Un área y no una línea: las notas de una casa son frases
          enteras, y en una línea de una pared no se lee lo que se
          escribió hace tres palabras. */}
      <textarea
        id="la-nota"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="He dejado los papeles del seguro en la mesa"
        autoFocus
        className="entrada mt-4 w-full resize-none py-4 text-[28px] font-extrabold leading-snug"
      />


      <p className="mt-3 text-[18px] font-bold leading-snug text-tenue">
        Lo que se deja aquí lo ve toda la casa. Para dejarle una nota a una persona, el móvil.
      </p>

      {fallo && (
        <p className="mt-3 text-[19px] font-bold" style={{ color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={ocupado || texto.trim().length < 2}
          className="tocable flex h-[76px] flex-1 items-center justify-center gap-3 rounded-[24px] text-[24px] font-extrabold disabled:opacity-45"
          style={{ background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }}
        >
          <Ico nombre="chincheta" tam={26} grosor={2.4} />
          {ocupado ? 'Guardando…' : 'Dejarla puesta'}
        </button>

        <button
          type="button"
          onClick={() => {
            setAbierto(false)
            setFallo(null)
          }}
          className="tocable h-[76px] rounded-[24px] border border-borde bg-fondo px-8 text-[22px] font-extrabold text-tinta-suave"
        >
          Dejarlo
        </button>
      </div>
    </div>
  )
}
