'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'

/*
  ═══════════════════════════════════════════════════════════════
  QUIÉN VIVE EN ESTA CASA
  ═══════════════════════════════════════════════════════════════

  Lo primero es la lista, no el botón. Antes de invitar a nadie, quien
  mira esta pantalla tiene derecho a ver de un vistazo QUIÉN tiene
  acceso a sus facturas, sus informes médicos y su Drive. Esa lista es
  el ajuste; invitar es lo que se hace desde ella.

  ─────────────────────────────────────────────────────────────
  SE DICE LO QUE PASA DE VERDAD AL INVITAR

  Sin adornos: esa persona verá todo. En HUBI no hay documentos
  privados todavía —todo lo que se guarda es de la casa— y quien
  invita tiene que saberlo ANTES de escribir un correo, no después.
*/

export type Vecino = {
  id: string
  nombre: string
  manda: boolean
  soyYo: boolean
}

export default function Gente({
  gente,
  puedoInvitar,
}: {
  gente: Vecino[]
  puedoInvitar: boolean
}) {
  const router = useRouter()

  const [invitando, setInvitando] = useState(false)
  const [correo, setCorreo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  async function invitar() {
    setFallo(null)
    setHecho(null)
    setOcupado(true)

    const r = await fetch('/api/miembros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: correo.trim() }),
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      correo?: string
      error?: string
      detalle?: string
    } | null

    setOcupado(false)

    if (!r.ok || d?.bien !== true) {
      setFallo(
        d
          ? [d.error ?? 'No se ha podido invitar.', d.detalle].filter(Boolean).join(' · ')
          : 'HUBI no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return
    }

    setHecho(d.correo ?? correo.trim())
    setCorreo('')
    setInvitando(false)
    router.refresh()
  }

  async function sacar(v: Vecino) {
    if (
      !window.confirm(
        `¿Sacar a ${v.nombre} de esta casa?\n\nDejará de ver los papeles, las cuentas y la agenda. Lo que haya subido o apuntado NO se borra: es de la casa.\n\nSe le puede volver a invitar cuando quieras.`
      )
    ) {
      return
    }

    setOcupado(true)
    setFallo(null)

    const r = await fetch(`/api/miembros?id=${encodeURIComponent(v.id)}`, { method: 'DELETE' })
    const d = (await r.json().catch(() => null)) as { bien?: boolean; error?: string } | null

    setOcupado(false)

    if (!r.ok || d?.bien !== true) {
      setFallo(d?.error ?? 'No se ha podido sacar a esa persona.')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-2.5">
      <ul className="space-y-2.5">
        {gente.map((v) => (
          <li
            key={v.id}
            className="flex items-center gap-3 rounded-[20px] border border-borde bg-superficie px-4 py-3.5"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold text-white"
              style={{ background: v.manda ? '#14B8A6' : '#3B82F6' }}
            >
              {v.nombre.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17.5px] font-extrabold tracking-tight">
                {v.nombre}
                {v.soyYo && <span className="text-tenue"> · tú</span>}
              </span>
              <span className="mt-0.5 block text-[14.5px] font-bold text-tenue">
                {v.manda ? 'Creó la casa · su Google Drive' : 'Ve y apunta todo lo de la casa'}
              </span>
            </span>
            {puedoInvitar && !v.manda && (
              <button
                onClick={() => sacar(v)}
                disabled={ocupado}
                aria-label={`Sacar a ${v.nombre} de la casa`}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-tinta-suave disabled:opacity-50"
              >
                <Ico nombre="aviso" tam={19} grosor={2.2} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {puedoInvitar &&
        (invitando ? (
          <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
            <p className="text-[17px] font-extrabold leading-snug">
              ¿Cuál es su correo?
            </p>
            <p className="mt-1 text-[15px] font-semibold leading-snug text-tenue">
              Verá <strong className="text-tinta">todo</strong> lo de esta casa: los papeles, las
              cuentas y la agenda. Y podrá guardar documentos en tu Google Drive, sin conectar
              nada suyo.
            </p>

            <input
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="nombre@gmail.com"
              className="entrada mt-3"
              autoFocus
            />

            <p className="mt-2 text-[14.5px] font-semibold leading-snug text-tenue">
              No le llega ningún correo de nuestra parte. Dile tú que entre en HUBI con ese
              correo y le llegará su número, como a ti.
            </p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={invitar}
                disabled={ocupado || correo.trim().length < 5}
                className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-boton text-[17px] font-extrabold text-boton-texto disabled:opacity-50"
              >
                <Ico nombre="check" tam={19} grosor={2.3} />
                {ocupado ? 'Invitando…' : 'Invitar'}
              </button>
              <button
                onClick={() => {
                  setInvitando(false)
                  setFallo(null)
                }}
                disabled={ocupado}
                className="h-[56px] flex-1 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave disabled:opacity-50"
              >
                Ahora no
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setInvitando(true)
              setHecho(null)
            }}
            className="flex h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave"
          >
            <Ico nombre="mas" tam={20} grosor={2.4} />
            Invitar a alguien
          </button>
        ))}

      {hecho && (
        <p className="rounded-[16px] border border-borde px-4 py-3.5 text-[15.5px] font-semibold leading-snug text-tinta-suave">
          Listo. Dile a <strong className="text-tinta">{hecho}</strong> que entre en HUBI con ese
          correo: le llegará su número y aparecerá directamente en esta casa.
        </p>
      )}

      {fallo && (
        <p className="rounded-[16px] bg-coral-suave px-4 py-3 text-[15.5px] font-semibold text-coral">
          {fallo}
        </p>
      )}
    </div>
  )
}
