'use client'

import Link from 'next/link'
import { useState } from 'react'
import Repetir, { type Repeticion } from '../../repetir'

type Perfil = { id: string; nombre: string }

const HOY = () => new Date().toISOString().slice(0, 10)

function enDias(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function Nuevo({ perfiles, yo }: { perfiles: Perfil[]; yo: string }) {
  const [titulo, setTitulo] = useState('')
  const [para, setPara] = useState<string | null>(yo)
  const [fecha, setFecha] = useState<string | null>(HOY())
  const [hora, setHora] = useState('')
  const [nota, setNota] = useState('')
  const [repite, setRepite] = useState<Repeticion>(null)
  const [hasta, setHasta] = useState('')
  const [verMas, setVerMas] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(false)

  const otros = perfiles.filter((p) => p.id !== yo)

  async function guardar() {
    setAviso(null)
    setGuardando(true)
    try {
      const r = await fetch('/api/recordatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          asignado_a: para,
          fecha,
          hora: hora || null,
          nota,
          repite,
          repite_hasta: hasta || null,
        }),
      })
      const datos = await r.json()
      if (!r.ok) {
        setAviso(datos.error ?? 'No se ha podido guardar.')
        setGuardando(false)
        return
      }
      setHecho(true)
    } catch {
      setAviso('No hay conexión. Inténtalo otra vez.')
    }
    setGuardando(false)
  }

  if (hecho) {
    return (
      <main className="flex min-h-screen flex-col justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-verde text-4xl text-white">
            ✓
          </div>
          <h1 className="mt-8 font-titulo text-4xl leading-tight text-tinta">Apuntado</h1>
          <p className="mt-4 text-lg text-tinta-suave">{titulo}</p>

          <div className="mt-12 space-y-4">
            <Link href="/tablon" className="block rounded-2xl bg-verde px-6 py-5 text-xl font-semibold text-white">
              Ver el tablón
            </Link>
            <Link href="/tablon/nuevo" className="block rounded-2xl border-2 border-borde px-6 py-5 text-xl font-medium text-tinta-suave">
              Apuntar otra cosa
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="techo-holgado min-h-screen px-6 pb-10">
      <div className="mx-auto w-full max-w-md">
        <Link href="/tablon" className="text-lg font-medium text-tinta-suave underline underline-offset-4">
          ← Volver
        </Link>

        <h1 className="mt-8 font-titulo text-[2.5rem] leading-tight text-tinta">
          Apuntar algo
        </h1>

        <label htmlFor="titulo" className="mt-10 block text-xl font-medium text-tinta">
          ¿Qué hay que recordar?
        </label>
        <textarea
          id="titulo"
          rows={2}
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Recoger la medicación en la farmacia"
          className="mt-3 w-full resize-none rounded-2xl border-2 border-borde bg-fondo px-5 py-4 text-xl leading-snug text-tinta placeholder:text-tenue focus:border-verde focus:outline-none"
        />

        <p className="mt-8 text-xl font-medium text-tinta">¿Para quién?</p>
        <div className="mt-3 space-y-3">
          <Opcion activa={para === yo} onClick={() => setPara(yo)} texto="Para mí" />
          {otros.map((p) => (
            <Opcion
              key={p.id}
              activa={para === p.id}
              onClick={() => setPara(p.id)}
              texto={`Para ${p.nombre}`}
            />
          ))}
          <Opcion activa={para === null} onClick={() => setPara(null)} texto="Para los dos" />
        </div>

        <p className="mt-8 text-xl font-medium text-tinta">¿Cuándo?</p>
        <div className="mt-3 space-y-3">
          <Opcion activa={fecha === HOY()} onClick={() => setFecha(HOY())} texto="Hoy" />
          <Opcion activa={fecha === enDias(1)} onClick={() => setFecha(enDias(1))} texto="Mañana" />
          <Opcion
            activa={fecha === null}
            onClick={() => setFecha(null)}
            texto="Cuando se pueda"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="fecha" className="block text-lg text-tinta-suave">
            O elige un día
          </label>
          <input
            id="fecha"
            type="date"
            value={fecha ?? ''}
            onChange={(e) => setFecha(e.target.value || null)}
            className="mt-2 w-full rounded-2xl border-2 border-borde bg-fondo px-5 py-4 text-tinta focus:border-verde focus:outline-none"
          />
        </div>

        {!verMas ? (
          <button
            onClick={() => setVerMas(true)}
            className="mt-8 w-full py-3 text-lg font-medium text-tinta-suave underline underline-offset-4"
          >
            Añadir hora, nota o repetirlo
          </button>
        ) : (
          <>
            <label htmlFor="hora" className="mt-8 block text-xl font-medium text-tinta">
              ¿A qué hora? <span className="font-normal text-tenue">(opcional)</span>
            </label>
            <input
              id="hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="mt-3 w-full rounded-2xl border-2 border-borde bg-fondo px-5 py-4 text-tinta focus:border-verde focus:outline-none"
            />

            <label htmlFor="nota" className="mt-8 block text-xl font-medium text-tinta">
              Nota <span className="font-normal text-tenue">(opcional)</span>
            </label>
            <textarea
              id="nota"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="mt-3 w-full resize-none rounded-2xl border-2 border-borde bg-fondo px-5 py-4 text-tinta focus:border-verde focus:outline-none"
            />

            {/* Repetir solo tiene sentido si la tarea tiene día: algo
                "cuando se pueda" no puede repetirse cada semana. */}
            {fecha && (
              <Repetir
                repite={repite}
                hasta={hasta}
                desde={fecha}
                cambiar={(r, h) => {
                  setRepite(r)
                  setHasta(h)
                }}
              />
            )}
          </>
        )}

        <button
          onClick={guardar}
          disabled={guardando || titulo.trim().length === 0}
          className="mt-10 w-full rounded-2xl bg-verde px-6 py-6 text-2xl font-semibold text-white disabled:opacity-40"
        >
          {guardando ? 'Guardando…' : 'Apuntar'}
        </button>

        {aviso && (
          <p className="mt-6 rounded-2xl bg-terracota-suave px-5 py-4 text-lg leading-snug text-terracota">
            {aviso}
          </p>
        )}
      </div>
    </main>
  )
}

function Opcion({
  activa,
  onClick,
  texto,
}: {
  activa: boolean
  onClick: () => void
  texto: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-[20px] border-2 px-6 py-5 text-left text-xl font-medium ${
        activa ? 'border-verde bg-verde-suave text-verde' : 'border-borde bg-superficie text-tinta'
      }`}
    >
      {activa ? '✓ ' : ''}
      {texto}
    </button>
  )
}
