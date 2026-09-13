'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { grabarVoz, sePuedeGrabar, type Grabando } from '../../hablar/grabadora'
import { NOCHE, DEGRADADO, DEGRADADO_TUMBADO } from '@/lib/voz-hubi'
import { Ico } from '../../iconos'

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
  Y POR VOZ, CON PISTA DE NOTA

  «Ponle que he dejado los papeles en la mesa» — con `pista: 'nota'`,
  el intérprete no vuelve a adivinar qué se ha querido decir: lo lee
  como nota. Sin ella, una frase con un día dentro —«los papeles hasta
  el jueves»— se leería como recordatorio y esta pantalla devolvería
  algo que no puede guardar aquí.
*/

export default function Apuntar() {
  const router = useRouter()

  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const [oyendo, setOyendo] = useState(false)
  const [pensando, setPensando] = useState(false)
  const [nivel, setNivel] = useState(0)
  const grabando = useRef<Grabando | null>(null)

  /* Si hay micrófono se sabe DESPUÉS de pintar: en el servidor no hay
     `navigator`. El porqué largo, en `app/casa/compra/dictar.tsx`. */
  const [hayMicro, setHayMicro] = useState(false)
  useEffect(() => setHayMicro(sePuedeGrabar()), [])

  async function escuchar() {
    setFallo(null)
    setOyendo(true)

    grabando.current = await grabarVoz({
      alNivel: setNivel,
      alPausar: () => {},
      alSeguir: () => {},
      alTerminar: (audio) => {
        grabando.current = null
        interpretar(audio)
      },
      alFallar: (motivo) => {
        grabando.current = null
        setOyendo(false)
        setNivel(0)
        setFallo(
          motivo === 'sin-permiso'
            ? 'Esta pantalla no tiene permiso para usar el micrófono.'
            : motivo === 'sin-micro'
              ? 'Esta pantalla no tiene micrófono.'
              : 'No se ha oído nada. Prueba otra vez.'
        )
      },
    })
  }

  async function interpretar(audio: Blob) {
    setOyendo(false)
    setNivel(0)
    setPensando(true)

    try {
      const paquete = new FormData()
      paquete.append('audio', audio, 'nota.webm')
      paquete.append('pista', 'nota')

      const r = await fetch(api('/api/voz'), { method: 'POST', body: paquete })
      const d = (await r.json().catch(() => null)) as
        | { titulo?: string | null; error?: string }
        | null

      if (!r.ok || !d?.titulo) {
        setFallo(d?.error ?? 'No se ha entendido. Prueba otra vez.')
        return
      }

      /* La voz RELLENA el campo, no guarda. Se lee escrito y se toca
         Dejarla — la misma regla que en todo HUBI. */
      setTexto(d.titulo)
    } catch {
      setFallo('No se ha podido entender. Prueba otra vez.')
    } finally {
      setPensando(false)
    }
  }

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
      router.refresh()
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

      {hayMicro && (
        <>
          <button
            type="button"
            onClick={() => {
              if (oyendo) grabando.current?.parar()
              else if (!pensando) escuchar()
            }}
            disabled={pensando}
            /* El azul de noche de HUBI: en toda la aplicación significa
               «esto escucha y entiende». Ver `lib/voz-hubi.ts`. */
            className="tocable mt-3 flex h-[72px] w-full items-center justify-center gap-3 rounded-[24px] text-[22px] font-extrabold text-white disabled:opacity-60"
            style={{ background: NOCHE, backgroundImage: oyendo ? DEGRADADO : undefined }}
          >
            <Ico nombre="micro" tam={26} grosor={2.3} />
            {pensando ? 'Un momento…' : oyendo ? 'Te escucho · toca para terminar' : 'O dilo en voz alta'}
          </button>

          {oyendo && (
            <div
              className="mt-2.5 h-[10px] w-full overflow-hidden rounded-full"
              style={{ background: 'var(--t-velo)' }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{
                  width: `${Math.min(100, Math.round(nivel * 140))}%`,
                  background: DEGRADADO_TUMBADO,
                }}
              />
            </div>
          )}
        </>
      )}

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
