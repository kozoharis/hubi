'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import { hoyAqui } from '@/lib/tablon'

/*
  PONERLE DÍA A UNA COMPRA.

  Una lista de la compra sin fecha es un papel en la nevera: está ahí,
  y se acuerda uno cuando ya está en el súper por otra cosa. Ponerle
  día la convierte en algo que HUBI puede recordar — que es la mitad
  de para qué existe.

  Se crea una tarea normal en la Agenda, no un invento aparte. Sale en
  la semana, se puede marcar hecha, avisa al móvil y se le puede
  asignar a quien vaya a ir. Que la compra y las demás cosas de la casa
  vivan en el mismo sitio es justo lo que pide el punto 18: para ellos
  todo es "cosas que tengo que recordar".

  TRES DECISIONES Y NINGUNA OBLIGATORIA. Día —con Hoy y Mañana ya
  puestos, que es el 90%—, hora, y a quién le toca. Con tocar "Hoy" y
  guardar ya está hecho.
*/

const AVISOS: { valor: string; texto: string }[] = [
  { valor: 'ninguno', texto: 'Sin aviso' },
  { valor: '1h', texto: '1 hora antes' },
  { valor: '1d', texto: 'El día antes' },
]

export default function Programar({
  lista,
  nombreCategoria,
  seccionId,
  cuantas,
  gente,
  yo,
  alCerrar,
}: {
  /** La lista concreta. Null si esta categoría no tiene ninguna aún. */
  lista: { id: string; nombre: string; fecha: string | null; hora: string | null; asignado_a: string | null } | null
  nombreCategoria: string
  seccionId: string | null
  cuantas: number
  gente: { id: string; nombre: string }[]
  yo: string
  alCerrar: () => void
}) {
  const router = useRouter()

  const hoy = hoyAqui()
  const manana = sumarDias(hoy, 1)

  /* Si ya tenía día, se abre con el suyo puesto: cambiar una fecha no
     puede obligar a volver a elegirlo todo desde cero. */
  const [fecha, setFecha] = useState(lista?.fecha ?? hoy)
  const [hora, setHora] = useState(lista?.hora?.slice(0, 5) ?? '')
  const [quien, setQuien] = useState<string | null>(lista?.asignado_a ?? yo)
  const [aviso, setAviso] = useState('1h')
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function guardar() {
    setFallo(null)
    setGuardando(true)

    /*
      El día se guarda EN LA LISTA, y la ruta se encarga de la tarea de
      la Agenda. Así, cambiar la fecha CAMBIA la tarea que ya había en
      vez de crear otra: sin eso, tocar tres veces el día deja tres
      "hacer la compra" en la misma semana y nadie sabe cuál vale.
    */
    let id = lista?.id ?? null

    // Si esta categoría todavía no tiene lista, se crea al vuelo.
    if (!id) {
      const c = await fetch('/api/compra/listas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: 'La compra', seccion_id: seccionId }),
      })
      if (!c.ok) {
        const d = (await c.json().catch(() => ({}))) as { error?: string }
        setFallo(d.error ?? 'No se ha podido programar.')
        setGuardando(false)
        return
      }
      id = ((await c.json()) as { lista?: { id: string } }).lista?.id ?? null
    }

    const r = await fetch('/api/compra/listas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        fecha,
        hora: hora || null,
        asignado_a: quien,
        /* Sin hora no hay de qué avisar "una hora antes": se guarda sin
           aviso en vez de dejar uno que no se sabe cuándo sonaría. */
        aviso_previo: hora ? aviso : 'ninguno',
      }),
    })

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setFallo(d.error ?? 'No se ha podido programar.')
      setGuardando(false)
      return
    }

    setGuardando(false)
    alCerrar()
    router.refresh()
  }

  return (
    <div className="mt-4 rounded-[22px] border border-borde bg-superficie px-4 py-4">
      <p className="text-[19px] font-extrabold tracking-tight">
        ¿Cuándo se hace {lista ? `«${lista.nombre}»` : `la compra de ${nombreCategoria}`}?
      </p>

      {/* ── El día ── */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Pastilla texto="Hoy" puesta={fecha === hoy} alPulsar={() => setFecha(hoy)} />
        <Pastilla texto="Mañana" puesta={fecha === manana} alPulsar={() => setFecha(manana)} />
        <label className="flex h-11 items-center rounded-full border border-borde px-3 text-[15px] font-extrabold text-tinta-suave">
          <input
            type="date"
            value={fecha}
            min={hoy}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-transparent text-[15px] font-extrabold text-tinta outline-none"
          />
        </label>
      </div>

      {/* ── La hora ── */}
      <p className="rotulo mt-4">A qué hora (si quieres)</p>
      <input
        type="time"
        value={hora}
        onChange={(e) => setHora(e.target.value)}
        className="entrada mt-2"
      />

      {/* ── Quién ── */}
      {gente.length > 1 && (
        <>
          <p className="rotulo mt-4">Quién va</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {gente.map((p) => (
              <Pastilla
                key={p.id}
                texto={p.nombre.split(' ')[0]}
                puesta={quien === p.id}
                alPulsar={() => setQuien(p.id)}
              />
            ))}
            <Pastilla
              texto="Los dos"
              puesta={quien === null}
              alPulsar={() => setQuien(null)}
            />
          </div>
        </>
      )}

      {/* ── El aviso ── */}
      {hora && (
        <>
          <p className="rotulo mt-4">Avisar</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AVISOS.map((a) => (
              <Pastilla
                key={a.valor}
                texto={a.texto}
                puesta={aviso === a.valor}
                alPulsar={() => setAviso(a.valor)}
              />
            ))}
          </div>
        </>
      )}

      {fallo && (
        <p className="mt-3 rounded-[16px] bg-coral-suave px-4 py-3 text-[15.5px] font-semibold text-coral">
          {fallo}
        </p>
      )}

      <div className="mt-4 flex gap-2.5">
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-boton text-[17px] font-extrabold text-boton-texto disabled:opacity-50"
        >
          <Ico nombre="check" tam={19} grosor={2.3} />
          {guardando ? 'Guardando…' : 'Ponerlo en la Agenda'}
        </button>
        <button
          onClick={alCerrar}
          disabled={guardando}
          className="h-[56px] flex-1 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave disabled:opacity-50"
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}

function Pastilla({
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
      className="flex h-11 items-center rounded-full px-4 text-[15px] font-extrabold"
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

function sumarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(a, m - 1, d)
  f.setDate(f.getDate() + n)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}
