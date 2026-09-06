'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'

/*
  ═══════════════════════════════════════════════════════════════
  LA CONVERSACIÓN CON EL ASESOR
  ═══════════════════════════════════════════════════════════════

  ─────────────────────────────────────────────────────────────
  NO ES UN CHAT, Y SE NOTA A PROPÓSITO

  Un chat pide contestar. Esto no: son avisos que se dejan y se leen
  cuando toca, como el punto 16 decidió para el tablón. Por eso no hay
  burbujas apretadas ni «escribiendo…»: son tarjetas grandes, con la
  fecha en palabras y sitio de sobra.

  Lo suyo lleva SU color y una barra a la izquierda. Lo tuyo va en
  gris, sin barra. Es todo lo que hace falta para saber de quién es
  cada cosa sin leer ninguna firma.

  ─────────────────────────────────────────────────────────────
  LAS TAREAS SE VEN, PERO NO SE TOCAN DESDE AQUÍ

  Una tarea que él te pone sale en esta lista para que te enteres, y
  se abre en la Agenda, que es donde vive. Marcarla hecha desde dos
  sitios distintos es la manera de que un día uno de los dos se quede
  sin enterar.
*/

export type Cosa = {
  clase: 'nota' | 'tarea'
  id: string
  texto: string
  /** La ha dejado él. Si no, la has dejado tú. */
  suya: boolean
  cuando: string
  /** Para ordenar. No se enseña. */
  orden: string
  vista: boolean
  fecha: string | null
  hecha: boolean
}

export default function Hilo({
  cosas,
  paraQuien,
  comoSeLlama,
  color,
  soyElAsesor,
}: {
  cosas: Cosa[]
  paraQuien: string
  comoSeLlama: string
  color: string
  soyElAsesor: boolean
}) {
  const router = useRouter()

  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function mandar() {
    const limpio = texto.trim()
    if (limpio.length < 2) return

    setFallo(null)
    setOcupado(true)

    const r = await fetch('/api/notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: limpio, para: paraQuien }),
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
          ? [d.error ?? 'No se ha podido enviar.', d.detalle].filter(Boolean).join(' · ')
          : 'HUBI no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return
    }

    setTexto('')
    router.refresh()
  }

  return (
    <>
      {/* ── Escribirle ── */}
      {/*
        Arriba y abierta, no detrás de un «+». Escribir es lo que se
        viene a hacer aquí la mitad de las veces, y esconderlo detrás
        de un botón convierte cinco segundos en tres toques.
      */}
      <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
        <label htmlFor="paraEl" className="block text-[17px] font-extrabold leading-snug">
          {soyElAsesor ? `Dejarles un aviso` : `Escribirle a ${comoSeLlama}`}
        </label>
        <textarea
          id="paraEl"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder={
            soyElAsesor
              ? 'Falta la factura de septiembre…'
              : 'Te he subido las facturas del trimestre…'
          }
          className="entrada mt-2.5 min-h-[92px] py-3 leading-snug"
        />
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={mandar}
            disabled={ocupado || texto.trim().length < 2}
            className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-boton text-[17px] font-extrabold text-boton-texto disabled:opacity-50"
          >
            <Ico nombre="check" tam={19} grosor={2.3} />
            {ocupado ? 'Enviando…' : 'Enviar'}
          </button>
          {/* Poner una fecha es otra cosa y vive en la Agenda. Aquí
              solo el enlace: duplicar el formulario de tareas sería
              duplicar también sus fallos. */}
          <Link
            href="/tablon/nuevo"
            className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-[16px] border border-borde text-[16.5px] font-extrabold text-tinta-suave"
          >
            <Ico nombre="calendario" tam={18} grosor={2.3} />
            Con fecha
          </Link>
        </div>

        {fallo && (
          <p className="mt-3 rounded-[16px] bg-coral-suave px-4 py-3 text-[15.5px] font-semibold text-coral">
            {fallo}
          </p>
        )}

        <p className="mt-3 text-[14px] font-semibold leading-snug text-tenue">
          Esto lo ve toda la casa, como el corcho. No es un mensaje privado.
        </p>
      </div>

      {/* ── Lo que os habéis dejado ── */}
      {cosas.length === 0 ? (
        <p className="mt-4 rounded-[20px] bg-superficie px-6 py-8 text-center text-[17px] font-medium leading-snug text-tinta-suave">
          Todavía no hay nada. Lo que {soyElAsesor ? 'les dejes' : `te deje ${comoSeLlama}`} saldrá
          aquí.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {cosas.map((c) => {
            const cuerpo = (
              <>
                <span className="flex items-center gap-2">
                  {c.clase === 'tarea' && (
                    <span
                      className="flex h-[22px] shrink-0 items-center rounded-full px-2 text-[12.5px] font-extrabold uppercase tracking-wide"
                      style={{
                        background: `color-mix(in srgb, ${c.suya ? color : '#64748B'} 18%, transparent)`,
                        color: c.suya ? color : '#64748B',
                      }}
                    >
                      {c.hecha ? 'Hecho' : 'Tarea'}
                    </span>
                  )}
                  <span className="truncate text-[14px] font-bold text-tenue">{c.cuando}</span>
                </span>
                <span className="mt-1 block whitespace-pre-wrap text-[17px] font-semibold leading-snug">
                  {c.texto}
                </span>
                {c.fecha && (
                  <span className="mt-1 block text-[14.5px] font-bold text-tenue">
                    Para el {enPalabras(c.fecha)}
                  </span>
                )}
              </>
            )

            /*
              Lo suyo con su color y una barra a la izquierda; lo tuyo
              en gris y sin barra. Es lo único que hace falta para
              saber de quién es cada cosa sin leer ninguna firma.
            */
            const pinta = c.suya
              ? {
                  background: `color-mix(in srgb, ${color} 9%, var(--t-superficie))`,
                  borderColor: `color-mix(in srgb, ${color} 32%, transparent)`,
                  borderLeft: `4px solid ${color}`,
                }
              : {
                  background: 'var(--t-superficie)',
                  borderColor: 'var(--t-borde)',
                }

            return (
              <li key={`${c.clase}-${c.id}`}>
                {c.clase === 'tarea' ? (
                  <Link
                    href={`/tablon/${c.id}`}
                    className="block rounded-[20px] border px-4 py-3.5"
                    style={pinta}
                  >
                    {cuerpo}
                  </Link>
                ) : (
                  <div className="rounded-[20px] border px-4 py-3.5" style={pinta}>
                    {cuerpo}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

/** «2026-11-12» → «12 de noviembre». */
function enPalabras(iso: string): string {
  const meses = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre',
  ]
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  return `${d} de ${meses[m - 1]}`
}
