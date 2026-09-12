'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Aviso } from '../../piezas'

export type Cuenta = {
  tipo: string
  nombre: string
  emoji: string
  explica: string
  cuantas: number
  yaDecididas: number
}

/*
  ═══════════════════════════════════════════════════════════════
  SIETE INTERRUPTORES Y UN BOTÓN
  ═══════════════════════════════════════════════════════════════

  Tres decisiones de forma, y las tres salen de las reglas del
  proyecto:

  **No se guarda al tocar cada interruptor.** En el resto de HUBI sí
  —las carpetas, los avisos— porque ahí cada interruptor es una cosa
  independiente. Aquí los siete son UNA decisión, y aplicarla toca
  filas de verdad. Se mira la lista entera, se cuenta lo que va a
  pasar, y se acepta una vez.

  **El número va en la línea.** «Citas médicas · 4 cosas» no es lo
  mismo que «Citas médicas», porque lo primero se puede decidir y lo
  segundo hay que imaginarlo. Es la misma razón por la que la pantalla
  de guardar enseña lo que ha entendido antes de archivar.

  **La forma fuerte se pide aparte, y solo si hace falta.** Volver a
  decidir lo que alguien marcó a mano no puede estar a un toque de
  distancia del botón normal; y si no hay nada marcado a mano, ni
  siquiera se menciona.
*/
export default function Decidir({
  cuentas,
  recados,
  elegidos,
  sinDecidir,
  conRecados,
  hayPantalla,
}: {
  cuentas: Cuenta[]
  recados: number
  elegidos: string[]
  sinDecidir: boolean
  conRecados: boolean
  hayPantalla: boolean
}) {
  const router = useRouter()

  const [puestos, setPuestos] = useState<string[]>(elegidos)
  const [conLosRecados, setConLosRecados] = useState(conRecados)
  const [pisarLoDecidido, setPisarLoDecidido] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  const yaDecididasEnTotal = cuentas.reduce((n, c) => n + c.yaDecididas, 0)

  const seVerian =
    cuentas.filter((c) => puestos.includes(c.tipo)).reduce((n, c) => n + c.cuantas, 0) +
    (conLosRecados ? recados : 0)

  function tocar(tipo: string) {
    setHecho(null)
    setPuestos((p) => (p.includes(tipo) ? p.filter((x) => x !== tipo) : [...p, tipo]))
  }

  async function guardar() {
    setGuardando(true)
    setFallo(null)
    setHecho(null)

    try {
      const r = await fetch(api('/api/cocina'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipos: puestos,
          notas: conLosRecados,
          tambienLoYaDecidido: pisarLoDecidido,
        }),
      })
      const d = (await r.json().catch(() => null)) as {
        bien?: boolean
        error?: string
        cosas?: number
        recados?: number
      } | null

      if (!r.ok || d?.bien !== true) {
        setFallo(d?.error ?? 'No se ha podido guardar.')
        return
      }

      /* Se dice CUÁNTO se ha tocado, no «hecho». Con una decisión que
         cambia filas, una confirmación que no dice qué ha pasado
         obliga a ir a comprobarlo. */
      const n = (d.cosas ?? 0) + (d.recados ?? 0)
      setHecho(
        n === 0
          ? 'Guardado. No había nada pendiente de decidir.'
          : `Guardado. He repasado ${n} ${n === 1 ? 'cosa' : 'cosas'}.`
      )
      setPisarLoDecidido(false)
      router.refresh()
    } catch {
      setFallo('No hay conexión. Inténtalo otra vez.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {/* ── Dónde estamos ── */}
      {!hayPantalla && (
        <div className="mt-4">
          <Aviso
            titulo="Todavía no hay ninguna pantalla en casa"
            explicacion="Esto no cambia nada de lo que ves tú. Deja decidido lo que se verá el día que se cuelgue una, para no tener que decidirlo con ella ya encendida en la pared."
          />
        </div>
      )}

      <p className="t-cuerpo mt-4 leading-relaxed">
        Una pantalla en la cocina la ve <strong>cualquiera que entre</strong>: quien viene a
        arreglar algo, la familia que pasa a comer. Aquí se decide qué sale en ella.
      </p>

      <p className="t-apoyo leading-relaxed">
        Lo que no salga sigue estando en HUBI igual que ahora. Tú y quien viva aquí lo
        seguís viendo todo desde vuestro móvil.
      </p>

      {/* ── Los siete ── */}
      <ul className="space-y-2.5">
        {cuentas.map((c) => {
          const puesto = puestos.includes(c.tipo)
          return (
            <li
              key={c.tipo}
              className="flex items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-4 py-3"
            >
              <span className="text-[26px] leading-none" aria-hidden>
                {c.emoji}
              </span>

              <span className="min-w-0 flex-1">
                <span className="t-cuerpo block font-extrabold">{c.nombre}</span>
                <span className="t-apoyo mt-0.5 block">
                  {c.explica}
                  {c.cuantas > 0 && ` · ${c.cuantas} ${c.cuantas === 1 ? 'cosa' : 'cosas'}`}
                </span>
              </span>

              <button
                onClick={() => tocar(c.tipo)}
                role="switch"
                aria-checked={puesto}
                aria-label={`${puesto ? 'Quitar' : 'Poner'} ${c.nombre} en la pantalla de la cocina`}
                className="relative h-[34px] w-[58px] shrink-0 rounded-full transition"
                style={{ background: puesto ? 'var(--t-boton)' : 'var(--t-borde)' }}
              >
                <span
                  className="absolute top-[3px] h-[28px] w-[28px] rounded-full bg-white transition-all"
                  style={{ left: puesto ? 27 : 3 }}
                />
              </button>
            </li>
          )
        })}

        {/* Los recados del tablón no tienen tipo: es un sí o un no. */}
        <li className="flex items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-4 py-3">
          <span className="text-[26px] leading-none" aria-hidden>
            📌
          </span>
          <span className="min-w-0 flex-1">
            <span className="t-cuerpo block font-extrabold">Los recados del tablón</span>
            <span className="t-apoyo mt-0.5 block">
              Lo que os dejáis escrito
              {recados > 0 && ` · ${recados} ${recados === 1 ? 'recado' : 'recados'}`}
            </span>
          </span>
          <button
            onClick={() => {
              setHecho(null)
              setConLosRecados((v) => !v)
            }}
            role="switch"
            aria-checked={conLosRecados}
            aria-label={`${conLosRecados ? 'Quitar' : 'Poner'} los recados en la pantalla de la cocina`}
            className="relative h-[34px] w-[58px] shrink-0 rounded-full transition"
            style={{ background: conLosRecados ? 'var(--t-boton)' : 'var(--t-borde)' }}
          >
            <span
              className="absolute top-[3px] h-[28px] w-[28px] rounded-full bg-white transition-all"
              style={{ left: conLosRecados ? 27 : 3 }}
            />
          </button>
        </li>
      </ul>

      {/* ── Lo que va a verse, en grande ── */}
      <div className="rounded-[24px] bg-superficie px-6 py-5">
        <p className="rotulo">En la cocina se verían</p>
        <p className="mt-1.5 text-[34px] font-extrabold leading-none tabular-nums">
          {seVerian} {seVerian === 1 ? 'cosa' : 'cosas'}
        </p>
        <p className="t-apoyo mt-2 leading-snug">
          de las {cuentas.reduce((n, c) => n + c.cuantas, 0) + recados} que hay ahora mismo.
        </p>
      </div>

      {sinDecidir && (
        <p className="t-apoyo px-1 leading-snug">
          Esto todavía no está guardado: es lo que HUBI propone. Mientras no lo guardes, la
          pantalla de la cocina no enseñaría <strong className="text-tinta">nada</strong>.
        </p>
      )}

      {/* ── La forma fuerte, solo si hay algo que pisar ── */}
      {yaDecididasEnTotal > 0 && (
        <div className="rounded-[20px] border border-borde px-4 py-3.5">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={pisarLoDecidido}
              onChange={(e) => {
                setHecho(null)
                setPisarLoDecidido(e.target.checked)
              }}
              className="mt-1 h-6 w-6 shrink-0"
            />
            <span className="min-w-0">
              <span className="t-cuerpo block font-extrabold">Volver a decidirlo todo</span>
              <span className="t-apoyo mt-0.5 block leading-snug">
                Hay {yaDecididasEnTotal}{' '}
                {yaDecididasEnTotal === 1 ? 'cosa decidida' : 'cosas decididas'} una por una
                desde su propia ficha. Normalmente <strong className="text-tinta">se
                respetan</strong>. Marca esto solo si quieres empezar de cero.
              </span>
            </span>
          </label>
        </div>
      )}

      {fallo && (
        <Aviso titulo="No se ha podido guardar" explicacion={fallo} />
      )}

      {hecho && (
        <div className="rounded-[20px] bg-superficie px-5 py-4">
          <p className="t-cuerpo font-extrabold text-verde">{hecho}</p>
        </div>
      )}

      <button
        onClick={guardar}
        disabled={guardando}
        className="r-campo w-full bg-boton px-6 py-5 text-[19px] font-extrabold text-fondo disabled:opacity-50"
      >
        {guardando ? 'Guardando…' : 'Así está bien'}
      </button>
    </div>
  )
}
