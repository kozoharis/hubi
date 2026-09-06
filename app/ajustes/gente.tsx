'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import QuienVe, { type CarpetaPermiso } from './quien-ve'

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
  soloMira: boolean
  soyYo: boolean
  /** Invitada, pero todavía no ha dicho que sí. */
  pendiente: boolean
  /** ¿Ve toda la casa, o solo lo que se le ha concedido? */
  veTodo: boolean
  escribeTodo: boolean
  /** Las carpetas de la casa, con lo que tiene concedido en cada una. */
  carpetas: CarpetaPermiso[]
}

export default function Gente({
  gente,
  puedoInvitar,
}: {
  gente: Vecino[]
  puedoInvitar: boolean
}) {
  const router = useRouter()

  const [repartiendo, setRepartiendo] = useState<string | null>(null)
  const [invitando, setInvitando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [papel, setPapel] = useState<'miembro' | 'lector'>('miembro')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [hecho, setHecho] = useState<{ nombre: string; correo: string } | null>(null)

  function cerrarInvitacion() {
    setInvitando(false)
    setNombre('')
    setCorreo('')
    setPapel('miembro')
    setFallo(null)
  }

  async function invitar() {
    setFallo(null)
    setHecho(null)
    setOcupado(true)

    const r = await fetch('/api/miembros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: correo.trim(), nombre: nombre.trim(), papel }),
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      correo?: string
      nombre?: string
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

    setHecho({ nombre: d.nombre ?? nombre.trim(), correo: d.correo ?? correo.trim() })
    cerrarInvitacion()
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
                {v.manda
                  ? 'Creó la casa · su Google Drive'
                  : v.pendiente
                    ? 'Invitación hecha · todavía no ha entrado'
                    : loQuePuede(v)}
              </span>
            </span>
            {puedoInvitar && !v.manda && (
              <button
                onClick={() => setRepartiendo(repartiendo === v.id ? null : v.id)}
                aria-label={`Qué puede ver ${v.nombre}`}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-tinta-suave"
              >
                <Ico nombre="ojo" tam={19} grosor={2.2} />
              </button>
            )}

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

      {repartiendo &&
        (() => {
          const v = gente.find((g) => g.id === repartiendo)
          if (!v) return null
          return (
            <QuienVe
              perfilId={v.id}
              nombre={v.nombre.split(' ')[0]}
              veTodo={v.veTodo}
              escribeTodo={v.escribeTodo}
              carpetas={v.carpetas}
              alCerrar={() => setRepartiendo(null)}
            />
          )
        })()}

      {puedoInvitar &&
        (invitando ? (
          <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
            {/* Primero quién es. Invitar un correo a secas es invitar a
                ciegas: hasta que esa persona se pusiera nombre, en toda
                la aplicación salía el trozo de delante de la arroba —
                «Para kozoharis», «kozoharis te ha dejado una tarea». */}
            <label htmlFor="quien" className="block text-[17px] font-extrabold leading-snug">
              ¿Cómo se llama?
            </label>
            <input
              id="quien"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Marta"
              className="entrada mt-2.5"
              autoFocus
              maxLength={40}
            />

            <label htmlFor="sucorreo" className="mt-4 block text-[17px] font-extrabold leading-snug">
              ¿Y su correo?
            </label>
            <input
              id="sucorreo"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="marta@gmail.com"
              className="entrada mt-2.5"
            />

            {/* ── Qué va a poder hacer ── */}
            <p className="mt-5 text-[17px] font-extrabold leading-snug">
              ¿Qué quieres que pueda hacer?
            </p>
            <div className="mt-2.5 space-y-2.5">
              <Papel
                puesto={papel === 'miembro'}
                alPulsar={() => setPapel('miembro')}
                titulo="Todo, como tú"
                pie="Guardar papeles, apuntar gastos, dejar recados. Para quien vive contigo."
              />
              <Papel
                puesto={papel === 'lector'}
                alPulsar={() => setPapel('lector')}
                titulo="Solo mirar"
                pie="Lo ve todo pero no puede cambiar ni borrar nada. Para un hijo o un gestor."
              />
            </div>

            {/*
              Se dice ANTES de escribir nada, no después: quien invita
              tiene que saber qué está dando. Hoy en HUBI no hay papeles
              privados — todo lo que se guarda es de la casa.
            */}
            <p className="mt-4 rounded-[14px] border border-borde px-3.5 py-3 text-[14.5px] font-semibold leading-snug text-tenue">
              En los dos casos <strong className="text-tinta">lo verá todo</strong>: los papeles,
              las cuentas y la agenda, también lo de Salud. Todavía no se puede guardar nada
              como privado.
            </p>

            <p className="mt-2.5 text-[14.5px] font-semibold leading-snug text-tenue">
              No le llega ningún correo de nuestra parte. Dile tú que entre en HUBI con ese
              correo y le llegará su número, como a ti.
            </p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={invitar}
                disabled={ocupado || correo.trim().length < 5 || nombre.trim().length < 2}
                className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-boton text-[17px] font-extrabold text-boton-texto disabled:opacity-50"
              >
                <Ico nombre="check" tam={19} grosor={2.3} />
                {ocupado ? 'Invitando…' : 'Invitar'}
              </button>
              <button
                onClick={cerrarInvitacion}
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
          Listo. Dile a <strong className="text-tinta">{hecho.nombre}</strong> que entre en HUBI
          con <strong className="text-tinta">{hecho.correo}</strong>: le llegará su número y verá
          tu invitación nada más entrar, y tiene que aceptarla desde su HUBI.
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

/*
  Las dos opciones de qué puede hacer.

  Con texto debajo, no solo el título: «Solo mirar» a secas deja la
  duda de si verá o no las cosas. La frase de abajo la quita.
*/
function Papel({
  puesto,
  alPulsar,
  titulo,
  pie,
}: {
  puesto: boolean
  alPulsar: () => void
  titulo: string
  pie: string
}) {
  return (
    <button
      onClick={alPulsar}
      aria-pressed={puesto}
      className="w-full rounded-[16px] px-4 py-3.5 text-left"
      style={
        puesto
          ? { background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }
          : {
              background: 'var(--t-fondo)',
              color: 'var(--t-tinta-suave)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      <span className="block text-[17px] font-extrabold leading-snug">
        {puesto ? '✓ ' : ''}
        {titulo}
      </span>
      <span className="mt-0.5 block text-[14.5px] font-semibold leading-snug opacity-80">
        {pie}
      </span>
    </button>
  )
}

/*
  Lo que puede esta persona, en una línea.

  Se dice el número de carpetas y no «acceso limitado», que no dice
  nada: quien mira esta lista quiere saber de un vistazo si Marta ve
  dos cosas o catorce.
*/
function loQuePuede(v: Vecino): string {
  if (v.soloMira && v.veTodo) return 'Ve toda la casa · no cambia nada'
  if (v.soloMira) return `Ve ${cuantasVe(v)} · no cambia nada`
  if (v.veTodo && v.escribeTodo) return 'Ve y apunta todo lo de la casa'
  if (v.veTodo) return `Ve toda la casa · guarda en ${dondeGuarda(v)}`
  return `Ve ${cuantasVe(v)} · guarda en ${v.escribeTodo ? 'todas ellas' : dondeGuarda(v)}`
}

function cuantasVe(v: Vecino): string {
  const n = v.carpetas.filter((c) => c.ver).length
  return n === 0 ? 'ninguna carpeta' : n === 1 ? '1 carpeta' : `${n} carpetas`
}

function dondeGuarda(v: Vecino): string {
  const n = v.carpetas.filter((c) => c.escribir).length
  return n === 0 ? 'ninguna' : n === 1 ? '1 carpeta' : `${n} carpetas`
}
