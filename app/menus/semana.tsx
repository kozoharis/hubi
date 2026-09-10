'use client'

import { useEffect, useRef, useState } from 'react'
import { Ico } from '../iconos'
import { Aviso, BotonPrincipal, BotonSecundario, Vacio } from '../piezas'
import { api } from '@/lib/api'
import {
  comoSeLlamaElDia,
  comoSeLlamaLaSemana,
  otraSemana,
  deDondeEs,
  MOMENTOS,
  type Momento,
} from '@/lib/menus'

/*
  ═══════════════════════════════════════════════════════════════
  LA SEMANA, DÍA A DÍA
  ═══════════════════════════════════════════════════════════════

  SE ESCRIBE DIRECTAMENTE EN EL DÍA. Sin botón de «añadir», sin
  ventana que se abre encima, sin «guardar». Tocas donde pone la cena
  del martes, escribes «lentejas» y al salir del campo ya está.

  Un menú se cambia veinte veces por semana —«el jueves mejor pescado»—
  y cada toque de más se paga veinte veces. Una ventana emergente para
  escribir dos palabras es exactamente el tipo de cosa que hace que una
  familia deje de usar una función a la segunda semana.
*/

type Menu = { id: string; fecha: string; momento: Momento; que: string; receta_id: string | null }
type Receta = { id: string; titulo: string; url: string | null; nota: string | null }

export default function Semana() {
  const [lunes, setLunes] = useState<string | null>(null)
  const [dias, setDias] = useState<string[]>([])
  const [menus, setMenus] = useState<Menu[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [sinTablas, setSinTablas] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  // ── El cajón de ideas ──
  const [abierto, setAbierto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [url, setUrl] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function traer(cual?: string) {
    try {
      const r = await fetch(api(`/api/menus${cual ? `?lunes=${cual}` : ''}`))
      const d = (await r.json()) as {
        lunes?: string
        dias?: string[]
        menus?: Menu[]
        recetas?: Receta[]
        sinTablas?: boolean
        error?: string
      }
      if (!r.ok) {
        setAviso(d.error ?? 'No se ha podido cargar.')
        return
      }
      setLunes(d.lunes ?? null)
      setDias(d.dias ?? [])
      setMenus(d.menus ?? [])
      setRecetas(d.recetas ?? [])
      setSinTablas(d.sinTablas === true)
    } catch {
      setAviso('No hay conexión.')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void traer()
  }, [])

  function loDe(fecha: string, momento: Momento): Menu | undefined {
    return menus.find((m) => m.fecha === fecha && m.momento === momento)
  }

  /*
    Se guarda al salir del campo, no mientras se escribe.

    Guardar en cada tecla haría veinte viajes por «macarrones» y, con
    mala cobertura, llegarían desordenados: se quedaría guardado
    «macarron». Al salir del campo se manda una vez y lo que hay
    escrito es lo que queda.
  */
  async function guardar(fecha: string, momento: Momento, que: string, recetaId?: string | null) {
    const antes = loDe(fecha, momento)
    if ((antes?.que ?? '') === que.trim() && recetaId === undefined) return

    /* Se pinta ya y se manda después: escribir la cena y ver el texto
       parpadear medio segundo después hace dudar de si se ha guardado. */
    setMenus((lista) => {
      const otros = lista.filter((m) => !(m.fecha === fecha && m.momento === momento))
      if (!que.trim()) return otros
      return [
        ...otros,
        {
          id: antes?.id ?? `nuevo-${fecha}-${momento}`,
          fecha,
          momento,
          que: que.trim(),
          receta_id: recetaId !== undefined ? recetaId : (antes?.receta_id ?? null),
        },
      ]
    })

    const r = await fetch(api('/api/menus'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha,
        momento,
        que: que.trim(),
        receta_id: recetaId !== undefined ? recetaId : (antes?.receta_id ?? null),
      }),
    })

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string; detalle?: string }
      setAviso(d.detalle ?? d.error ?? 'No se ha podido guardar.')
      traer(lunes ?? undefined)
    }
  }

  async function nuevaIdea() {
    if (titulo.trim().length < 2) return
    setGuardando(true)
    setAviso(null)

    const r = await fetch(api('/api/menus'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: titulo.trim(), url: url.trim() }),
    })
    const d = (await r.json().catch(() => ({}))) as {
      receta?: Receta
      error?: string
      detalle?: string
    }
    setGuardando(false)

    if (!r.ok || !d.receta) {
      setAviso(d.detalle ?? d.error ?? 'No se ha podido guardar.')
      return
    }

    setRecetas((x) => [d.receta!, ...x])
    setTitulo('')
    setUrl('')
    setAbierto(false)
  }

  async function quitarIdea(id: string) {
    setRecetas((x) => x.filter((r) => r.id !== id))
    await fetch(api(`/api/menus?receta=${id}`), { method: 'DELETE' })
  }

  return (
    <div>
      {/* ── La semana que se está mirando ── */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => lunes && traer(otraSemana(lunes, -1))}
          aria-label="La semana anterior"
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] border border-borde bg-superficie"
        >
          <Ico nombre="atras" tam={20} grosor={2.4} />
        </button>

        <p className="t-tarjeta min-w-0 flex-1 text-center">
          {lunes ? comoSeLlamaLaSemana(lunes) : 'Un momento…'}
        </p>

        <button
          onClick={() => lunes && traer(otraSemana(lunes, 1))}
          aria-label="La semana siguiente"
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] border border-borde bg-superficie"
        >
          <Ico nombre="flecha" tam={20} grosor={2.4} />
        </button>
      </div>

      {sinTablas && (
        <div className="mt-3">
          <Aviso
            tono="atencion"
            titulo="Los menús todavía no están disponibles"
            explicacion="Se están terminando de preparar en esta casa."
          />
        </div>
      )}

      {/* ── Los siete días ── */}
      <ul className="mt-4 space-y-2.5">
        {dias.map((fecha) => (
          <li key={fecha} className="rounded-[20px] border border-borde bg-superficie px-4 py-3.5">
            <p className="rotulo">{comoSeLlamaElDia(fecha)}</p>

            <div className="mt-2 space-y-2">
              {MOMENTOS.map(({ valor, texto }) => {
                const puesto = loDe(fecha, valor)
                const suya = puesto?.receta_id
                  ? recetas.find((r) => r.id === puesto.receta_id)
                  : undefined
                return (
                  <div key={valor}>
                    <div className="flex items-center gap-3">
                      <span className="t-apoyo w-[62px] shrink-0 font-extrabold">
                        {texto}
                      </span>
                      <Renglon
                        valor={puesto?.que ?? ''}
                        alSalir={(v) => guardar(fecha, valor, v)}
                      />
                    </div>
                    {/* Si vino de una receta con enlace, se puede abrir
                        desde aquí: es el momento en que hace falta. */}
                    {suya?.url && (
                      <a
                        href={suya.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="t-apoyo mt-1 ml-[74px] flex h-12 items-center font-extrabold"
                        style={{ color: 'var(--t-bien)' }}
                      >
                        Ver la receta · {deDondeEs(suya.url)}
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </li>
        ))}
      </ul>

      {aviso && (
        <div className="mt-4">
          <Aviso titulo="No se ha podido guardar" explicacion={aviso} />
        </div>
      )}

      {/* ── EL CAJÓN DE LAS IDEAS ── */}
      <p className="rotulo mt-8">Ideas y recetas guardadas</p>

      {recetas.length === 0 ? (
        <div className="mt-2">
          <Vacio
            titulo="El cajón está vacío"
            explicacion="Aquí se guarda lo que vayáis viendo: un vídeo de YouTube, una receta de una página, o solo el nombre de algo que sale bien."
          />
        </div>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {recetas.map((r) => (
            <li key={r.id} className="rounded-[20px] border border-borde bg-superficie px-4 py-3.5">
              <p className="t-tarjeta">{r.titulo}</p>
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="t-apoyo mt-0.5 flex h-12 items-center font-extrabold"
                  style={{ color: 'var(--t-bien)' }}
                >
                  Abrir · {deDondeEs(r.url)}
                </a>
              )}
              {r.nota && (
                <p className="t-apoyo mt-1">{r.nota}</p>
              )}

              {/*
                Ponerla en un día desde aquí. Es el camino natural: se
                mira el cajón, se ve algo que apetece y se coloca. Al
                revés —abrir el día y buscar la receta— hay que
                acordarse de cómo se llamaba.
              */}
              <div className="mt-2.5 flex flex-wrap gap-2">
                {dias.slice(0, 7).map((fecha) => (
                  <button
                    key={fecha}
                    onClick={() => guardar(fecha, 'comida', r.titulo, r.id)}
                    className="t-apoyo h-[48px] min-w-[52px] rounded-[16px] border border-borde bg-superficie px-3 font-extrabold text-tinta"
                  >
                    {comoSeLlamaElDia(fecha).split(' ')[0].slice(0, 3)}
                  </button>
                ))}
              </div>
              <p className="t-apoyo mt-1.5">Toca un día para ponerla de comida</p>

              {/* Era texto suelto de 14 px: 20 px de alto en una lista
                  donde todo lo demás pasa de 48. */}
              <button
                onClick={() => quitarIdea(r.id)}
                className="t-apoyo mt-1 flex h-12 items-center font-extrabold"
                style={{ color: 'var(--t-alerta)' }}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {!abierto ? (
        <div className="mt-4">
          <BotonPrincipal onClick={() => setAbierto(true)} icono="mas">
            Guardar una idea
          </BotonPrincipal>
        </div>
      ) : (
        <div className="mt-4 rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <label className="block">
            <span className="rotulo">¿Qué es?</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Lentejas de la abuela, pollo al horno…"
              maxLength={120}
              className="entrada mt-2"
            />
          </label>

          <label className="mt-4 block">
            <span className="rotulo">Enlace (si lo hay)</span>
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              autoCapitalize="off"
              spellCheck={false}
              className="entrada mt-2"
            />
          </label>
          <p className="t-apoyo mt-1.5">
            Pega la dirección del vídeo o de la página. Si no hay enlace, déjalo
            vacío: con el nombre basta.
          </p>

          {/* Eran `bg-verde` con texto blanco, uno al lado del otro a
              56 px. A 360 px dos botones en fila dejan 150 px cada uno
              y «Guardando…» se corta. Uno debajo del otro, y el que se
              apaga dice por qué. */}
          <div className="mt-4 space-y-2.5">
            <BotonPrincipal
              onClick={nuevaIdea}
              desactivado={guardando || titulo.trim().length < 2}
              porQue={titulo.trim().length < 2 ? 'Ponle un nombre para reconocerlo.' : undefined}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </BotonPrincipal>
            <BotonSecundario onClick={() => setAbierto(false)}>Dejarlo</BotonSecundario>
          </div>
        </div>
      )}
    </div>
  )
}

/*
  Un renglón que se escribe y se guarda solo al salir.

  Lleva su propio estado porque, si escribiera directamente en la lista
  de arriba, cada tecla repintaría los catorce campos de la semana. En
  un móvil eso se nota: las letras salen con retraso.
*/
function Renglon({
  valor,
  alSalir,
}: {
  valor: string
  alSalir: (v: string) => void
}) {
  const [texto, setTexto] = useState(valor)
  const ultimo = useRef(valor)

  /* Si cambia desde fuera —se cambia de semana— el campo se pone al
     día. Sin esto, la semana siguiente saldría con el texto de la
     anterior. */
  useEffect(() => {
    if (valor !== ultimo.current) {
      ultimo.current = valor
      setTexto(valor)
    }
  }, [valor])

  return (
    <input
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        ultimo.current = texto
        alSalir(texto)
      }}
      placeholder="—"
      maxLength={200}
      className="t-cuerpo min-w-0 flex-1 rounded-[16px] border border-transparent bg-fondo px-3 py-3 font-extrabold text-tinta placeholder:font-semibold placeholder:text-apagado focus:outline-none"
      style={{ minHeight: 48 }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accion)')}
      onBlurCapture={(e) => (e.currentTarget.style.borderColor = 'transparent')}
    />
  )
}
