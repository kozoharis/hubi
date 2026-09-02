'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../../iconos'

/*
  Cambiar o borrar una tarea que ya existe.

  Esto faltaba, y su ausencia hacía más daño del que parece: una fecha
  mal oída o un nombre equivocado se quedaban mal para siempre, porque
  la única salida era borrar y volver a dictarlo entero. Y lo que no se
  puede corregir, se deja — hasta que uno deja de fiarse de lo que hay
  apuntado.

  El formulario se abre en la misma pantalla, debajo. Ni otra pantalla
  ni una ventana flotante: se ve lo que hay, se cambia, se guarda.
*/

type Persona = { id: string; nombre: string }

const REPETICIONES: { valor: string; texto: string }[] = [
  { valor: '', texto: 'No se repite' },
  { valor: 'diaria', texto: 'Todos los días' },
  { valor: 'semanal', texto: 'Todas las semanas' },
  { valor: 'mensual', texto: 'Todos los meses' },
  { valor: 'anual', texto: 'Todos los años' },
]

export default function Editar({
  id,
  inicial,
  personas,
}: {
  id: string
  inicial: {
    titulo: string
    asignado_a: string | null
    fecha: string | null
    hora: string | null
    nota: string | null
    repite: string | null
    repite_hasta: string | null
  }
  personas: Persona[]
}) {
  const router = useRouter()

  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [seguro, setSeguro] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const [titulo, setTitulo] = useState(inicial.titulo)
  const [para, setPara] = useState(inicial.asignado_a ?? '')
  const [fecha, setFecha] = useState(inicial.fecha ?? '')
  const [hora, setHora] = useState(inicial.hora ?? '')
  const [nota, setNota] = useState(inicial.nota ?? '')
  const [repite, setRepite] = useState(inicial.repite ?? '')
  const [hasta, setHasta] = useState(inicial.repite_hasta ?? '')

  async function guardar() {
    if (!titulo.trim()) {
      setAviso('Falta decir qué hay que hacer.')
      return
    }
    setGuardando(true)
    setAviso(null)

    try {
      const r = await fetch(`/api/recordatorios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          asignado_a: para || null,
          fecha: fecha || null,
          hora: hora || null,
          nota,
          repite: repite || null,
          repite_hasta: repite ? hasta || null : null,
        }),
      })
      if (!r.ok) throw new Error((await r.json()).error)

      setAbierto(false)
      router.refresh()
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se ha podido guardar.')
    }
    setGuardando(false)
  }

  async function borrar() {
    setBorrando(true)
    try {
      const r = await fetch(`/api/recordatorios/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error((await r.json()).error)
      router.push('/agenda')
      router.refresh()
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se ha podido borrar.')
      setBorrando(false)
      setSeguro(false)
    }
  }

  if (!abierto) {
    return (
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => setAbierto(true)}
          className="flex h-[60px] flex-1 items-center justify-center gap-2.5 rounded-[18px] border border-borde bg-superficie text-[17.5px] font-extrabold text-tinta"
        >
          <Ico nombre="lapiz" tam={21} grosor={2.1} />
          Cambiar
        </button>
        <button
          onClick={() => setSeguro(true)}
          className="flex h-[60px] w-[60px] items-center justify-center rounded-[18px] border border-borde bg-superficie text-coral"
          aria-label="Borrar esta tarea"
        >
          <Ico nombre="aviso" tam={22} grosor={2.1} />
        </button>

        {/*
          Borrar pregunta antes, y la pregunta dice QUÉ se va a borrar.
          Un "¿estás seguro?" a secas se contesta que sí sin leerlo.
        */}
        {seguro && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/50 px-5 pb-8">
            <div className="mx-auto w-full max-w-md rounded-[24px] bg-superficie p-6">
              <h2 className="text-[21px] font-extrabold leading-snug">
                ¿Borrar «{inicial.titulo}»?
              </h2>
              <p className="mt-2 text-[16.5px] font-medium leading-relaxed text-tinta-suave">
                Desaparece del tablón y del calendario. Esto no se puede deshacer.
              </p>
              <button
                onClick={borrar}
                disabled={borrando}
                className="mt-6 flex h-[60px] w-full items-center justify-center rounded-[16px] bg-coral text-[18px] font-extrabold text-white disabled:opacity-50"
              >
                {borrando ? 'Borrando…' : 'Sí, borrarla'}
              </button>
              <button
                onClick={() => setSeguro(false)}
                className="mt-3 flex h-[60px] w-full items-center justify-center rounded-[16px] border border-borde text-[18px] font-bold text-tinta"
              >
                No, dejarla
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-[22px] border border-borde bg-superficie p-5">
      <h2 className="text-[20px] font-extrabold tracking-tight">Cambiar la tarea</h2>

      <Campo etiqueta="Qué hay que hacer">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="h-[58px] w-full rounded-[14px] border border-borde bg-fondo px-4 font-semibold text-tinta"
        />
      </Campo>

      <Campo etiqueta="Para quién">
        <select
          value={para}
          onChange={(e) => setPara(e.target.value)}
          className="h-[58px] w-full rounded-[14px] border border-borde bg-fondo px-4 font-semibold text-tinta"
        >
          <option value="">Los dos</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <div className="flex gap-3">
        <div className="flex-1">
          <Campo etiqueta="Día">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-[58px] w-full rounded-[14px] border border-borde bg-fondo px-4 font-semibold text-tinta"
            />
          </Campo>
        </div>
        <div className="w-[42%]">
          <Campo etiqueta="Hora">
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="h-[58px] w-full rounded-[14px] border border-borde bg-fondo px-4 font-semibold text-tinta"
            />
          </Campo>
        </div>
      </div>

      <Campo etiqueta="Se repite">
        <select
          value={repite}
          onChange={(e) => {
            setRepite(e.target.value)
            if (!e.target.value) setHasta('')
          }}
          className="h-[58px] w-full rounded-[14px] border border-borde bg-fondo px-4 font-semibold text-tinta"
        >
          {REPETICIONES.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.texto}
            </option>
          ))}
        </select>
      </Campo>

      {/* Hasta cuándo, solo si se repite. Preguntar el final de algo
          que no se repite es pedir que se conteste a nada. */}
      {repite && (
        <Campo etiqueta="Hasta cuándo (en blanco: para siempre)">
          <input
            type="date"
            value={hasta}
            min={fecha || undefined}
            onChange={(e) => setHasta(e.target.value)}
            className="h-[58px] w-full rounded-[14px] border border-borde bg-fondo px-4 font-semibold text-tinta"
          />
        </Campo>
      )}

      <Campo etiqueta="Nota">
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          className="w-full rounded-[14px] border border-borde bg-fondo p-4 font-semibold leading-snug text-tinta"
        />
      </Campo>

      {aviso && (
        <p className="mt-4 rounded-[14px] bg-coral-suave px-4 py-3 text-[16px] font-semibold text-coral">
          {aviso}
        </p>
      )}

      <button
        onClick={guardar}
        disabled={guardando}
        className="mt-5 flex h-[62px] w-full items-center justify-center rounded-[16px] bg-verde text-[18px] font-extrabold text-white disabled:opacity-50"
      >
        {guardando ? 'Guardando…' : 'Guardar los cambios'}
      </button>
      <button
        onClick={() => setAbierto(false)}
        className="mt-3 flex h-[58px] w-full items-center justify-center rounded-[16px] border border-borde text-[17.5px] font-bold text-tinta-suave"
      >
        Dejarlo como estaba
      </button>
    </div>
  )
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string
  children: React.ReactNode
}) {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-[15px] font-bold text-tenue">{etiqueta}</span>
      {children}
    </label>
  )
}
