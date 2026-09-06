'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import QuienVe, { type CarpetaPermiso } from './quien-ve'
import Semana from './semana'
import { ROLES, nombreDelRol, type Rol } from '@/lib/roles'
import { COLORES } from '@/lib/gente'
import type { Rutina } from '@/lib/rutinas'

/*
  ═══════════════════════════════════════════════════════════════
  QUIÉN VIVE EN ESTA CASA
  ═══════════════════════════════════════════════════════════════

  Lo primero es la lista, no el botón. Antes de invitar a nadie, quien
  mira esta pantalla tiene derecho a ver de un vistazo QUIÉN tiene
  acceso a sus facturas, sus informes médicos y su Drive. Esa lista es
  el ajuste; invitar es lo que se hace desde ella.

  ─────────────────────────────────────────────────────────────
  SE DICE LO QUE PASA DE VERDAD AL INVITAR

  Sin adornos: esa persona verá todo. En HUBI no hay documentos
  privados todavía —todo lo que se guarda es de la casa— y quien
  invita tiene que saberlo ANTES de escribir un correo, no después.
*/

export type Vecino = {
  id: string
  nombre: string
  manda: boolean
  soloMira: boolean
  soyYo: boolean
  /** Invitada, pero todavía no ha dicho que sí. */
  pendiente: boolean
  /** Quién es en esta casa: familia, ayuda, asesor, solo mirar. */
  rol: string | null
  /** Último día con acceso, si se le puso fecha de fin. */
  hasta: string | null
  /** El suyo en esta casa. Con él se le reconoce en la agenda y el corcho. */
  color: string
  /** ¿Ve toda la casa, o solo lo que se le ha concedido? */
  veTodo: boolean
  escribeTodo: boolean
  /** Las carpetas de la casa, con lo que tiene concedido en cada una. */
  carpetas: CarpetaPermiso[]
}

export default function Gente({
  gente,
  puedoInvitar,
  plan = [],
}: {
  gente: Vecino[]
  puedoInvitar: boolean
  /** Todo el plan semanal de la casa. Cada persona ve el suyo. */
  plan?: Rutina[]
}) {
  const router = useRouter()

  const [repartiendo, setRepartiendo] = useState<string | null>(null)
  const [cambiando, setCambiando] = useState<string | null>(null)
  const [programando, setProgramando] = useState<{ id: string; nombre: string } | null>(null)
  const [invitando, setInvitando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [rol, setRol] = useState<Rol>('familia')
  const [hasta, setHasta] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [hecho, setHecho] = useState<{ nombre: string; correo: string } | null>(null)

  function cerrarInvitacion() {
    setInvitando(false)
    setNombre('')
    setCorreo('')
    setRol('familia')
    setHasta('')
    setFallo(null)
  }

  async function invitar() {
    setFallo(null)
    setHecho(null)
    setOcupado(true)

    const r = await fetch('/api/miembros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correo: correo.trim(),
        nombre: nombre.trim(),
        rol,
        hasta: hasta || null,
      }),
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      id?: string
      correo?: string
      nombre?: string
      error?: string
      detalle?: string
    } | null

    setOcupado(false)

    if (!r.ok || d?.bien !== true) {
      setFallo(
        d
          ? [d.error ?? 'No se ha podido invitar.', d.detalle].filter(Boolean).join(' · ')
          : 'HUBI no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return
    }

    const comoSeLlama = (d.nombre ?? nombre.trim()).split(' ')[0]
    setHecho({ nombre: d.nombre ?? nombre.trim(), correo: d.correo ?? correo.trim() })

    /*
      Y si es quien ayuda en casa, se le monta la semana AQUÍ MISMO.

      No es una comodidad: es el único momento en que quien invita está
      pensando en eso. Dejarlo para «entra luego en su ficha y
      prográmaselo» es dejarlo sin montar — y entonces ella entra el
      primer día y su HUBI está vacío, que es justo lo que no puede
      pasar.

      Se puede cerrar sin tocar nada, y volver cuando quiera desde el
      botón del calendario de su fila.
    */
    const eraAyuda = rol === 'ayuda'
    cerrarInvitacion()
    if (eraAyuda && d.id) setProgramando({ id: d.id, nombre: comoSeLlama })
    router.refresh()
  }

  async function cambiarRol(id: string, nuevo: Rol) {
    setFallo(null)
    setOcupado(true)

    const r = await fetch('/api/miembros', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, rol: nuevo }),
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      error?: string
      detalle?: string
    } | null

    setOcupado(false)

    if (!r.ok || d?.bien !== true) {
      setFallo(
        d
          ? [d.error ?? 'No se ha podido.', d.detalle].filter(Boolean).join(' · ')
          : 'HUBI no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return
    }

    setCambiando(null)
    router.refresh()
  }

  /* Aparte de cambiar el papel a propósito: cambiar un color no puede
     obligar a volver a repartirle todos los permisos. */
  async function cambiarColor(id: string, color: string) {
    setFallo(null)
    setOcupado(true)

    const r = await fetch('/api/miembros', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, color }),
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      error?: string
      detalle?: string
    } | null

    setOcupado(false)

    if (!r.ok || d?.bien !== true) {
      setFallo(
        d
          ? [d.error ?? 'No se ha podido cambiar el color.', d.detalle]
              .filter(Boolean)
              .join(' · ')
          : 'HUBI no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return
    }

    router.refresh()
  }

  async function sacar(v: Vecino) {
    if (
      !window.confirm(
        `¿Sacar a ${v.nombre} de esta casa?\n\nDejará de ver los papeles, las cuentas y la agenda. Lo que haya subido o apuntado NO se borra: es de la casa.\n\nSe le puede volver a invitar cuando quieras.`
      )
    ) {
      return
    }

    setOcupado(true)
    setFallo(null)

    const r = await fetch(`/api/miembros?id=${encodeURIComponent(v.id)}`, { method: 'DELETE' })
    const d = (await r.json().catch(() => null)) as { bien?: boolean; error?: string } | null

    setOcupado(false)

    if (!r.ok || d?.bien !== true) {
      setFallo(d?.error ?? 'No se ha podido sacar a esa persona.')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-2.5">
      <ul className="space-y-2.5">
        {gente.map((v) => (
          <li
            key={v.id}
            className="flex items-center gap-3 rounded-[20px] border border-borde bg-superficie px-4 py-3.5"
          >
            <span
              /* Su color, no uno según si manda o no. Es el mismo con
                 el que sale en la agenda y en el corcho: verlo aquí es
                 lo que enseña a leerlo allí. */
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold text-white"
              style={{ background: v.color }}
            >
              {v.nombre.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17.5px] font-extrabold tracking-tight">
                {v.nombre}
                {v.soyYo && <span className="text-tenue"> · tú</span>}
              </span>
              <span className="mt-0.5 block text-[14.5px] font-bold text-tenue">
                {v.manda
                  ? 'Creó la casa · su Google Drive'
                  : [
                      nombreDelRol(v.rol),
                      v.pendiente ? 'todavía no ha entrado' : loQuePuede(v),
                      v.hasta ? `hasta el ${enPalabras(v.hasta)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
              </span>
            </span>
            {/*
              ── SU SEMANA ──

              Solo a quien ayuda en casa. Para la familia no tiene
              sentido —nadie le programa la semana a su mujer— y ponerlo
              en todas las filas obligaría a descartarlo cada vez.

              Se llega también desde aquí, y no solo al invitar: la
              semana cambia. Empieza viniendo tres días y acaba
              viniendo dos, o se le añade planchar en invierno.
            */}
            {puedoInvitar && !v.manda && v.rol === 'ayuda' && (
              <button
                onClick={() =>
                  setProgramando(
                    programando?.id === v.id
                      ? null
                      : { id: v.id, nombre: v.nombre.split(' ')[0] }
                  )
                }
                aria-label={`La semana de ${v.nombre}`}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-tinta-suave"
              >
                <Ico nombre="calendario" tam={19} grosor={2.2} />
              </button>
            )}

            {/* Cambiar quién es. Hacía falta y no estaba: se elegía al
                invitar y ya no había manera de rectificar — que es
                justo lo que pasa en la vida real. */}
            {puedoInvitar && !v.manda && (
              <button
                onClick={() => setCambiando(cambiando === v.id ? null : v.id)}
                aria-label={`Cambiar quién es ${v.nombre}`}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-tinta-suave"
              >
                <Ico nombre="lapiz" tam={19} grosor={2.2} />
              </button>
            )}

            {puedoInvitar && !v.manda && (
              <button
                onClick={() => setRepartiendo(repartiendo === v.id ? null : v.id)}
                aria-label={`Qué puede ver ${v.nombre}`}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-tinta-suave"
              >
                <Ico nombre="ojo" tam={19} grosor={2.2} />
              </button>
            )}

            {puedoInvitar && !v.manda && (
              <button
                onClick={() => sacar(v)}
                disabled={ocupado}
                aria-label={`Sacar a ${v.nombre} de la casa`}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-tinta-suave disabled:opacity-50"
              >
                <Ico nombre="aviso" tam={19} grosor={2.2} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {cambiando &&
        (() => {
          const v = gente.find((g) => g.id === cambiando)
          if (!v) return null
          return (
            <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
              <p className="text-[17px] font-extrabold leading-snug">
                ¿Quién es {v.nombre.split(' ')[0]}?
              </p>
              <p className="mt-1 text-[14.5px] font-semibold leading-snug text-tenue">
                Cambiarlo vuelve a repartirle los permisos desde cero. Lo que le hayas abierto
                a mano se pierde.
              </p>
              <div className="mt-3 space-y-2.5">
                {ROLES.map((r) => (
                  <Papel
                    key={r.valor}
                    puesto={(v.rol ?? 'familia') === r.valor}
                    alPulsar={() => cambiarRol(v.id, r.valor)}
                    titulo={r.nombre}
                    pie={r.pie}
                  />
                ))}
              </div>
              {/*
                ── Y DE QUÉ COLOR ──

                Va aquí, debajo del papel, porque el color SALE del
                papel: se elige «Asesor» y ya viene con el suyo. Esto
                es para el caso en que haya dos del mismo papel, o
                simplemente porque el naranja le pega más.

                Los que ya tiene otro no se ofrecen: dos personas del
                mismo color en la agenda es exactamente lo que el
                color venía a evitar.
              */}
              <p className="mt-5 text-[16px] font-extrabold leading-snug">Su color</p>
              <p className="mt-1 text-[14.5px] font-semibold leading-snug text-tenue">
                Con el que se le reconoce en la agenda y en el corcho.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {COLORES.filter(
                  (c) => c === v.color || !gente.some((g) => g.id !== v.id && g.color === c)
                ).map((c) => (
                  <button
                    key={c}
                    onClick={() => cambiarColor(v.id, c)}
                    disabled={ocupado}
                    aria-pressed={v.color?.toUpperCase() === c.toUpperCase()}
                    aria-label={`Ponerle el color ${c}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white disabled:opacity-50"
                    style={{
                      background: c,
                      boxShadow:
                        v.color?.toUpperCase() === c.toUpperCase()
                          ? `0 0 0 3px var(--t-superficie), 0 0 0 5px ${c}`
                          : undefined,
                    }}
                  >
                    {v.color?.toUpperCase() === c.toUpperCase() && (
                      <Ico nombre="check" tam={19} grosor={2.8} />
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCambiando(null)}
                disabled={ocupado}
                className="mt-4 h-[52px] w-full rounded-[14px] border border-borde text-[16.5px] font-extrabold text-tinta-suave disabled:opacity-50"
              >
                Dejarlo como está
              </button>
            </div>
          )
        })()}

      {programando && (
        /* La `key` con el identificador: sin ella, abrir la semana de
           Marta después de la de Carmen reutilizaría el mismo trozo de
           pantalla y saldrían las casillas de Carmen con el nombre de
           Marta encima. Y como solo cambia al cambiar de persona, un
           refresco de fondo no borra lo que se esté tocando. */
        <Semana
          key={programando.id}
          quienEs={programando.nombre}
          para={programando.id}
          plan={plan.filter((r) => r.para === programando.id)}
          alCerrar={() => setProgramando(null)}
        />
      )}

      {repartiendo &&
        (() => {
          const v = gente.find((g) => g.id === repartiendo)
          if (!v) return null
          return (
            <QuienVe
              perfilId={v.id}
              nombre={v.nombre.split(' ')[0]}
              veTodo={v.veTodo}
              escribeTodo={v.escribeTodo}
              carpetas={v.carpetas}
              alCerrar={() => setRepartiendo(null)}
            />
          )
        })()}

      {puedoInvitar &&
        (invitando ? (
          <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
            {/* Primero quién es. Invitar un correo a secas es invitar a
                ciegas: hasta que esa persona se pusiera nombre, en toda
                la aplicación salía el trozo de delante de la arroba —
                «Para kozoharis», «kozoharis te ha dejado una tarea». */}
            <label htmlFor="quien" className="block text-[17px] font-extrabold leading-snug">
              ¿Cómo se llama?
            </label>
            <input
              id="quien"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Marta"
              className="entrada mt-2.5"
              autoFocus
              maxLength={40}
            />

            <label htmlFor="sucorreo" className="mt-4 block text-[17px] font-extrabold leading-snug">
              ¿Y su correo?
            </label>
            <input
              id="sucorreo"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="marta@gmail.com"
              className="entrada mt-2.5"
            />

            {/*
              ── QUIÉN ES ──

              Antes eran dos: «todo, como tú» o «solo mirar». Y con eso
              se resolvían mal los dos casos que la gente tiene de
              verdad: a quien ayuda en casa le dabas de más, y a un
              gestor le dabas de menos y acababa pidiéndotelo por
              teléfono.

              Elegir aquí rellena de golpe los permisos que ya existían
              —el papel, lo que ve, y las carpetas una a una—. Se puede
              afinar después desde el ojo de cada persona.
            */}
            <p className="mt-5 text-[17px] font-extrabold leading-snug">
              ¿Quién es?
            </p>
            <div className="mt-2.5 space-y-2.5">
              {ROLES.map((r) => (
                <Papel
                  key={r.valor}
                  puesto={rol === r.valor}
                  alPulsar={() => setRol(r.valor)}
                  titulo={r.nombre}
                  pie={r.pie}
                />
              ))}
            </div>

            {/*
              Se dice ANTES de escribir nada, no después: quien invita
              tiene que saber exactamente qué está dando.
            */}
            <p className="mt-4 rounded-[14px] border border-borde px-3.5 py-3 text-[14.5px] font-semibold leading-snug text-tenue">
              {ROLES.find((r) => r.valor === rol)?.detalle}
            </p>

            {/*
              ── HASTA CUÁNDO ──

              Una empleada que se va, un asesor que deja de llevarte las
              cuentas. Hoy hay que ACORDARSE de quitarles el acceso, y
              nadie se acuerda: así es como se acumula gente mirando los
              papeles de una casa donde ya no está.

              Vacío es lo normal y no pasa nada por dejarlo así.
            */}
            <label htmlFor="hasta" className="mt-5 block text-[17px] font-extrabold leading-snug">
              ¿Hasta cuándo? <span className="font-bold text-tenue">· si quieres</span>
            </label>
            <input
              id="hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="entrada mt-2.5"
            />
            <p className="mt-2 text-[14.5px] font-semibold leading-snug text-tenue">
              {hasta
                ? 'Ese día deja de entrar, sin que tengas que hacer nada.'
                : 'Sin fecha, el acceso no caduca. Se le puede quitar cuando quieras.'}
            </p>

            <p className="mt-4 text-[14.5px] font-semibold leading-snug text-tenue">
              No le llega ningún correo de nuestra parte. Dile tú que entre en HUBI con ese
              correo y le llegará su número, como a ti.
            </p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={invitar}
                disabled={ocupado || correo.trim().length < 5 || nombre.trim().length < 2}
                className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-boton text-[17px] font-extrabold text-boton-texto disabled:opacity-50"
              >
                <Ico nombre="check" tam={19} grosor={2.3} />
                {ocupado ? 'Invitando…' : 'Invitar'}
              </button>
              <button
                onClick={cerrarInvitacion}
                disabled={ocupado}
                className="h-[56px] flex-1 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave disabled:opacity-50"
              >
                Ahora no
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setInvitando(true)
              setHecho(null)
            }}
            className="flex h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave"
          >
            <Ico nombre="mas" tam={20} grosor={2.4} />
            Invitar a alguien
          </button>
        ))}

      {hecho && (
        <p className="rounded-[16px] border border-borde px-4 py-3.5 text-[15.5px] font-semibold leading-snug text-tinta-suave">
          Listo. Dile a <strong className="text-tinta">{hecho.nombre}</strong> que entre en HUBI
          con <strong className="text-tinta">{hecho.correo}</strong>: le llegará su número y verá
          tu invitación nada más entrar, y tiene que aceptarla desde su HUBI.
        </p>
      )}

      {fallo && (
        <p className="rounded-[16px] bg-coral-suave px-4 py-3 text-[15.5px] font-semibold text-coral">
          {fallo}
        </p>
      )}
    </div>
  )
}

/*
  Las dos opciones de qué puede hacer.

  Con texto debajo, no solo el título: «Solo mirar» a secas deja la
  duda de si verá o no las cosas. La frase de abajo la quita.
*/
function Papel({
  puesto,
  alPulsar,
  titulo,
  pie,
}: {
  puesto: boolean
  alPulsar: () => void
  titulo: string
  pie: string
}) {
  return (
    <button
      onClick={alPulsar}
      aria-pressed={puesto}
      className="w-full rounded-[16px] px-4 py-3.5 text-left"
      style={
        puesto
          ? { background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }
          : {
              background: 'var(--t-fondo)',
              color: 'var(--t-tinta-suave)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      <span className="block text-[17px] font-extrabold leading-snug">
        {puesto ? '✓ ' : ''}
        {titulo}
      </span>
      <span className="mt-0.5 block text-[14.5px] font-semibold leading-snug opacity-80">
        {pie}
      </span>
    </button>
  )
}

/*
  Lo que puede esta persona, en una línea.

  Se dice el número de carpetas y no «acceso limitado», que no dice
  nada: quien mira esta lista quiere saber de un vistazo si Marta ve
  dos cosas o catorce.
*/
function loQuePuede(v: Vecino): string {
  if (v.soloMira && v.veTodo) return 'Ve toda la casa · no cambia nada'
  if (v.soloMira) return `Ve ${cuantasVe(v)} · no cambia nada`
  if (v.veTodo && v.escribeTodo) return 'Ve y apunta todo lo de la casa'
  if (v.veTodo) return `Ve toda la casa · guarda en ${dondeGuarda(v)}`
  return `Ve ${cuantasVe(v)} · guarda en ${v.escribeTodo ? 'todas ellas' : dondeGuarda(v)}`
}

/** «2026-12-31» → «31 de diciembre». */
function enPalabras(iso: string): string {
  const meses = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre',
  ]
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  const esteAnio = new Date().getFullYear()
  return a === esteAnio ? `${d} de ${meses[m - 1]}` : `${d}/${m}/${a}`
}

function cuantasVe(v: Vecino): string {
  const n = v.carpetas.filter((c) => c.ver).length
  return n === 0 ? 'ninguna carpeta' : n === 1 ? '1 carpeta' : `${n} carpetas`
}

function dondeGuarda(v: Vecino): string {
  const n = v.carpetas.filter((c) => c.escribir).length
  return n === 0 ? 'ninguna' : n === 1 ? '1 carpeta' : `${n} carpetas`
}
