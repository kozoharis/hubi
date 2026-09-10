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

/*
  Los iconos que se pueden poner. Son los que HUBI sabe dibujar como
  línea: cualquier otro emoji acabaría pintado como una carpeta
  genérica y quien lo eligiera no entendería por qué. Es la misma
  lista que valida la ruta.
*/
const ICONOS = [
  '📁', '🏠', '❤️', '🚗', '🛡', '📄', '💊', '🌿', '🔑',
  '👷', '🧰', '💼', '⛵', '🐾', '🛒', '⏰', '👥', '🔒', '📌',
]

export default function Carpetas({ carpetas }: { carpetas: Carpeta[] }) {
  const router = useRouter()

  const [creando, setCreando] = useState(false)
  const [cambiandoIcono, setCambiandoIcono] = useState<string | null>(null)
  const [icono, setIcono] = useState('📁')
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
      body: JSON.stringify({ nombre: nombre.trim(), icono }),
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
    setIcono('📁')
    setCreando(false)
    router.refresh()
  }

  /* Cambiarle el icono a una que ya existe. Se toca el propio icono:
     es donde iría el dedo de cualquiera que quiera cambiarlo, y así no
     hace falta otro botón en una fila que ya tiene interruptor. */
  async function ponerIcono(id: string, nuevo: string) {
    setCambiandoIcono(null)
    setFallo(null)
    setOcupado(id)

    const r = await fetch('/api/carpetas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, icono: nuevo }),
    })

    const d = (await r.json().catch(() => null)) as { bien?: boolean; error?: string } | null
    setOcupado(null)

    if (!r.ok || d?.bien !== true) {
      setFallo(d?.error ?? 'No se ha podido cambiar el icono.')
      return
    }
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
            <button
              onClick={() => setCambiandoIcono(cambiandoIcono === c.id ? null : c.id)}
              aria-label={`Cambiar el icono de ${c.nombre}`}
              className="flex h-12 w-11 shrink-0 items-center justify-center rounded-[13px] border border-borde text-[22px] leading-none"
            >
              {c.icono || '📁'}
            </button>
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

      {cambiandoIcono && (
        <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <p className="text-[16px] font-extrabold">Elige un icono</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ICONOS.map((e) => (
              <button
                key={e}
                onClick={() => ponerIcono(cambiandoIcono, e)}
                aria-label={`Poner ${e}`}
                className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-borde text-[24px]"
              >
                {e}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCambiandoIcono(null)}
            className="mt-3 w-full py-3 text-[16px] font-bold text-tinta-suave underline underline-offset-4"
          >
            Dejarlo
          </button>
        </div>
      )}

      <p className="px-1 text-[14.5px] font-semibold leading-snug text-tenue">
        Apagar una carpeta la esconde: deja de salir al guardar papeles. Lo que ya tenga dentro
        <strong className="text-tinta"> no se borra</strong>, ni en HUBI ni en tu Drive, y vuelve
        a aparecer si la enciendes.
      </p>

      {creando ? (
        <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <p className="text-[17px] font-extrabold">¿Cómo se llama?</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {ICONOS.map((e) => (
              <button
                key={e}
                onClick={() => setIcono(e)}
                aria-label={`Poner ${e}`}
                aria-pressed={icono === e}
                className="flex h-12 w-11 items-center justify-center rounded-[13px] text-[22px]"
                style={
                  icono === e
                    ? { background: 'var(--t-boton)', border: '1px solid var(--t-boton)' }
                    : { border: '1px solid var(--t-borde)' }
                }
              >
                {e}
              </button>
            ))}
          </div>
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
              className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-accion text-[17px] font-extrabold text-accion-tinta disabled:opacity-50"
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
              className="h-[60px] flex-1 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave disabled:opacity-50"
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
          className="flex h-[60px] w-full items-center justify-center gap-2 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave"
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
        <p className="t-apoyo rounded-[16px] border px-4 py-3"
          style={{ background: 'var(--t-alerta-velo)', borderColor: 'color-mix(in srgb, var(--t-alerta) 45%, transparent)', color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}
    </div>
  )
}
