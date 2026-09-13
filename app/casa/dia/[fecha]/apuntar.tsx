'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { grabarVoz, sePuedeGrabar, type Grabando } from '../../../hablar/grabadora'
import { Ico } from '../../../iconos'
import { AMBITO } from '../../../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  APUNTAR ALGO EN ESTE DÍA, DESDE LA PARED
  ═══════════════════════════════════════════════════════════════

  «El jueves viene el fontanero.» Se escribe en la cocina, donde se está
  teniendo la conversación, en vez de acordarse de hacerlo luego con el
  móvil — que es la parte que falla.

  ─────────────────────────────────────────────────────────────
  CERRADO POR DEFECTO, Y UN BOTÓN GRANDE

  El formulario no está siempre abierto. Esta pantalla se mira mucho más
  de lo que se escribe, y un campo de texto permanente en una pared
  invita a que alguien escriba cualquier cosa al pasar.

  Un botón que dice lo que hace, y el formulario cuando se pulsa.

  ─────────────────────────────────────────────────────────────
  LA HORA ES OPCIONAL Y ESO IMPORTA

  «El jueves viene el fontanero» no tiene hora, y pedirla obligaría a
  inventarse una. Los que no la llevan salen arriba del día, en «Sin
  hora», que es exactamente lo que son.

  ─────────────────────────────────────────────────────────────
  ⚠️  Y SÍ SE PREGUNTA DE QUIÉN ES · CORREGIDO EN EL PASO 76

  Aquí ponía que no se preguntaba, con este argumento: «decir esto es de
  Conchita es un juicio que hace una persona, no un aparato». Suena bien
  y está mal, y es la SEGUNDA vez que el mismo error aparece — la
  primera fue prohibir apuntar del todo.

  **El aparato no juzga nada.** Quien está delante de la pared
  escribiendo es una persona, y es exactamente la persona que sabe de
  quién es el recado. Así se apunta un recado en una cocina desde que
  existen las cocinas.

  La regla que sale de aquí: cuando escriba «un aparato no debería poder
  X», comprobar primero si lo que de verdad estoy diciendo es «una
  persona de pie no debería poder X» — que casi nunca es cierto.

  ─────────────────────────────────────────────────────────────
  BOTONES Y NO UN DESPLEGABLE

  Tres o cuatro nombres caben en una fila de botones grandes, y un
  desplegable en una pantalla colgada de una pared es dos toques y una
  lista que aparece encima de lo que estabas mirando. El punto 5 del
  planteamiento: nada importante oculto.

  «La casa» va primero y es lo que viene puesto, porque la mayoría de lo
  que se apunta en una cocina no es de nadie en concreto.
*/

export type Quien = { id: string; nombre: string; color: string }

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/* «2026-09-17» → «jueves 17 de septiembre». Si se le dice a alguien
   que ha dicho otro día, hay que decírselo con el nombre del día: una
   fecha con guiones no se lee de un vistazo desde dos metros. */
function comoSeDice(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`)
  if (Number.isNaN(d.getTime())) return fecha
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

export default function Apuntar({ fecha, gente }: { fecha: string; gente: Quien[] }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [hora, setHora] = useState('')
  const [para, setPara] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  /* ── La voz ── */
  const [oyendo, setOyendo] = useState(false)
  const [pensando, setPensando] = useState(false)
  const [nivel, setNivel] = useState(0)
  const [otroDia, setOtroDia] = useState<string | null>(null)
  const grabando = useRef<Grabando | null>(null)

  /* Si hay micrófono se sabe DESPUÉS de pintar: en el servidor no
     existe `navigator`, y preguntarlo mientras se pinta haría que el
     servidor y el navegador dibujaran cosas distintas en el mismo
     sitio. El porqué largo, en `app/casa/compra/dictar.tsx`. */
  const [hayMicro, setHayMicro] = useState(false)
  useEffect(() => setHayMicro(sePuedeGrabar()), [])

  async function escuchar() {
    setFallo(null)
    setOtroDia(null)
    setOyendo(true)

    grabando.current = await grabarVoz({
      alNivel: setNivel,
      alPausar: () => {},
      alSeguir: () => {},
      alTerminar: (audio) => {
        grabando.current = null
        interpretar(audio)
      },
      alFallar: (motivo) => {
        grabando.current = null
        setOyendo(false)
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

  async function interpretar(audio: Blob) {
    setOyendo(false)
    setNivel(0)
    setPensando(true)

    try {
      const paquete = new FormData()
      paquete.append('audio', audio, 'recado.webm')
      /* Con pista: esta pantalla solo puede apuntar cosas en la agenda.
         Sin ella, «apunta ochenta euros de luz» se leería como un gasto
         y devolvería algo que la pared no puede guardar. */
      paquete.append('pista', 'recordatorio')

      const r = await fetch(api('/api/voz'), { method: 'POST', body: paquete })
      const d = (await r.json().catch(() => null)) as
        | { titulo?: string | null; hora?: string | null; fecha?: string | null; error?: string }
        | null

      if (!r.ok || !d?.titulo) {
        setFallo(d?.error ?? 'No se ha entendido. Prueba otra vez.')
        return
      }

      setTitulo(d.titulo)
      if (d.hora) setHora(String(d.hora).slice(0, 5))

      /*
        ── SI HA DICHO OTRO DÍA, SE DICE ──

        La pantalla está abierta en un día concreto y lo que se apunte
        va a ESE día. Si alguien dicta «el jueves viene el fontanero»
        estando en el martes, callarse y guardarlo en el martes sería
        guardar algo distinto de lo que se ha dicho.

        No se cambia de día por su cuenta: se avisa y decide la
        persona. Una pared que navega sola mientras hablas es una pared
        que da miedo.
      */
      if (d.fecha && d.fecha !== fecha) setOtroDia(d.fecha)
    } catch {
      setFallo('No se ha podido entender. Prueba otra vez.')
    } finally {
      setPensando(false)
    }
  }

  async function guardar() {
    const que = titulo.trim()
    if (que.length < 2) return

    setFallo(null)
    setOcupado(true)

    try {
      const r = await fetch(api('/api/pared'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: que, fecha, hora: hora || null, para }),
      })
      const d = (await r.json().catch(() => null)) as { error?: string } | null

      if (!r.ok) {
        setFallo(d?.error ?? 'No se ha podido apuntar.')
        return
      }

      setTitulo('')
      setHora('')
      setPara(null)
      setOtroDia(null)
      setAbierto(false)
      router.refresh()
    } catch {
      setFallo('No se ha podido apuntar.')
    } finally {
      setOcupado(false)
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="tocable mt-5 flex h-[76px] w-full items-center justify-center gap-3 rounded-[24px] border-2 border-dashed text-[24px] font-extrabold text-tinta-suave"
        style={{ borderColor: 'var(--t-borde)' }}
      >
        <Ico nombre="mas" tam={28} grosor={2.6} />
        Apuntar algo este día
      </button>
    )
  }

  return (
    <div className="mt-5 rounded-[28px] border border-borde bg-superficie px-7 py-6">
      <label
        htmlFor="que-hay"
        className="block text-[19px] font-extrabold uppercase tracking-[0.14em] text-tenue"
      >
        Qué hay que recordar
      </label>

      {/* 30 px y 84 de alto: un teclado de pantalla tapa media tableta,
          así que lo escrito tiene que leerse por encima de él. */}
      <input
        id="que-hay"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') guardar()
        }}
        maxLength={120}
        placeholder="Viene el fontanero"
        autoComplete="off"
        autoFocus
        className="entrada mt-4 h-[84px] w-full text-[30px] font-extrabold"
      />

      {/* ── O decirlo ── */}
      {/*
        La voz aquí NO guarda: rellena el campo de arriba y lo deja
        escrito para que se lea. Es un teclado que se usa hablando, no
        un segundo camino con sus propias reglas — y así la persona ve
        lo entendido antes de tocar «Apuntarlo», igual que en todo HUBI.
      */}
      {hayMicro && (
        <>
          <button
            type="button"
            onClick={() => {
              if (oyendo) grabando.current?.parar()
              else if (!pensando) escuchar()
            }}
            disabled={pensando}
            className="tocable mt-3 flex h-[72px] w-full items-center justify-center gap-3 rounded-[24px] border-2 text-[22px] font-extrabold disabled:opacity-60"
            style={
              oyendo
                ? {
                    borderColor: AMBITO.verde,
                    background: `color-mix(in srgb, ${AMBITO.verde} 10%, var(--t-superficie))`,
                    color: 'var(--t-tinta)',
                  }
                : { borderColor: 'var(--t-borde)', background: 'var(--t-fondo)', color: 'var(--t-tinta-suave)' }
            }
          >
            <Ico nombre="micro" tam={26} grosor={2.3} />
            {pensando
              ? 'Un momento…'
              : oyendo
                ? 'Te escucho · toca para terminar'
                : 'O dilo en voz alta'}
          </button>

          {oyendo && (
            <div className="mt-2.5 h-[10px] w-full overflow-hidden rounded-full" style={{ background: 'var(--t-velo)' }}>
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{
                  width: `${Math.min(100, Math.round(nivel * 140))}%`,
                  background: AMBITO.verde,
                }}
              />
            </div>
          )}

          {otroDia && (
            <p className="mt-3 text-[19px] font-bold leading-snug text-tinta-suave">
              Has dicho otro día. Esto se va a apuntar en el día que estás mirando; si lo
              quieres en el {comoSeDice(otroDia)}, ve a ese día y apúntalo ahí.
            </p>
          )}
        </>
      )}

      {/* ── Para quién ── */}
      {gente.length > 0 && (
        <div className="mt-5">
          <p className="text-[17px] font-extrabold uppercase tracking-wider text-tenue">
            Para quién
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            <Nombre texto="La casa" puesto={para === null} alTocar={() => setPara(null)} />
            {gente.map((g) => (
              <Nombre
                key={g.id}
                texto={g.nombre}
                color={g.color}
                puesto={para === g.id}
                alTocar={() => setPara(g.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-end gap-4">
        <div className="w-[220px] shrink-0">
          <label
            htmlFor="a-que-hora"
            className="block text-[17px] font-extrabold uppercase tracking-wider text-tenue"
          >
            A qué hora
          </label>
          <input
            id="a-que-hora"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="entrada mt-2 h-[72px] w-full text-[26px] font-extrabold tabular-nums"
          />
        </div>

        <p className="pb-4 text-[17px] font-bold leading-snug text-tenue">
          Si no la sabes, déjala en blanco.
        </p>
      </div>

      {fallo && (
        <p className="mt-4 text-[19px] font-bold" style={{ color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={ocupado || titulo.trim().length < 2}
          className="tocable flex h-[76px] flex-1 items-center justify-center gap-3 rounded-[24px] text-[24px] font-extrabold disabled:opacity-45"
          style={{ background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }}
        >
          <Ico nombre="check" tam={28} grosor={2.6} />
          {ocupado ? 'Guardando…' : 'Apuntarlo'}
        </button>

        <button
          type="button"
          onClick={() => {
            setAbierto(false)
            setFallo(null)
          }}
          className="tocable h-[76px] rounded-[24px] border border-borde bg-fondo px-8 text-[22px] font-extrabold text-tinta-suave"
        >
          Dejarlo
        </button>
      </div>
    </div>
  )
}

/*
  Un nombre para elegir. Lleva SU color —el mismo con el que esa persona
  sale en la agenda y en el corcho— porque en una casa el color es el
  nombre: se reconoce antes de leerlo.

  «La casa» no lleva ninguno: no es de nadie, y darle un color la
  convertiría en una persona más de la fila.
*/
function Nombre({
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
      className="tocable flex h-[64px] items-center gap-3 rounded-full border px-6 text-[21px] font-extrabold"
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
          className="block h-[14px] w-[14px] shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      {texto}
    </button>
  )
}
