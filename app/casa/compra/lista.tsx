'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAlDia } from '@/lib/al-dia'
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
  VARIAS LISTAS, Y SOLO LAS QUE SE HAYAN QUERIDO

  La compra de MAPPEL son varias listas: la del sábado, la de la
  ferretería, la de la finca. La pared las enseñaba todas revueltas en
  una montonera.

  Ahora salen separadas y con su nombre, y **solo las que alguien haya
  marcado** para que se vean aquí (paso 77). La compra corriente de la
  casa —lo que no está en ninguna lista— sale siempre: es donde va la
  leche y es lo que se apunta desde aquí.

  ─────────────────────────────────────────────────────────────
  Y CASI NUNCA HAY QUE ESCRIBIR

  Debajo del campo hay una fila de botones: lo que ESTA casa compra a
  menudo primero, y detrás lo corriente para rellenar. Se toca y se
  apunta — un toque en vez de seis letras y un teclado que tapa media
  tableta.

  El botón desaparece en cuanto se toca. En una pared, algo que sigue
  ahí medio segundo después de tocarlo se toca otra vez, y entonces en
  el súper compran dos leches.

  De dónde salen y por qué son treinta y no trescientos, en
  `lib/lo-de-siempre.ts`.

  ─────────────────────────────────────────────────────────────
  LO TACHADO NO DESAPARECE

  Se queda, apagado y con una raya. Dos razones, y las dos se ven en una
  cocina: para poder deshacer un toque dado sin querer, y porque saber
  que la leche YA está comprada evita que la apunte otro.
*/

export type Cosa = { id: string; que: string; comprado: boolean; lista_id: string | null }

/*
  Un grupo es una lista de la compra con su nombre: «El sábado», «La
  ferretería». El primero, sin nombre, es lo que no está en ninguna
  lista — la compra corriente de la casa, que es donde va la leche.
*/
export type Grupo = { id: string | null; nombre: string | null; cosas: Cosa[] }

export default function Lista({
  grupos,
  sugerencias = [],
}: {
  grupos: Grupo[]
  sugerencias?: string[]
}) {
  const router = useRouter()

  /*
    ── LO QUE HAY, Y LO QUE SE ACABA DE TOCAR ──

    `useAlDia` y no `useState` a secas, y ésa es la diferencia entre
    que la leche se vea al apuntarla o no se vea nunca. Está contado
    entero en `lib/al-dia.ts`: la copia local se sigue pintando al
    instante, pero ahora vuelve a mirar al servidor cuando el servidor
    trae algo distinto.

    La firma lleva el `id` y si está comprado: lo único que puede
    cambiar de una cosa de la compra y que esta pantalla pinte.
  */
  const delServidor = grupos.flatMap((g) => g.cosas)
  const firma = delServidor.map((c) => `${c.id}${c.comprado ? '1' : '0'}`).join('|')
  const [locales, setLocales] = useAlDia(delServidor, firma)

  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  /* Lo tocado en los botones de abajo desde que se cargó la pantalla.
     Sirve para que el botón desaparezca EN EL ACTO: si hay que esperar
     al refresco, se toca «Leche» dos veces y se apuntan dos. */
  const [recien, setRecien] = useState<string[]>([])

  async function apuntar(bruto: string) {
    const que = bruto.trim().replace(/\s+/g, ' ')
    if (que.length < 2) return false

    setFallo(null)
    setOcupado(true)

    try {
      const r = await fetch(api('/api/compra'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ que }),
      })
      if (!r.ok) throw new Error()
      router.refresh()
      return true
    } catch {
      setFallo('No se ha podido apuntar. Inténtalo otra vez.')
      return false
    } finally {
      setOcupado(false)
    }
  }

  async function anadir() {
    const que = texto.trim().replace(/\s+/g, ' ')
    if (que.length < 2) return

    /* Se vacía ya: quien apunta tres cosas seguidas escribe la segunda
       mientras la primera todavía va por el aire. */
    setTexto('')
    const bien = await apuntar(que)
    if (!bien) setTexto(que)
  }

  /* Un botón de los de abajo. Se aparta ANTES de que conteste el
     servidor, y si falla vuelve: en una pared, un botón que sigue ahí
     medio segundo después de tocarlo se toca otra vez. */
  async function tocarSugerencia(que: string) {
    setRecien((r) => [...r, que])
    const bien = await apuntar(que)
    if (!bien) setRecien((r) => r.filter((x) => x !== que))
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

  /*
    Lo que se ofrece AHORA. Se recorta con lo que hay en pantalla y con
    lo recién tocado, no solo con lo que había al cargar: si no, tras
    apuntar la leche a mano el botón «Leche» seguiría ahí hasta el
    siguiente refresco, invitando a apuntarla otra vez.
  */
  const puestas = new Set([
    ...locales.map((c) => c.que.trim().toLowerCase()),
    ...recien.map((r) => r.trim().toLowerCase()),
  ])
  const ofrecidas = sugerencias.filter((s) => !puestas.has(s.trim().toLowerCase()))

  /* Los grupos con lo que hay ahora mismo en pantalla, para que al
     tachar algo no salte de sitio. */
  const enPantalla = grupos
    .map((g) => ({
      ...g,
      cosas: locales.filter((c) => c.lista_id === g.id),
    }))
    .filter((g) => g.cosas.length > 0 || g.id === null)

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


        {/* ── Sin escribir nada ── */}
        {ofrecidas.length > 0 && (
          <div className="mt-7">
            <p className="text-[19px] font-extrabold uppercase tracking-[0.14em] text-tenue">
              Tócalo y se apunta
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              {ofrecidas.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => tocarSugerencia(s)}
                  className="tocable flex h-[64px] items-center gap-3 rounded-full border bg-superficie px-6 text-[22px] font-extrabold text-tinta"
                  style={{ borderColor: 'var(--t-borde)' }}
                >
                  <span style={{ color: AMBITO.oliva }}>
                    <Ico nombre="mas" tam={22} grosor={2.6} />
                  </span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Las listas ── */}
      <div className="mt-10 space-y-9 xl:mt-0">
        {locales.length === 0 && (
          <div className="rounded-[28px] border border-borde bg-superficie px-8 py-10">
            <p className="text-[30px] font-extrabold leading-snug text-tinta-suave">
              No falta nada en casa.
            </p>
          </div>
        )}

        {enPantalla.map((g) => {
          const faltan = g.cosas.filter((c) => !c.comprado)
          const puestas = g.cosas.filter((c) => c.comprado)
          if (g.cosas.length === 0) return null

          return (
          <div key={g.id ?? 'la-casa'}>
            {/*
              El nombre de la lista solo si HAY varias. Con una sola, un
              rótulo que diga «La casa» encima de la única lista que hay
              es una palabra que no distingue nada.
            */}
            {enPantalla.filter((x) => x.cosas.length > 0).length > 1 && (
              <h3 className="mb-4 text-[19px] font-extrabold uppercase tracking-[0.16em] text-tenue">
                {g.nombre ?? 'La casa'}
              </h3>
            )}

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
          </div>
          )
        })}
      </div>
    </div>
  )
}
