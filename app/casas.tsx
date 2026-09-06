'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from './iconos'
import type { Casa } from '@/lib/casas'

/*
  ═══════════════════════════════════════════════════════════════
  EN QUÉ CASA ESTÁS, Y LAS QUE TE HAN OFRECIDO
  ═══════════════════════════════════════════════════════════════

  ─────────────────────────────────────────────────────────────
  CON UNA SOLA CASA, ESTO NO EXISTE

  Y es la regla que decide si esto ayuda o estorba. Juan Miguel y
  Conchita tienen una: no verán ni un botón, ni un rótulo, ni un
  «Casa de Juan Miguel y Conchita» que no les dice nada porque ya
  saben dónde están.

  Un selector que sale cuando no hay nada que seleccionar es ruido en
  todas las pantallas para el 95% de la gente, a cambio de ayudar al
  5%. Sale solo cuando hay dos.

  ─────────────────────────────────────────────────────────────
  LA INVITACIÓN SÍ SALE SIEMPRE, Y ARRIBA

  Alguien te ha dado acceso a los papeles de su casa. Eso no puede
  estar escondido en un menú: hay que verlo y hay que poder decir que
  no. Se enseña quién y qué casa, y las dos respuestas al mismo peso —
  «Aceptar» no es más grande que «No, gracias».
*/

export default function Casas({ casas }: { casas: Casa[] }) {
  const router = useRouter()

  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const dentro = casas.filter((c) => !c.pendiente)
  const ofrecidas = casas.filter((c) => c.pendiente)
  const aqui = dentro.find((c) => c.mirando)

  async function pedir(casa: string, que: 'mirar' | 'aceptar' | 'rechazar') {
    setFallo(null)
    setOcupado(true)

    const r = await fetch('/api/casas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ casa, que }),
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
          ? [d.error ?? 'No se ha podido.', d.detalle].filter(Boolean).join(' · ')
          : 'HUBI no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return
    }

    setAbierto(false)
    /* `refresh` y no `push`: se recarga la pantalla donde está, ya con
       la casa nueva. Mandarle al inicio sería sacarle de donde estaba
       por un cambio que él ha pedido. */
    router.refresh()
  }

  if (casas.length <= 1 && ofrecidas.length === 0) return null

  return (
    <div className="mt-3 space-y-2.5">
      {/* ── Te han invitado ── */}
      {ofrecidas.map((c) => (
        <div key={c.id} className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <p className="text-[17px] font-extrabold leading-snug">
            Te han invitado a <span className="text-verde">{c.nombre}</span>
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-tenue">
            Podrás ver sus papeles y su agenda, con los permisos que te hayan dado. Lo tuyo
            no se comparte con ellos.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => pedir(c.id, 'aceptar')}
              disabled={ocupado}
              className="h-[52px] flex-1 rounded-[14px] bg-boton text-[16.5px] font-extrabold text-boton-texto disabled:opacity-50"
            >
              Aceptar
            </button>
            <button
              onClick={() => pedir(c.id, 'rechazar')}
              disabled={ocupado}
              className="h-[52px] flex-1 rounded-[14px] border border-borde text-[16.5px] font-extrabold text-tinta-suave disabled:opacity-50"
            >
              No, gracias
            </button>
          </div>
        </div>
      ))}

      {/* ── En cuál estás ── */}
      {dentro.length > 1 && (
        <>
          <button
            onClick={() => setAbierto(!abierto)}
            className="flex h-[52px] w-full items-center gap-2.5 rounded-[16px] border border-borde bg-superficie px-4"
          >
            <Ico nombre="casa" tam={19} grosor={2.2} className="shrink-0 text-tenue" />
            <span className="min-w-0 flex-1 truncate text-left text-[16px] font-extrabold">
              {aqui?.nombre ?? 'Tu casa'}
            </span>
            <span className="shrink-0 text-[14.5px] font-bold text-tenue">Cambiar</span>
            <Ico nombre="flecha" tam={18} grosor={2.2} className="shrink-0 text-borde" />
          </button>

          {abierto && (
            <ul className="space-y-2">
              {dentro.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => (c.mirando ? setAbierto(false) : pedir(c.id, 'mirar'))}
                    disabled={ocupado}
                    className="flex min-h-[52px] w-full items-center gap-2.5 rounded-[14px] px-4 text-left disabled:opacity-50"
                    style={
                      c.mirando
                        ? { background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }
                        : {
                            background: 'var(--t-fondo)',
                            color: 'var(--t-tinta-suave)',
                            border: '1px solid var(--t-borde)',
                          }
                    }
                  >
                    {c.mirando && <Ico nombre="check" tam={18} grosor={2.3} />}
                    <span className="min-w-0 flex-1 truncate text-[16px] font-extrabold">
                      {c.nombre}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {fallo && (
        <p className="rounded-[16px] bg-coral-suave px-4 py-3 text-[15.5px] font-semibold text-coral">
          {fallo}
        </p>
      )}
    </div>
  )
}
