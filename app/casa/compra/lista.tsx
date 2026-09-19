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
  /** Del paso 89: a quién le toca comprarlo. Vacío = cualquiera, que
      es lo normal. Puede no venir, por lo mismo. */
  para?: string | null
}

/** Uno de la casa, con su color. */
export type Quien = { id: string; nombre: string; color: string }

/** Una lista de la compra, para poder mandar algo a ella. */
export type UnaLista = { id: string; nombre: string }

/** Una comida de los próximos días, para poder atarle algo. */
export type UnMenuAlQueAtar = {
  id: string
  /** «Hoy», «Mañana», «El jueves». */
  cuando: string
  /** «Comida» o «Cena». */
  momento: string
  /** «Lentejas · Merluza». Puede estar vacío: una comida sin poner. */
  platos: string
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
  listas = [],
  gente = [],
  menusAlQueAtar = [],
}: {
  menus: ParaUnMenu[]
  grupos: Grupo[]
  sugerencias?: string[]
  /*
    ── LO QUE HACE FALTA PARA ASIGNAR ──

    Haris: *«desde la cocina, la tablet, sería bueno poder asignar las
    compras también si fuera necesario»*.

    Las tres llegan como DATOS desde el servidor, nunca como funciones
    que las busquen: entre un componente de servidor y uno de cliente
    sólo pasan datos, y una función se compila sin una queja y revienta
    al abrir la pantalla. Ya nos costó el menú entero una vez.

    Y las tres con respaldo vacío: una casa sin listas, sin menús o sin
    gente no ve esa pregunta, y el panel sigue funcionando con las
    demás.
  */
  listas?: UnaLista[]
  gente?: Quien[]
  menusAlQueAtar?: UnMenuAlQueAtar[]
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

  /* En qué lista se apunta lo que se escriba. Nulo = la de la casa, que
     es lo de siempre y lo que se queda puesto: quien apunta la leche no
     tiene que elegir nada. */
  const [enQueLista, setEnQueLista] = useState<string | null>(null)

  /* La cosa que se está asignando, si hay alguna. */
  const [asignando, setAsignando] = useState<Cosa | null>(null)

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
        body: JSON.stringify(enQueLista ? { que, lista_id: enQueLista } : { que }),
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
    ── ASIGNAR ──

    Se manda SOLO lo que cambia. `null` es un valor —«ya no le toca a
    nadie»— y por eso viaja: el que no se manda es el que no se toca.
  */
  async function asignar(cosa: Cosa, cambio: Partial<Pick<Cosa, 'lista_id' | 'para' | 'para_menu_id'>>) {
    /* Se pinta ya, como todo en esta pantalla. */
    setLocales((c) => c.map((x) => (x.id === cosa.id ? { ...x, ...cambio } : x)))
    setAsignando((a) => (a && a.id === cosa.id ? { ...a, ...cambio } : a))
    setFallo(null)

    try {
      const r = await fetch(api(`/api/compra/${cosa.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambio),
      })
      const d = (await r.json().catch(() => null)) as
        | { error?: string; detalle?: string }
        | null
      if (!r.ok) {
        /* El detalle dice QUÉ paso falta, y eso es lo único que hace
           falta saber para arreglarlo. Un «algo ha ido mal» aquí
           costaría una tarde. */
        setFallo(d?.detalle ?? d?.error ?? 'No se ha podido cambiar.')
        setLocales((c) => c.map((x) => (x.id === cosa.id ? cosa : x)))
        setAsignando((a) => (a && a.id === cosa.id ? cosa : a))
        return
      }
      router.refresh()
    } catch {
      setFallo('No se ha podido cambiar. Inténtalo otra vez.')
      setLocales((c) => c.map((x) => (x.id === cosa.id ? cosa : x)))
      setAsignando((a) => (a && a.id === cosa.id ? cosa : a))
    }
  }

  const sePuedeAsignar = listas.length > 0 || gente.length > 0 || menusAlQueAtar.length > 0

  /* A quién le toca una cosa, si le toca a alguien. */
  const porPersona = new Map(gente.map((g) => [g.id, g]))
  const quienEs = (c: Cosa) => (c.para ? (porPersona.get(c.para) ?? null) : null)

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

          {/*
            ── EN QUÉ LISTA ──

            Sólo cuando hay más de una. Con una sola lista esto sería
            un botón que siempre dice lo mismo, o sea una decisión de
            adorno — y el punto 5 del planteamiento es «pocas
            decisiones por pantalla».

            «De la casa» va primero y viene puesto: apuntar la leche
            sigue siendo escribir y dar, sin elegir nada. Elegir es la
            excepción.
          */}
          {listas.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Pastilla elegida={enQueLista === null} alTocar={() => setEnQueLista(null)}>
                De la casa
              </Pastilla>
              {listas.map((l) => (
                <Pastilla
                  key={l.id}
                  elegida={enQueLista === l.id}
                  alTocar={() => setEnQueLista(l.id)}
                >
                  {l.nombre}
                </Pastilla>
              ))}
            </div>
          )}

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
                <Renglon
                  key={c.id}
                  cosa={c}
                  color={AMBITO.arena}
                  alTocar={() => tachar(c)}
                  dequien={quienEs(c)}
                  alAsignar={sePuedeAsignar ? () => setAsignando(c) : null}
                />
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
                          dequien={quienEs(c)}
                          alAsignar={sePuedeAsignar ? () => setAsignando(c) : null}
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

      {/*
        ══════════════════════════════════════════════════════════
        EL PANEL DE ASIGNAR
        ══════════════════════════════════════════════════════════

        Haris: *«desde la cocina, la tablet, sería bueno poder asignar
        las compras también si fuera necesario»*. Y el «si fuera
        necesario» es la mitad de la frase: esto NO puede estorbar al
        gesto de siempre.

        Por eso no está en la pantalla, está detrás de un lápiz. Apuntar
        la leche sigue siendo escribir y dar; tacharla sigue siendo un
        toque en el renglón. Asignar es otra cosa, se hace de vez en
        cuando, y se abre aparte.

        ── LAS TRES PREGUNTAS, Y NINGUNA OBLIGATORIA ──

        Cada una con su respuesta de «nada» PRIMERA y por defecto: «De
        la casa», «Cualquiera», «De la casa» otra vez. Sin esa salida,
        abrir el panel sería un peaje: entras a cambiar la lista y te
        vas habiendo tenido que decidir de quién es.

        ── Y SE GUARDA AL TOCAR, SIN BOTÓN DE GUARDAR ──

        Cada toque manda su cambio y ya está. Un «Guardar» al final
        sería un sitio más donde perder lo hecho, y en una pared el
        movimiento natural es tocar y marcharse.

        El mismo telón que la cámara y la pizarra, y tampoco se cierra
        al tocarlo: se sale por el botón.
      */}
      {asignando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-8 py-6"
          style={{ background: 'rgba(26,23,20,.72)' }}
        >
          <div className="max-h-full w-full max-w-[960px] overflow-y-auto rounded-[36px] border border-borde bg-fondo px-9 py-8">
            <p className="text-[18px] font-extrabold uppercase tracking-[0.2em] text-tenue">
              Qué hago con
            </p>
            <p className="mt-2 text-[34px] font-extrabold leading-tight text-tinta">
              {asignando.que}
            </p>

            {listas.length > 0 && (
              <div className="mt-8">
                <p className="text-[18px] font-extrabold uppercase tracking-[0.14em] text-tenue">
                  En qué lista
                </p>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <Pastilla
                    elegida={!asignando.lista_id}
                    alTocar={() => asignar(asignando, { lista_id: null })}
                  >
                    De la casa
                  </Pastilla>
                  {listas.map((l) => (
                    <Pastilla
                      key={l.id}
                      elegida={asignando.lista_id === l.id}
                      alTocar={() => asignar(asignando, { lista_id: l.id })}
                    >
                      {l.nombre}
                    </Pastilla>
                  ))}
                </div>
              </div>
            )}

            {gente.length > 0 && (
              <div className="mt-8">
                <p className="text-[18px] font-extrabold uppercase tracking-[0.14em] text-tenue">
                  Quién lo compra
                </p>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <Pastilla
                    elegida={!asignando.para}
                    alTocar={() => asignar(asignando, { para: null })}
                  >
                    Cualquiera
                  </Pastilla>
                  {gente.map((g) => (
                    <Pastilla
                      key={g.id}
                      color={g.color}
                      elegida={asignando.para === g.id}
                      alTocar={() => asignar(asignando, { para: g.id })}
                    >
                      {g.nombre.split(' ')[0]}
                    </Pastilla>
                  ))}
                </div>
              </div>
            )}

            {menusAlQueAtar.length > 0 && (
              <div className="mt-8">
                <p className="text-[18px] font-extrabold uppercase tracking-[0.14em] text-tenue">
                  Para qué comida
                </p>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <Pastilla
                    elegida={!asignando.para_menu_id}
                    alTocar={() => asignar(asignando, { para_menu_id: null })}
                  >
                    De la casa
                  </Pastilla>
                  {menusAlQueAtar.map((m) => (
                    <Pastilla
                      key={m.id}
                      elegida={asignando.para_menu_id === m.id}
                      alTocar={() => asignar(asignando, { para_menu_id: m.id })}
                    >
                      {m.cuando} · {m.momento}
                      {m.platos ? ` · ${m.platos}` : ''}
                    </Pastilla>
                  ))}
                </div>
              </div>
            )}

            {fallo && (
              <p className="mt-6 text-[20px] font-bold" style={{ color: 'var(--t-alerta)' }}>
                {fallo}
              </p>
            )}

            <div className="mt-9 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setAsignando(null)
                  setFallo(null)
                }}
                className="tocable flex items-center justify-center gap-3 rounded-full border border-borde bg-superficie px-9 text-[21px] font-extrabold text-tinta"
                style={{ minHeight: 68 }}
              >
                <Ico nombre="check" tam={24} grosor={2.6} />
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
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
  dequien = null,
  alAsignar = null,
}: {
  cosa: Cosa
  color: string
  alTocar: () => void
  /** El de la casa a quien le toca, si le toca a alguien. */
  dequien?: Quien | null
  /** Abrir el panel de asignar. Nulo = esta casa no tiene nada que
      asignar, y entonces el lápiz no sale. */
  alAsignar?: (() => void) | null
}) {
  return (
    /*
      ── DOS COSAS EN UN RENGLÓN, Y NO UN BOTÓN DENTRO DE OTRO ──

      Tocar el renglón tacha; tocar el lápiz abre el panel. Son dos
      botones hermanos dentro del `li`, no uno metido en el otro: un
      botón dentro de otro no es HTML válido y, peor, en una pared el
      toque acaba yendo al de fuera la mitad de las veces.

      El grande sigue siendo tachar, que es lo que se hace mil veces.
      El lápiz es pequeño y va a la derecha, que es donde ya está en el
      menú diciendo lo mismo: **esto se puede cambiar**.
    */
    <li className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={alTocar}
        className={`tocable flex min-w-0 flex-1 items-center gap-4 rounded-[20px] border bg-superficie px-5 py-3 text-left ${
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

        {/*
          A quién le toca, con SU color y no con su nombre. A dos metros
          un nombre no se lee y un círculo sí — es la misma decisión que
          en la agenda y en el corcho, donde en una casa el color ES el
          nombre.
        */}
        {dequien && (
          <span
            aria-label={`Le toca a ${dequien.nombre.split(' ')[0]}`}
            className="block h-[26px] w-[26px] shrink-0 rounded-full"
            style={{ background: dequien.color }}
          />
        )}
      </button>

      {alAsignar && (
        <button
          type="button"
          onClick={alAsignar}
          aria-label={`Cambiar ${cosa.que} de lista, de persona o de menú`}
          className="tocable flex w-[58px] shrink-0 items-center justify-center rounded-[20px] border border-borde bg-superficie text-apagado"
        >
          <Ico nombre="lapiz" tam={22} grosor={2.2} />
        </button>
      )}
    </li>
  )
}

/* Una pastilla de elegir. La misma en el formulario de apuntar y en el
   panel de asignar: dos maneras de enseñar «esto está elegido» serían
   dos cosas que aprender donde sólo hay una. */
function Pastilla({
  children,
  elegida,
  alTocar,
  color = null,
}: {
  children: React.ReactNode
  elegida: boolean
  alTocar: () => void
  /** El color de la persona, cuando la pastilla es una persona. */
  color?: string | null
}) {
  return (
    <button
      type="button"
      onClick={alTocar}
      className="tocable flex items-center gap-3 rounded-full border px-5 text-[19px] font-extrabold"
      style={{
        minHeight: 56,
        background: elegida ? 'var(--t-tinta)' : 'var(--t-superficie)',
        color: elegida ? 'var(--t-fondo)' : 'var(--t-tinta)',
        borderColor: elegida ? 'transparent' : 'var(--t-borde)',
      }}
    >
      {color && (
        <span
          aria-hidden
          className="block h-[22px] w-[22px] shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      {children}
    </button>
  )
}
