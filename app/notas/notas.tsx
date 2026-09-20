'use client'

import { useEffect, useState } from 'react'
import { AMBITO } from '@/lib/ambitos'
import Link from '@/app/enlace'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import { Aviso } from '../piezas'
import type { NotaVista } from '@/lib/notas'
import { api } from '@/lib/api'
import { refrescar } from '@/lib/refrescar'

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

  Viviendo solo en MAPPEL, un desplegable de «¿para quién?» con una
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
  hayPantalla,
  abrirCaja = false,
}: {
  notas: NotaVista[]
  gente: Quien[]
  yo: string
  /** Falso para quien solo puede mirar. */
  escribo: boolean
  viendoGuardadas: boolean
  /*
    ¿Tiene esta casa una pantalla común encendida?

    Si no la tiene, el botón de la cocina no se pinta: sería una
    decisión más sobre un aparato que no existe. El día que se encienda
    una tablet aparece solo, sin tocar nada.
  */
  hayPantalla: boolean
  /*
    ¿Se entra con la caja de escribir ya abierta?

    En grande, «Dejar una nota» vive arriba en la banda, con el resto
    de acciones del producto. Ese botón es un enlace —`?escribir=1`— y
    esto es lo que lo recoge: la pantalla se pinta con la caja abierta
    y el foco puesto, exactamente igual que si se hubiera pulsado el
    botón de abajo.
  */
  abrirCaja?: boolean
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
  const [escribiendo, setEscribiendo] = useState(abrirCaja)
  /* Qué nota está esperando un sí o un no antes de borrarse. Una
     sola: borrar es de una en una, a propósito. */
  const [borrando, setBorrando] = useState<string | null>(null)

  /*
    ── LA NOTA ELEGIDA ──

    Sólo en escritorio, y sólo hace una cosa: la nota **crece en su
    sitio**. No se abre nada al lado, no se lleva la pantalla, no
    aparece una ventana encima. Se queda donde está, en su columna del
    corcho, con el texto entero y sus botones a la vista.

    Es la manera de un corcho: descolgar un papel para leerlo y volver
    a colgarlo en el mismo sitio. Cualquier otra cosa —un panel a la
    derecha, una ficha— convierte veinte notas en veinte fichas, y
    entonces ya no es un corcho.

    En el móvil no existe: allí todas las notas enseñan sus botones
    siempre, porque con el dedo no hay manera de «acercarse» a una.
  */
  const [laElegida, setLaElegida] = useState<string | null>(null)

  /* Escape la suelta. Es la tecla que se prueba, y aquí no hay nada
     más que cerrar, así que no pisa nada. */
  useEffect(() => {
    if (!laElegida) return
    function alPulsar(e: KeyboardEvent) {
      if (e.key === 'Escape') setLaElegida(null)
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [laElegida])

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
    DE CUATRO PASTILLAS A TRES TÍTULOS
    ═══════════════════════════════════════════════════════════

    Aquí había un filtro: `Todas · Casa · Yo · Julia`, cuatro botones
    que enseñaban un montón y escondían los otros tres. Y por debajo,
    una sola lista mezclada en la que una nota para ti y el recado de
    la fontanería eran el mismo papel.

    Haris lo miró y dijo *«se ve algo caótico… propón algo lógico de
    uso y visualmente más estable»*. Tenía razón por dos motivos que
    se notan más de lo que parece:

    · UN FILTRO NO ES UNA ESTRUCTURA. Para saber si hay algo para ti
      había que PULSAR. Y la pregunta «¿tengo algo?» es la que se hace
      al entrar, no una que merezca un toque.

    · Y LO QUE PULSAS TE ESCONDE LO DEMÁS. Elegir «Yo» hace
      desaparecer las notas de la casa, que es la mitad del corcho.

    Ahora no hay filtro: están todas, siempre, **partidas en montones
    con su título**, y en el orden en que le importan a quien mira:

        PARA TI        lo que te espera. Primero, aunque esté vacío.
        DE LA CASA     lo común.
        PARA JULIA…    lo que le dejaste a otro, y todavía está ahí.

    El montón vacío que se conserva es sólo el tuyo, y por lo de
    siempre: «Para ti · nada» es la respuesta a *¿por qué no me sale
    en el Inicio?*. El de los demás no: un título de alguien que no
    tiene ninguna nota es ruido, no respuesta.

    Nada se esconde, no hay ningún estado que recordar, y la pantalla
    se lee de arriba abajo una sola vez.
  */
  const deQuien = (quien: string | null) => notas.filter((n) => n.para === quien)

  /* Lo tuyo sin ver, arriba del todo de tu montón: es lo único de
     esta pantalla que te está esperando. */
  const paraTi = [...deQuien(yo)].sort((a, b) =>
    a.vista_en === b.vista_en ? 0 : a.vista_en ? 1 : -1
  )

  /*
    ── Y UN MONTÓN PARA LO QUE NO CABE EN NINGUNO ──

    Una nota dirigida a alguien que ya no está en la casa no es de
    nadie de los de arriba. Con el filtro de antes daba igual —«Todas»
    era todas— pero al partir en montones, una nota sin montón
    DESAPARECERÍA de la pantalla sin que nadie pudiera saber que
    existió.

    Repartir nunca puede perder nada. Lo que sobra va al final, con su
    título, y casi siempre no hay nada que poner ahí.
  */
  const conMonton = new Set<string>([
    ...paraTi.map((n) => n.id),
    ...deQuien(null).map((n) => n.id),
    ...otros.flatMap((g) => deQuien(g.id).map((n) => n.id)),
  ])

  const grupos = [
    { clave: 'ti', titulo: 'Para ti', lista: paraTi, siempre: true },
    { clave: 'casa', titulo: 'De la casa', lista: deQuien(null), siempre: false },
    ...otros.map((g) => ({
      clave: g.id,
      titulo: `Para ${g.nombre.split(' ')[0]}`,
      lista: deQuien(g.id),
      siempre: false,
    })),
    {
      clave: 'sueltas',
      titulo: 'De quien ya no está en casa',
      lista: notas.filter((n) => !conMonton.has(n.id)),
      siempre: false,
    },
  ].filter((g) => g.siempre || g.lista.length > 0)

  /*
    Guardadas NO se parte en montones: es un cajón, no un corcho. Lo
    que se busca ahí es una nota concreta que se quitó, y lo último
    que se quitó es casi siempre la que se busca — así que va seguida
    y por fecha, como estaba.

    Y viviendo solo tampoco: «De la casa» y «Para ti» serían el mismo
    montón dicho dos veces.
  */
  const porMontones = !viendoGuardadas && otros.length > 0

  async function pedir(cuerpo: object, metodo: 'POST' | 'PATCH' | 'DELETE') {
    setFallo(null)
    setOcupado(true)

    const r = await fetch(api('/api/notas'), {
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
          : 'mappel no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return false
    }

    refrescar(router)
    return true
  }

  async function poner() {
    if (await pedir({ texto: texto.trim(), para }, 'POST')) {
      setTexto('')
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
    if (bien) setEditando(null)
  }

  /* Borrar del todo. Sólo llega aquí desde Guardadas y después de un
     sí: el botón de la tarjeta se convierte en la pregunta. */
  async function borrarDeVerdad(id: string) {
    if (await pedir({ id }, 'DELETE')) setBorrando(null)
  }


  /*
    ═══════════════════════════════════════════════════════════
    UN CORCHO DE VERDAD, Y COLUMNAS QUE NO SE ADIVINAN
    ═══════════════════════════════════════════════════════════

    En el móvil es una columna de papeles uno encima de otro, porque
    no cabe otra cosa. En un ordenador sí cabe más de uno por fila, y
    entonces se parece a lo que dice ser: se ve todo lo que hay puesto
    sin descolgar nada. Y no es sólo estética — un recado se busca por
    su SITIO («el de arriba a la derecha»), no leyendo veinte de
    arriba abajo. Eso sólo funciona si los sitios existen.

    ── COLUMNAS DE ALTURA LIBRE, NO REJILLA ──

    Una rejilla obliga a que todas las celdas de una fila midan lo que
    la más alta: una nota de seis renglones dejaba dos agujeros de
    papel en blanco a los lados. `columns` reparte como un periódico y
    cada nota ocupa lo que mide. `break-inside-avoid` para que ninguna
    se parta entre dos columnas, que es el único fallo de la técnica.

    ── Y CUÁNTAS COLUMNAS LO DICE EL ANCHO, NO UN PUNTO DE CORTE ──

    Eran tres a 1024 y cuatro a 1800. Con el techo del contenedor
    quitado eso se quedó corto por los dos lados: tres columnas en una
    ventana de 1700 son notas de 560 px de ancho —un papel de nevera
    no mide eso— y en un monitor grande sobraba sitio para otra.

    `columns: 17rem` dice lo que de verdad importa: **una nota mide un
    palmo**. El navegador pone las que quepan y reparte lo que sobra,
    así que la nota acaba midiendo entre 280 y 385 px en todo el
    recorrido —de una ventana de 1100 a un monitor de 4K— en vez de
    los 560 que le tocaban con tres columnas fijas en una pantalla
    ancha. Una regla menos que mantener y ni un punto de corte que
    adivinar.

    (17rem son 272 px, que es el MÍNIMO, no la medida: con 780 px de
    papel caben dos y cada una se queda en 384.)
  */
  const tablero = (lista: NotaVista[]) => (
    <ul className="mt-3 space-y-2.5 lg:[columns:17rem] lg:gap-3 lg:space-y-0">
      {lista.map((n) => {
      const mia = n.escrita_por === yo
      const paraMi = n.para === yo
      const autor = nombreDe.get(n.escrita_por)?.split(' ')[0] ?? 'Alguien'
      const destino = n.para ? (nombreDe.get(n.para)?.split(' ')[0] ?? 'alguien') : null
      const suColor = colorDe.get(n.escrita_por) ?? AMBITO.pizarra

      return (
        <li
          key={n.id}
          /*
            `break-inside-avoid`: que ninguna nota se parta entre
            dos columnas. `lg:mb-3` porque en columnas el hueco
            vertical ya no lo pone `space-y`.

            `grupo` es la clase que enseña los botones al pasar
            por encima, y sólo con ratón. Está en `globals.css`
            con su media query, no aquí, porque con el dedo no
            existe «pasar por encima» y una nota con los botones
            escondidos sería una nota sin botones.
          */
          className={
            'grupo rounded-[20px] border border-borde bg-superficie px-4 py-3.5 lg:mb-3 lg:break-inside-avoid ' +
            (laElegida === n.id ? 'elegida' : '')
          }
          onClick={(e) => {
            /* Elegir es sólo «acercarse» a esta nota. No abre
               nada ni cambia de sitio: enseña el texto entero y
               los botones. Se vuelve a pulsar y se suelta.

               Y pulsar un botón DE DENTRO no cuenta: sin esta
               comprobación, tocar «Visto» marcaría la nota como
               vista y además la soltaría, que es un movimiento
               de más justo cuando se acaba de hacer algo. */
            if (editando === n.id) return
            if ((e.target as HTMLElement).closest('button,a,textarea')) return
            setLaElegida((x) => (x === n.id ? null : n.id))
          }}
          style={
            /* Una nota que es PARA TI se ve distinta desde el otro
               lado de la habitación: es lo único de esta pantalla
               que exige algo de quien la lee, y por eso se lleva
               el borde entero.

               El resto solo lleva una barra a la izquierda con el
               color de quien la escribió. Es suficiente para
               saber de quién es sin leer la firma, y no compite
               con lo que sí te está esperando. */
            /* ── Y LA BARRA LA LLEVAN TODAS, TAMBIÉN LAS TUYAS ──

               Las tuyas no la llevaban —`mia ? undefined`— y eso
               hacía que en un corcho con cuatro notas seguidas el
               texto empezara 4 px más a la izquierda en unas que en
               otras. Es de las cosas que no se saben ver pero se
               notan: el borde izquierdo del montón baila.

               Parte de lo «caótico» era esto. Ahora todas llevan su
               barra, y la tuya lleva TU color, que además es el que
               dice el Inicio y el que dice la Agenda. */
            paraMi && !n.vista_en
              ? {
                  borderColor: '#14B8A6',
                  background: 'color-mix(in srgb, #14B8A6 8%, var(--t-superficie))',
                  borderLeft: `4px solid ${suColor}`,
                }
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
              {/* Recortada a ocho renglones mientras no está
                  elegida, y sólo en grande: en un corcho de tres
                  columnas, una nota de treinta líneas se come la
                  columna entera y las cuatro de debajo dejan de
                  verse. Elegirla la abre del todo. */}
              <p className="texto-nota t-cuerpo whitespace-pre-wrap font-semibold">
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
              <div className="acciones mt-3 flex flex-wrap gap-2">
                {/*
                  ── LA PREGUNTA OCUPA EL SITIO DE LOS BOTONES ──

                  Y no una ventana encima de la pantalla. Una ventana
                  tapa justo lo que hay que mirar para contestarla —el
                  texto de la nota— y obliga a acordarse de cuál era.
                  Aquí la nota sigue delante, entera, y la pregunta
                  está en su pie.

                  «Sí, bórrala» y no «Sí» a secas: el botón dice lo
                  que hace, que es la regla de toda la aplicación, y
                  además se lee bien a medio metro.
                */}
                {borrando === n.id ? (
                  <>
                    <span className="t-apoyo w-full font-extrabold">
                      Se borra del todo y no se puede recuperar.
                    </span>
                    <Boton
                      texto="Sí, bórrala"
                      ocupado={ocupado}
                      alPulsar={() => borrarDeVerdad(n.id)}
                      peligro
                    />
                    <Boton texto="No" ocupado={ocupado} alPulsar={() => setBorrando(null)} />
                  </>
                ) : (
                <>
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

                {/*
                  ── BORRAR SÓLO VIVE AQUÍ ──

                  En Guardadas, y sólo para quien la escribió —que es
                  lo que deja hacer la política de la base de datos
                  desde el primer día—.

                  No está en el corcho a propósito: allí el botón de
                  al lado es «Quitar», que se usa todos los días, y
                  dos botones pegados que hacen cosas tan distintas se
                  confunden una vez cada cien. Una de cada cien veces
                  es demasiado cuando no hay vuelta atrás.
                */}
                {viendoGuardadas && mia && escribo && (
                  <Boton
                    texto="Borrar"
                    ocupado={ocupado}
                    alPulsar={() => setBorrando(n.id)}
                  />
                )}

                {/* Y si hay pantalla en la casa, si esta nota sale
                    ahí. Se decide MIRANDO la nota, que es cuando
                    se puede decidir bien. */}
                {hayPantalla && (mia || paraMi) && escribo && !viendoGuardadas && (
                  <Boton
                    texto={n.visible_en_casa ? 'Fuera de la cocina' : 'En la cocina'}
                    ocupado={ocupado}
                    alPulsar={() =>
                      pedir(
                        {
                          id: n.id,
                          que: n.visible_en_casa ? 'fuera-de-la-cocina' : 'en-la-cocina',
                        },
                        'PATCH'
                      )
                    }
                  />
                )}
                </>
                )}
              </div>
            </>
          )}
        </li>
      )
      })}
    </ul>
  )

  return (
    <>
      {/* ── Puestas · Guardadas ──
          `lg:hidden`: en grande viven arriba, en la banda, con la
          misma píldora del sistema. Decirlo dos veces en la misma
          pantalla es decirlo peor. */}
      <div className="mt-1 flex gap-2 lg:hidden">
        <Pestana texto="En el corcho" href="/notas" puesta={!viendoGuardadas} />
        <Pestana texto="Guardadas" href="/notas?ver=guardadas" puesta={viendoGuardadas} />
      </div>

      {/* Quien solo mira no ve la caja de escribir. Se le dice por qué,
          una vez y sin dramatismo: no ha hecho nada mal. */}
      {!escribo && (
        <p className="t-apoyo mt-4 rounded-[16px] border border-borde px-4 py-3.5">
          Puedes leer las notas de la casa, pero no dejar ninguna.
        </p>
      )}

      {/* Qué es esto y qué se puede hacer aquí, dicho al entrar. Sin
          esta línea, «Guardadas» es un cajón del que nadie sabe si se
          vacía nunca — y la respuesta, desde hoy, es que sí. */}
      {viendoGuardadas && (
        <p className="t-apoyo mt-4">
          Lo que quitas del corcho se queda aquí. Puedes volver a ponerlo o,
          si ya no hace falta, borrarlo del todo.
        </p>
      )}

      {/* ── El corcho ── */}
      {notas.length === 0 ? (
        <p className="t-cuerpo mt-4 rounded-[20px] border border-borde bg-superficie px-6 py-8 text-center text-tinta-suave">
          {viendoGuardadas
            ? 'No has guardado ninguna nota todavía.'
            : 'No hay ninguna nota puesta.'}
        </p>
      ) : porMontones ? (
        /*
          El corcho de una casa con más de una persona: por montones,
          con su título, y sin nada escondido detrás de un filtro.
        */
        grupos.map((g) => (
          <section key={g.clave}>
            <h2 className="rotulo mt-6 first:mt-4">
              {g.titulo}
              {g.lista.length > 0 && ` · ${g.lista.length}`}
            </h2>
            {g.lista.length === 0 ? (
              <p className="t-apoyo mt-2">Nada para ti ahora mismo.</p>
            ) : (
              tablero(g.lista)
            )}
          </section>
        ))
      ) : (
        tablero(notas)
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
            /* SOLO EN EL MÓVIL. En grande «Dejar una nota» vive arriba
               en la banda: aquí abajo, después de veinte notas, para
               poner una había que bajar hasta el final del corcho. */
            className="t-tarjeta mt-4 flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[16px] border border-borde bg-superficie text-tinta lg:hidden"
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

/* Los botones de una nota. Con texto SIEMPRE, nunca un dibujo suelto:
   el punto 5 lo dice y aquí se nota — «quitar» y «cambiar» dibujados
   se parecen demasiado. */
function Boton({
  texto,
  ocupado,
  alPulsar,
  fuerte = false,
  peligro = false,
}: {
  texto: string
  ocupado: boolean
  alPulsar: () => void
  fuerte?: boolean
  /* El único que no tiene vuelta atrás. Va en el coral de alerta, y
     sólo aparece DESPUÉS de preguntar: un botón rojo a la vista todo
     el rato acaba pulsándose. */
  peligro?: boolean
}) {
  return (
    <button
      onClick={alPulsar}
      disabled={ocupado}
      className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-[16px] px-2 text-[15px] font-extrabold disabled:opacity-50"
      style={
        peligro
          ? { background: 'var(--t-alerta)', color: '#FFFFFF' }
          : fuerte
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
