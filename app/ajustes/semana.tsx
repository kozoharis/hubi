'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import { DIAS, DE_SIEMPRE, type Rutina } from '@/lib/rutinas'

/*
  ═══════════════════════════════════════════════════════════════
  EL PLAN DE LA SEMANA DE UNA PERSONA
  ═══════════════════════════════════════════════════════════════

  ─────────────────────────────────────────────────────────────
  PRIMERO LOS DÍAS QUE VIENE. TODO LO DEMÁS CUELGA DE AHÍ

  Si viene lunes, miércoles y viernes, ofrecerle trabajos en martes es
  ofrecerle trabajos que no va a hacer nadie. Se pregunta una vez, y a
  partir de ahí los días que no vienen ni se enseñan.

  ─────────────────────────────────────────────────────────────
  Y LA LISTA VIENE PUESTA, NO EN BLANCO

  Una pantalla que dice «añade tu primera rutina» no la rellena casi
  nadie: obliga a pensarlas todas de golpe y a escribirlas una a una,
  y eso se deja para luego y luego no llega.

  Con la lista delante se toca lo que valga y se quita lo que no —
  mucho más fácil que inventar de cero. No son las de nadie en
  concreto: son las que aparecen en cualquier casa, y valen como punto
  de partida, no como plantilla que haya que respetar. Cualquiera se
  quita, y se añade lo que falte.

  ─────────────────────────────────────────────────────────────
  SE GUARDA EL PLAN ENTERO DE UNA VEZ

  Aquí se marcan y se desmarcan diez casillas antes de dar a guardar.
  Mandar cada cambio por separado serían quince peticiones y quince
  maneras de quedarse a medias, con medio plan puesto y medio no, sin
  que nadie lo note.
*/

type Trabajo = { que: string; dias: number[] }

export default function Semana({
  quienEs,
  para,
  plan,
  alCerrar,
}: {
  /** Su nombre de pila, para que la pantalla hable de ella. */
  quienEs: string
  /** De quién es el plan. Nulo = de la casa. */
  para: string | null
  /** Lo que ya hay guardado. */
  plan: Rutina[]
  alCerrar: () => void
}) {
  const router = useRouter()

  /* Lo guardado se convierte en la forma que usa esta pantalla: una
     línea por trabajo con los días que le tocan, en vez de una fila
     por día como está en la base de datos. Es lo mismo, contado como
     lo cuenta una persona. */
  const dePartida: Trabajo[] = (() => {
    if (plan.length === 0) return DE_SIEMPRE.map((t) => ({ ...t, dias: [] }))

    const juntos = new Map<string, number[]>()
    for (const r of plan) juntos.set(r.que, [...(juntos.get(r.que) ?? []), r.dia])

    const suyos = [...juntos.entries()].map(([que, dias]) => ({ que, dias }))
    /* Y detrás, las de siempre que todavía no tenga, por si quiere
       añadir alguna sin escribirla. */
    const yaEstan = new Set(suyos.map((t) => t.que))
    return [...suyos, ...DE_SIEMPRE.filter((t) => !yaEstan.has(t.que)).map((t) => ({ ...t, dias: [] }))]
  })()

  const [trabajos, setTrabajos] = useState<Trabajo[]>(dePartida)
  const [viene, setViene] = useState<number[]>(() => {
    const puestos = [...new Set(plan.map((r) => r.dia))].sort()
    return puestos.length > 0 ? puestos : [1, 2, 3, 4, 5]
  })
  const [nuevo, setNuevo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  function tocarDia(d: number) {
    setViene((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d].sort()))
    /* Y se limpia de los trabajos: dejar marcado el martes en cinco
       trabajos de alguien que ya no viene los martes es guardar un
       plan que no existe. */
    setTrabajos((ts) => ts.map((t) => ({ ...t, dias: t.dias.filter((x) => x !== d || !viene.includes(d)) })))
  }

  function tocar(i: number, d: number) {
    setTrabajos((ts) =>
      ts.map((t, j) =>
        j === i
          ? { ...t, dias: t.dias.includes(d) ? t.dias.filter((x) => x !== d) : [...t.dias, d].sort() }
          : t
      )
    )
  }

  function anadir() {
    const que = nuevo.trim().slice(0, 80)
    if (que.length < 2) return
    setTrabajos((ts) => [...ts, { que, dias: [] }])
    setNuevo('')
  }

  async function guardar() {
    setFallo(null)
    setOcupado(true)

    /* Se despliega: una fila por trabajo y día, que es como vive en la
       base de datos. Aquí se junta por trabajo porque es como lo
       piensa una persona; allí se separa porque es como se consulta
       «qué toca hoy». */
    const rutinas = trabajos.flatMap((t) =>
      t.dias.filter((d) => viene.includes(d)).map((d) => ({ que: t.que, dia: d }))
    )

    const r = await fetch('/api/rutinas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ para, rutinas }),
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

    alCerrar()
    router.refresh()
  }

  const cuantas = trabajos.reduce(
    (n, t) => n + t.dias.filter((d) => viene.includes(d)).length,
    0
  )

  return (
    <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
      <p className="text-[17px] font-extrabold leading-snug">La semana de {quienEs}</p>

      {/* ── Qué días viene ── */}
      <p className="mt-4 text-[16px] font-extrabold leading-snug">¿Qué días viene?</p>
      <div className="mt-2.5 flex gap-1.5">
        {DIAS.map((d) => {
          const puesto = viene.includes(d.n)
          return (
            <button
              key={d.n}
              onClick={() => tocarDia(d.n)}
              aria-pressed={puesto}
              aria-label={d.largo}
              className="h-12 flex-1 rounded-[13px] text-[16px] font-extrabold"
              style={
                puesto
                  ? { background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }
                  : {
                      background: 'var(--t-fondo)',
                      color: 'var(--t-tenue)',
                      border: '1px solid var(--t-borde)',
                    }
              }
            >
              {d.corto}
            </button>
          )
        })}
      </div>

      {/* ── Y qué hace cada día ── */}
      <p className="mt-5 text-[16px] font-extrabold leading-snug">¿Y qué hace cada día?</p>
      <p className="mt-1 text-[14.5px] font-semibold leading-snug text-tenue">
        Toca los días de cada cosa. Lo que dejes sin marcar no se guarda.
      </p>

      <ul className="mt-3 space-y-2">
        {trabajos.map((t, i) => (
          <li key={`${t.que}-${i}`} className="rounded-[16px] border border-borde px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[16px] font-bold">{t.que}</span>
              <button
                onClick={() => setTrabajos((ts) => ts.filter((_, j) => j !== i))}
                aria-label={`Quitar ${t.que}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center text-[22px] font-light leading-none text-tenue"
              >
                ×
              </button>
            </div>
            <div className="mt-2 flex gap-1.5">
              {DIAS.filter((d) => viene.includes(d.n)).map((d) => {
                const puesto = t.dias.includes(d.n)
                return (
                  <button
                    key={d.n}
                    onClick={() => tocar(i, d.n)}
                    aria-pressed={puesto}
                    aria-label={`${t.que}, ${d.largo}`}
                    className="h-10 flex-1 rounded-[11px] text-[14.5px] font-extrabold"
                    style={
                      puesto
                        ? { background: 'var(--t-tinta)', color: 'var(--t-fondo)' }
                        : {
                            background: 'var(--t-fondo)',
                            color: 'var(--t-tenue)',
                            border: '1px solid var(--t-borde)',
                          }
                    }
                  >
                    {d.corto}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ul>

      {/* ── Añadir una que no esté ── */}
      <div className="mt-3 flex gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') anadir()
          }}
          placeholder="Otra cosa que haga"
          maxLength={80}
          className="entrada flex-1"
        />
        <button
          onClick={anadir}
          disabled={nuevo.trim().length < 2}
          aria-label="Añadir"
          className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[16px] border border-borde text-tinta-suave disabled:opacity-40"
        >
          <Ico nombre="mas" tam={22} grosor={2.4} />
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={guardar}
          disabled={ocupado}
          className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-accion text-[17px] font-extrabold text-accion-tinta disabled:opacity-50"
        >
          <Ico nombre="check" tam={19} grosor={2.3} />
          {ocupado ? 'Guardando…' : `Guardar · ${cuantas}`}
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
