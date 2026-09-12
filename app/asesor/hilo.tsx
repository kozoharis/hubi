'use client'

import { useState } from 'react'
import Link from '@/app/enlace'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import {
  ambitoDeColor,
  AMBITO,
  Aviso,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  Vacio,
} from '../piezas'

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

  /* Por dónde se vino, tal cual — con el espacio de la dirección si lo
     lleva. Escribirlo a mano como «/asesor» perdería la casa en las
     direcciones con espacio (`/e/<casa>/asesor`) y devolvería a la
     casa equivocada a quien tenga dos. */
  const dondeEstoy = usePathname() ?? '/asesor'

  /* Su color, ya traducido a la paleta apagada. La marca del borde
     baja de 4 px a 3, que es la de `Fila`: cuatro colores distintos a
     cuatro anchos distintos para decir lo mismo era el problema. */
  const tono = AMBITO[ambitoDeColor(color)]

  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function mandar() {
    const limpio = texto.trim()
    if (limpio.length < 2) return

    setFallo(null)
    setOcupado(true)

    const r = await fetch(api('/api/notas'), {
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
      <div className="r-tarjeta border border-borde bg-superficie px-4 py-4">
        <Campo
          etiqueta={soyElAsesor ? 'Dejarles un aviso' : `Escribirle a ${comoSeLlama}`}
          htmlFor="paraEl"
          ayuda="Esto lo ve toda la casa, como el corcho. No es un mensaje privado."
        >
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
            className="entrada min-h-[92px] py-3 leading-snug"
          />
        </Campo>

        {fallo && (
          <div className="mt-3">
            <Aviso titulo="No se ha podido enviar" explicacion={fallo} />
          </div>
        )}

        <div className="mt-3 flex gap-2.5">
          <BotonPrincipal
            onClick={mandar}
            desactivado={ocupado || texto.trim().length < 2}
            porQue={texto.trim().length < 2 ? 'Escribe el aviso primero' : undefined}
            icono="check"
            ancho="completo"
          >
            {ocupado ? 'Enviando…' : 'Enviar'}
          </BotonPrincipal>
          {/*
            Poner una fecha es otra cosa y vive en la Agenda. Aquí solo
            el enlace: duplicar el formulario de tareas sería duplicar
            también sus fallos.

            Pero el enlace iba a secas —`/tablon/nuevo`— y eso tenía
            tres consecuencias, las tres feas:

              · se perdía lo que ya estaba escrito;
              · la tarea nacía «para mí» en vez de para quien se estaba
                hablando;
              · y al volver se acababa en la Agenda, a dos pantallas del
                hilo donde uno estaba.

            Ahora las tres cosas viajan en la dirección. Lo escrito, el
            destinatario, y por dónde se vino.
          */}
          <BotonSecundario
            href={
              `/tablon/nuevo?para=${encodeURIComponent(paraQuien)}` +
              `&volver=${encodeURIComponent(dondeEstoy)}` +
              (texto.trim() ? `&texto=${encodeURIComponent(texto.trim().slice(0, 600))}` : '')
            }
            icono="calendario"
            ancho="completo"
          >
            Con fecha
          </BotonSecundario>
        </div>
      </div>

      {/* ── Lo que os habéis dejado ── */}
      {cosas.length === 0 ? (
        <div className="mt-4">
          <Vacio
            titulo="Todavía no hay nada"
            explicacion={`Lo que ${soyElAsesor ? 'les dejes' : `te deje ${comoSeLlama}`} saldrá aquí.`}
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {cosas.map((c) => {
            const cuerpo = (
              <>
                <span className="flex items-center gap-2">
                  {c.clase === 'tarea' && (
                    /* Era `#64748B` escrito a mano para lo tuyo. Y una
                       tarea hecha se decía con la misma tinta que una
                       pendiente: es lo único de esta lista que tiene
                       estado, y ahora lo dice el color de estado. */
                    <span
                      className="flex h-[22px] shrink-0 items-center rounded-full px-2 text-[12.5px] font-extrabold uppercase tracking-wide"
                      style={
                        c.hecha
                          ? {
                              background: 'var(--t-bien-velo)',
                              color: 'var(--t-bien)',
                            }
                          : {
                              background: `color-mix(in srgb, ${tono} 18%, var(--t-superficie))`,
                              color: 'var(--t-tinta)',
                            }
                      }
                    >
                      {c.hecha ? 'Hecho' : 'Tarea'}
                    </span>
                  )}
                  <span className="t-apoyo truncate">{c.cuando}</span>
                </span>
                <span className="t-cuerpo mt-1 block whitespace-pre-wrap">{c.texto}</span>
                {c.fecha && (
                  <span className="t-apoyo mt-1 block">Para el {enPalabras(c.fecha)}</span>
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
                  background: `color-mix(in srgb, ${tono} 5%, var(--t-superficie))`,
                  borderColor: `color-mix(in srgb, ${tono} 32%, transparent)`,
                  borderLeft: `3px solid ${tono}`,
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
                    className="r-tarjeta block border px-4 py-3.5"
                    style={pinta}
                  >
                    {cuerpo}
                  </Link>
                ) : (
                  <div className="r-tarjeta border px-4 py-3.5" style={pinta}>
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
