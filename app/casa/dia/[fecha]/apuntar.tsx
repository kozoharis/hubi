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
  ⚠️  Y SÍ SE PREGUNTA DE QUIÉN ES · CORREGIDO EN EL PASO 76

  Aquí ponía que no se preguntaba, con este argumento: «decir esto es de
  Conchita es un juicio que hace una persona, no un aparato». Suena bien
  y está mal, y es la SEGUNDA vez que el mismo error aparece — la
  primera fue prohibir apuntar del todo.

  **El aparato no juzga nada.** Quien está delante de la pared
  escribiendo es una persona, y es exactamente la persona que sabe de
  quién es el recado. Así se apunta un recado en una cocina desde que
  existen las cocinas.

  La regla que sale de aquí: cuando escriba «un aparato no debería poder
  X», comprobar primero si lo que de verdad estoy diciendo es «una
  persona de pie no debería poder X» — que casi nunca es cierto.

  ─────────────────────────────────────────────────────────────
  BOTONES Y NO UN DESPLEGABLE

  Tres o cuatro nombres caben en una fila de botones grandes, y un
  desplegable en una pantalla colgada de una pared es dos toques y una
  lista que aparece encima de lo que estabas mirando. El punto 5 del
  planteamiento: nada importante oculto.

  «La casa» va primero y es lo que viene puesto, porque la mayoría de lo
  que se apunta en una cocina no es de nadie en concreto.

  ─────────────────────────────────────────────────────────────
  Y EL MICRÓFONO NO ESTÁ AQUÍ: ESTÁ EN LA PARED ENTERA

  Llegó a haber uno metido en este formulario, otro en la compra y otro
  en las notas. Tres botones distintos en tres pantallas —y ninguno en
  las otras dos— obligaban a aprender dónde se puede hablar.

  Ahora hay UNO, en el armazón, abajo a la derecha en las cinco
  pestañas: `app/casa/microfono.tsx`. Esto se queda para escribirlo a
  mano, que es lo que hace falta cuando hay ruido o alguien durmiendo.
*/

export type Quien = { id: string; nombre: string; color: string }



export default function Apuntar({ fecha, gente }: { fecha: string; gente: Quien[] }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [hora, setHora] = useState('')
  const [para, setPara] = useState<string | null>(null)
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
        body: JSON.stringify({ titulo: que, fecha, hora: hora || null, para }),
      })
      const d = (await r.json().catch(() => null)) as { error?: string } | null

      if (!r.ok) {
        setFallo(d?.error ?? 'No se ha podido apuntar.')
        return
      }

      setTitulo('')
      setHora('')
      setPara(null)
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

      {/* ── Para quién ── */}
      {gente.length > 0 && (
        <div className="mt-5">
          <p className="text-[17px] font-extrabold uppercase tracking-wider text-tenue">
            Para quién
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            <Nombre texto="La casa" puesto={para === null} alTocar={() => setPara(null)} />
            {gente.map((g) => (
              <Nombre
                key={g.id}
                texto={g.nombre}
                color={g.color}
                puesto={para === g.id}
                alTocar={() => setPara(g.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-end gap-4">
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

/*
  Un nombre para elegir. Lleva SU color —el mismo con el que esa persona
  sale en la agenda y en el corcho— porque en una casa el color es el
  nombre: se reconoce antes de leerlo.

  «La casa» no lleva ninguno: no es de nadie, y darle un color la
  convertiría en una persona más de la fila.
*/
function Nombre({
  texto,
  color,
  puesto,
  alTocar,
}: {
  texto: string
  color?: string
  puesto: boolean
  alTocar: () => void
}) {
  return (
    <button
      type="button"
      onClick={alTocar}
      aria-pressed={puesto}
      className="tocable flex h-[64px] items-center gap-3 rounded-full border px-6 text-[21px] font-extrabold"
      style={
        puesto
          ? {
              background: color
                ? `color-mix(in srgb, ${color} 16%, var(--t-superficie))`
                : 'var(--t-velo)',
              borderColor: color
                ? `color-mix(in srgb, ${color} 50%, transparent)`
                : 'var(--t-tinta-suave)',
              color: 'var(--t-tinta)',
            }
          : {
              background: 'var(--t-superficie)',
              borderColor: 'var(--t-borde)',
              color: 'var(--t-tenue)',
            }
      }
    >
      {color && (
        <span
          className="block h-[14px] w-[14px] shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      {texto}
    </button>
  )
}
