'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Ico, pintaDe } from '../iconos'
import { AMBITO, PastillaAmbito } from '../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  UNA COSA EN LA PARED
  ═══════════════════════════════════════════════════════════════

  La misma tarjeta de `tablon/tarjeta.tsx`: papel blanco, marca del
  ámbito al borde izquierdo, pastilla con el icono dibujado, y el cuándo
  en cifra tabular a la izquierda del texto.

  Tres tamaños: el de Hoy, el de las listas, y el de dentro de una
  columna. Y ni uno más — por la misma razón por la que `Fila` tiene dos
  alturas: en cuanto haya cuatro, vuelve a haber un dibujo por pantalla
  en vez de un sistema.

  ─────────────────────────────────────────────────────────────
  Y DESDE EL PASO 74, SE PUEDE TACHAR

  Con `id`, la tarjeta entera es un botón que marca hecho y deshecho.
  Sin `id`, es papel: se lee y no se toca.

  Se pasa `id` donde tachar significa algo —lo de HOY y el día que se
  abre desde el calendario— y no en «Después» ni dentro de las columnas
  de la semana. Tachar el martes que viene desde una pared, de paso, es
  la clase de toque que se da sin querer y que nadie deshace porque
  nadie se entera.

  ─────────────────────────────────────────────────────────────
  LO QUE LA PARED PUEDE Y LO QUE NO, Y DÓNDE ESTÁ DECIDIDO

  Aquí no se comprueba nada: se intenta y manda la base.

      la política del 74  →  solo las filas que se ven en la pared
      el disparador       →  solo las columnas `estado`, `hecho_en`
                             y `hecho_por`

  Si alguien quitara la política mañana, esto empezaría a fallar solo,
  que es lo que tiene que pasar. Comprobarlo también aquí sería una
  segunda regla para lo mismo, y el día que una se olvide conviene que
  se olvide la que no protege.
*/

export type Talla = 'hoy' | 'lista' | 'columna'

/** Alguien de la casa, para poder decir de quién es un recado. */
export type Quien = { id: string; nombre: string; color: string }

export default function Cosa({
  id,
  titulo,
  cuando,
  talla = 'lista',
  hecha = false,
  cambiable = false,
  fecha,
  hora,
  para = null,
  gente = [],
  dequienes = [],
}: {
  /** Con identificador, se puede tachar. Sin él, es papel. */
  id?: string
  titulo: string
  /** La hora, o el día. Ya escrito: quien lo sabe es de fuera. */
  cuando?: string
  talla?: Talla
  hecha?: boolean
  /** Con esto sale el botón de Cambiar (paso 79). */
  cambiable?: boolean
  /** Lo que hay guardado, para poder editarlo sin volver a pedirlo. */
  fecha?: string | null
  hora?: string | null
  para?: string | null
  gente?: Quien[]
  /*
    ── DE QUIÉN ES, EN COLOR ──

    La pared no decía de quién era nada, y era una decisión: los
    nombres no se leen a dos metros y una cosa para dos personas se
    junta en una sola fila.

    Pero «de quién es» sí se lee a dos metros **si no es un nombre**.
    Un círculo del color de cada uno —el mismo que ya llevan en el
    corcho y en las notas— se ve de reojo desde la puerta de la
    cocina, que es como se mira esto.

    Vacío = de la casa. Y entonces no se pinta nada: un hueco gris
    diciendo «de nadie» sería una pregunta donde no la hay.
  */
  dequienes?: string[]
}) {
  const router = useRouter()
  const [marcada, setMarcada] = useState(hecha)
  const [fallo, setFallo] = useState(false)
  const [editando, setEditando] = useState(false)

  /*
    La MISMA función que pinta esa tarea en el tablón y en la agenda.
    Esta pantalla llegó a tener su propia tabla de emojis, así que una
    cita médica era 🩺 aquí y un corazón rosa en el móvil: dos idiomas
    para la misma cosa, y ninguno de los dos era el de MAPPEL.
  */
  const p = pintaDe(titulo)

  async function tachar() {
    if (!id) return
    const antes = marcada

    /* Se pinta ya. En una pared, un toque que tarda medio segundo en
       responder se vuelve a dar. */
    setMarcada(!antes)
    setFallo(false)

    try {
      const r = await fetch(api(`/api/recordatorios/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: antes ? 'pendiente' : 'hecho' }),
      })
      if (!r.ok) throw new Error()
      router.refresh()
    } catch {
      setMarcada(antes)
      setFallo(true)
    }
  }

  const marco =
    talla === 'hoy'
      ? 'gap-6 px-6 py-5'
      : talla === 'lista'
        ? 'gap-4 px-5 py-3.5'
        : 'gap-3.5 px-4 py-3'

  const dentro = (
    <>
      {/*
        El cuándo va PRIMERO, que es lo que se busca desde la puerta, y
        en columna fija para que los títulos de todas las filas empiecen
        en el mismo sitio. Sin hora, la columna se queda vacía en vez de
        poner una raya: un guion a 40 px es una cosa que hay que leer
        para descubrir que no dice nada.

        275 px en las listas, y `whitespace-nowrap`. Con 230, «mar 10
        ago 2027» partía y dejaba el «2027» solo en la línea de abajo —
        la regla 1 de `reglas-de-pantalla.md`, que en esta pantalla ya ha
        aparecido dos veces.
      */}
      {talla !== 'columna' && (
        <span
          className={`shrink-0 whitespace-nowrap font-extrabold tabular-nums tracking-tight ${
            talla === 'hoy'
              ? 'w-[112px] text-[34px] text-tinta xl:w-[128px] xl:text-[40px]'
              : 'w-[240px] text-[23px] text-tinta-suave'
          }`}
        >
          {cuando ?? ''}
        </span>
      )}

      <PastillaAmbito
        icono={p.icono}
        ambito={p.ambito}
        tam={talla === 'hoy' ? 56 : talla === 'lista' ? 44 : 36}
      />

      <span className="min-w-0 flex-1">
        {/* En columna el cuándo no cabe al lado, así que va encima y
            pequeño. Quitarlo del todo dejaría un día entero de la
            semana sin decir a qué hora es nada. */}
        {talla === 'columna' && cuando && (
          <span className="block text-[15px] font-extrabold tabular-nums text-tenue">{cuando}</span>
        )}
        <span
          className={`block font-extrabold leading-tight text-tinta ${
            talla === 'hoy'
              ? 'text-[28px] xl:text-[31px]'
              : talla === 'lista'
                ? 'text-[24px]'
                : 'text-[17px]'
          } ${marcada ? 'line-through' : ''}`}
        >
          {titulo}
        </span>
        {fallo && (
          <span className="mt-1 block text-[17px] font-bold" style={{ color: 'var(--t-alerta)' }}>
            No se ha podido cambiar
          </span>
        )}
      </span>

      {/*
        ── LAS CARAS, ANTES DE LA CASILLA ──

        Aquí y no al principio: el orden de lectura de esta tarjeta es
        **cuándo · qué · de quién**, y el de quién es lo último que se
        pregunta. Delante competiría con la hora, que es lo que se
        busca desde la puerta.

        Se solapan 10 px como en cualquier grupo de caras, y de tres en
        adelante se corta: cuatro círculos en una fila dejan de contar
        personas y pasan a ser una mancha.
      */}
      {dequienes.length > 0 && talla !== 'columna' && (
        <span className="flex shrink-0 items-center">
          {dequienes.slice(0, 3).map((q, i) => {
            const suyo = gente.find((g) => g.id === q)
            if (!suyo) return null
            return (
              <span
                key={q}
                title={suyo.nombre}
                className={
                  'rounded-full border-[3px] ' +
                  (talla === 'hoy' ? 'h-[46px] w-[46px]' : 'h-[34px] w-[34px]')
                }
                style={{
                  background: suyo.color,
                  borderColor: 'var(--t-superficie)',
                  marginLeft: i === 0 ? 0 : -10,
                }}
              />
            )
          })}
        </span>
      )}

      {/*
        La casilla, al final. No es lo que se toca —se toca la fila
        entera— : está para DECIR que esto se tacha, y para que se vea
        desde lejos cuáles quedan.

        Al final y no al principio a propósito: delante rompería el
        orden de lectura que ya tiene esta tarjeta —cuándo, qué— y que
        es el mismo en las cinco pantallas de la pared.
      */}
      {id && (
        <span
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] border-2"
          style={{
            borderColor: marcada ? 'transparent' : 'var(--t-borde)',
            background: marcada ? AMBITO.verde : 'transparent',
            color: '#FFFFFF',
          }}
        >
          {marcada && <Ico nombre="check" tam={26} grosor={2.6} />}
        </span>
      )}
    </>
  )

  /*
    ── CAMBIAR ESTÁ ABIERTO (paso 79) ──

    El botón va FUERA del botón de tachar, no dentro: un botón dentro de
    otro botón no es HTML válido y, peor, en una pantalla táctil el
    dedo no sabe cuál de los dos ha tocado.

    Y es pequeño al lado de la tarjeta entera a propósito: tachar es lo
    que se hace veinte veces al día y cambiar una vez a la semana. El
    sitio grande es para lo que se usa.
  */
  if (editando && id) {
    return (
      <li>
        <Cambiar
          id={id}
          titulo={titulo}
          fecha={fecha ?? null}
          hora={hora ?? null}
          para={para}
          gente={gente}
          alCerrar={() => setEditando(false)}
        />
      </li>
    )
  }

  const pinta = {
    borderColor: 'var(--t-borde)',
    borderLeft: `6px solid ${marcada ? 'var(--t-borde)' : AMBITO[p.ambito]}`,
  }

  const clase =
    `flex w-full items-center rounded-[28px] border bg-superficie ${marco} ` +
    `${marcada ? 'opacity-50' : ''}`

  return (
    <li className={cambiable && id ? 'flex items-center gap-3' : undefined}>
      {id ? (
        <button type="button" onClick={tachar} className={`tocable ${clase} text-left`} style={pinta}>
          {dentro}
        </button>
      ) : (
        <div className={clase} style={pinta}>
          {dentro}
        </div>
      )}

      {cambiable && id && (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="tocable flex h-[60px] shrink-0 items-center gap-2.5 rounded-full border border-borde bg-superficie px-6 text-[18px] font-extrabold text-tinta-suave"
        >
          <Ico nombre="lapiz" tam={20} grosor={2.3} />
          Cambiar
        </button>
      )}
    </li>
  )
}

/*
  ═══════════════════════════════════════════════════════════════
  CAMBIAR UNA COSA, DE PIE EN LA COCINA
  ═══════════════════════════════════════════════════════════════

  El texto, el día, la hora y de quién es. Y quitarlo.

  ─────────────────────────────────────────────────────────────
  ⚠️  QUITAR NO BORRA, Y SE DICE CON PALABRAS

  Va a la papelera, y desde el móvil se recupera. El botón lo dice —«Se
  puede recuperar desde el móvil»— porque quien está delante de una
  pared no tiene por qué saber qué hace MAPPEL por dentro, y sin esa
  frase «Quitar» da miedo y no se usa, o da igual y se usa de más.

  Lo que no lleva es un «¿estás seguro?». Una pregunta que sale siempre
  se contesta que sí sin leerla, y entonces no protege nada: lo que
  protege de verdad es que se pueda deshacer.

  ─────────────────────────────────────────────────────────────
  LO QUE NO SE PUEDE CAMBIAR AQUÍ

  Lo que se repite. «Los martes a las cinco, inglés» tiene una pregunta
  detrás que no cabe en una pared: ¿este martes o todos? Contestarla mal
  borra seis meses. Eso se hace desde el móvil, y la base lo impide
  aunque esta pantalla lo mandara (paso 79).
*/
function Cambiar({
  id,
  titulo,
  fecha,
  hora,
  para,
  gente,
  alCerrar,
}: {
  id: string
  titulo: string
  fecha: string | null
  hora: string | null
  para: string | null
  gente: Quien[]
  alCerrar: () => void
}) {
  const router = useRouter()
  const [texto, setTexto] = useState(titulo)
  const [elDia, setElDia] = useState(fecha ?? '')
  const [laHora, setLaHora] = useState(hora ? hora.slice(0, 5) : '')
  const [deQuien, setDeQuien] = useState<string | null>(para)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function mandar(cuerpo: Record<string, unknown>) {
    setFallo(null)
    setOcupado(true)
    try {
      const r = await fetch(api(`/api/pared/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      const d = (await r.json().catch(() => null)) as { error?: string } | null
      if (!r.ok) {
        setFallo(d?.error ?? 'No se ha podido guardar.')
        return false
      }
      router.refresh()
      return true
    } catch {
      setFallo('No se ha podido guardar.')
      return false
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="rounded-[28px] border border-borde bg-superficie px-7 py-6">
      <label
        htmlFor={`que-${id}`}
        className="block text-[19px] font-extrabold uppercase tracking-[0.14em] text-tenue"
      >
        Qué hay que recordar
      </label>

      <input
        id={`que-${id}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={120}
        autoComplete="off"
        className="entrada mt-3 h-[80px] w-full text-[28px] font-extrabold"
      />

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="w-[260px]">
          <label
            htmlFor={`dia-${id}`}
            className="block text-[17px] font-extrabold uppercase tracking-wider text-tenue"
          >
            Qué día
          </label>
          <input
            id={`dia-${id}`}
            type="date"
            value={elDia}
            onChange={(e) => setElDia(e.target.value)}
            className="entrada mt-2 h-[68px] w-full text-[24px] font-extrabold tabular-nums"
          />
        </div>

        <div className="w-[200px]">
          <label
            htmlFor={`hora-${id}`}
            className="block text-[17px] font-extrabold uppercase tracking-wider text-tenue"
          >
            A qué hora
          </label>
          <input
            id={`hora-${id}`}
            type="time"
            value={laHora}
            onChange={(e) => setLaHora(e.target.value)}
            className="entrada mt-2 h-[68px] w-full text-[24px] font-extrabold tabular-nums"
          />
        </div>
      </div>

      {gente.length > 0 && (
        <div className="mt-4">
          <p className="text-[17px] font-extrabold uppercase tracking-wider text-tenue">
            De quién es
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            <Pastilla texto="La casa" puesto={deQuien === null} alTocar={() => setDeQuien(null)} />
            {gente.map((g) => (
              <Pastilla
                key={g.id}
                texto={g.nombre}
                color={g.color}
                puesto={deQuien === g.id}
                alTocar={() => setDeQuien(g.id)}
              />
            ))}
          </div>
        </div>
      )}

      {fallo && (
        <p className="mt-4 text-[19px] font-bold" style={{ color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={ocupado || texto.trim().length < 2}
          onClick={async () => {
            const bien = await mandar({
              titulo: texto,
              fecha: elDia || null,
              hora: laHora || null,
              para: deQuien,
            })
            if (bien) alCerrar()
          }}
          className="tocable flex h-[72px] flex-1 items-center justify-center gap-3 rounded-[24px] text-[22px] font-extrabold disabled:opacity-45"
          style={{ background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }}
        >
          <Ico nombre="check" tam={26} grosor={2.6} />
          {ocupado ? 'Guardando…' : 'Guardar'}
        </button>

        <button
          type="button"
          onClick={alCerrar}
          className="tocable h-[72px] rounded-[24px] border border-borde bg-fondo px-8 text-[21px] font-extrabold text-tinta-suave"
        >
          Dejarlo
        </button>
      </div>

      {/* Quitar, aparte de los otros dos y con su explicación debajo. */}
      <div className="mt-5 border-t border-borde pt-5">
        <button
          type="button"
          disabled={ocupado}
          onClick={async () => {
            const bien = await mandar({ quitar: true })
            if (bien) alCerrar()
          }}
          className="tocable flex h-[64px] items-center gap-3 rounded-full border-2 px-7 text-[20px] font-extrabold disabled:opacity-45"
          style={{ borderColor: 'var(--t-alerta)', color: 'var(--t-alerta)' }}
        >
          <Ico nombre="mas" tam={22} grosor={2.6} className="rotate-45" />
          Quitarlo de aquí
        </button>
        <p className="mt-2.5 text-[17px] font-bold leading-snug text-tenue">
          No se borra: queda guardado y se puede recuperar desde el móvil.
        </p>
      </div>
    </div>
  )
}

/* Un nombre para elegir, con SU color — el mismo con el que esa persona
   sale en la agenda y en el corcho. En una casa el color es el nombre:
   se reconoce antes de leerlo. «La casa» no lleva ninguno, porque no es
   de nadie. */
function Pastilla({
  texto,
  color,
  puesto,
  alTocar,
}: {
  texto: string
  color?: string
  puesto: boolean
  alTocar: () => void
}) {
  return (
    <button
      type="button"
      onClick={alTocar}
      aria-pressed={puesto}
      className="tocable flex h-[60px] items-center gap-3 rounded-full border px-6 text-[20px] font-extrabold"
      style={
        puesto
          ? {
              background: color
                ? `color-mix(in srgb, ${color} 16%, var(--t-superficie))`
                : 'var(--t-velo)',
              borderColor: color
                ? `color-mix(in srgb, ${color} 50%, transparent)`
                : 'var(--t-tinta-suave)',
              color: 'var(--t-tinta)',
            }
          : {
              background: 'var(--t-superficie)',
              borderColor: 'var(--t-borde)',
              color: 'var(--t-tenue)',
            }
      }
    >
      {color && (
        <span
          className="block h-[13px] w-[13px] shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      {texto}
    </button>
  )
}

/*
  ═══════════════════════════════════════════════════════════════
  UN RENGLÓN · para las siete columnas de la semana
  ═══════════════════════════════════════════════════════════════

  En la pestaña del Calendario, cada día mide unos 250 px. Ahí una
  tarjeta NO cabe, y se vio renderizándola: la pastilla de 40 px más los
  dos rellenos se comían la mitad del ancho, y «Recoger la medicación en
  la farmacia» salía en CUATRO renglones. Encima era una tarjeta blanca
  dentro de otra tarjeta blanca — dos bordes y dos redondeos para decir
  lo mismo.

  Así que dentro de una columna, una cosa no es una tarjeta: es un
  renglón. Un punto de su color, la hora, y el texto con todo el ancho.

  No es un dibujo nuevo: es la misma idea de la marca de ámbito de
  `Fila`, reducida a lo que cabe. Y es la misma forma con la que se
  escriben los platos justo debajo, para que un día de la semana se lea
  como una sola lista y no como dos inventos.
*/
export function Renglon({
  titulo,
  cuando,
  hecha = false,
}: {
  titulo: string
  cuando?: string
  hecha?: boolean
}) {
  const p = pintaDe(titulo)

  return (
    <li className={`flex gap-2.5 ${hecha ? 'opacity-50' : ''}`}>
      <span
        className="mt-[9px] block h-[9px] w-[9px] shrink-0 rounded-full"
        style={{ background: AMBITO[p.ambito] }}
      />
      <span className="min-w-0 flex-1">
        {cuando && (
          <span className="block text-[15px] font-extrabold tabular-nums text-tenue">{cuando}</span>
        )}
        <span
          className={`block text-[17.5px] font-extrabold leading-snug text-tinta ${
            hecha ? 'line-through' : ''
          }`}
        >
          {titulo}
        </span>
      </span>
    </li>
  )
}
