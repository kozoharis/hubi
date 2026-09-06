'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import { enHoras } from '@/lib/dia'

/*
  ═══════════════════════════════════════════════════════════════
  EL PARTE DEL DÍA
  ═══════════════════════════════════════════════════════════════

  Cuántas horas ha estado y qué tiene que decir de ese día.

  ─────────────────────────────────────────────────────────────
  LO ESCRIBE ELLA. A LOS DEMÁS SE LES ENSEÑA.

  No es una cortesía de la pantalla: las políticas del SQL 40 dicen
  exactamente lo mismo, así que si aquí saliera un formulario para la
  familia, fallaría al guardar y nadie entendería por qué.

  Y es lo único que hace que el número valga algo a fin de mes. Un
  parte que el empleador puede escribir no es el parte de ella.

  ─────────────────────────────────────────────────────────────
  Y SE DICE LO QUE ES, EN LA PANTALLA

  «Apuntes para cuadrar el mes», no un registro de jornada. Un
  registro de jornada tiene requisitos legales que HUBI no cumple, y
  dejar que alguien crea que sí los cumple sería lo peor que podemos
  hacer aquí.

  ─────────────────────────────────────────────────────────────
  LAS HORAS, A TOQUES

  Un campo numérico en un móvil, con el teclado tapando media
  pantalla, para escribir «7,5». Los botones de −½ y +½ lo resuelven
  sin teclado y sin errores: nadie apunta 75 horas por un dedo gordo.
*/

export default function Parte({
  deQuien,
  color,
  fecha,
  esHoy,
  mio,
  parte,
  horasDelMes,
  diasDelMes,
}: {
  deQuien: string
  color: string
  fecha: string
  esHoy: boolean
  /** ¿Es mi parte? Solo entonces se puede escribir. */
  mio: boolean
  parte: { horas: number | null; nota: string | null }
  horasDelMes: number
  diasDelMes: number
}) {
  const router = useRouter()

  const [horas, setHoras] = useState<number | null>(parte.horas)
  const [nota, setNota] = useState(parte.nota ?? '')
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  const cambiado = horas !== parte.horas || nota !== (parte.nota ?? '')

  function mover(paso: number) {
    setGuardado(false)
    setHoras((h) => {
      const n = Math.round(((h ?? 0) + paso) * 4) / 4
      return n <= 0 ? null : Math.min(24, n)
    })
  }

  async function guardar() {
    setFallo(null)
    setOcupado(true)

    const r = await fetch('/api/dia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, horas, nota: nota.trim() || null }),
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

    setGuardado(true)
    setAbierto(false)
    router.refresh()
  }

  // ── Lo que ve la familia: el parte, sin poder tocarlo ────
  if (!mio) {
    return (
      <section className="mt-6">
        <h2 className="rotulo">El día de {deQuien}</h2>

        {parte.horas == null && !parte.nota ? (
          <p className="mt-2.5 rounded-[20px] border border-borde bg-superficie px-4 py-4 text-[16px] font-semibold leading-snug text-tenue">
            {esHoy
              ? `${deQuien} todavía no ha apuntado nada de hoy.`
              : `${deQuien} no apuntó nada ese día.`}
          </p>
        ) : (
          <div className="mt-2.5 rounded-[20px] border border-borde bg-superficie px-4 py-4">
            {parte.horas != null && (
              <p className="text-[26px] font-extrabold leading-none tracking-tight" style={{ color }}>
                {enHoras(parte.horas)}
              </p>
            )}
            {parte.nota && (
              <p className="mt-2.5 whitespace-pre-wrap text-[16.5px] font-semibold leading-snug">
                {parte.nota}
              </p>
            )}
            <p className="mt-3 border-t border-borde pt-2.5 text-[13.5px] font-semibold leading-snug text-tenue">
              Lo apunta {deQuien}. Tú lo ves y no lo puedes cambiar.
            </p>
          </div>
        )}

        {horasDelMes > 0 && <DelMes horas={horasDelMes} dias={diasDelMes} color={color} />}
      </section>
    )
  }

  // ── Y lo que ve ella: su parte, para escribirlo ─────────
  return (
    <section className="mt-6">
      <h2 className="rotulo">Tu día</h2>

      {!abierto ? (
        <button
          onClick={() => setAbierto(true)}
          className="mt-2.5 flex w-full items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-4 py-4 text-left"
        >
          <span
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[15px]"
            style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
          >
            <Ico nombre="reloj" tam={23} grosor={2.1} />
          </span>
          <span className="min-w-0 flex-1">
            {parte.horas == null && !parte.nota ? (
              <>
                <span className="block text-[17.5px] font-extrabold tracking-tight">
                  Apuntar tus horas
                </span>
                <span className="mt-0.5 block text-[14.5px] font-bold text-tenue">
                  Y lo que quieras contar del día
                </span>
              </>
            ) : (
              <>
                <span className="block text-[17.5px] font-extrabold tracking-tight">
                  {parte.horas != null ? enHoras(parte.horas) : 'Sin horas'}
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
            {esHoy ? '¿Cuántas horas has estado hoy?' : '¿Cuántas horas estuviste?'}
          </p>

          {/* Media hora arriba y media abajo. Sin teclado: en un móvil,
              con el teclado tapando media pantalla, escribir «7,5» es
              donde se cuelan los errores. */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => mover(-0.5)}
              disabled={ocupado || horas == null}
              aria-label="Media hora menos"
              className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[16px] border border-borde text-[26px] font-light leading-none text-tinta-suave disabled:opacity-40"
            >
              −
            </button>
            <span className="flex h-[58px] flex-1 items-center justify-center rounded-[16px] border border-borde text-[24px] font-extrabold tracking-tight">
              {horas == null ? <span className="text-tenue">Sin apuntar</span> : enHoras(horas)}
            </span>
            <button
              onClick={() => mover(0.5)}
              disabled={ocupado}
              aria-label="Media hora más"
              className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[16px] border border-borde text-[26px] font-light leading-none text-tinta-suave disabled:opacity-40"
            >
              +
            </button>
          </div>

          {/* Los de siempre, de un toque. Cuatro, seis y ocho horas
              cubren casi todos los días de casi todas las casas. */}
          <div className="mt-2 flex gap-2">
            {[2, 4, 6, 8].map((h) => (
              <button
                key={h}
                onClick={() => {
                  setGuardado(false)
                  setHoras(h)
                }}
                className="h-[44px] flex-1 rounded-[13px] text-[15.5px] font-extrabold"
                style={
                  horas === h
                    ? { background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }
                    : {
                        background: 'var(--t-fondo)',
                        color: 'var(--t-tenue)',
                        border: '1px solid var(--t-borde)',
                      }
                }
              >
                {h} h
              </button>
            ))}
          </div>

          <label htmlFor="nota" className="mt-5 block text-[17px] font-extrabold leading-snug">
            ¿Algo que contar? <span className="font-bold text-tenue">· si quieres</span>
          </label>
          <textarea
            id="nota"
            value={nota}
            onChange={(e) => {
              setGuardado(false)
              setNota(e.target.value)
            }}
            rows={3}
            maxLength={600}
            placeholder="No pude planchar, no había plancha. Me quedé una hora más."
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
                setHoras(parte.horas)
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

      {guardado && !abierto && (
        <p className="mt-2 text-[14.5px] font-bold text-verde">Guardado.</p>
      )}

      {horasDelMes > 0 && <DelMes horas={horasDelMes} dias={diasDelMes} color={color} />}

      {/*
        SE DICE LO QUE ES. Y se dice aquí, donde se escribe.

        Llamar a esto «registro de jornada» sería mentir: un registro
        de jornada tiene requisitos legales que HUBI no cumple. Dejar
        que alguien crea que sí los cumple es lo peor que podríamos
        hacer en esta pantalla.
      */}
      <p className="mt-3 rounded-[16px] border border-borde px-4 py-3 text-[14px] font-semibold leading-snug text-tenue">
        Esto son apuntes para cuadrar el mes entre vosotros, no un registro de jornada
        oficial. Los escribes tú y nadie más los puede cambiar.
      </p>
    </section>
  )
}

/*
  Lo que lleva del mes.

  Es el número por el que se hace todo esto: nadie apunta horas por
  gusto, se apuntan para que a fin de mes los dos miren lo mismo.
*/
function DelMes({ horas, dias, color }: { horas: number; dias: number; color: string }) {
  return (
    <div className="mt-2.5 flex items-center gap-3.5 rounded-[20px] border border-borde px-4 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold text-tenue">Este mes</span>
        <span className="mt-0.5 block text-[22px] font-extrabold leading-tight tracking-tight">
          {enHoras(horas)}
        </span>
      </span>
      <span className="shrink-0 text-[14.5px] font-bold" style={{ color }}>
        {dias === 1 ? '1 día' : `${dias} días`}
      </span>
    </div>
  )
}
