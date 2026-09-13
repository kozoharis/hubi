'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Ico } from '../../iconos'
import { AMBITO } from '../../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  LA COMPRA, EN LA PARED
  ═══════════════════════════════════════════════════════════════

  Ésta es LA razón de que haya una tableta en una cocina. Se acaba la
  leche, se apunta la leche. Sin buscar el móvil, sin desbloquearlo, sin
  abrir nada: dos pasos hasta la pared y ya está.

  ─────────────────────────────────────────────────────────────
  Y ES LO ÚNICO QUE LA BASE LE DEJA HACER DE VERDAD

  No hay que pedir permiso para esto: ya está dado, y a propósito desde
  el paso 61.

      nivel_por_rol('casa', 'compra')  =  'anadir'

  Una pantalla de cocina tiene `nada` en papeles, `nada` en cuentas,
  `mirar` en la agenda — y `anadir` en la compra. Es la única sección
  donde un aparato colgado de una pared puede escribir algo que importe,
  y está así porque es exactamente para lo que sirve.

  ─────────────────────────────────────────────────────────────
  TODO GRANDE, Y TACHAR ES TOCAR LA FILA ENTERA

  No una casilla de 24 px al lado del texto. Se toca de pie, muchas
  veces con una mano ocupada y casi siempre sin mirar dónde se está
  dando: el sitio donde hay que dar es el sitio donde está la palabra.

  ─────────────────────────────────────────────────────────────
  LO TACHADO NO DESAPARECE

  Se queda, apagado y con una raya. Dos razones, y las dos se ven en una
  cocina: para poder deshacer un toque dado sin querer, y porque saber
  que la leche YA está comprada evita que la apunte otro.
*/

export type Cosa = { id: string; que: string; comprado: boolean }

export default function Lista({ cosas }: { cosas: Cosa[] }) {
  const router = useRouter()

  const [locales, setLocales] = useState(cosas)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function anadir() {
    const que = texto.trim().replace(/\s+/g, ' ')
    if (que.length < 2) return

    setFallo(null)
    setOcupado(true)
    /* Se vacía ya: quien apunta tres cosas seguidas escribe la segunda
       mientras la primera todavía va por el aire. */
    setTexto('')

    try {
      const r = await fetch(api('/api/compra'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ que }),
      })
      if (!r.ok) throw new Error()
      router.refresh()
    } catch {
      setFallo('No se ha podido apuntar. Inténtalo otra vez.')
      setTexto(que)
    } finally {
      setOcupado(false)
    }
  }

  async function tachar(cosa: Cosa) {
    const antes = cosa.comprado

    /* Se pinta ya. En una pared, un toque que tarda medio segundo en
       responder se vuelve a dar. */
    setLocales((c) => c.map((x) => (x.id === cosa.id ? { ...x, comprado: !antes } : x)))

    try {
      const r = await fetch(api(`/api/compra/${cosa.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comprado: !antes }),
      })
      if (!r.ok) throw new Error()
      router.refresh()
    } catch {
      setLocales((c) => c.map((x) => (x.id === cosa.id ? { ...x, comprado: antes } : x)))
      setFallo('No se ha podido cambiar. Inténtalo otra vez.')
    }
  }

  const faltan = locales.filter((c) => !c.comprado)
  const puestas = locales.filter((c) => c.comprado)

  return (
    <div className="mt-8 xl:grid xl:grid-cols-[1fr_1.25fr] xl:items-start xl:gap-14">
      {/* ── Apuntar ── */}
      <div>
        <div className="rounded-[28px] border border-borde bg-superficie px-7 py-7">
          <label
            htmlFor="que-falta"
            className="block text-[19px] font-extrabold uppercase tracking-[0.14em] text-tenue"
          >
            Qué falta
          </label>

          {/*
            El campo a 30 px y 84 de alto. Un teclado de pantalla tapa
            media tableta, así que lo que se escribe tiene que leerse
            entero por encima de él — y el dedo tiene que acertar a la
            primera.
          */}
          <input
            id="que-falta"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') anadir()
            }}
            maxLength={60}
            placeholder="Leche"
            autoComplete="off"
            className="entrada mt-4 h-[84px] w-full text-[30px] font-extrabold"
          />

          <button
            type="button"
            onClick={anadir}
            disabled={ocupado || texto.trim().length < 2}
            className="tocable mt-4 flex h-[76px] w-full items-center justify-center gap-3 rounded-[24px] text-[24px] font-extrabold disabled:opacity-45"
            style={{ background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }}
          >
            <Ico nombre="mas" tam={28} grosor={2.6} />
            Apuntarlo
          </button>

          {fallo && (
            <p className="mt-4 text-[18px] font-bold" style={{ color: 'var(--t-alerta)' }}>
              {fallo}
            </p>
          )}
        </div>
      </div>

      {/* ── La lista ── */}
      <div className="mt-10 xl:mt-0">
        {locales.length === 0 ? (
          <div className="rounded-[28px] border border-borde bg-superficie px-8 py-10">
            <p className="text-[30px] font-extrabold leading-snug text-tinta-suave">
              No falta nada en casa.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {[...faltan, ...puestas].map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => tachar(c)}
                  className={`tocable flex w-full items-center gap-6 rounded-[28px] border bg-superficie px-7 py-5 text-left ${
                    c.comprado ? 'opacity-45' : ''
                  }`}
                  style={{
                    borderColor: 'var(--t-borde)',
                    borderLeft: `6px solid ${c.comprado ? 'var(--t-borde)' : AMBITO.oliva}`,
                  }}
                >
                  {/*
                    La casilla es grande —44 px— pero no es lo que se
                    toca: lo que se toca es la fila. Está ahí para DECIR
                    que esto se tacha, no para que haya que acertarle.
                  */}
                  <span
                    className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] border-2"
                    style={{
                      borderColor: c.comprado ? 'transparent' : 'var(--t-borde)',
                      background: c.comprado ? AMBITO.oliva : 'transparent',
                      color: '#FFFFFF',
                    }}
                  >
                    {c.comprado && <Ico nombre="check" tam={26} grosor={2.6} />}
                  </span>

                  <span
                    className={`min-w-0 flex-1 text-[30px] font-extrabold leading-tight text-tinta ${
                      c.comprado ? 'line-through' : ''
                    }`}
                  >
                    {c.que}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
