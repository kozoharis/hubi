'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import { enHoras } from '@/lib/dia'

/*
  ═══════════════════════════════════════════════════════════════
  LAS HORAS DE MÁS
  ═══════════════════════════════════════════════════════════════

  ─────────────────────────────────────────────────────────────
  LO NORMAL NO SE APUNTA. ESTO ES LO QUE CAMBIA TODO.

  Aquí antes se preguntaba «¿cuántas horas has estado hoy?», y estaba
  mal planteado. El horario está acordado —viene lunes, miércoles y
  viernes de nueve a una— y eso no cambia: pedirle que lo escriba cada
  día es dar trabajo a cambio de un dato que ya saben los dos.

  Lo que hay que apuntar es lo que se SALE de lo acordado: el día que
  se quedó una hora más. Eso es lo que a fin de mes hay que cuadrar, y
  es justo lo que se olvida.

  Y el efecto es el que importa: el estado normal pasa a ser NO
  ESCRIBIR NADA. Un campo que hay que rellenar todos los días se
  rellena mal a la tercera semana; uno que solo se toca los días raros
  se toca los días raros.

  ─────────────────────────────────────────────────────────────
  LO ESCRIBE ELLA. A LOS DEMÁS SE LES ENSEÑA.

  No es una cortesía de la pantalla: las políticas del SQL 41 dicen
  exactamente lo mismo, así que si aquí saliera un formulario para la
  familia, fallaría al guardar y nadie entendería por qué.

  Es lo único que hace que el número valga algo. Un parte que el
  empleador puede escribir no es el parte de ella.

  ─────────────────────────────────────────────────────────────
  Y SE DICE LO QUE ES, EN LA PANTALLA

  «Apuntes para cuadrar el mes», no un registro de jornada. Un
  registro de jornada tiene requisitos legales que HUBI no cumple, y
  dejar que alguien crea que sí los cumple sería lo peor que podemos
  hacer aquí.
*/

export default function Parte({
  deQuien,
  color,
  fecha,
  esHoy,
  mio,
  parte,
  extraDelMes,
  diasConExtra,
}: {
  deQuien: string
  color: string
  fecha: string
  esHoy: boolean
  /** ¿Es mi parte? Solo entonces se puede escribir. */
  mio: boolean
  parte: { extra: number | null; nota: string | null }
  extraDelMes: number
  diasConExtra: number
}) {
  const router = useRouter()

  const [extra, setExtra] = useState<number | null>(parte.extra)
  const [nota, setNota] = useState(parte.nota ?? '')
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const cambiado = extra !== parte.extra || nota !== (parte.nota ?? '')
  const diaNormal = parte.extra == null && !parte.nota

  function mover(paso: number) {
    setExtra((h) => {
      const n = Math.round(((h ?? 0) + paso) * 4) / 4
      return n <= 0 ? null : Math.min(12, n)
    })
  }

  async function guardar() {
    setFallo(null)
    setOcupado(true)

    const r = await fetch('/api/dia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, extra, nota: nota.trim() || null }),
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

    setAbierto(false)
    router.refresh()
  }

  // ══ Lo que ve la familia: el parte, sin poder tocarlo ══════
  if (!mio) {
    return (
      <section className="mt-6">
        <h2 className="rotulo">El día de {deQuien}</h2>

        {diaNormal ? (
          /* Un día sin nada apuntado NO es un día sin información: es
             un día normal, que es la mayoría. Se dice así en vez de
             dejar un hueco que parece que falta algo. */
          <p className="mt-2.5 rounded-[20px] border border-borde bg-superficie px-4 py-4 text-[16px] font-semibold leading-snug text-tenue">
            Un día normal. Sin horas de más.
          </p>
        ) : (
          <div className="mt-2.5 rounded-[20px] border border-borde bg-superficie px-4 py-4">
            {parte.extra != null && (
              <>
                <p className="text-[14.5px] font-bold text-tenue">Horas de más</p>
                <p
                  className="mt-0.5 text-[28px] font-extrabold leading-none tracking-tight"
                  style={{ color }}
                >
                  +{enHoras(parte.extra)}
                </p>
              </>
            )}
            {parte.nota && (
              <p
                className={`whitespace-pre-wrap text-[16.5px] font-semibold leading-snug ${
                  parte.extra != null ? 'mt-3' : ''
                }`}
              >
                {parte.nota}
              </p>
            )}
            <p className="mt-3 border-t border-borde pt-2.5 text-[13.5px] font-semibold leading-snug text-tenue">
              Lo apunta {deQuien}. Tú lo ves y no lo puedes cambiar.
            </p>
          </div>
        )}

        <DelMes horas={extraDelMes} dias={diasConExtra} color={color} deQuien={deQuien} />
      </section>
    )
  }

  // ══ Y lo que ve ella: su parte, para escribirlo ═══════════
  return (
    <section className="mt-6">
      <h2 className="rotulo">Tu día</h2>

      {!abierto ? (
        <button
          onClick={() => setAbierto(true)}
          className="mt-2.5 flex w-full items-center gap-3.5 rounded-[20px] border px-4 py-4 text-left"
          style={
            diaNormal
              ? { borderColor: 'var(--t-borde)', background: 'var(--t-superficie)' }
              : {
                  borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
                  background: `color-mix(in srgb, ${color} 10%, var(--t-superficie))`,
                }
          }
        >
          <span
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[15px]"
            style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
          >
            <Ico nombre="reloj" tam={23} grosor={2.1} />
          </span>
          <span className="min-w-0 flex-1">
            {diaNormal ? (
              <>
                <span className="block text-[17.5px] font-extrabold tracking-tight">
                  ¿Has hecho horas de más?
                </span>
                <span className="mt-0.5 block text-[14.5px] font-bold text-tenue">
                  {esHoy ? 'Si no, no hace falta que pongas nada' : 'Si aquel día te quedaste más'}
                </span>
              </>
            ) : (
              <>
                <span className="block text-[17.5px] font-extrabold tracking-tight">
                  {parte.extra != null ? `+${enHoras(parte.extra)}` : 'Sin horas de más'}
                </span>
                <span className="mt-0.5 block truncate text-[14.5px] font-bold text-tenue">
                  {parte.nota ?? 'Toca para cambiarlo'}
                </span>
              </>
            )}
          </span>
          <Ico nombre="lapiz" tam={19} grosor={2.2} className="shrink-0 text-tinta-suave" />
        </button>
      ) : (
        <div className="mt-2.5 rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <p className="text-[17px] font-extrabold leading-snug">
            {esHoy ? '¿Cuántas horas de más hoy?' : '¿Cuántas horas de más aquel día?'}
          </p>
          <p className="mt-1 text-[14.5px] font-semibold leading-snug text-tenue">
            Solo lo que se salga de tu horario. Un día normal se deja en blanco.
          </p>

          {/*
            Los de siempre, de un toque. Media hora, una y dos cubren
            casi todos los casos reales; para lo demás están los
            botones de arriba y abajo.
          */}
          <div className="mt-3 flex gap-2">
            {[0.5, 1, 2].map((h) => (
              <button
                key={h}
                onClick={() => setExtra(extra === h ? null : h)}
                aria-pressed={extra === h}
                className="h-[54px] flex-1 rounded-[14px] text-[16.5px] font-extrabold"
                style={
                  extra === h
                    ? { background: color, color: '#FFFFFF' }
                    : {
                        background: 'var(--t-fondo)',
                        color: 'var(--t-tenue)',
                        border: '1px solid var(--t-borde)',
                      }
                }
              >
                +{enHoras(h)}
              </button>
            ))}
          </div>

          {/* Media hora arriba y media abajo. Sin teclado: en un móvil,
              con el teclado tapando media pantalla, escribir «1,5» es
              donde se cuelan los errores. */}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => mover(-0.5)}
              disabled={ocupado || extra == null}
              aria-label="Media hora menos"
              className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[14px] border border-borde text-[26px] font-light leading-none text-tinta-suave disabled:opacity-40"
            >
              −
            </button>
            <span className="flex h-[54px] flex-1 items-center justify-center rounded-[14px] border border-borde text-[22px] font-extrabold tracking-tight">
              {extra == null ? (
                <span className="text-[17px] text-tenue">Ninguna</span>
              ) : (
                `+${enHoras(extra)}`
              )}
            </span>
            <button
              onClick={() => mover(0.5)}
              disabled={ocupado}
              aria-label="Media hora más"
              className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[14px] border border-borde text-[26px] font-light leading-none text-tinta-suave disabled:opacity-40"
            >
              +
            </button>
          </div>

          <label htmlFor="nota" className="mt-5 block text-[17px] font-extrabold leading-snug">
            ¿Algo que contar? <span className="font-bold text-tenue">· si quieres</span>
          </label>
          <textarea
            id="nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            maxLength={600}
            placeholder="No pude planchar, no había plancha."
            className="entrada mt-2.5 min-h-[92px] py-3 leading-snug"
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={guardar}
              disabled={ocupado || !cambiado}
              className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-boton text-[17px] font-extrabold text-boton-texto disabled:opacity-50"
            >
              <Ico nombre="check" tam={19} grosor={2.3} />
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={() => {
                setExtra(parte.extra)
                setNota(parte.nota ?? '')
                setAbierto(false)
              }}
              disabled={ocupado}
              className="h-[56px] flex-1 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave disabled:opacity-50"
            >
              Dejarlo
            </button>
          </div>

          {fallo && (
            <p className="mt-3 rounded-[16px] bg-coral-suave px-4 py-3 text-[15.5px] font-semibold text-coral">
              {fallo}
            </p>
          )}
        </div>
      )}

      <DelMes horas={extraDelMes} dias={diasConExtra} color={color} />

      <p className="mt-3 rounded-[16px] border border-borde px-4 py-3 text-[14px] font-semibold leading-snug text-tenue">
        Esto son apuntes para cuadrar el mes entre vosotros, no un registro de jornada
        oficial. Los escribes tú y nadie más los puede cambiar.
      </p>
    </section>
  )
}

/*
  Lo que lleva de horas de más este mes.

  Es el número por el que existe todo esto: nadie apunta horas por
  gusto, se apuntan para que a fin de mes los dos miren lo mismo.

  Con cero NO se enseña un cero grande: un mes sin horas de más es un
  mes normal, no un resultado. Se dice en una línea y ya.
*/
function DelMes({
  horas,
  dias,
  color,
  deQuien,
}: {
  horas: number
  dias: number
  color: string
  deQuien?: string
}) {
  if (horas <= 0) {
    return (
      <p className="mt-2.5 px-1 text-[14.5px] font-semibold leading-snug text-tenue">
        Este mes no hay horas de más apuntadas
        {deQuien ? ` por ${deQuien}` : ''}.
      </p>
    )
  }

  return (
    <div
      className="mt-2.5 flex items-center gap-3.5 rounded-[20px] border px-4 py-3.5"
      style={{
        borderColor: `color-mix(in srgb, ${color} 34%, transparent)`,
        background: `color-mix(in srgb, ${color} 9%, transparent)`,
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold text-tenue">Horas de más este mes</span>
        <span className="mt-0.5 block text-[24px] font-extrabold leading-tight tracking-tight">
          +{enHoras(horas)}
        </span>
      </span>
      <span className="shrink-0 text-[14.5px] font-bold" style={{ color }}>
        {dias === 1 ? '1 día' : `${dias} días`}
      </span>
    </div>
  )
}
