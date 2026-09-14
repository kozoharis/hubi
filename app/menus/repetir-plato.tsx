'use client'

import { useState } from 'react'
import { Aviso, BotonPrincipal, BotonSecundario, Pildora } from '../piezas'
import { api } from '@/lib/api'
import { CADA_SEMANAS, DIAS_DE_LA_SEMANA, MOMENTOS, type Momento } from '@/lib/menus'

/*
  ═══════════════════════════════════════════════════════════════
  UN PLATO QUE VUELVE
  ═══════════════════════════════════════════════════════════════

  Haris: *«poder crearlo en un solo sitio y luego asignarle el día o
  días que se repite en la semana, si es comida o cena y si se repite
  cada semana, cada dos semanas o 3 semanas»*.

  Tres preguntas y ninguna más: **qué días**, **comida o cena**, **cada
  cuánto**. Todo con pastillas que se tocan, sin desplegables y sin
  fechas que escribir — es el punto 5 del planteamiento, formularios
  mínimos.

  ─────────────────────────────────────────────────────────────
  LO QUE SE ESCRIBE Y HASTA DÓNDE

  Tres meses por delante, y luego hay un botón para alargar. El porqué
  —y por qué aquí se hace lo contrario que con las tareas que se
  repiten— está escrito en el sql/81.

  ─────────────────────────────────────────────────────────────
  Y POR QUÉ SE DICE CUÁNTOS SE SALTARON

  Si el viernes ya tenía cena, la tanda lo respeta. Poner «cada
  viernes» y que salgan once de trece sin explicación es la clase de
  silencio que hace dudar de si la pantalla ha hecho algo.
*/

export default function RepetirPlato({
  receta,
  alHecho,
  cerrar,
}: {
  receta: { id: string; titulo: string }
  alHecho: () => void
  cerrar: () => void
}) {
  const [dias, setDias] = useState<number[]>([])
  const [momento, setMomento] = useState<Momento>('comida')
  const [cada, setCada] = useState<1 | 2 | 3>(1)
  const [trabajando, setTrabajando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [parte, setParte] = useState<{ puestos: number; saltados: number } | null>(null)

  async function ponerlo() {
    if (dias.length === 0) return
    setTrabajando(true)
    setAviso(null)

    const r = await fetch(api('/api/menus/plan'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receta_id: receta.id,
        dias,
        momento,
        cada_semanas: cada,
      }),
    })
    const d = (await r.json().catch(() => ({}))) as {
      puestos?: number
      saltados?: number
      sinRepeticion?: boolean
      error?: string
      detalle?: string
    }
    setTrabajando(false)

    if (!r.ok) {
      setAviso(d.detalle ?? d.error ?? 'No se ha podido guardar.')
      return
    }

    setParte({ puestos: d.puestos ?? 0, saltados: d.saltados ?? 0 })
    alHecho()
  }

  // ── Ya está puesto ──
  if (parte) {
    return (
      <div className="mt-2.5 rounded-[20px] border border-borde bg-fondo px-4 py-4">
        <Aviso
          tono={parte.puestos > 0 ? 'bien' : 'atencion'}
          titulo={
            parte.puestos > 0
              ? `${receta.titulo}, ${parte.puestos} ${parte.puestos === 1 ? 'día' : 'días'} puestos`
              : 'No se ha puesto ningún día'
          }
          explicacion={
            parte.saltados > 0
              ? `${parte.saltados} ${parte.saltados === 1 ? 'día ya tenía' : 'días ya tenían'} algo puesto y se ${parte.saltados === 1 ? 'ha dejado' : 'han dejado'} como estaba${parte.saltados === 1 ? '' : 'n'}.`
              : 'Están en el calendario de los próximos tres meses.'
          }
        />
        <div className="mt-3">
          <BotonSecundario onClick={cerrar}>Listo</BotonSecundario>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2.5 rounded-[20px] border border-borde bg-fondo px-4 py-4">
      <p className="rotulo">Que vuelva</p>
      <p className="t-tarjeta mt-0.5">{receta.titulo}</p>

      {/* ── Qué días ── */}
      <p className="rotulo mt-4">¿Qué días?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DIAS_DE_LA_SEMANA.map((d) => (
          <Pildora
            key={d.valor}
            puesta={dias.includes(d.valor)}
            onClick={() =>
              setDias((x) => (x.includes(d.valor) ? x.filter((y) => y !== d.valor) : [...x, d.valor]))
            }
          >
            {d.corto}
          </Pildora>
        ))}
      </div>

      {/* ── Comida o cena ── */}
      <p className="rotulo mt-4">¿Comida o cena?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {MOMENTOS.map((m) => (
          <Pildora key={m.valor} puesta={momento === m.valor} onClick={() => setMomento(m.valor)}>
            {m.texto}
          </Pildora>
        ))}
      </div>

      {/* ── Cada cuánto ── */}
      <p className="rotulo mt-4">¿Cada cuánto?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {CADA_SEMANAS.map((c) => (
          <Pildora key={c.valor} puesta={cada === c.valor} onClick={() => setCada(c.valor)}>
            {c.texto}
          </Pildora>
        ))}
      </div>

      <p className="t-apoyo mt-3 leading-snug">
        Se pone en el calendario de los próximos tres meses. Lo que ya tengáis puesto esos días
        no se toca.
      </p>

      <div className="mt-4 space-y-2.5">
        <BotonPrincipal
          onClick={ponerlo}
          desactivado={trabajando || dias.length === 0}
          porQue={dias.length === 0 ? 'Elige al menos un día.' : undefined}
        >
          {trabajando ? 'Poniéndolo…' : 'Ponerlo en el calendario'}
        </BotonPrincipal>
        <BotonSecundario onClick={cerrar}>Dejarlo</BotonSecundario>
      </div>

      {aviso && (
        <div className="mt-3">
          <Aviso titulo="No se ha podido" explicacion={aviso} />
        </div>
      )}
    </div>
  )
}
