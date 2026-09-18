'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAlDia } from '@/lib/al-dia'
import { Ico } from '../../iconos'
import { AMBITO } from '../../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  LA COMPRA EN LA PARED · apuntar, tachar, y saber para qué es
  ═══════════════════════════════════════════════════════════════

  Haris, con la tableta delante: *«la compra en la tablet se ve de un
  aspecto algo tosco y grande… creo que podemos pulirlo más»*.

  Tenía razón y los números lo decían: cada renglón era letra de 30 px,
  casilla de 44 y tarjeta de 28 de radio con 20 px de aire arriba y
  abajo. Eso son más de 90 px por cosa. Con quince cosas apuntadas, la
  lista no cabía en la pantalla y encima parecía un teclado de
  calculadora gigante.

  Ahora el renglón mide 23 px de letra, casilla de 36 y 12 px de aire:
  unos 60 px, que sigue estando muy por encima del suelo de 44 para
  algo que se toca de pie. Cabe el doble y se lee igual desde la
  puerta.

  ─────────────────────────────────────────────────────────────
  Y ESTÁ ORDENADA POR PARA QUÉ ES

  Primero **lo que hace falta para los menús** —cada comida con su día
  y sus platos, lo de antes arriba—, y debajo **lo de casa**, por
  pasillos del súper. La decisión está razonada en `page.tsx`.

  El porqué de que el menú vaya primero lo dijo Haris entero: *«sin
  ello no se puede cocinar y nos quedamos sin menú y luego a
  improvisar»*. Una lista de la compra que no distingue entre «papel de
  cocina» y «el cilantro de la cena de mañana» trata igual dos cosas
  que no lo son.

  ─────────────────────────────────────────────────────────────
  LOS PASILLOS, DENTRO DE CADA ZONA

  `pasilloDe` es la MISMA función que usa el móvil. Ni una lista de
  palabras nueva: el día que alguien añada «bubango» a la fruta, se
  añade en un sitio y aparece en los dos. Es la regla de siempre —una
  pantalla nueva no inventa un idioma, usa el que hay, más grande.
*/

export type Cosa = {
  id: string
  que: string
  comprado: boolean
  lista_id: string | null
  /** Del paso 87. Puede no venir: la pantalla lo pide y, si la base
      todavía no lo tiene, vuelve a pedir sin ello. */
  para_menu_id?: string | null
}

/** Lo que hace falta para UNA comida concreta. */
export type ParaUnMenu = {
  clave: string
  fecha: string
  momento: string
  /** «Lentejas · Merluza». Desde el paso 85 una comida lleva varios. */
  platos: string
  /** «Hoy», «Mañana», «El jueves». */
  cuando: string
  /** Hoy o mañana: o se compra hoy, o no se cocina. */
  apura: boolean
  cosas: Cosa[]
}

/** Un trozo de la tienda con lo que toca coger allí. */
export type PorPasillo = { pasillo: string; cosas: Cosa[] }

/** Una lista de la compra, con lo suyo repartido por pasillos. */
export type Grupo = { id: string | null; nombre: string | null; zonas: PorPasillo[] }

export default function Lista({
  menus,
  grupos,
  sugerencias = [],
}: {
  menus: ParaUnMenu[]
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
  const delServidor = [
    ...menus.flatMap((m) => m.cosas),
    ...grupos.flatMap((g) => g.zonas.flatMap((z) => z.cosas)),
  ]
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

  /* El estado de AHORA de cada cosa, sin que nada salte de sitio: los
     grupos los arma el servidor y aquí solo se repinta lo tachado. */
  const comoEsta = new Map(locales.map((c) => [c.id, c]))
  const alDia = (cosas: Cosa[]) => cosas.map((c) => comoEsta.get(c.id) ?? c)

  const hayAlgo = delServidor.length > 0

  return (
    <div
      /*
        Dos columnas desde 1024 y no desde 1280: una tableta apaisada
        de las corrientes mide justo eso, y con una sola columna el
        formulario de apuntar se lleva media pantalla de alto antes de
        que empiece la lista — que es de donde venía lo de «tosco y
        grande».
      */
      className="mt-7 lg:grid lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.6fr)] lg:items-start lg:gap-12"
    >
      {/* ══ 1 · APUNTAR ══════════════════════════════════════ */}
      <div>
        <div className="rounded-[26px] border border-borde bg-superficie px-6 py-6">
          <label
            htmlFor="apuntar-en-la-compra"
            className="block text-[18px] font-extrabold uppercase tracking-[0.14em] text-tenue"
          >
            Apuntar
          </label>

          <input
            id="apuntar-en-la-compra"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') anadir()
            }}
            placeholder="Leche"
            maxLength={120}
            autoComplete="off"
            className="entrada mt-3 h-[72px] w-full text-[26px] font-extrabold"
          />

          <button
            type="button"
            onClick={anadir}
            disabled={ocupado || texto.trim().length < 2}
            className="tocable mt-3 flex h-[68px] w-full items-center justify-center gap-3 rounded-[22px] text-[22px] font-extrabold disabled:opacity-45"
            style={{ background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }}
          >
            <Ico nombre="mas" tam={24} grosor={2.6} />
            {ocupado ? 'Un momento…' : 'Apuntar'}
          </button>

          {fallo && (
            <p className="mt-3 text-[17px] font-bold" style={{ color: 'var(--t-alerta)' }}>
              {fallo}
            </p>
          )}
        </div>

        {/* ── Lo de siempre, sin escribir ── */}
        {ofrecidas.length > 0 && (
          <div className="mt-6">
            <p className="text-[18px] font-extrabold uppercase tracking-[0.14em] text-tenue">
              Lo de siempre
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ofrecidas.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => tocarSugerencia(s)}
                  className="tocable flex h-[56px] items-center gap-2.5 rounded-full border bg-superficie px-5 text-[19px] font-extrabold text-tinta"
                  style={{ borderColor: 'var(--t-borde)' }}
                >
                  <span aria-hidden style={{ color: AMBITO.oliva }}>
                    <Ico nombre="mas" tam={19} grosor={2.6} />
                  </span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ 2 · LO QUE FALTA ═════════════════════════════════ */}
      <div className="mt-9 space-y-10 lg:mt-0">
        {!hayAlgo && (
          <div className="rounded-[26px] border border-borde bg-superficie px-7 py-9">
            <p className="text-[27px] font-extrabold leading-snug text-tinta-suave">
              No falta nada en casa.
            </p>
            <p className="mt-2 text-[20px] font-bold leading-snug text-tenue">
              Lo que se apunte aquí o desde el móvil sale en esta misma pantalla.
            </p>
          </div>
        )}

        {/*
          ── PARA LOS MENÚS ──

          Arriba del todo y con su día, porque es lo único de esta
          pantalla que tiene fecha límite. Lo demás se puede comprar
          mañana; esto, si no está, se cambia la cena.
        */}
        {menus.map((m) => (
          <div key={m.clave}>
            <div
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-[20px] border px-5 py-3"
              style={{
                background: `color-mix(in srgb, ${AMBITO.arena} 10%, var(--t-superficie))`,
                borderColor: `color-mix(in srgb, ${AMBITO.arena} 40%, transparent)`,
                borderLeft: `6px solid ${AMBITO.arena}`,
              }}
            >
              <span className="text-[15px] font-extrabold uppercase tracking-[0.16em] text-tenue">
                {m.momento} · {m.cuando}
              </span>
              <span className="text-[24px] font-extrabold leading-tight text-tinta">
                {m.platos || 'Sin poner'}
              </span>

              {/*
                La nota que pidió Haris, y solo cuando de verdad aprieta.
                Puesta siempre sería un cartel de peligro permanente, que
                a la semana no lo lee nadie.
              */}
              {m.apura && (
                <span
                  className="flex items-center gap-2 text-[17px] font-extrabold"
                  style={{ color: 'var(--t-alerta)' }}
                >
                  <Ico nombre="aviso" tam={18} grosor={2.4} />
                  Sin esto no se puede cocinar
                </span>
              )}
            </div>

            <ul className="mt-3 space-y-2">
              {alDia(m.cosas).map((c) => (
                <Renglon key={c.id} cosa={c} color={AMBITO.arena} alTocar={() => tachar(c)} />
              ))}
            </ul>
          </div>
        ))}

        {/* ── Y LO DE CASA, POR PASILLOS ── */}
        {grupos.map((g) =>
          g.zonas.length === 0 ? null : (
            <div key={g.id ?? 'de-casa'}>
              <h3 className="text-[19px] font-extrabold uppercase tracking-[0.16em] text-tenue">
                {g.nombre ?? 'De casa'}
              </h3>

              <div className="mt-4 space-y-6">
                {g.zonas.map((z) => (
                  <div key={z.pasillo}>
                    {/*
                      El pasillo, en pequeño y sin caja. Es una ayuda
                      para el carro, no una sección: con tarjeta propia
                      pesaría más que lo que hay que comprar.
                    */}
                    <p className="mb-2 text-[16px] font-extrabold uppercase tracking-[0.12em] text-apagado">
                      {z.pasillo}
                    </p>
                    <ul className="space-y-2">
                      {alDia(z.cosas).map((c) => (
                        <Renglon
                          key={c.id}
                          cosa={c}
                          color={AMBITO.oliva}
                          alTocar={() => tachar(c)}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

/*
  ── UN RENGLÓN ──────────────────────────────────────────────

  Se toca entero, no la casilla: se hace de pie y con una mano ocupada,
  y el sitio donde hay que dar es el sitio donde está la palabra.

  Lo comprado se queda, tachado y apagado. Quitarlo de la vista al
  tocarlo haría que la lista saltara debajo del dedo, y en una pared
  eso es tachar la siguiente sin querer.
*/
function Renglon({
  cosa,
  color,
  alTocar,
}: {
  cosa: Cosa
  color: string
  alTocar: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={alTocar}
        className={`tocable flex w-full items-center gap-4 rounded-[20px] border bg-superficie px-5 py-3 text-left ${
          cosa.comprado ? 'opacity-45' : ''
        }`}
        style={{
          borderColor: 'var(--t-borde)',
          borderLeft: `5px solid ${cosa.comprado ? 'var(--t-borde)' : color}`,
        }}
      >
        <span
          className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[12px] border-2"
          style={{
            borderColor: cosa.comprado ? 'transparent' : 'var(--t-borde)',
            background: cosa.comprado ? color : 'transparent',
            color: '#FFFFFF',
          }}
        >
          {cosa.comprado && <Ico nombre="check" tam={22} grosor={2.6} />}
        </span>

        <span
          className={`min-w-0 flex-1 text-[23px] font-extrabold leading-tight text-tinta ${
            cosa.comprado ? 'line-through' : ''
          }`}
        >
          {cosa.que}
        </span>
      </button>
    </li>
  )
}
