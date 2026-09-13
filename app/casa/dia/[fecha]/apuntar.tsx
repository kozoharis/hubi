'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Ico } from '../../../iconos'

/*
  ═══════════════════════════════════════════════════════════════
  APUNTAR ALGO EN ESTE DÍA, DESDE LA PARED
  ═══════════════════════════════════════════════════════════════

  «El jueves viene el fontanero.» Se escribe en la cocina, donde se está
  teniendo la conversación, en vez de acordarse de hacerlo luego con el
  móvil — que es la parte que falla.

  ─────────────────────────────────────────────────────────────
  CERRADO POR DEFECTO, Y UN BOTÓN GRANDE

  El formulario no está siempre abierto. Esta pantalla se mira mucho más
  de lo que se escribe, y un campo de texto permanente en una pared
  invita a que alguien escriba cualquier cosa al pasar.

  Un botón que dice lo que hace, y el formulario cuando se pulsa.

  ─────────────────────────────────────────────────────────────
  LA HORA ES OPCIONAL Y ESO IMPORTA

  «El jueves viene el fontanero» no tiene hora, y pedirla obligaría a
  inventarse una. Los que no la llevan salen arriba del día, en «Sin
  hora», que es exactamente lo que son.

  ─────────────────────────────────────────────────────────────
  Y NO SE PREGUNTA DE QUIÉN ES

  Lo que apunta una pared es de la casa, de nadie en concreto. Lo exige
  la política del paso 75 —`asignado_a is null`— y es la decisión
  correcta: decir «esto es de Conchita» es un juicio que hace una
  persona, no un aparato al que tiene acceso cualquiera que entre.
*/
export default function Apuntar({ fecha }: { fecha: string }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [hora, setHora] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function guardar() {
    const que = titulo.trim()
    if (que.length < 2) return

    setFallo(null)
    setOcupado(true)

    try {
      const r = await fetch(api('/api/pared'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: que, fecha, hora: hora || null }),
      })
      const d = (await r.json().catch(() => null)) as { error?: string } | null

      if (!r.ok) {
        setFallo(d?.error ?? 'No se ha podido apuntar.')
        return
      }

      setTitulo('')
      setHora('')
      setAbierto(false)
      router.refresh()
    } catch {
      setFallo('No se ha podido apuntar.')
    } finally {
      setOcupado(false)
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="tocable mt-5 flex h-[76px] w-full items-center justify-center gap-3 rounded-[24px] border-2 border-dashed text-[24px] font-extrabold text-tinta-suave"
        style={{ borderColor: 'var(--t-borde)' }}
      >
        <Ico nombre="mas" tam={28} grosor={2.6} />
        Apuntar algo este día
      </button>
    )
  }

  return (
    <div className="mt-5 rounded-[28px] border border-borde bg-superficie px-7 py-6">
      <label
        htmlFor="que-hay"
        className="block text-[19px] font-extrabold uppercase tracking-[0.14em] text-tenue"
      >
        Qué hay que recordar
      </label>

      {/* 30 px y 84 de alto: un teclado de pantalla tapa media tableta,
          así que lo escrito tiene que leerse por encima de él. */}
      <input
        id="que-hay"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') guardar()
        }}
        maxLength={120}
        placeholder="Viene el fontanero"
        autoComplete="off"
        autoFocus
        className="entrada mt-4 h-[84px] w-full text-[30px] font-extrabold"
      />

      <div className="mt-4 flex items-end gap-4">
        <div className="w-[220px] shrink-0">
          <label
            htmlFor="a-que-hora"
            className="block text-[17px] font-extrabold uppercase tracking-wider text-tenue"
          >
            A qué hora
          </label>
          <input
            id="a-que-hora"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="entrada mt-2 h-[72px] w-full text-[26px] font-extrabold tabular-nums"
          />
        </div>

        <p className="pb-4 text-[17px] font-bold leading-snug text-tenue">
          Si no la sabes, déjala en blanco.
        </p>
      </div>

      {fallo && (
        <p className="mt-4 text-[19px] font-bold" style={{ color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={ocupado || titulo.trim().length < 2}
          className="tocable flex h-[76px] flex-1 items-center justify-center gap-3 rounded-[24px] text-[24px] font-extrabold disabled:opacity-45"
          style={{ background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }}
        >
          <Ico nombre="check" tam={28} grosor={2.6} />
          {ocupado ? 'Guardando…' : 'Apuntarlo'}
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
