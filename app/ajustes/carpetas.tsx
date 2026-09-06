'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'

/*
  ═══════════════════════════════════════════════════════════════
  TUS CARPETAS
  ═══════════════════════════════════════════════════════════════

  Las que solo guardan papeles: Casa, Salud, Vehículos, Seguros,
  Documentos importantes. Se encienden, se apagan y se añaden.

  ─────────────────────────────────────────────────────────────
  UN INTERRUPTOR, NO UNA PAPELERA

  El icono de esta lista es a propósito un interruptor y no un cubo de
  basura. Apagar «Vehículos» porque no tienes coche no debería dar
  ningún miedo — y si el botón fuera de borrar, lo daría, con razón.

  Se dice además debajo, con todas las letras, que los papeles se
  quedan. Que se pueda deshacer no sirve de nada si quien mira la
  pantalla no lo sabe ANTES de tocar.
*/

export type Carpeta = {
  id: string
  nombre: string
  icono: string
  activa: boolean
  papeles: number
}

export default function Carpetas({ carpetas }: { carpetas: Carpeta[] }) {
  const router = useRouter()

  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function cambiar(c: Carpeta) {
    setFallo(null)
    setAviso(null)
    setOcupado(c.id)

    const r = await fetch('/api/carpetas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, activa: !c.activa }),
    })

    const d = (await r.json().catch(() => null)) as { bien?: boolean; error?: string } | null
    setOcupado(null)

    if (!r.ok || d?.bien !== true) {
      setFallo(d?.error ?? 'No se ha podido cambiar.')
      return
    }
    router.refresh()
  }

  async function crear() {
    setFallo(null)
    setAviso(null)
    setOcupado('nueva')

    const r = await fetch('/api/carpetas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim() }),
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      error?: string
      detalle?: string
      aviso?: string
    } | null

    setOcupado(null)

    if (!r.ok || d?.bien !== true) {
      setFallo(
        d
          ? [d.error ?? 'No se ha podido crear.', d.detalle].filter(Boolean).join(' · ')
          : 'HUBI no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return
    }

    if (d.aviso) setAviso(d.aviso)
    setNombre('')
    setCreando(false)
    router.refresh()
  }

  return (
    <div className="space-y-2.5">
      <ul className="space-y-2.5">
        {carpetas.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-[20px] border border-borde bg-superficie px-4 py-3"
            style={{ opacity: c.activa ? 1 : 0.55 }}
          >
            <span className="text-[24px] leading-none">{c.icono || '📁'}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px] font-extrabold tracking-tight">
                {c.nombre}
              </span>
              <span className="mt-0.5 block text-[14.5px] font-bold text-tenue">
                {c.activa
                  ? c.papeles > 0
                    ? `${c.papeles} ${c.papeles === 1 ? 'papel' : 'papeles'}`
                    : 'Sin papeles todavía'
                  : c.papeles > 0
                    ? `Apagada · sus ${c.papeles} ${c.papeles === 1 ? 'papel sigue' : 'papeles siguen'} guardados`
                    : 'Apagada'}
              </span>
            </span>

            <button
              onClick={() => cambiar(c)}
              disabled={ocupado !== null}
              role="switch"
              aria-checked={c.activa}
              aria-label={`${c.activa ? 'Apagar' : 'Encender'} ${c.nombre}`}
              className="relative h-[34px] w-[58px] shrink-0 rounded-full transition disabled:opacity-50"
              style={{
                background: c.activa ? 'var(--t-boton)' : 'var(--t-borde)',
              }}
            >
              <span
                className="absolute top-[3px] h-[28px] w-[28px] rounded-full bg-white transition-all"
                style={{ left: c.activa ? 27 : 3 }}
              />
            </button>
          </li>
        ))}
      </ul>

      <p className="px-1 text-[14.5px] font-semibold leading-snug text-tenue">
        Apagar una carpeta la esconde: deja de salir al guardar papeles. Lo que ya tenga dentro
        <strong className="text-tinta"> no se borra</strong>, ni en HUBI ni en tu Drive, y vuelve
        a aparecer si la enciendes.
      </p>

      {creando ? (
        <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <p className="text-[17px] font-extrabold">¿Cómo se llama?</p>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="El barco"
            className="entrada mt-2.5"
            autoFocus
            maxLength={40}
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={crear}
              disabled={ocupado !== null || nombre.trim().length < 2}
              className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-boton text-[17px] font-extrabold text-boton-texto disabled:opacity-50"
            >
              <Ico nombre="check" tam={19} grosor={2.3} />
              {ocupado === 'nueva' ? 'Creando…' : 'Crear'}
            </button>
            <button
              onClick={() => {
                setCreando(false)
                setFallo(null)
              }}
              disabled={ocupado !== null}
              className="h-[56px] flex-1 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave disabled:opacity-50"
            >
              Ahora no
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setCreando(true)
            setAviso(null)
          }}
          className="flex h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave"
        >
          <Ico nombre="mas" tam={20} grosor={2.4} />
          Nueva carpeta
        </button>
      )}

      {aviso && (
        <p className="rounded-[16px] border border-borde px-4 py-3 text-[15.5px] font-semibold text-tinta-suave">
          {aviso}
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
