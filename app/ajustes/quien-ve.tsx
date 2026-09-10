'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import { api } from '@/lib/api'

/*
  ═══════════════════════════════════════════════════════════════
  QUÉ VE Y DÓNDE PUEDE GUARDAR
  ═══════════════════════════════════════════════════════════════

  Dos preguntas por persona, y la segunda solo cuando la primera lo
  pide:

      ¿Ve toda la casa?         Sí  ·  Solo algunas carpetas
      ¿Guarda en toda la casa?  Sí  ·  Solo en algunas  ·  En ninguna

  Con «Sí» en las dos —que es lo que tienen quienes ya estaban
  dentro— esta pantalla no enseña ni una casilla. La lista de carpetas
  aparece únicamente cuando alguien ha dicho que quiere limitar algo,
  que es cuando de verdad hace falta decidir carpeta por carpeta.

  ─────────────────────────────────────────────────────────────
  NO SE PUEDE GUARDAR DONDE NO SE VE

  Marcar «guardar» en una carpeta que no ve sería un permiso que no
  significa nada: no podría llegar a ella. Así que al quitar el ojo se
  quita también el lápiz, aquí y en la base de datos.
*/

export type CarpetaPermiso = {
  id: string
  nombre: string
  icono: string
  ver: boolean
  escribir: boolean
}

export default function QuienVe({
  perfilId,
  nombre,
  veTodo,
  escribeTodo,
  carpetas,
  alCerrar,
}: {
  perfilId: string
  nombre: string
  veTodo: boolean
  escribeTodo: boolean
  carpetas: CarpetaPermiso[]
  alCerrar: () => void
}) {
  const router = useRouter()

  const [todoVer, setTodoVer] = useState(veTodo)
  const [todoEscribir, setTodoEscribir] = useState(escribeTodo)
  const [lista, setLista] = useState(carpetas)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  function cambiarVer(id: string) {
    setLista((cs) =>
      cs.map((c) =>
        c.id === id
          ? /* Al apagar el ojo se apaga el lápiz: guardar donde no ves
               es un permiso que no significa nada. */
            { ...c, ver: !c.ver, escribir: !c.ver ? c.escribir : false }
          : c
      )
    )
  }

  function cambiarEscribir(id: string) {
    setLista((cs) =>
      cs.map((c) =>
        c.id === id ? { ...c, escribir: !c.escribir, ver: !c.escribir ? true : c.ver } : c
      )
    )
  }

  async function guardar() {
    setFallo(null)
    setOcupado(true)

    const r = await fetch(api('/api/permisos'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        perfil_id: perfilId,
        ve_todo: todoVer,
        escribe_todo: todoEscribir,
        carpetas: lista.map((c) => ({ id: c.id, ver: c.ver, escribir: c.escribir })),
      }),
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      error?: string
      detalle?: string
    } | null

    setOcupado(false)

    if (!r.ok || d?.bien !== true) {
      setFallo(
        d
          ? [d.error ?? 'No se ha podido guardar.', d.detalle].filter(Boolean).join(' · ')
          : 'HUBI no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return
    }

    router.refresh()
    alCerrar()
  }

  const hayQueElegir = !todoVer || !todoEscribir

  return (
    <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
      <p className="text-[17.5px] font-extrabold leading-snug">Qué puede ver {nombre}</p>

      <div className="mt-3 flex gap-2">
        <Opcion texto="Toda la casa" puesta={todoVer} alPulsar={() => setTodoVer(true)} />
        <Opcion
          texto="Solo algunas carpetas"
          puesta={!todoVer}
          alPulsar={() => setTodoVer(false)}
        />
      </div>

      <p className="mt-5 text-[17.5px] font-extrabold leading-snug">Y dónde puede guardar</p>

      <div className="mt-3 flex gap-2">
        <Opcion
          texto="Donde vea"
          puesta={todoEscribir}
          alPulsar={() => setTodoEscribir(true)}
        />
        <Opcion
          texto="Solo en algunas"
          puesta={!todoEscribir}
          alPulsar={() => setTodoEscribir(false)}
        />
      </div>

      {hayQueElegir && (
        <>
          <div className="mt-5 flex items-center justify-between px-1">
            <span className="rotulo">Carpeta</span>
            <span className="flex gap-3 pr-1">
              <span className="w-11 text-center text-[12.5px] font-extrabold tracking-wider text-tenue">
                VER
              </span>
              {!todoEscribir && (
                <span className="w-11 text-center text-[12.5px] font-extrabold tracking-wider text-tenue">
                  GUARDAR
                </span>
              )}
            </span>
          </div>

          <ul className="mt-2 space-y-2">
            {lista.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-[16px] border border-borde px-3 py-2.5"
              >
                <span className="text-[20px] leading-none">{c.icono || '📁'}</span>
                <span className="min-w-0 flex-1 truncate text-[16.5px] font-bold">
                  {c.nombre}
                </span>

                <Casilla
                  puesta={todoVer || c.ver}
                  bloqueada={todoVer}
                  etiqueta={`${nombre} ve ${c.nombre}`}
                  alPulsar={() => cambiarVer(c.id)}
                  icono="ojo"
                />

                {!todoEscribir && (
                  <Casilla
                    puesta={c.escribir}
                    bloqueada={false}
                    etiqueta={`${nombre} guarda en ${c.nombre}`}
                    alPulsar={() => cambiarEscribir(c.id)}
                    icono="lapiz"
                  />
                )}
              </li>
            ))}
          </ul>

          {lista.length === 0 && (
            <p className="mt-3 rounded-[16px] bg-fondo px-4 py-3 text-[15px] font-semibold text-tenue">
              Esta casa todavía no tiene carpetas que repartir.
            </p>
          )}
        </>
      )}

      {/*
        Se dice lo que HOY no separa el permiso, porque quien reparte
        acceso tiene que saber dónde está el límite. Prometer más
        privacidad de la que hay es peor que no ofrecerla.
      */}
      <p className="mt-4 rounded-[16px] border border-borde px-3.5 py-3 text-[14.5px] font-semibold leading-snug text-tenue">
        El permiso es por carpeta entera: quien ve <strong className="text-tinta">Casa</strong>{' '}
        ve todo lo que hay dentro. Las tareas, la agenda y la lista de la compra las siguen
        viendo todos.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={guardar}
          disabled={ocupado}
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-accion text-[17px] font-extrabold text-accion-tinta disabled:opacity-50"
        >
          <Ico nombre="check" tam={19} grosor={2.3} />
          {ocupado ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          onClick={alCerrar}
          disabled={ocupado}
          className="h-[60px] flex-1 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave disabled:opacity-50"
        >
          Dejarlo
        </button>
      </div>

      {fallo && (
        <p className="mt-3 t-apoyo rounded-[16px] border px-4 py-3"
          style={{ background: 'var(--t-alerta-velo)', borderColor: 'color-mix(in srgb, var(--t-alerta) 45%, transparent)', color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}
    </div>
  )
}

function Opcion({
  texto,
  puesta,
  alPulsar,
}: {
  texto: string
  puesta: boolean
  alPulsar: () => void
}) {
  return (
    <button
      onClick={alPulsar}
      aria-pressed={puesta}
      className="flex min-h-[52px] flex-1 items-center justify-center rounded-[14px] px-3 text-center text-[15.5px] font-extrabold leading-tight"
      style={
        puesta
          ? { background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }
          : {
              background: 'var(--t-fondo)',
              color: 'var(--t-tinta-suave)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      {texto}
    </button>
  )
}

/*
  Una casilla de 44 px. No baja de ahí aunque quepa: es el suelo que
  fijamos para lo que hay que pulsar, y una tabla de permisos es
  justo donde tienta hacer los controles pequeños para que entren más.
*/
function Casilla({
  puesta,
  bloqueada,
  etiqueta,
  alPulsar,
  icono,
}: {
  puesta: boolean
  bloqueada: boolean
  etiqueta: string
  alPulsar: () => void
  icono: 'ojo' | 'lapiz'
}) {
  return (
    <button
      onClick={alPulsar}
      disabled={bloqueada}
      role="switch"
      aria-checked={puesta}
      aria-label={etiqueta}
      className="flex h-12 w-11 shrink-0 items-center justify-center rounded-[13px] disabled:opacity-45"
      style={
        puesta
          ? { background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }
          : {
              background: 'var(--t-fondo)',
              color: 'var(--t-borde)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      <Ico nombre={icono} tam={19} grosor={2.2} />
    </button>
  )
}
