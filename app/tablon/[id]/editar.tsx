'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Aviso, BotonDestructivo, BotonSecundario } from '../../piezas'

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

/*
  Con cuánta antelación avisar.

  El campo existía en la base de datos y se enseñaba en la ficha, pero
  no había ningún formulario donde ponerlo. Estaba en el planteamiento
  —«¿quieres que te avisemos? un mes / una semana / un día antes»— y
  era, en la práctica, de solo lectura.
*/
const AVISOS: { valor: string; texto: string }[] = [
  { valor: 'sin_aviso', texto: 'Sin aviso' },
  { valor: '30_min', texto: '30 minutos antes' },
  { valor: '1_dia', texto: 'Un día antes' },
  { valor: '1_semana', texto: 'Una semana antes' },
  { valor: '1_mes', texto: 'Un mes antes' },
]

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
    aviso_previo?: string | null
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
  const [avisoPrevio, setAvisoPrevio] = useState(inicial.aviso_previo ?? 'sin_aviso')

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
          /* Sin día no hay desde cuándo contar la antelación. */
          aviso_previo: fecha ? avisoPrevio : 'sin_aviso',
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

  /*
    ── EL BOTÓN DE BORRAR ERA UN CUADRADO CON UN TRIÁNGULO ──

    60×60, sin una palabra, en coral, al lado de «Cambiar». Un icono
    solo no dice qué hace: un triángulo de aviso puede ser «borrar»,
    «denunciar» o «hay un problema con esto», y el único sitio donde
    ponía «Borrar» era la etiqueta invisible para lectores de pantalla.

    La acción más irreversible de la pantalla era la única que no se
    explicaba. Ahora lleva su palabra, como las otras dos veces que
    apareció esto mismo en Ajustes.
  */
  if (!abierto) {
    return (
      <div className="mt-4 space-y-2.5">
        <BotonSecundario onClick={() => setAbierto(true)} icono="lapiz">
          Cambiar
        </BotonSecundario>
        <BotonDestructivo onClick={() => setSeguro(true)}>
          Borrar esta tarea
        </BotonDestructivo>

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

      {/* Avisar necesita día: sin fecha no hay desde cuándo contar.
          Y «30 minutos antes» necesita hora, por lo mismo. */}
      {fecha && (
        <Campo etiqueta="¿Os avisamos antes?">
          <select
            value={avisoPrevio}
            onChange={(e) => setAvisoPrevio(e.target.value)}
            className="h-[58px] w-full rounded-[14px] border border-borde bg-fondo px-4 font-semibold text-tinta"
          >
            {AVISOS.filter((a) => a.valor !== '30_min' || hora).map((a) => (
              <option key={a.valor} value={a.valor}>
                {a.texto}
              </option>
            ))}
          </select>
        </Campo>
      )}

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
        <div className="mt-4">
          <Aviso titulo="No se ha podido guardar" explicacion={aviso} />
        </div>
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
