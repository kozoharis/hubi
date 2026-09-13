'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { grabarVoz, sePuedeGrabar, type Grabando } from '../hablar/grabadora'
import { NOCHE, DEGRADADO, DEGRADADO_TUMBADO, TURQUESA } from '@/lib/voz-hubi'
import { Ico } from '../iconos'

/*
  ═══════════════════════════════════════════════════════════════
  EL MICRÓFONO DE HUBI, EN LA PARED
  ═══════════════════════════════════════════════════════════════

  Uno. En todos los sitios. Con la cara de siempre.

  ─────────────────────────────────────────────────────────────
  ⚠️  ESTO CORRIGE UN ERROR MÍO, Y ES LA CUARTA VEZ QUE ES EL MISMO

  Había puesto tres micrófonos pequeños —uno en la compra, uno en el
  día, uno en las notas— y nada en el resto de la pared. El argumento:
  «una pantalla de cocina no tiene permiso para guardar un gasto, así
  que ahí no pongo micrófono».

  Haris: *«¿el micro de HUBI no debería estar en todos los sitios? ¿y
  con el mismo look and feel?»*. Sí. Y el punto 20 del planteamiento ya
  lo decía con todas las letras, desde el primer día:

      «Debe existir SIEMPRE un botón: 🎙️ HABLAR.»

  El error otra vez es el mismo que en los pasos 74, 75 y 76: **quitar
  una capacidad en lugar de diseñarla.** Que la pared no pueda guardar
  un gasto no es una razón para esconder el micrófono — es una razón
  para que el micrófono sepa contestar «eso te lo guardo desde el
  móvil». El punto 29: *la complejidad pertenece al sistema, no al
  usuario.*

  Tres botones distintos en tres pantallas, y ninguno en las otras dos,
  obligan a Juan Miguel a aprender DÓNDE se puede hablar. Uno solo,
  siempre en el mismo sitio, no obliga a aprender nada.

  ─────────────────────────────────────────────────────────────
  LO QUE HACE CON LO QUE OYE

  Se manda SIN pista: el intérprete entero, como en el móvil. Y con lo
  que entiende:

      compra        ·  lo enseña y lo apunta
      recordatorio  ·  lo enseña y lo apunta
      nota          ·  la enseña y la deja en el corcho
      gasto/ingreso ·  «eso te lo guardo desde el móvil»
      buscar        ·  «eso te lo enseño en el móvil»
      consulta      ·  «eso te lo contesto en el móvil»
      cambiar/borrar·  «toca la cosa en la pantalla y cámbiala ahí»

  Los cuatro últimos no son un «no puedo»: son una frase que dice qué
  hacer. Un aparato que se queda callado obliga a adivinar.

  ─────────────────────────────────────────────────────────────
  Y POR QUÉ LAS CUENTAS Y LOS PAPELES SIGUEN SIN CONTESTARSE AQUÍ

  Ésta es la única parte del razonamiento anterior que sobrevive, y no
  es de permisos: **una pared contesta en voz alta en una cocina por la
  que pasa cualquiera.** «Habéis gastado 8.430 € este trimestre» o «la
  última factura de Conchita es del hospital» son respuestas correctas
  dichas en el peor sitio posible.

  Eso se pregunta al móvil, que se mira a treinta centímetros de la
  cara. Y aquí se DICE que es ahí, en vez de fallar.
*/

type Paso =
  | { que: 'quieto' }
  | { que: 'oyendo' }
  | { que: 'pensando' }
  | { que: 'compra'; cosas: string[] }
  | { que: 'recordatorio'; tareas: { titulo: string; fecha: string | null; hora: string | null }[] }
  | { que: 'nota'; texto: string }
  | { que: 'aqui-no'; titulo: string; explica: string }
  | { que: 'hecho'; texto: string }

type Oido = {
  accion?: string
  transcripcion?: string | null
  titulo?: string | null
  fecha?: string | null
  hora?: string | null
  tareas?: { titulo?: string | null; fecha?: string | null; hora?: string | null }[]
  compra?: ({ que?: string } | string)[]
  error?: string
}

export default function Microfono() {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>({ que: 'quieto' })
  const [abierto, setAbierto] = useState(false)
  const [nivel, setNivel] = useState(0)
  const [fallo, setFallo] = useState<string | null>(null)
  const grabando = useRef<Grabando | null>(null)

  /* Si hay micrófono se sabe después de pintar: en el servidor no
     existe `navigator`, y preguntarlo mientras se pinta haría que el
     servidor y el navegador dibujaran cosas distintas. */
  const [hayMicro, setHayMicro] = useState<boolean | null>(null)
  useEffect(() => setHayMicro(sePuedeGrabar()), [])

  function cerrar() {
    grabando.current?.cancelar()
    grabando.current = null
    setAbierto(false)
    setPaso({ que: 'quieto' })
    setNivel(0)
    setFallo(null)
  }

  async function empezar() {
    setFallo(null)
    setPaso({ que: 'oyendo' })

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
        setNivel(0)
        setPaso({ que: 'quieto' })
        setFallo(
          motivo === 'sin-permiso'
            ? 'Esta pantalla no tiene permiso para usar el micrófono. Se le da desde los ajustes del navegador de la tableta.'
            : motivo === 'sin-micro'
              ? 'Esta pantalla no tiene micrófono.'
              : 'No se ha oído nada. Prueba otra vez.'
        )
      },
    })
  }

  async function interpretar(audio: Blob) {
    setNivel(0)
    setPaso({ que: 'pensando' })

    try {
      const paquete = new FormData()
      paquete.append('audio', audio, 'hablar.webm')
      /* SIN pista: el intérprete entero, como en el móvil. Lo que no se
         pueda hacer aquí se explica abajo, no se fuerza a ser otra
         cosa. */

      const r = await fetch(api('/api/voz'), { method: 'POST', body: paquete })
      const d = (await r.json().catch(() => null)) as Oido | null

      if (!r.ok) {
        setPaso({ que: 'quieto' })
        setFallo(d?.error ?? 'No se ha entendido. Prueba otra vez.')
        return
      }

      repartir(d ?? {})
    } catch {
      setPaso({ que: 'quieto' })
      setFallo('No se ha podido entender. Prueba otra vez.')
    }
  }

  /** De lo que HUBI ha entendido, a lo que esta pantalla enseña. */
  function repartir(d: Oido) {
    switch (d.accion) {
      case 'compra': {
        const cosas = (d.compra ?? [])
          .map((c) => (typeof c === 'string' ? c : (c?.que ?? '')))
          .map((s) => String(s).trim())
          .filter((s) => s.length > 1)
        if (cosas.length === 0) return noEntendido()
        return setPaso({ que: 'compra', cosas })
      }

      case 'recordatorio': {
        const tareas = (d.tareas ?? [])
          .map((t) => ({
            titulo: String(t.titulo ?? '').trim(),
            fecha: t.fecha ?? null,
            hora: t.hora ?? null,
          }))
          .filter((t) => t.titulo.length > 1)

        /* Con una sola cosa, el intérprete a veces la deja suelta en
           `titulo` en vez de en `tareas`. Se admiten las dos formas:
           contar con una sola ha costado ya un fallo en este proyecto. */
        if (tareas.length === 0 && d.titulo && d.titulo.trim().length > 1) {
          tareas.push({ titulo: d.titulo.trim(), fecha: d.fecha ?? null, hora: d.hora ?? null })
        }
        if (tareas.length === 0) return noEntendido()
        return setPaso({ que: 'recordatorio', tareas })
      }

      case 'nota': {
        const texto = String(d.titulo ?? '').trim()
        if (texto.length < 2) return noEntendido()
        return setPaso({ que: 'nota', texto })
      }

      case 'gasto':
      case 'ingreso':
        return setPaso({
          que: 'aqui-no',
          titulo: 'Eso te lo guardo desde el móvil',
          explica:
            'Las cuentas de la casa no se tocan desde la pantalla de la cocina. Dilo otra vez con el móvil en la mano y se apunta igual de rápido.',
        })

      case 'buscar':
        return setPaso({
          que: 'aqui-no',
          titulo: 'Los papeles se ven en el móvil',
          explica:
            'Esta pantalla la ve cualquiera que entre en la casa, así que no enseña documentos. Búscalo en tu HUBI y sale en un momento.',
        })

      case 'consulta':
        return setPaso({
          que: 'aqui-no',
          titulo: 'Eso te lo contesto en el móvil',
          explica:
            'Contestarlo aquí sería decirlo en voz alta en la cocina, y por la cocina pasa cualquiera. Pregúntaselo a tu HUBI y te lo dice sólo a ti.',
        })

      case 'cambiar':
      case 'borrar':
        return setPaso({
          que: 'aqui-no',
          titulo: 'Eso se cambia tocándolo',
          explica:
            'Ve al Calendario, toca el día, y en la cosa que quieras verás el botón de Cambiar. Desde ahí se cambia y se quita.',
        })

      default:
        return noEntendido()
    }
  }

  function noEntendido() {
    setPaso({ que: 'quieto' })
    setFallo('No lo he entendido. Prueba a decirlo de otra manera.')
  }

  async function guardar(donde: string, cuerpo: unknown, dicho: string) {
    setFallo(null)
    const antes = paso
    setPaso({ que: 'pensando' })

    try {
      const r = await fetch(api(donde), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      const d = (await r.json().catch(() => null)) as { error?: string } | null

      if (!r.ok) {
        setPaso(antes)
        setFallo(d?.error ?? 'No se ha podido guardar.')
        return
      }

      setPaso({ que: 'hecho', texto: dicho })
      router.refresh()
      /* Se cierra solo. Nadie se queda mirando un cartel de «hecho» en
         una cocina, y dejarlo puesto tapa la pared hasta que alguien
         pase y lo quite. */
      setTimeout(() => cerrar(), 1800)
    } catch {
      setPaso(antes)
      setFallo('No se ha podido guardar.')
    }
  }

  // ── El botón, siempre en la misma esquina ──
  if (hayMicro === null) return null

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true)
          if (hayMicro) empezar()
        }}
        /*
          Abajo a la derecha y fijo. En el teléfono el micrófono vive en
          la barra de abajo; aquí no hay barra, así que se queda en la
          esquina donde cae la mano de quien está de pie delante — y en
          las cinco pestañas en el mismo sitio, que es lo que hace que
          no haya que buscarlo.
        */
        className="tocable fixed bottom-9 right-9 z-40 flex h-[96px] items-center gap-4 rounded-full px-9 text-[26px] font-extrabold text-white shadow-lg"
        style={{ background: NOCHE }}
      >
        <Ico nombre="micro" tam={32} grosor={2.3} />
        Hablar
      </button>
    )
  }

  // ── Y la ventana, con la cara de la voz de HUBI ──
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-10 py-10"
      style={{ background: NOCHE, color: '#FFFFFF' }}
    >
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar"
        className="tocable absolute right-9 top-9 flex h-[72px] items-center gap-3 rounded-full border-2 px-7 text-[20px] font-extrabold"
        style={{ borderColor: 'rgba(255,255,255,.28)', color: '#FFFFFF' }}
      >
        <Ico nombre="mas" tam={24} grosor={2.6} className="rotate-45" />
        Cerrar
      </button>

      <div className="w-full max-w-[1000px]">
        {/* ── Sin micrófono: se dice, no se calla ── */}
        {!hayMicro && (
          <Cartel
            titulo="Esta pantalla no puede grabar"
            texto="O no tiene micrófono, o su navegador es demasiado antiguo. Se puede seguir apuntando escribiendo en cada pestaña."
          />
        )}

        {hayMicro && paso.que === 'oyendo' && (
          <div className="text-center">
            <p className="text-[52px] font-extrabold leading-tight">Te escucho</p>
            <p className="mt-3 text-[24px] font-bold" style={{ color: 'rgba(255,255,255,.62)' }}>
              Di lo que quieras apuntar. Cuando termines, toca.
            </p>

            {/* La barra que se mueve con la voz: la única prueba honesta
                de que el micrófono está entrando. Se mueve porque hay
                sonido, no porque se haya entendido algo. */}
            <div
              className="mx-auto mt-10 h-[14px] w-full max-w-[680px] overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,.14)' }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{
                  width: `${Math.min(100, Math.round(nivel * 140))}%`,
                  background: DEGRADADO_TUMBADO,
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => grabando.current?.parar()}
              className="tocable mx-auto mt-10 flex h-[96px] items-center gap-4 rounded-full px-12 text-[26px] font-extrabold text-white"
              style={{ background: DEGRADADO }}
            >
              <Ico nombre="check" tam={30} grosor={2.6} />
              Ya está
            </button>
          </div>
        )}

        {paso.que === 'pensando' && (
          <p className="text-center text-[44px] font-extrabold">Un momento…</p>
        )}

        {paso.que === 'hecho' && (
          <div className="text-center">
            <p className="text-[52px] font-extrabold leading-tight">Hecho</p>
            <p className="mt-3 text-[26px] font-bold" style={{ color: 'rgba(255,255,255,.62)' }}>
              {paso.texto}
            </p>
          </div>
        )}

        {paso.que === 'aqui-no' && <Cartel titulo={paso.titulo} texto={paso.explica} />}

        {/* ── La compra ── */}
        {paso.que === 'compra' && (
          <Entendido
            rotulo="Para la compra"
            lineas={paso.cosas}
            boton="Apuntarlo"
            alGuardar={() =>
              guardar(
                '/api/compra',
                { cosas: paso.cosas.map((q) => ({ que: q })) },
                `${paso.cosas.length} ${paso.cosas.length === 1 ? 'cosa' : 'cosas'} en la compra`
              )
            }
            alDejarlo={cerrar}
          />
        )}

        {/* ── Algo que recordar ── */}
        {paso.que === 'recordatorio' && (
          <Entendido
            rotulo={paso.tareas.length === 1 ? 'Para recordar' : 'Para recordar'}
            lineas={paso.tareas.map(
              (t) => `${t.titulo}${cuando(t.fecha, t.hora) ? ` · ${cuando(t.fecha, t.hora)}` : ''}`
            )}
            boton="Apuntarlo"
            alGuardar={async () => {
              /* Una a una, y la primera que falle corta: apuntar tres
                 de cinco sin decir cuáles es peor que no apuntar nada. */
              for (const t of paso.tareas) {
                await guardar(
                  '/api/pared',
                  { titulo: t.titulo, fecha: t.fecha, hora: t.hora, para: null },
                  `${paso.tareas.length} ${paso.tareas.length === 1 ? 'cosa apuntada' : 'cosas apuntadas'}`
                )
              }
            }}
            alDejarlo={cerrar}
          />
        )}

        {/* ── Una nota para el corcho ── */}
        {paso.que === 'nota' && (
          <Entendido
            rotulo="Para el corcho"
            lineas={[paso.texto]}
            boton="Dejarla puesta"
            alGuardar={() => guardar('/api/pared/nota', { texto: paso.texto }, 'Nota puesta')}
            alDejarlo={cerrar}
          />
        )}

        {fallo && (
          <div className="mt-8 text-center">
            <p className="text-[26px] font-extrabold" style={{ color: '#FFB4B0' }}>
              {fallo}
            </p>
            <button
              type="button"
              onClick={empezar}
              className="tocable mx-auto mt-6 flex h-[84px] items-center gap-3 rounded-full px-10 text-[24px] font-extrabold text-white"
              style={{ background: DEGRADADO }}
            >
              <Ico nombre="micro" tam={28} grosor={2.3} />
              Probar otra vez
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/*
  Lo entendido, antes de guardarlo. La misma regla que en todo HUBI: se
  ve escrito y se confirma. Una pared que apunta sola lo que cree haber
  oído acaba llena de trozos de conversación.
*/
function Entendido({
  rotulo,
  lineas,
  boton,
  alGuardar,
  alDejarlo,
}: {
  rotulo: string
  lineas: string[]
  boton: string
  alGuardar: () => void
  alDejarlo: () => void
}) {
  return (
    <div>
      <p
        className="flex items-center gap-3 text-[21px] font-extrabold uppercase tracking-[0.16em]"
        style={{ color: 'rgba(255,255,255,.58)' }}
      >
        <span
          className="block h-[15px] w-[15px] shrink-0 rounded-full"
          style={{ background: DEGRADADO }}
        />
        Esto es lo que he entendido · {rotulo}
      </p>

      <ul className="mt-6 space-y-3">
        {lineas.map((l, i) => (
          <li
            key={`${l}-${i}`}
            className="rounded-[24px] px-7 py-5 text-[34px] font-extrabold leading-tight"
            style={{
              background: 'rgba(255,255,255,.06)',
              borderLeft: `6px solid ${TURQUESA}`,
            }}
          >
            {l}
          </li>
        ))}
      </ul>

      <div className="mt-9 flex gap-4">
        <button
          type="button"
          onClick={alGuardar}
          className="tocable flex h-[96px] flex-1 items-center justify-center gap-4 rounded-[28px] text-[28px] font-extrabold text-white"
          style={{ background: DEGRADADO }}
        >
          <Ico nombre="check" tam={32} grosor={2.6} />
          {boton}
        </button>

        <button
          type="button"
          onClick={alDejarlo}
          className="tocable h-[96px] rounded-[28px] border-2 px-12 text-[24px] font-extrabold"
          style={{ borderColor: 'rgba(255,255,255,.28)', color: '#FFFFFF' }}
        >
          Dejarlo
        </button>
      </div>
    </div>
  )
}

/*
  «Eso, en el móvil.» No es un error: es una frase que dice qué hacer.

  Un aparato que se queda callado cuando no puede hacer algo obliga a
  adivinar si no ha entendido, si está roto, o si eso no existe.
*/
function Cartel({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="text-center">
      <p className="text-[46px] font-extrabold leading-tight">{titulo}</p>
      <p
        className="mx-auto mt-5 max-w-[760px] text-[26px] font-bold leading-snug"
        style={{ color: 'rgba(255,255,255,.66)' }}
      >
        {texto}
      </p>
    </div>
  )
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** «jueves 17 · 10:00». Lo que hace falta leer de un vistazo. */
function cuando(fecha: string | null, hora: string | null): string {
  const trozos: string[] = []

  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const d = new Date(`${fecha}T12:00:00`)
    if (!Number.isNaN(d.getTime())) trozos.push(`${DIAS[d.getDay()]} ${d.getDate()}`)
  }
  if (hora) trozos.push(hora.slice(0, 5))

  return trozos.join(' · ')
}
