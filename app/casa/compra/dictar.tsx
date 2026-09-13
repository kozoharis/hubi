'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { grabarVoz, sePuedeGrabar, type Grabando } from '../../hablar/grabadora'
import { Ico } from '../../iconos'
import { AMBITO } from '../../piezas'
import { NOCHE, DEGRADADO, DEGRADADO_TUMBADO, TURQUESA } from '@/lib/voz-hubi'

/*
  ═══════════════════════════════════════════════════════════════
  DICTAR LA COMPRA EN LA COCINA
  ═══════════════════════════════════════════════════════════════

  «Se ha acabado la leche» con las manos metidas en el fregadero. Es el
  momento exacto en que no se coge un móvil y no se escribe nada, y es
  la razón entera de que haya un micrófono en esta pared.

  ─────────────────────────────────────────────────────────────
  ⚠️  Y AQUÍ NO ESTÁ EL ASISTENTE ENTERO. ESTO ES LO IMPORTANTE.

  Haris preguntó si el asistente de voz debía funcionar también aquí,
  y añadió lo que de verdad había que contestar: *«dónde debe de
  funcionar, claro»*.

  El de los móviles sabe hacer nueve cosas: apuntar la compra, crear
  recordatorios, dejar notas, apuntar gastos e ingresos, buscar
  papeles, consultar las cuentas, cambiar y borrar.

  **Aquí funcionan dos, y no por prudencia mía: porque son las dos que
  esta pantalla puede hacer.**

  Una pantalla de cocina tiene —desde el paso 61, a propósito—
  `nada` en cuentas, `nada` en papeles, `mirar` en la agenda y
  `anadir` en la compra. Si le pusiera el asistente completo,
  «apunta un gasto de ochenta y cinco euros» terminaría en un error de
  la base de datos después de que la persona lo haya dicho en voz
  alta. Un botón que puede fallar a mitad es peor que no tenerlo.

  Y hay una segunda razón, que no es de permisos: **una pared
  contesta en alto en una cocina por la que pasa cualquiera.**
  «Habéis gastado 8.430 € este trimestre» o «la última factura de
  Conchita es del hospital» son respuestas correctas dichas en el
  peor sitio posible. Eso se pregunta al móvil, que se mira a
  treinta centímetros de la cara.

  Así que el micrófono de la pared hace lo que hacen sus manos:

      · Aquí, en la compra  →  «leche, pan y huevos»
      · En un día del calendario  →  «el jueves viene el fontanero»

  Y nada más.

  ─────────────────────────────────────────────────────────────
  CÓMO SE FUERZA ESO

  Se manda `pista: 'compra'` con el audio. Con pista, el intérprete no
  vuelve a adivinar qué se ha querido decir: lo lee como compra y
  devuelve productos. Decir «apunta un gasto de ochenta euros» delante
  de esta pared no apunta un gasto — a lo sumo intenta apuntar un
  producto raro, y se ve escrito antes de guardarlo.

  La pista es una preferencia, no una cerradura: lo que de verdad se
  puede guardar lo sigue diciendo la RLS. Las dos capas dicen lo
  mismo, y ése es el punto.

  ─────────────────────────────────────────────────────────────
  Y NO SE GUARDA NADA SIN QUE SE VEA ESCRITO

  La misma regla que en todo HUBI. Se dicta, se lee lo entendido en
  letra grande, y se guarda. Una pared que apunta sola lo que cree
  haber oído acaba llenando la compra de trozos de conversación.
*/

type Estado = 'quieto' | 'oyendo' | 'pensando' | 'leyendo'

export default function Dictar() {
  const router = useRouter()

  const [estado, setEstado] = useState<Estado>('quieto')
  const [nivel, setNivel] = useState(0)
  const [oido, setOido] = useState<string[]>([])
  const [fallo, setFallo] = useState<string | null>(null)
  const grabando = useRef<Grabando | null>(null)

  /*
    ── SI HAY MICRÓFONO, SE MIRA DESPUÉS DE PINTAR ──

    Sin micrófono no hay botón: una tableta vieja colgada de una pared
    puede no tenerlo, y un botón que siempre da error es ruido.

    Pero eso NO se puede preguntar mientras se pinta. En el servidor no
    existe `navigator`, así que preguntarlo ahí y en el navegador da
    dos respuestas distintas, React pinta dos cosas distintas para el
    mismo sitio y la pantalla se rompe al arrancar. Se pinta sin botón
    y aparece cuando se sabe.
  */
  const [hayMicro, setHayMicro] = useState(false)
  useEffect(() => setHayMicro(sePuedeGrabar()), [])

  async function empezar() {
    setFallo(null)
    setOido([])
    setEstado('oyendo')

    grabando.current = await grabarVoz({
      alNivel: setNivel,
      alPausar: () => {},
      alSeguir: () => {},
      alTerminar: (audio) => {
        grabando.current = null
        mandar(audio)
      },
      alFallar: (motivo) => {
        grabando.current = null
        setEstado('quieto')
        setNivel(0)
        setFallo(
          motivo === 'sin-permiso'
            ? 'Esta pantalla no tiene permiso para usar el micrófono.'
            : motivo === 'sin-micro'
              ? 'Esta pantalla no tiene micrófono.'
              : 'No se ha oído nada. Prueba otra vez.'
        )
      },
    })
  }

  async function mandar(audio: Blob) {
    setEstado('pensando')
    setNivel(0)

    try {
      const paquete = new FormData()
      paquete.append('audio', audio, 'compra.webm')
      /* La pista. Sin ella, «apunta leche» podría leerse como un
         recordatorio y la pared devolvería una tarea que no puede
         guardar. */
      paquete.append('pista', 'compra')

      const r = await fetch(api('/api/voz'), { method: 'POST', body: paquete })
      const d = (await r.json().catch(() => null)) as
        | { compra?: { que?: string }[] | string[]; error?: string }
        | null

      if (!r.ok) {
        setEstado('quieto')
        setFallo(d?.error ?? 'No se ha entendido. Prueba otra vez.')
        return
      }

      /* El intérprete devuelve los productos como objetos con `que`,
         pero por el camino de las reglas pueden venir como texto
         suelto. Se admiten los dos: contar con una sola forma ha
         costado ya un fallo en este proyecto. */
      const cosas = (d?.compra ?? [])
        .map((c) => (typeof c === 'string' ? c : (c?.que ?? '')))
        .map((s) => String(s).trim())
        .filter((s) => s.length > 1)

      if (cosas.length === 0) {
        setEstado('quieto')
        setFallo('No he reconocido nada que se compre. Di los productos: leche, pan, huevos.')
        return
      }

      setOido(cosas)
      setEstado('leyendo')
    } catch {
      setEstado('quieto')
      setFallo('No se ha podido entender. Prueba otra vez.')
    }
  }

  async function guardar() {
    setEstado('pensando')
    try {
      const r = await fetch(api('/api/compra'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cosas: oido.map((q) => ({ que: q })) }),
      })
      const d = (await r.json().catch(() => null)) as { error?: string } | null

      if (!r.ok) {
        setEstado('leyendo')
        setFallo(d?.error ?? 'No se ha podido apuntar.')
        return
      }

      setOido([])
      setEstado('quieto')
      router.refresh()
    } catch {
      setEstado('leyendo')
      setFallo('No se ha podido apuntar.')
    }
  }

  /*
    ── SIN MICRÓFONO SE DICE, NO SE CALLA ──

    Aquí ponía `return null`: si la tableta no tiene micrófono o el
    navegador no sabe grabar, no salía nada. Y «no sale nada» es
    indistinguible de «esto no está publicado todavía» — que es
    exactamente la confusión que nos costó una tarde con `/casa`.

    Una línea gris, sin botón. No invita a tocar nada, y contesta sola
    la pregunta «¿por qué no veo el micrófono?».
  */
  if (!hayMicro) {
    return (
      <p className="mt-5 text-[18px] font-bold leading-snug text-tenue">
        Esta pantalla no puede grabar: o no tiene micrófono, o su navegador es demasiado antiguo.
        Se puede seguir apuntando escribiendo o con los botones de abajo.
      </p>
    )
  }

  // ── Lo entendido, para leerlo antes de guardarlo ──
  if (estado === 'leyendo') {
    return (
      <div className="mt-5 rounded-[28px] border border-borde bg-superficie px-7 py-6">
        {/*
          Este cartel lleva el color de la voz y no el de la compra, y
          es a propósito: lo de aquí abajo TODAVÍA NO ESTÁ GUARDADO. Es
          lo que HUBI cree haber oído, y hasta que no se toca «Apuntarlo»
          no es una lista de la compra — es una interpretación.

          En cuanto se guarda, se pinta con el oliva de la compra como
          todo lo demás. El color dice en qué punto está.
        */}
        <p className="flex items-center gap-3 text-[19px] font-extrabold uppercase tracking-[0.14em] text-tenue">
          <span
            className="block h-[14px] w-[14px] shrink-0 rounded-full"
            style={{ background: DEGRADADO }}
          />
          Esto es lo que he entendido
        </p>

        <ul className="mt-4 space-y-2.5">
          {oido.map((q, i) => (
            <li
              key={`${q}-${i}`}
              className="flex items-center gap-4 rounded-[20px] border px-5 py-3"
              style={{
                borderColor: 'var(--t-borde)',
                borderLeft: `6px solid ${TURQUESA}`,
              }}
            >
              <span className="text-[28px] font-extrabold leading-tight text-tinta">{q}</span>

              {/* Quitar uno suelto. Se cuela una palabra de cada diez
                  dictados, y sin esto habría que tirar la frase entera
                  y volver a decirla.

                  Con la palabra escrita y no con un aspa: el punto 5
                  del planteamiento dice que los iconos van siempre
                  acompañados de texto, y una equis sola en una pared es
                  justo donde eso falla. */}
              <button
                type="button"
                onClick={() => setOido((o) => o.filter((_, j) => j !== i))}
                className="tocable ml-auto h-[52px] shrink-0 rounded-full border border-borde px-6 text-[19px] font-extrabold text-tenue"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>

        {fallo && (
          <p className="mt-4 text-[19px] font-bold" style={{ color: 'var(--t-alerta)' }}>
            {fallo}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={guardar}
            disabled={oido.length === 0}
            className="tocable flex h-[76px] flex-1 items-center justify-center gap-3 rounded-[24px] text-[24px] font-extrabold disabled:opacity-45"
            style={{ background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }}
          >
            <Ico nombre="check" tam={28} grosor={2.6} />
            Apuntarlo
          </button>

          <button
            type="button"
            onClick={() => {
              setOido([])
              setFallo(null)
              setEstado('quieto')
            }}
            className="tocable h-[76px] rounded-[24px] border border-borde bg-fondo px-8 text-[22px] font-extrabold text-tinta-suave"
          >
            Dejarlo
          </button>
        </div>
      </div>
    )
  }

  // ── El botón, y la barra mientras oye ──
  const oyendo = estado === 'oyendo'
  const pensando = estado === 'pensando'

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => {
          if (oyendo) grabando.current?.parar()
          else if (!pensando) empezar()
        }}
        disabled={pensando}
        /*
          ── EL COLOR DE LA VOZ, EL DE HUBI ──

          Azul de noche y letra blanca. No es decoración: en HUBI este
          color significa una cosa concreta —«esto ESCUCHA y entiende»—
          y es el mismo de la pantalla de Hablar del móvil, del arranque
          y de la puerta de entrar.

          Antes este botón era una tarjeta blanca más, igual que el de
          apuntar de al lado. Y eso estaba mal por algo más que estético:
          en una pared llena de tarjetas blancas, la única que hace algo
          distinto tiene que parecer distinta.

          Los colores, en `lib/voz-hubi.ts`.
        */
        className="tocable flex h-[88px] w-full items-center justify-center gap-4 rounded-[24px] text-[26px] font-extrabold text-white disabled:opacity-60"
        style={{
          background: NOCHE,
          /* Mientras escucha, el degradado por encima: se ve desde la
             puerta de la cocina que la pared está oyendo. */
          backgroundImage: oyendo ? DEGRADADO : undefined,
        }}
      >
        <Ico nombre="micro" tam={32} grosor={2.3} />
        {pensando ? 'Un momento…' : oyendo ? 'Te escucho · toca para terminar' : 'Decirlo en voz alta'}
      </button>

      {/*
        La barra que se mueve con la voz. No es adorno: es la única
        prueba honesta de que el micrófono está entrando. Se mueve
        porque hay sonido, no porque se haya entendido algo — y eso es
        exactamente lo que hay que enseñar mientras se habla.

        El degradado tumbado y no el de 140 grados: con el inclinado,
        una barra corta sale entera turquesa y no se distingue de una
        larga.
      */}
      {oyendo && (
        <div className="mt-3 h-[10px] w-full overflow-hidden rounded-full" style={{ background: 'var(--t-velo)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{
              width: `${Math.min(100, Math.round(nivel * 140))}%`,
              background: DEGRADADO_TUMBADO,
            }}
          />
        </div>
      )}

      {!oyendo && (
        <p className="mt-2.5 text-[18px] font-bold leading-snug text-tenue">
          Di los productos seguidos: «leche, pan y huevos».
        </p>
      )}

      {fallo && (
        <p className="mt-3 text-[19px] font-bold" style={{ color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}
    </div>
  )
}
