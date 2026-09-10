'use client'

import { useState } from 'react'
import { useIr } from '@/app/enlace'
import { Ico } from '../iconos'
import { api } from '@/lib/api'

/*
  ═══════════════════════════════════════════════════════════════
  UNA ACTIVIDAD NUEVA
  ═══════════════════════════════════════════════════════════════

  Las mismas cuatro opciones que al crear la casa, con las mismas
  palabras. No es pereza: dos vocabularios distintos para lo mismo
  obligan a la persona a traducir, y eso es trabajo que le estamos
  cobrando por no habernos puesto de acuerdo con nosotros mismos.

  Dos preguntas, y en este orden: primero QUÉ es —porque de ahí salen
  sus partidas, su color y si va por partes— y después cómo se llama.
  Al revés, la segunda pregunta llegaría cuando ya se ha decidido todo
  y parecería un trámite.
*/

type Tipo = 'finca' | 'obra' | 'alquileres' | 'otra'

const TIPOS: { id: Tipo; emoji: string; titulo: string; pie: string; ejemplo: string }[] = [
  {
    id: 'finca',
    emoji: '🌿',
    titulo: 'Una finca o huerta',
    pie: 'Agua, luz, productos, maquinaria… y lo que se venda.',
    ejemplo: 'La finca',
  },
  {
    id: 'obra',
    emoji: '🧱',
    titulo: 'Obras o reformas',
    pie: 'Cada obra por separado, con albañilería, carpintería…',
    ejemplo: 'Obras',
  },
  {
    id: 'alquileres',
    emoji: '🔑',
    titulo: 'Pisos en alquiler',
    pie: 'Cada piso por separado, y lo común repartido.',
    ejemplo: 'Alquileres',
  },
  {
    id: 'otra',
    emoji: '📁',
    titulo: 'Otra cosa',
    pie: 'Empieza vacía y le pones tú las partidas.',
    ejemplo: 'El taller',
  },
]

export default function NuevaActividad() {
  const router = useIr()

  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<Tipo | null>(null)
  const [nombre, setNombre] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  function elegir(t: Tipo) {
    setTipo(t)
    /* El nombre se propone, no se impone: casi siempre vale y quien
       quiera otro solo tiene que escribir encima. Un campo vacío
       delante de alguien que no sabe qué se espera es una pausa
       innecesaria. */
    setNombre(TIPOS.find((x) => x.id === t)?.ejemplo ?? '')
    setFallo(null)
  }

  function cerrar() {
    setAbierto(false)
    setTipo(null)
    setNombre('')
    setFallo(null)
  }

  async function crear() {
    if (!tipo || nombre.trim().length < 2) return
    setFallo(null)
    setOcupado(true)

    const r = await fetch(api('/api/actividades'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim(), tipo }),
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      id?: string
      error?: string
      detalle?: string
      aviso?: string
    } | null

    setOcupado(false)

    /* Un 200 solo dice que algo contestó. Se exige que conteste lo que
       contesta esta ruta y ninguna otra. */
    if (!r.ok || d?.bien !== true) {
      setFallo(
        d
          ? [d.error ?? 'No se ha podido crear.', d.detalle].filter(Boolean).join(' · ')
          : 'HUBI no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return
    }

    cerrar()
    router.refresh()
    /* Se entra directamente a «Cómo la llevas»: es donde se terminan
       de decidir las partes y las partidas, y llegar ahí solo es el
       siguiente paso natural de lo que acaba de hacer. */
    if (d.id) router.push(`/seccion/${d.id}/ajustes`)
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex h-[60px] w-full items-center justify-center gap-2 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave"
      >
        <Ico nombre="mas" tam={20} grosor={2.4} />
        Nueva actividad
      </button>
    )
  }

  return (
    <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
      {!tipo ? (
        <>
          <p className="text-[17.5px] font-extrabold leading-snug">
            ¿De qué quieres llevar las cuentas?
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-tenue">
            Algo con gastos e ingresos propios, para verlo aparte de la casa.
          </p>

          <div className="mt-3 space-y-2.5">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                onClick={() => elegir(t.id)}
                className="flex w-full items-center gap-3 rounded-[16px] border border-borde px-3.5 py-3 text-left"
              >
                <span className="text-[26px] leading-none">{t.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-extrabold leading-snug">{t.titulo}</span>
                  <span className="mt-0.5 block text-[14.5px] font-semibold leading-snug text-tenue">
                    {t.pie}
                  </span>
                </span>
                <Ico nombre="flecha" tam={19} grosor={2.2} className="shrink-0 text-apagado" />
              </button>
            ))}
          </div>

          <button
            onClick={cerrar}
            className="mt-3 w-full py-3 text-[16px] font-bold text-tinta-suave underline underline-offset-4"
          >
            Ahora no
          </button>
        </>
      ) : (
        <>
          <p className="text-[17.5px] font-extrabold leading-snug">¿Cómo la llamas?</p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-tenue">
            El nombre que uséis en casa. Se puede cambiar después.
          </p>

          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="entrada mt-3"
            autoFocus
            maxLength={40}
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={crear}
              disabled={ocupado || nombre.trim().length < 2}
              className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-accion text-[17px] font-extrabold text-accion-tinta disabled:opacity-50"
            >
              <Ico nombre="check" tam={19} grosor={2.3} />
              {ocupado ? 'Creando…' : 'Crear'}
            </button>
            <button
              onClick={() => setTipo(null)}
              disabled={ocupado}
              className="h-[60px] flex-1 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave disabled:opacity-50"
            >
              Volver
            </button>
          </div>
        </>
      )}

      {fallo && (
        <p className="mt-3 t-apoyo rounded-[16px] border px-4 py-3"
          style={{ background: 'var(--t-alerta-velo)', borderColor: 'color-mix(in srgb, var(--t-alerta) 45%, transparent)', color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}
    </div>
  )
}
