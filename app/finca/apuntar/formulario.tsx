'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Categoria } from '@/lib/rutas'
import { Ico } from '../../iconos'
import CamposEstancia, { ESTANCIA_VACIA, type Estancia } from '../../estancia'

type Paso = 'tipo' | 'datos' | 'hecho'

export default function Apuntar({
  categorias,
  nombre = 'Finca',
  volver = '/finca',
  /* Los Helechos pregunta además por el apartamento, y en los
     ingresos por las noches y las personas. La Finca no: no tiene
     apartamentos que separar. */
  conApartamentos = false,
}: {
  categorias: Categoria[]
  /* De qué sección se está apuntando, para decirlo en pantalla. */
  nombre?: string
  volver?: string
  conApartamentos?: boolean
}) {
  const [paso, setPaso] = useState<Paso>('tipo')
  const [tipo, setTipo] = useState<'gasto' | 'ingreso'>('gasto')
  const [importe, setImporte] = useState('')
  const [concepto, setConcepto] = useState('')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [estancia, setEstancia] = useState<Estancia>(ESTANCIA_VACIA)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const opciones = useMemo(
    () => categorias.filter((c) => c.naturaleza === tipo),
    [categorias, tipo]
  )

  function empezar(t: 'gasto' | 'ingreso') {
    setTipo(t)
    setCategoriaId(null)
    setPaso('datos')
  }

  async function guardar() {
    setAviso(null)
    setGuardando(true)

    try {
      const r = await fetch('/api/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          concepto,
          importe,
          fecha,
          categoria_id: categoriaId,
          ...(conApartamentos
            ? {
                apartamento: estancia.apartamento,
                personas: tipo === 'ingreso' ? estancia.personas : null,
                noches: tipo === 'ingreso' ? estancia.noches : null,
                huesped: tipo === 'ingreso' ? estancia.huesped : '',
                referencia: tipo === 'ingreso' ? estancia.referencia : '',
              }
            : {}),
        }),
      })
      const datos = await r.json()

      if (!r.ok) {
        setAviso(datos.error ?? 'No se ha podido apuntar.')
        setGuardando(false)
        return
      }
      setPaso('hecho')
    } catch {
      setAviso('No hay conexión. Inténtalo otra vez.')
    }
    setGuardando(false)
  }

  if (paso === 'hecho') {
    return (
      <main className="flex min-h-screen flex-col justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-verde text-white">
            <Ico nombre="check" tam={40} grosor={2.2} />
          </div>
          <h1 className="mt-8 text-[28px] font-extrabold leading-tight tracking-tight text-tinta">
            Apuntado
          </h1>
          <p className="mt-4 text-lg text-tinta-suave">
            {tipo === 'gasto' ? 'Gasto' : 'Ingreso'} de{' '}
            {importe.replace('.', ',')} € · {concepto}
          </p>

          <div className="mt-12 space-y-4">
            <Link href={volver} className="block rounded-2xl bg-verde px-6 py-5 text-xl font-semibold text-white">
              Ver {nombre}
            </Link>
            <Link
              href={conApartamentos ? '/finca/apuntar?seccion=HELECHOS' : '/finca/apuntar'}
              className="block rounded-2xl border-2 border-borde px-6 py-5 text-xl font-medium text-tinta-suave"
            >
              Apuntar otro
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="techo-holgado min-h-screen px-6 pb-10">
      <div className="mx-auto w-full max-w-md">
        <button
          onClick={() => (paso === 'datos' ? setPaso('tipo') : (window.location.href = volver))}
          className="mb-3 inline-flex h-12 items-center gap-1.5 rounded-full border border-borde bg-superficie pl-3 pr-5 text-[16.5px] font-extrabold text-tinta"
        >
          <Ico nombre="atras" tam={21} grosor={2.6} />
          Volver
        </button>

        {paso === 'tipo' && (
          <>
            <h1 className="mt-4 text-[27px] font-extrabold leading-tight tracking-tight text-tinta">
              ¿Qué quieres apuntar?
            </h1>

            {/* Lo primero, porque es lo que menos trabajo da */}
            <Link
              href="/guardar"
              className="mt-5 flex h-[86px] items-center gap-3.5 rounded-[22px] px-4"
              style={{
              background: 'color-mix(in srgb, #14B8A6 12%, transparent)',
              border: '1px solid color-mix(in srgb, #14B8A6 30%, transparent)',
            }}
            >
              <span className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[14px] bg-superficie text-verde">
                <Ico nombre="foto" tam={25} grosor={2.1} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[18.5px] font-extrabold tracking-tight text-tinta">
                  Tengo el papel
                </span>
                <span className="block text-[14.5px] font-bold leading-snug text-verde">
                  Hazle una foto: leo el importe y lo apunto solo
                </span>
              </span>
              <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-verde" />
            </Link>

            <p className="rotulo mt-6">O apúntalo a mano</p>
            <div className="mt-3 space-y-2.5">
              <button
                onClick={() => empezar('gasto')}
                className="flex h-[68px] w-full items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-4 text-left"
              >
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px]" style={{ background: 'color-mix(in srgb, #FF6B6B 15%, transparent)', color: '#FF6B6B' }}>
                  <Ico nombre="euro" tam={22} grosor={2.1} />
                </span>
                <span className="flex-1 text-[19px] font-extrabold text-tinta">Un gasto</span>
                <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0 text-borde" />
              </button>
              <button
                onClick={() => empezar('ingreso')}
                className="flex h-[68px] w-full items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-4 text-left"
              >
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px]" style={{ background: 'color-mix(in srgb, #14B8A6 15%, transparent)', color: '#14B8A6' }}>
                  <Ico nombre="euro" tam={22} grosor={2.1} />
                </span>
                <span className="flex-1 text-[19px] font-extrabold text-tinta">Un ingreso</span>
                <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0 text-borde" />
              </button>
            </div>

            <p className="mt-5 text-center text-[15px] font-semibold leading-relaxed text-tenue">
              También puedes decírmelo: «apunta 40 € de productos».
            </p>
          </>
        )}

        {paso === 'datos' && (
          <>
            <h1 className="mt-8 text-[27px] font-extrabold leading-tight tracking-tight text-tinta">
              {tipo === 'gasto' ? 'Un gasto' : 'Un ingreso'}
            </h1>

            <label htmlFor="importe" className="mt-10 block text-xl font-medium text-tinta">
              ¿Cuánto?
            </label>
            <div className="mt-3 flex items-center rounded-2xl border-2 border-borde bg-fondo px-5">
              <input
                id="importe"
                inputMode="decimal"
                autoFocus
                value={importe}
                onChange={(e) => setImporte(e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0,00"
                className="w-full bg-transparent py-5 font-titulo text-4xl text-tinta placeholder:text-borde focus:outline-none"
              />
              <span className="font-titulo text-4xl text-tenue">€</span>
            </div>

            <label htmlFor="concepto" className="mt-8 block text-xl font-medium text-tinta">
              ¿De qué?
            </label>
            <input
              id="concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Productos, abono, jornal…"
              className="mt-3 w-full rounded-2xl border-2 border-borde bg-fondo px-5 py-4 text-tinta placeholder:text-tenue focus:border-verde focus:outline-none"
            />

            <p className="mt-8 text-xl font-medium text-tinta">Categoría</p>
            <div className="mt-3 space-y-3">
              {opciones.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoriaId(c.id)}
                  className={`w-full rounded-[20px] border-2 px-6 py-5 text-left text-xl font-medium ${
                    categoriaId === c.id
                      ? 'border-verde bg-verde-suave text-verde'
                      : 'border-borde bg-superficie text-tinta'
                  }`}
                >
                  {categoriaId === c.id ? '✓ ' : ''}
                  {c.nombre}
                </button>
              ))}
            </div>

            {conApartamentos && (
              <CamposEstancia
                valor={estancia}
                cambiar={setEstancia}
                conEstancia={tipo === 'ingreso'}
              />
            )}

            <label htmlFor="fecha" className="mt-8 block text-xl font-medium text-tinta">
              ¿Cuándo?
            </label>
            <input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-3 w-full rounded-2xl border-2 border-borde bg-fondo px-5 py-4 text-tinta focus:border-verde focus:outline-none"
            />

            <button
              onClick={guardar}
              disabled={guardando || !importe || !concepto || !categoriaId}
              className="mt-10 w-full rounded-2xl bg-verde px-6 py-6 text-2xl font-semibold text-white disabled:opacity-40"
            >
              {guardando ? 'Apuntando…' : 'Apuntar'}
            </button>
          </>
        )}

        {aviso && (
          <p className="mt-6 rounded-2xl bg-terracota-suave px-5 py-4 text-lg leading-snug text-terracota">
            {aviso}
          </p>
        )}
      </div>
    </main>
  )
}
