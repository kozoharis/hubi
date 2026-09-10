'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from './iconos'
import { Aviso, BotonPrincipal, BotonSecundario, Tarjeta } from './piezas'
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
        <Tarjeta key={c.id}>
          {/* El nombre iba en `text-verde`, que ya no es un color de
              acento sino el verde de ámbito. Aquí no identifica nada:
              es el nombre de una casa dentro de una frase. */}
          <p className="t-tarjeta">Te han invitado a {c.nombre}</p>
          <p className="t-apoyo mt-1">
            Podrás ver sus papeles y su agenda, con los permisos que te hayan dado. Lo tuyo
            no se comparte con ellos.
          </p>
          <div className="mt-3 flex gap-2.5">
            <BotonPrincipal
              onClick={() => pedir(c.id, 'aceptar')}
              desactivado={ocupado}
              ancho="completo"
            >
              Aceptar
            </BotonPrincipal>
            <BotonSecundario
              onClick={() => pedir(c.id, 'rechazar')}
              desactivado={ocupado}
              ancho="completo"
            >
              No, gracias
            </BotonSecundario>
          </div>
        </Tarjeta>
      ))}

      {/* ── En cuál estás ── */}
      {dentro.length > 1 && (
        <>
          <button
            onClick={() => setAbierto(!abierto)}
            className="r-campo flex h-[56px] w-full items-center gap-2.5 border border-borde bg-superficie px-4"
          >
            <Ico nombre="casa" tam={19} grosor={2.2} className="shrink-0 text-tenue" />
            <span className="t-cuerpo min-w-0 flex-1 truncate text-left font-extrabold">
              {aqui?.nombre ?? 'Tu casa'}
            </span>
            <span className="t-apoyo shrink-0">Cambiar</span>
            <Ico nombre="flecha" tam={18} grosor={2.2} className="shrink-0 text-borde" />
          </button>

          {abierto && (
            <ul className="space-y-2">
              {dentro.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => (c.mirando ? setAbierto(false) : pedir(c.id, 'mirar'))}
                    disabled={ocupado}
                    className="r-campo flex min-h-[56px] w-full items-center gap-2.5 border px-4 text-left disabled:opacity-50"
                    style={
                      /* La casa en la que estás es la ELEGIDA de una
                         lista, no una acción: se rellena de tinta,
                         como cualquier píldora puesta. */
                      c.mirando
                        ? {
                            background: 'var(--t-tinta)',
                            color: 'var(--t-fondo)',
                            borderColor: 'var(--t-tinta)',
                          }
                        : {
                            background: 'var(--t-superficie)',
                            color: 'var(--t-tinta-suave)',
                            borderColor: 'var(--t-borde)',
                          }
                    }
                  >
                    {c.mirando && <Ico nombre="check" tam={18} grosor={2.3} />}
                    <span className="t-cuerpo min-w-0 flex-1 truncate font-extrabold">
                      {c.nombre}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {fallo && <Aviso titulo="No se ha podido cambiar" explicacion={fallo} />}
    </div>
  )
}
