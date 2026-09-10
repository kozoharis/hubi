'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from './iconos'
import { Aviso } from './piezas'
import { api } from '@/lib/api'

/*
  ═══════════════════════════════════════════════════════════════
  LO DE HOY
  ═══════════════════════════════════════════════════════════════

  Lo que toca hoy según el plan de la semana. Se marca aquí mismo, de
  un toque, sin entrar en ningún sitio.

  ─────────────────────────────────────────────────────────────
  SE MARCA ANTES DE QUE EL SERVIDOR CONTESTE

  Quien está limpiando lleva el móvil en la otra mano y a veces sin
  buena cobertura. Si el tic tardara un segundo en aparecer, lo normal
  es volver a tocar — y entonces se desmarca lo que sí estaba hecho.

  Así que se pinta al instante y, si algo falla, se deshace y se dice.
  Nunca al revés: una pantalla que dice «hecho» sin haberlo guardado es
  peor que una que tarda.

  ─────────────────────────────────────────────────────────────
  Y NO SE ORDENA PONIENDO LO HECHO AL FINAL

  Se quedan donde están. Que una cosa salte de sitio justo cuando la
  acabas de tocar hace dudar de si has marcado la que querías — y con
  la lista quieta se sigue con el dedo donde estaba.
*/

export type Deber = {
  id: string
  que: string
  hora: string | null
  hecha: boolean
  /** De quién es, si es de alguien. Nulo = de la casa. */
  deQuien: string | null
}

export default function RutinasHoy({
  rutinas,
  puedeMarcar,
  titulo = 'Lo de hoy',
  /** Cuando es mi propia lista, no hace falta poner mi nombre en cada línea. */
  soloMias = false,
}: {
  rutinas: Deber[]
  puedeMarcar: boolean
  /** «Lo de hoy» cuando es tuyo; «La casa hoy» cuando lo hace otro. */
  titulo?: string
  soloMias?: boolean
}) {
  const router = useRouter()
  const [estado, setEstado] = useState<Record<string, boolean>>({})
  const [fallo, setFallo] = useState<string | null>(null)

  const hecha = (r: Deber) => estado[r.id] ?? r.hecha
  const cuantas = rutinas.filter((r) => hecha(r)).length

  async function marcar(r: Deber) {
    if (!puedeMarcar) return

    const nueva = !hecha(r)
    setEstado((e) => ({ ...e, [r.id]: nueva }))
    setFallo(null)

    const p = await fetch(api('/api/rutinas'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, hecha: nueva }),
    }).catch(() => null)

    const d = p ? ((await p.json().catch(() => null)) as { bien?: boolean } | null) : null

    if (!p?.ok || d?.bien !== true) {
      /* Se deshace. Dejarlo marcado sería mentir en la única pantalla
         donde alguien mira si ya hizo algo. */
      setEstado((e) => ({ ...e, [r.id]: !nueva }))
      setFallo('Mira la cobertura y vuelve a tocarlo. Sigue sin marcar.')
      return
    }

    router.refresh()
  }

  if (rutinas.length === 0) return null

  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="t-seccion">{titulo}</h2>
        {/* Cuántas van. Es lo único que se quiere saber de un vistazo
            a media mañana, y evita contar los tics a ojo. */}
        <span className="t-apoyo shrink-0 tabular-nums">
          {cuantas} de {rutinas.length}
        </span>
      </div>

      <ul className="mt-2.5 space-y-2">
        {rutinas.map((r) => {
          const ya = hecha(r)
          return (
            <li key={r.id}>
              <button
                onClick={() => marcar(r)}
                disabled={!puedeMarcar}
                aria-pressed={ya}
                className="tocable r-tarjeta flex min-h-[64px] w-full items-center gap-3.5 border px-3.5 py-3 text-left transition-colors duration-200 disabled:opacity-100"
                style={{
                  background: ya ? 'var(--t-bien-velo)' : 'var(--t-superficie)',
                  borderColor: ya
                    ? 'color-mix(in srgb, var(--t-bien) 35%, transparent)'
                    : 'var(--t-borde)',
                }}
              >
                {/*
                  La casilla, grande. 44 px: el punto 5 pide botones
                  grandes, y aquí es lo único que hay que acertar.

                  Iba rellena del `#14B8A6` de acción. Pero una cosa
                  hecha no es una acción: es un ESTADO, y el estado
                  bueno tiene su propio color. Con el teal, la mitad
                  de la pantalla de La casa acababa pintada del color
                  que en el resto de HUBI quiere decir «pulsa aquí».
                */}
                <span
                  className="casilla r-campo flex h-[44px] w-[44px] shrink-0 items-center justify-center"
                  style={
                    ya
                      ? { background: 'var(--t-bien)', color: 'var(--t-superficie)' }
                      : {
                          background: 'var(--t-fondo)',
                          color: 'var(--t-tenue)',
                          border: '1px solid var(--t-borde)',
                        }
                  }
                >
                  {ya && (
                    <span className="tic flex">
                      <Ico nombre="check" tam={22} grosor={2.6} />
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`tachable t-cuerpo block transition-opacity duration-300 ${
                      ya ? 'tachable-puesto opacity-55' : ''
                    }`}
                  >
                    {r.que}
                  </span>
                  {(r.hora || (!soloMias && r.deQuien)) && (
                    <span className="t-apoyo mt-0.5 block">
                      {[r.hora?.slice(0, 5), soloMias ? null : r.deQuien]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {fallo && (
        <div className="mt-2.5">
          <Aviso titulo="No se ha podido guardar" explicacion={fallo} />
        </div>
      )}
    </section>
  )
}
