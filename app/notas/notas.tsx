'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import type { NotaVista } from '@/lib/notas'

/*
  ═══════════════════════════════════════════════════════════════
  EL CORCHO
  ═══════════════════════════════════════════════════════════════

  ─────────────────────────────────────────────────────────────
  ESCRIBIR ES LO PRIMERO, NO UN BOTÓN «+»

  Una nota se pone en cinco segundos y se pone a menudo. Esconder eso
  detrás de un «+» que abre otra pantalla convierte cinco segundos en
  tres toques. La caja de escribir está arriba, abierta, esperando.

  ─────────────────────────────────────────────────────────────
  «PARA QUIÉN» SOLO APARECE SI HAY ALGUIEN

  Viviendo solo en HUBI, un desplegable de «¿para quién?» con una
  única opción —tú— es una decisión inventada. Sale cuando hay otra
  persona en la casa.

  ─────────────────────────────────────────────────────────────
  Y LAS NOTAS NO SON PRIVADAS

  Una nota dirigida a alguien la sigue viendo toda la casa: es un
  corcho, no un chat. Se dice donde se escribe, no en unos ajustes —
  quien deja una nota tiene que saberlo ANTES de escribirla.
*/

type Quien = { id: string; nombre: string }

export default function Notas({
  notas,
  gente,
  yo,
  escribo,
  viendoGuardadas,
}: {
  notas: NotaVista[]
  gente: Quien[]
  yo: string
  /** Falso para quien solo puede mirar. */
  escribo: boolean
  viendoGuardadas: boolean
}) {
  const router = useRouter()

  const [texto, setTexto] = useState('')
  const [para, setPara] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [borrador, setBorrador] = useState('')

  const otros = gente.filter((g) => g.id !== yo)
  const nombreDe = new Map(gente.map((g) => [g.id, g.nombre]))

  async function pedir(cuerpo: object, metodo: 'POST' | 'PATCH') {
    setFallo(null)
    setOcupado(true)

    const r = await fetch('/api/notas', {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      error?: string
      detalle?: string
    } | null

    setOcupado(false)

    /* `bien === true`, no `r.ok` a secas. Una petición que acaba
       redirigida a la pantalla de entrar contesta 200 con el HTML del
       login, y `r.ok` diría que todo ha ido bien. Ya pasó una vez y
       costó una tarde. */
    if (!r.ok || d?.bien !== true) {
      setFallo(
        d
          ? [d.error ?? 'No se ha podido.', d.detalle].filter(Boolean).join(' · ')
          : 'HUBI no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return false
    }

    router.refresh()
    return true
  }

  async function poner() {
    if (await pedir({ texto: texto.trim(), para }, 'POST')) {
      setTexto('')
      setPara(null)
    }
  }

  async function guardarCambio(id: string) {
    if (await pedir({ id, que: 'texto', texto: borrador.trim() }, 'PATCH')) {
      setEditando(null)
    }
  }

  return (
    <>
      {/* ── Puestas · Guardadas ── */}
      <div className="mt-1 flex gap-2">
        <Pestana texto="En el corcho" href="/notas" puesta={!viendoGuardadas} />
        <Pestana texto="Guardadas" href="/notas?ver=guardadas" puesta={viendoGuardadas} />
      </div>

      {/* ── Escribir una ── */}
      {escribo && !viendoGuardadas && (
        <div className="mt-4 rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <label htmlFor="nota" className="block text-[17px] font-extrabold leading-snug">
            Deja una nota
          </label>
          <textarea
            id="nota"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={1200}
            placeholder="La llave del garaje está en el cajón de la entrada"
            className="mt-2.5 w-full resize-y rounded-[16px] border border-borde bg-fondo px-4 py-3.5 text-[18px] font-semibold leading-snug text-tinta outline-none placeholder:font-semibold placeholder:text-tenue focus:border-verde"
          />

          {otros.length > 0 && (
            <>
              <p className="mt-4 text-[17px] font-extrabold leading-snug">¿Para quién?</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Pastilla
                  texto="Para la casa"
                  puesta={para === null}
                  alPulsar={() => setPara(null)}
                />
                {otros.map((g) => (
                  <Pastilla
                    key={g.id}
                    texto={`Para ${g.nombre.split(' ')[0]}`}
                    puesta={para === g.id}
                    alPulsar={() => setPara(g.id)}
                  />
                ))}
              </div>
              <p className="mt-2.5 text-[14.5px] font-semibold leading-snug text-tenue">
                {para === null
                  ? 'La verá todo el mundo en casa. No suena ningún teléfono.'
                  : 'Le llega un aviso al móvil. La nota la sigue viendo toda la casa.'}
              </p>
            </>
          )}

          <button
            onClick={poner}
            disabled={ocupado || texto.trim().length === 0}
            className="mt-3 flex h-[56px] w-full items-center justify-center gap-2 rounded-[16px] bg-boton text-[17px] font-extrabold text-boton-texto disabled:opacity-50"
          >
            <Ico nombre="chincheta" tam={19} grosor={2.3} />
            {ocupado ? 'Poniendo…' : 'Poner la nota'}
          </button>
        </div>
      )}

      {/* Quien solo mira no ve la caja de escribir. Se le dice por qué,
          una vez y sin dramatismo: no ha hecho nada mal. */}
      {!escribo && (
        <p className="mt-4 rounded-[16px] border border-borde px-4 py-3.5 text-[15.5px] font-semibold leading-snug text-tenue">
          Puedes leer las notas de la casa, pero no dejar ninguna.
        </p>
      )}

      {/* ── El corcho ── */}
      {notas.length === 0 ? (
        <p className="mt-4 rounded-[20px] bg-superficie px-6 py-10 text-center text-[17px] font-medium text-tinta-suave">
          {viendoGuardadas
            ? 'No has guardado ninguna nota todavía.'
            : 'No hay ninguna nota puesta.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {notas.map((n) => {
            const mia = n.escrita_por === yo
            const paraMi = n.para === yo
            const autor = nombreDe.get(n.escrita_por)?.split(' ')[0] ?? 'Alguien'
            const destino = n.para ? (nombreDe.get(n.para)?.split(' ')[0] ?? 'alguien') : null

            return (
              <li
                key={n.id}
                className="rounded-[20px] border border-borde bg-superficie px-4 py-3.5"
                style={
                  /* Una nota que es PARA TI se ve distinta desde el otro
                     lado de la habitación. Es lo único de esta pantalla
                     que exige algo de quien la lee. */
                  paraMi && !n.vista_en
                    ? { borderColor: '#14B8A6', background: 'color-mix(in srgb, #14B8A6 8%, var(--t-superficie))' }
                    : undefined
                }
              >
                {editando === n.id ? (
                  <>
                    <textarea
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                      rows={3}
                      maxLength={1200}
                      className="w-full resize-y rounded-[16px] border border-borde bg-fondo px-4 py-3.5 text-[18px] font-semibold leading-snug text-tinta outline-none focus:border-verde"
                      autoFocus
                    />
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => guardarCambio(n.id)}
                        disabled={ocupado || borrador.trim().length === 0}
                        className="h-[52px] flex-1 rounded-[14px] bg-boton text-[16.5px] font-extrabold text-boton-texto disabled:opacity-50"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        disabled={ocupado}
                        className="h-[52px] flex-1 rounded-[14px] border border-borde text-[16.5px] font-extrabold text-tinta-suave disabled:opacity-50"
                      >
                        Dejarlo
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* `whitespace-pre-wrap`: si alguien escribe la nota
                        en tres renglones, se lee en tres renglones. */}
                    <p className="whitespace-pre-wrap text-[17.5px] font-semibold leading-snug">
                      {n.texto}
                    </p>

                    <p className="mt-2 text-[14.5px] font-bold text-tenue">
                      {[
                        mia ? 'Tú' : autor,
                        destino ? (paraMi ? '→ para ti' : `→ para ${destino}`) : null,
                        n.cuando,
                        n.cambiada_en ? 'cambiada' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>

                    {/* «Visto», y quién lo ha visto. Es el punto 16: quien
                        deja el recado quiere saber que ha llegado. */}
                    {n.para && n.vista_en && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-[14.5px] font-extrabold text-verde">
                        <Ico nombre="check" tam={16} grosor={2.4} />
                        Visto
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {paraMi && !n.vista_en && escribo && (
                        <Boton
                          texto="Visto"
                          icono="check"
                          ocupado={ocupado}
                          alPulsar={() => pedir({ id: n.id, que: 'visto' }, 'PATCH')}
                          fuerte
                        />
                      )}

                      {mia && !viendoGuardadas && escribo && (
                        <Boton
                          texto="Cambiar"
                          icono="lapiz"
                          ocupado={ocupado}
                          alPulsar={() => {
                            setEditando(n.id)
                            setBorrador(n.texto)
                          }}
                        />
                      )}

                      {(mia || paraMi) &&
                        escribo &&
                        (viendoGuardadas ? (
                          <Boton
                            texto="Volver a ponerla"
                            icono="chincheta"
                            ocupado={ocupado}
                            alPulsar={() => pedir({ id: n.id, que: 'recuperar' }, 'PATCH')}
                          />
                        ) : (
                          <Boton
                            texto="Quitar"
                            icono="carpeta"
                            ocupado={ocupado}
                            alPulsar={() => pedir({ id: n.id, que: 'guardar' }, 'PATCH')}
                          />
                        ))}
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Se dice dónde va lo que se quita. «Quitar» a secas suena a
          borrar, y nadie pulsa un botón que suena a borrar. */}
      {!viendoGuardadas && notas.length > 0 && escribo && (
        <p className="mt-3 text-center text-[14.5px] font-semibold text-tenue">
          Lo que quites no se borra: queda en Guardadas.
        </p>
      )}

      {fallo && (
        <p className="mt-3 rounded-[16px] bg-coral-suave px-4 py-3 text-[15.5px] font-semibold text-coral">
          {fallo}
        </p>
      )}
    </>
  )
}

function Pestana({ texto, href, puesta }: { texto: string; href: string; puesta: boolean }) {
  return (
    <Link
      href={href}
      aria-current={puesta ? 'page' : undefined}
      className="flex h-11 flex-1 items-center justify-center rounded-full text-[15px] font-extrabold"
      style={
        puesta
          ? { background: '#F59E0B', color: '#0F172A' }
          : {
              background: 'var(--t-superficie)',
              color: 'var(--t-tinta-suave)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      {texto}
    </Link>
  )
}

function Pastilla({
  texto,
  puesta,
  alPulsar,
}: {
  texto: string
  puesta: boolean
  alPulsar: () => void
}) {
  return (
    <button
      onClick={alPulsar}
      aria-pressed={puesta}
      className="flex h-12 items-center rounded-full px-4 text-[15.5px] font-extrabold"
      style={
        puesta
          ? { background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }
          : {
              background: 'var(--t-fondo)',
              color: 'var(--t-tinta-suave)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      {puesta ? `✓ ${texto}` : texto}
    </button>
  )
}

/* Los botones de una nota. Con texto SIEMPRE, nunca un dibujo suelto:
   el punto 5 lo dice y aquí se nota — «quitar» y «cambiar» dibujados
   se parecen demasiado. */
function Boton({
  texto,
  icono,
  ocupado,
  alPulsar,
  fuerte = false,
}: {
  texto: string
  icono: 'check' | 'lapiz' | 'chincheta' | 'carpeta'
  ocupado: boolean
  alPulsar: () => void
  fuerte?: boolean
}) {
  return (
    <button
      onClick={alPulsar}
      disabled={ocupado}
      className="flex h-12 items-center gap-1.5 rounded-[14px] px-4 text-[15.5px] font-extrabold disabled:opacity-50"
      style={
        fuerte
          ? { background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }
          : {
              background: 'var(--t-fondo)',
              color: 'var(--t-tinta-suave)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      <Ico nombre={icono} tam={17} grosor={2.3} />
      {texto}
    </button>
  )
}
