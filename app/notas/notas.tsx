'use client'

import { useState } from 'react'
import { AMBITO } from '@/lib/ambitos'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import { Aviso } from '../piezas'
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

  Pero cuando sale, TÚ estás en él. Es «Para la casa · Para mí · Para
  Conchita», y las tres hacen cosas distintas: la de la casa no avisa
  a nadie, la tuya se te queda en el Inicio hasta que la despachas, y
  la de otra persona le hace sonar el móvil.

  ─────────────────────────────────────────────────────────────
  Y LAS NOTAS NO SON PRIVADAS

  Una nota dirigida a alguien la sigue viendo toda la casa: es un
  corcho, no un chat. Se dice donde se escribe, no en unos ajustes —
  quien deja una nota tiene que saberlo ANTES de escribirla.
*/

type Quien = { id: string; nombre: string; color?: string }

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
  /* Para quién queda la nota al corregirla. Empieza en el que tenía. */
  const [otroDestino, setOtroDestino] = useState<string | null>(null)
  /* Qué montón se está mirando, y si la caja de escribir está abierta. */
  const [mirando, setMirando] = useState<string>('todas')
  const [escribiendo, setEscribiendo] = useState(false)

  const otros = gente.filter((g) => g.id !== yo)

  /*
    ── Y TÚ TAMBIÉN ──

    Faltabas en tu propia lista. Dejarse una nota a uno mismo es lo que
    hace cualquiera con un papel en la nevera, y hasta ahora aquí no se
    podía: te quedaba «para la casa», que no es lo mismo — la de la
    casa no sale en tu Inicio ni se queda ahí hasta que la despachas.

    Vas después de «Para la casa» y antes que los demás, porque es el
    destino que más se usa después del común. Y no sale tu nombre sino
    «Para mí»: leerse a uno mismo en tercera persona en una lista donde
    están los demás hace dudar de si ése eres tú.
  */
  const destinos: { id: string | null; etiqueta: string }[] = [
    { id: null, etiqueta: 'Para la casa' },
    { id: yo, etiqueta: 'Para mí' },
    ...otros.map((g) => ({ id: g.id, etiqueta: `Para ${g.nombre.split(' ')[0]}` })),
  ]
  const nombreDe = new Map(gente.map((g) => [g.id, g.nombre]))
  /* El color de quien la escribió. Con cuatro personas en la casa,
     saber de quién es cada nota obliga hoy a leerse la firma de cada
     una; una barra de color a la izquierda lo contesta de reojo. */
  /* Pizarra de la paleta, no el gris azulado de antes. */
  const colorDe = new Map(gente.map((g) => [g.id, g.color ?? AMBITO.pizarra]))

  /*
    ═══════════════════════════════════════════════════════════
    UN CORCHO SE MIRA POR MONTONES
    ═══════════════════════════════════════════════════════════

    Antes esto era una lista sola con todo mezclado, y para saber si
    había algo para ti había que leerse las veinte y fijarse en la
    letra pequeña de cada una. Un corcho de verdad tiene la parte de la
    casa y la parte de cada uno.

    ─────────────────────────────────────────────────────────
    Y LOS MONTONES VACÍOS TAMBIÉN SE ENSEÑAN

    «Para mí · 0» parece información inútil y es justo lo contrario:
    es la respuesta a «¿por qué no me sale en el Inicio?». Escondiendo
    el montón cuando está vacío, esa pregunta no tiene dónde
    contestarse — y quien la hace acaba pensando que la aplicación
    falla cuando lo que pasa es que la nota se puso para la casa.
  */
  const cuantasCon = (quien: string | null) =>
    notas.filter((n) => n.para === quien).length

  /*
    ── Y CABEN EN UNA LÍNEA PORQUE LAS PALABRAS SON CORTAS ──

    Eran «Todas · 4», «De la casa · 3», «Para mí · 1», «Para Julia ·
    0»: cuatro pastillas gordas que se iban a dos filas y ocupaban más
    que las propias notas. El «Para» se repetía en tres de las cuatro
    sin distinguir nada, y el título de la pantalla ya dice Notas.

    Con `Todas · Casa · Yo · Julia` cabe la fila entera. Y «Yo» junto a
    «Julia» se entiende de un vistazo: son la misma clase de cosa —una
    persona— dicha con la misma clase de palabra.
  */
  const montones = [
    { clave: 'todas', etiqueta: 'Todas', cuantas: notas.length },
    { clave: 'casa', etiqueta: 'Casa', cuantas: cuantasCon(null) },
    { clave: yo, etiqueta: 'Yo', cuantas: cuantasCon(yo) },
    ...otros.map((g) => ({
      clave: g.id,
      etiqueta: g.nombre.split(' ')[0],
      cuantas: cuantasCon(g.id),
    })),
  ]

  const visibles = notas.filter((n) =>
    mirando === 'todas' ? true : mirando === 'casa' ? n.para === null : n.para === mirando
  )

  const comoSeLlama = montones.find((m) => m.clave === mirando)?.etiqueta ?? 'Todas'

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
      /* Se queda mirando el montón donde acaba de caer: si la pusiste
         para Julia, quieres verla en el de Julia. Sin esto, la nota
         «desaparece» al ponerla desde otro montón. */
      setMirando(para ?? 'casa')
      setPara(null)
      setEscribiendo(false)
    }
  }

  async function guardarCambio(id: string) {
    /* `destino: ''` es «para la casa» y `undefined` sería «no lo
       toques». Se manda siempre porque la pantalla siempre lo
       enseña: lo que se ve es lo que se guarda. */
    const bien = await pedir(
      { id, que: 'texto', texto: borrador.trim(), destino: otroDestino ?? '' },
      'PATCH'
    )
    if (bien) {
      setEditando(null)
      setMirando(otroDestino ?? 'casa')
    }
  }

  return (
    <>
      {/* ── Puestas · Guardadas ── */}
      <div className="mt-1 flex gap-2">
        <Pestana texto="En el corcho" href="/notas" puesta={!viendoGuardadas} />
        <Pestana texto="Guardadas" href="/notas?ver=guardadas" puesta={viendoGuardadas} />
      </div>

      {/*
        ── LOS MONTONES ──

        Van envueltas, no en una sola línea que se sale: con cuatro
        personas en casa son seis pastillas, y una barra que se
        desliza esconde justo la que buscas. Envolver no esconde nada.

        Solo salen si hay más gente: viviendo solo en HUBI, «De la
        casa» y «Para mí» son la misma cosa.
      */}
      {otros.length > 0 && (
        <div className="mt-3 flex gap-1.5" role="group" aria-label="Qué notas ver">
          {montones.map((m) => (
            <Monton
              key={m.clave}
              etiqueta={m.etiqueta}
              cuantas={m.cuantas}
              puesta={mirando === m.clave}
              alPulsar={() => setMirando(m.clave)}
            />
          ))}
        </div>
      )}

      {/* Quien solo mira no ve la caja de escribir. Se le dice por qué,
          una vez y sin dramatismo: no ha hecho nada mal. */}
      {!escribo && (
        <p className="t-apoyo mt-4 rounded-[16px] border border-borde px-4 py-3.5">
          Puedes leer las notas de la casa, pero no dejar ninguna.
        </p>
      )}

      {/* ── El corcho ── */}
      {visibles.length === 0 ? (
        <p className="t-cuerpo mt-4 rounded-[20px] border border-borde bg-superficie px-6 py-8 text-center text-tinta-suave">
          {viendoGuardadas
            ? 'No has guardado ninguna nota todavía.'
            : mirando === 'todas'
              ? 'No hay ninguna nota puesta.'
              : /* Y se dice DE QUÉ montón está hablando. «No hay
                   ninguna» a secas, con las pestañas encima, se lee
                   como «no hay ninguna en toda la casa». */
                `Aquí no hay nada. ${comoSeLlama} está vacío.`}
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {visibles.map((n) => {
            const mia = n.escrita_por === yo
            const paraMi = n.para === yo
            const autor = nombreDe.get(n.escrita_por)?.split(' ')[0] ?? 'Alguien'
            const destino = n.para ? (nombreDe.get(n.para)?.split(' ')[0] ?? 'alguien') : null
            const suColor = colorDe.get(n.escrita_por) ?? AMBITO.pizarra

            return (
              <li
                key={n.id}
                className="rounded-[20px] border border-borde bg-superficie px-4 py-3.5"
                style={
                  /* Una nota que es PARA TI se ve distinta desde el otro
                     lado de la habitación: es lo único de esta pantalla
                     que exige algo de quien la lee, y por eso se lleva
                     el borde entero.

                     El resto solo lleva una barra a la izquierda con el
                     color de quien la escribió. Es suficiente para
                     saber de quién es sin leer la firma, y no compite
                     con lo que sí te está esperando. */
                  paraMi && !n.vista_en
                    ? {
                        borderColor: '#14B8A6',
                        background: 'color-mix(in srgb, #14B8A6 8%, var(--t-superficie))',
                        borderLeft: `4px solid ${suColor}`,
                      }
                    : mia
                      ? undefined
                      : { borderLeft: `4px solid ${suColor}` }
                }
              >
                {editando === n.id ? (
                  <>
                    <textarea
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                      rows={3}
                      maxLength={1200}
                      className="w-full resize-y rounded-[16px] border border-borde bg-superficie px-4 py-3.5 text-[19px] font-semibold leading-snug text-tinta outline-none focus:border-[color:var(--color-accion)]"
                      autoFocus
                    />
                    {/* PARA QUIÉN, TAMBIÉN AL CORREGIR.

                        Se podía arreglar la letra pero no la persona,
                        y equivocarse de persona al ponerla es lo más
                        fácil del mundo: las pastillas están una al
                        lado de otra. Sin esto había que quitar la nota
                        y escribirla otra vez. */}
                    {otros.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {destinos.map((d) => (
                          <Pastilla
                            key={d.id ?? 'casa'}
                            texto={d.etiqueta}
                            puesta={otroDestino === d.id}
                            alPulsar={() => setOtroDestino(d.id)}
                          />
                        ))}
                      </div>
                    )}

                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => guardarCambio(n.id)}
                        disabled={ocupado || borrador.trim().length === 0}
                        className="t-cuerpo h-[60px] flex-1 rounded-[16px] font-extrabold disabled:opacity-50"
                        style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        disabled={ocupado}
                        className="t-cuerpo h-[60px] flex-1 rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta disabled:opacity-50"
                      >
                        Dejarlo
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* `whitespace-pre-wrap`: si alguien escribe la nota
                        en tres renglones, se lee en tres renglones. */}
                    <p className="t-cuerpo whitespace-pre-wrap font-semibold">
                      {n.texto}
                    </p>

                    <p className="t-apoyo mt-2">
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
                      <p
                        className="t-apoyo mt-1.5 flex items-center gap-1.5 font-extrabold"
                        style={{ color: 'var(--t-bien)' }}
                      >
                        <Ico nombre="check" tam={16} grosor={2.4} />
                        Visto
                      </p>
                    )}

                    {/* En UNA línea, repartidos. Antes cada botón
                        llevaba su dibujo delante y se medía por su
                        palabra, así que tres se iban a dos filas y una
                        nota de seis palabras ocupaba media pantalla de
                        botones. Los dibujos se van —«Visto», «Cambiar»
                        y «Quitar» no se confunden escritos— y el ancho
                        lo reparte la fila. */}
                    <div className="mt-3 flex gap-2">
                      {paraMi && !n.vista_en && escribo && (
                        <Boton
                          texto="Visto"
                          ocupado={ocupado}
                          alPulsar={() => pedir({ id: n.id, que: 'visto' }, 'PATCH')}
                          fuerte
                        />
                      )}

                      {mia && !viendoGuardadas && escribo && (
                        <Boton
                          texto="Cambiar"
                          ocupado={ocupado}
                          alPulsar={() => {
                            setEditando(n.id)
                            setBorrador(n.texto)
                            setOtroDestino(n.para)
                          }}
                        />
                      )}

                      {(mia || paraMi) &&
                        escribo &&
                        (viendoGuardadas ? (
                          <Boton
                            texto="Volver a ponerla"
                            ocupado={ocupado}
                            alPulsar={() => pedir({ id: n.id, que: 'recuperar' }, 'PATCH')}
                          />
                        ) : (
                          <Boton
                            texto="Quitar"
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

      {/*
        ═══════════════════════════════════════════════════════════
        ¿DEJAMOS OTRA NOTA?
        ═══════════════════════════════════════════════════════════

        Esto estaba ARRIBA y abierto de par en par, con su caja de
        texto y sus pastillas ocupando media pantalla. Y el corcho
        empezaba por debajo del pliegue: para leer lo que te han
        dejado había que pasar antes por el formulario de dejar otra.

        En un corcho se mira primero y se escribe después. Ahora eso
        es lo que hace la pantalla.

        ─────────────────────────────────────────────────────────
        PERO NO ES UN «+» QUE ABRE OTRA PANTALLA

        Ésa era la razón de tenerlo arriba, y sigue siendo buena: una
        nota se pone en cinco segundos y esconderla detrás de dos
        pantallas convierte cinco segundos en tres toques.

        Por eso se despliega AQUÍ MISMO. Un toque, y la caja está
        abierta debajo con el foco puesto. Se gana el orden de lectura
        sin pagar el precio del «+».
      */}
      {escribo && !viendoGuardadas && (
        escribiendo ? (
          <div className="mt-4 rounded-[20px] border border-borde bg-superficie px-4 py-4">
            <label htmlFor="nota" className="t-tarjeta block">
              Deja una nota
            </label>
            <textarea
              id="nota"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              maxLength={1200}
              autoFocus
              placeholder="La llave del garaje está en el cajón de la entrada"
              className="mt-2.5 w-full resize-y rounded-[16px] border border-borde bg-superficie px-4 py-3.5 text-[19px] font-semibold leading-snug text-tinta outline-none placeholder:font-semibold placeholder:text-tenue focus:border-[color:var(--color-accion)]"
            />

            {otros.length > 0 && (
              <>
                <p className="rotulo mt-4">¿Para quién?</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {destinos.map((d) => (
                    <Pastilla
                      key={d.id ?? 'casa'}
                      texto={d.etiqueta}
                      puesta={para === d.id}
                      alPulsar={() => setPara(d.id)}
                    />
                  ))}
                </div>
                {/* Lo que va a pasar, dicho antes de pulsar. Los tres
                    destinos hacen tres cosas distintas y ninguna se
                    adivina mirando la pastilla. */}
                <p className="t-apoyo mt-2.5">
                  {para === null
                    ? 'La verá todo el mundo en casa. No suena ningún teléfono.'
                    : para === yo
                      ? 'Te saldrá en tu Inicio hasta que la marques como vista. No suena ningún teléfono.'
                      : 'Le llega un aviso al móvil. La nota la sigue viendo toda la casa.'}
                </p>
              </>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={poner}
                disabled={ocupado || texto.trim().length === 0}
                className="t-cuerpo flex h-[60px] flex-1 items-center justify-center gap-2 rounded-[16px] font-extrabold disabled:opacity-50"
                style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
              >
                <Ico nombre="chincheta" tam={19} grosor={2.3} />
                {ocupado ? 'Poniendo…' : 'Poner la nota'}
              </button>
              <button
                onClick={() => {
                  setEscribiendo(false)
                  setFallo(null)
                }}
                disabled={ocupado}
                className="t-cuerpo h-[60px] flex-1 rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta disabled:opacity-50"
              >
                Ahora no
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEscribiendo(true)}
            className="t-tarjeta mt-4 flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[16px] border border-borde bg-superficie text-tinta"
          >
            <Ico nombre="mas" tam={21} grosor={2.4} />
            ¿Dejamos otra nota?
          </button>
        )
      )}

      {/* Se dice dónde va lo que se quita. «Quitar» a secas suena a
          borrar, y nadie pulsa un botón que suena a borrar. */}
      {!viendoGuardadas && notas.length > 0 && escribo && (
        <p className="t-apoyo mt-3 text-center">
          Lo que quites no se borra: queda en Guardadas.
        </p>
      )}

      {fallo && (
        <div className="mt-3">
          <Aviso titulo="No se ha podido" explicacion={fallo} />
        </div>
      )}
    </>
  )
}

function Pestana({ texto, href, puesta }: { texto: string; href: string; puesta: boolean }) {
  return (
    <Link
      href={href}
      aria-current={puesta ? 'page' : undefined}
      /* Eran 44 px y se rellenaban de naranja saturado. El naranja es
         ahora el color de «atención», no el de una sección — y una
         pestaña elegida no reclama nada, solo dice dónde estás. */
      className="flex h-12 flex-1 items-center justify-center rounded-full text-[15px] font-extrabold"
      style={
        puesta
          ? { background: 'var(--t-tinta)', color: 'var(--t-fondo)', border: '1px solid var(--t-tinta)' }
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
      className="flex h-12 items-center rounded-full px-4 text-[15px] font-extrabold"
      style={
        puesta
          ? { background: 'var(--t-tinta)', color: 'var(--t-fondo)', border: '1px solid var(--t-tinta)' }
          : {
              background: 'var(--t-superficie)',
              color: 'var(--t-tinta-suave)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      {/* El «✓ » iba pegado al texto y la etiqueta se desplazaba dos
          caracteres al elegirla: toda la fila bailaba. */}
      {texto}
    </button>
  )
}

/*
  Una pestaña de montón: la palabra y cuántas hay.

  `flex-1` con `min-w-0`: se reparten el ancho a partes iguales y
  nunca se van a una segunda fila, tenga la casa dos personas o cinco.
  El número va debajo y más pequeño — al lado alargaba la pastilla
  justo lo que hacía falta para no caber.
*/
function Monton({
  etiqueta,
  cuantas,
  puesta,
  alPulsar,
}: {
  etiqueta: string
  cuantas: number
  puesta: boolean
  alPulsar: () => void
}) {
  return (
    <button
      onClick={alPulsar}
      aria-pressed={puesta}
      className="flex h-[56px] min-w-0 flex-1 flex-col items-center justify-center rounded-[16px] px-1"
      style={
        puesta
          ? { background: 'var(--t-tinta)', color: 'var(--t-fondo)', border: '1px solid var(--t-tinta)' }
          : {
              background: 'var(--t-superficie)',
              color: 'var(--t-tinta-suave)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      <span className="w-full truncate text-center text-[15px] font-extrabold leading-none">
        {etiqueta}
      </span>
      <span
        className="mt-1 text-[13px] font-bold leading-none tabular-nums"
        style={{ opacity: cuantas === 0 ? 0.45 : 0.8 }}
      >
        {cuantas}
      </span>
    </button>
  )
}

/* Los botones de una nota. Con texto SIEMPRE, nunca un dibujo suelto:
   el punto 5 lo dice y aquí se nota — «quitar» y «cambiar» dibujados
   se parecen demasiado. */
function Boton({
  texto,
  ocupado,
  alPulsar,
  fuerte = false,
}: {
  texto: string
  ocupado: boolean
  alPulsar: () => void
  fuerte?: boolean
}) {
  return (
    <button
      onClick={alPulsar}
      disabled={ocupado}
      className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-[16px] px-2 text-[15px] font-extrabold disabled:opacity-50"
      style={
        fuerte
          ? { background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }
          : {
              background: 'var(--t-superficie)',
              color: 'var(--t-tinta)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      {texto}
    </button>
  )
}
