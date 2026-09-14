'use client'

import { useEffect, useRef, useState } from 'react'
import { Ico } from '../iconos'
import { Aviso, BotonDestructivo, BotonPrincipal, BotonSecundario, Vacio } from '../piezas'
import { api } from '@/lib/api'
import Comprobar, { type ListaDeCompra } from './comprobar'
import RepetirPlato from './repetir-plato'
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

type Menu = {
  id: string
  fecha: string
  momento: Momento
  que: string
  receta_id: string | null
  /* Del paso 81. Pueden no venir: la API los pide y, si la base
     todavía no los tiene, vuelve a pedir sin ellos. */
  grupo_id?: string | null
  cada_semanas?: number | null
  repite_hasta?: string | null
  comprobado_en?: string | null
  faltan?: string[] | null
}
type Receta = {
  id: string
  titulo: string
  url: string | null
  nota: string | null
  /* Lo que lleva, una línea por ingrediente (paso 80). Desde la pared
     se mandan enteros a la compra de un toque. */
  ingredientes?: string[] | null
}

export default function Semana() {
  const [lunes, setLunes] = useState<string | null>(null)
  const [dias, setDias] = useState<string[]>([])
  const [menus, setMenus] = useState<Menu[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [listas, setListas] = useState<ListaDeCompra[]>([])
  const [sinTablas, setSinTablas] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  /* Qué menú se está comprobando, y qué plato se está poniendo a
     repetir. Uno cada vez: dos fichas abiertas a la vez en una pantalla
     de teléfono es no saber cuál contestas. */
  const [comprobando, setComprobando] = useState<string | null>(null)
  const [repitiendo, setRepitiendo] = useState<string | null>(null)
  /* Qué tanda se está tocando, por su `grupo_id`. */
  const [laTanda, setLaTanda] = useState<string | null>(null)
  const [conLaTanda, setConLaTanda] = useState(false)

  // ── El cajón de ideas ──
  const [abierto, setAbierto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [url, setUrl] = useState('')
  /* La receta escrita, para las que no tienen enlace — y también para
     las que sí: «le pongo menos azúcar que en el vídeo». */
  const [nota, setNota] = useState('')
  /* Los ingredientes, escritos uno por línea. Un campo de texto y no
     una lista de campos con su botón de añadir: quien copia una receta
     de una página los pega de golpe, y con campos sueltos habría que
     repartirlos a mano. */
  const [loQueLleva, setLoQueLleva] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function traer(cual?: string) {
    try {
      const r = await fetch(api(`/api/menus${cual ? `?lunes=${cual}` : ''}`))
      const d = (await r.json()) as {
        lunes?: string
        dias?: string[]
        menus?: Menu[]
        recetas?: Receta[]
        listas?: ListaDeCompra[]
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
      setListas(d.listas ?? [])
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

    const d = (await r.json().catch(() => ({}))) as {
      id?: string
      error?: string
      detalle?: string
    }

    if (!r.ok) {
      setAviso(d.detalle ?? d.error ?? 'No se ha podido guardar.')
      traer(lunes ?? undefined)
      return
    }

    /*
      Y SE CAMBIA EL IDENTIFICADOR DE MENTIRA POR EL DE VERDAD.

      Mientras se guardaba, la fila llevaba `nuevo-2026-09-18-cena`,
      que sirve para pintarla y para nada más. Sin esta línea, la
      comprobación de ingredientes que se abriera justo después
      mandaría ese texto a la base y volvería «ese menú ya no está»
      sobre un menú que se acaba de poner.
    */
    if (d.id) {
      setMenus((lista) =>
        lista.map((m) => (m.fecha === fecha && m.momento === momento ? { ...m, id: d.id! } : m))
      )
    }
  }

  /* Lo que acaba de comprobarse, sin volver a pedir la semana entera. */
  function yaComprobado(id: string, faltan: string[]) {
    setMenus((lista) =>
      lista.map((m) =>
        m.id === id ? { ...m, comprobado_en: new Date().toISOString(), faltan } : m
      )
    )
  }

  /*
    ══════════════════════════════════════════════════════════════
    LA TANDA · quitarla y alargarla
    ══════════════════════════════════════════════════════════════

    Los dos botones viven DEBAJO DEL DÍA y no en una pantalla de
    ajustes, y eso es la decisión que importa.

    Una tanda no es un objeto que nadie vaya a buscar: es una lasaña
    que aparece los viernes. Y el momento en que alguien quiere quitarla
    es exactamente el momento en que la ve puesta un viernes y piensa
    «otra vez lasaña». Si para quitarla hay que acordarse de dónde se
    creó, no se quita: se borra el texto de ese día, y a la semana
    siguiente vuelve a estar.

    **Quitar solo borra de hoy en adelante.** Lo de atrás es lo que se
    comió, y reescribir la historia para arreglar el futuro no lo pide
    nadie.
  */
  async function quitarLaTanda(grupo: string) {
    setConLaTanda(true)
    setAviso(null)
    const r = await fetch(api(`/api/menus/plan?grupo=${grupo}`), { method: 'DELETE' })
    setConLaTanda(false)
    setLaTanda(null)

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string; detalle?: string }
      setAviso(d.detalle ?? d.error ?? 'No se ha podido quitar.')
      return
    }
    traer(lunes ?? undefined)
  }

  async function alargarLaTanda(grupo: string) {
    setConLaTanda(true)
    setAviso(null)
    const r = await fetch(api('/api/menus/plan'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grupo }),
    })
    setConLaTanda(false)
    setLaTanda(null)

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string; detalle?: string }
      setAviso(d.detalle ?? d.error ?? 'No se ha podido alargar.')
      return
    }
    traer(lunes ?? undefined)
  }

  async function nuevaIdea() {
    if (titulo.trim().length < 2) return
    setGuardando(true)
    setAviso(null)

    const r = await fetch(api('/api/menus'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: titulo.trim(),
        url: url.trim(),
        nota: nota.trim(),
        ingredientes: loQueLleva
          .split('\n')
          .map((i) => i.trim())
          .filter((i) => i.length > 1),
      }),
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
    setNota('')
    setLoQueLleva('')
    setAbierto(false)
  }

  async function quitarIdea(id: string) {
    setRecetas((x) => x.filter((r) => r.id !== id))
    await fetch(api(`/api/menus?receta=${id}`), { method: 'DELETE' })
  }

  /*
    ══════════════════════════════════════════════════════════════
    LAS TANDAS QUE SE ESTÁN ACABANDO
    ══════════════════════════════════════════════════════════════

    Y esto es lo que convierte «alargar» en algo que funciona.

    Un botón de alargar escondido en una ficha es un botón que nadie
    toca: nadie entra a mirar si su plan se está acabando. Lo que pasa
    en la vida real es que un viernes la lasaña deja de aparecer y
    nadie sabe por qué — ni siquiera se echa en falta, simplemente ya
    no está.

    Así que la tanda lo dice ella. Tres semanas antes, arriba, con su
    botón al lado. Es la misma idea que gobierna lo que vence: **si
    algo se va a acabar, lo tiene que decir quien lo sabe.**
  */
  const hoy = new Date()
  const dentroDeTres = new Date(hoy.getTime() + 21 * 86_400_000).toISOString().slice(0, 10)

  const seAcaban = [
    ...new Map(
      menus
        .filter((m) => m.grupo_id && m.repite_hasta && m.repite_hasta <= dentroDeTres)
        .map((m) => [m.grupo_id!, m])
    ).values(),
  ]

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

      {seAcaban.map((m) => (
        <div key={m.grupo_id} className="mt-3 rounded-[20px] border border-borde bg-superficie px-4 py-3.5">
          <p className="t-cuerpo leading-snug">
            <strong className="text-tinta">{m.que}</strong> deja de repetirse el{' '}
            {comoSeLlamaElDia(m.repite_hasta!)}.
          </p>
          <div className="mt-2.5">
            <BotonSecundario
              onClick={() => alargarLaTanda(m.grupo_id!)}
              desactivado={conLaTanda}
            >
              {conLaTanda ? 'Un momento…' : 'Alargar tres meses más'}
            </BotonSecundario>
          </div>
        </div>
      ))}

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
                const lleva = suya?.ingredientes ?? []
                const nuevoDeVerdad = puesto && !puesto.id.startsWith('nuevo-')
                const sinMirar = Boolean(nuevoDeVerdad && lleva.length > 0 && !puesto!.comprobado_en)
                const faltan = puesto?.faltan ?? []

                return (
                  <div key={valor}>
                    <div className="flex items-center gap-2.5">
                      <span className="t-apoyo w-[62px] shrink-0 font-extrabold">
                        {texto}
                      </span>
                      <Renglon
                        valor={puesto?.que ?? ''}
                        alSalir={(v) => guardar(fecha, valor, v)}
                      />
                      {/*
                        ── EL DESPLEGABLE ──

                        Haris: *«si queremos cambiar el menú de la cena
                        del viernes, pueda salirte un desplegable y lo
                        puedas elegir»*.

                        Es un `select` de los del navegador, a
                        propósito: en el teléfono abre la rueda del
                        sistema, que es enorme y se maneja con el pulgar
                        sin apuntar. Una lista dibujada por nosotros
                        sería más bonita y más pequeña.

                        Y NO SUSTITUYE AL CAMPO DE ESCRIBIR, que sigue
                        al lado. «Sobras» y «cada uno lo suyo» no están
                        en el cajón de recetas y nunca lo estarán.
                      */}
                      {recetas.length > 0 && (
                        <label className="relative shrink-0">
                          <span className="sr-only">
                            Elegir un plato guardado para la {texto.toLowerCase()} del{' '}
                            {comoSeLlamaElDia(fecha)}
                          </span>
                          <select
                            value=""
                            onChange={(e) => {
                              const r = recetas.find((x) => x.id === e.target.value)
                              if (r) guardar(fecha, valor, r.titulo, r.id)
                            }}
                            className="absolute inset-0 h-full w-full opacity-0"
                          >
                            <option value="">Elegir…</option>
                            {recetas.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.titulo}
                              </option>
                            ))}
                          </select>
                          <span
                            aria-hidden
                            className="tocable flex h-[48px] w-[48px] items-center justify-center rounded-[16px] border border-borde bg-superficie"
                          >
                            <Ico nombre="flecha" tam={18} grosor={2.4} className="rotate-90" />
                          </span>
                        </label>
                      )}
                    </div>

                    {/* Si vino de una receta con enlace, se puede abrir
                        desde aquí: es el momento en que hace falta. */}
                    {suya?.url && (
                      <a
                        href={suya.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="t-apoyo mt-1 ml-[72px] flex h-12 items-center font-extrabold"
                        style={{ color: 'var(--t-bien)' }}
                      >
                        Ver la receta · {deDondeEs(suya.url)}
                      </a>
                    )}

                    {/*
                      ── ¿SE PUEDE HACER? ──

                      Haris: *«siempre hay que hacer una checklist para
                      que se pueda hacer, si no que se haga otro»*. Por
                      eso el estado se ve SIN abrir nada: lo que hay que
                      poder decidir de un vistazo es si hay que cambiar
                      el menú del viernes, y eso se decide mirando la
                      semana, no entrando en siete fichas.
                    */}
                    {nuevoDeVerdad && lleva.length > 0 && comprobando !== puesto!.id && (
                      <button
                        onClick={() => setComprobando(puesto!.id)}
                        className="t-apoyo ml-[72px] flex h-12 items-center gap-1.5 font-extrabold"
                        style={{
                          color: sinMirar
                            ? 'var(--t-tinta-suave)'
                            : faltan.length > 0
                              ? 'var(--t-alerta)'
                              : 'var(--t-bien)',
                        }}
                      >
                        {!sinMirar && faltan.length === 0 && (
                          <Ico nombre="check" tam={17} grosor={2.6} />
                        )}
                        {sinMirar
                          ? `¿Tienes lo que lleva? · ${lleva.length}`
                          : faltan.length > 0
                            ? `Faltan ${faltan.length} ${faltan.length === 1 ? 'cosa' : 'cosas'}`
                            : 'Está todo para hacerlo'}
                      </button>
                    )}

                    {/*
                      ── ESTE PLATO SE REPITE ──

                      Solo sale si el menú nació de una tanda. Dice cada
                      cuánto vuelve —que es la pregunta de quien se
                      extraña de verlo— y abre las dos únicas cosas que
                      se pueden hacer con ella.
                    */}
                    {puesto?.grupo_id && comprobando !== puesto.id && (
                      <div className="ml-[72px]">
                        <button
                          onClick={() =>
                            setLaTanda((g) => (g === puesto.grupo_id ? null : puesto.grupo_id!))
                          }
                          className="t-apoyo flex h-12 items-center gap-1.5 font-extrabold"
                        >
                          <Ico nombre="refrescar" tam={16} grosor={2.4} />
                          {puesto.cada_semanas === 2
                            ? 'Se repite cada dos semanas'
                            : puesto.cada_semanas === 3
                              ? 'Se repite cada tres semanas'
                              : 'Se repite cada semana'}
                        </button>

                        {laTanda === puesto.grupo_id && (
                          <div className="mb-1 rounded-[20px] border border-borde bg-fondo px-4 py-3.5">
                            {puesto.repite_hasta && (
                              <p className="t-apoyo leading-snug">
                                Está puesto hasta el {comoSeLlamaElDia(puesto.repite_hasta)}.
                              </p>
                            )}
                            <div className="mt-2.5 space-y-2">
                              <BotonSecundario
                                onClick={() => alargarLaTanda(puesto.grupo_id!)}
                                desactivado={conLaTanda}
                              >
                                {conLaTanda ? 'Un momento…' : 'Alargar tres meses más'}
                              </BotonSecundario>
                              <BotonDestructivo
                                onClick={() => quitarLaTanda(puesto.grupo_id!)}
                                desactivado={conLaTanda}
                              >
                                Quitar los que vienen
                              </BotonDestructivo>
                            </div>
                            <p className="t-apoyo mt-2 leading-snug">
                              Lo de días pasados se queda: es lo que se comió.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {comprobando === puesto?.id && (
                      <Comprobar
                        menu={puesto}
                        ingredientes={lleva}
                        listas={listas}
                        alGuardar={(f) => yaComprobado(puesto.id, f)}
                        cerrar={() => setComprobando(null)}
                      />
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
                <p className="t-apoyo mt-1 whitespace-pre-wrap">{r.nota}</p>
              )}

              {/* Lo que lleva, en corto: aquí se está eligiendo qué se
                  come, no cocinando. La lista entera se lee en la
                  cocina, que es donde hace falta. */}
              {(r.ingredientes ?? []).length > 0 && (
                <p className="t-apoyo mt-1 font-extrabold">
                  Lleva {(r.ingredientes ?? []).length}{' '}
                  {(r.ingredientes ?? []).length === 1 ? 'cosa' : 'cosas'}:{' '}
                  {(r.ingredientes ?? []).slice(0, 3).join(', ')}
                  {(r.ingredientes ?? []).length > 3 && '…'}
                </p>
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

              {/*
                ── Y QUE VUELVA ──

                Los botones de arriba ponen el plato UNA vez, esta
                semana. Esto lo pone todos los viernes durante tres
                meses. Son dos cosas distintas y por eso son dos sitios
                distintos: mezclarlas obligaría a preguntar «¿solo hoy o
                siempre?» cada vez que se toca un día, que es la
                pregunta de más que sobra catorce veces por semana.
              */}
              {repitiendo === r.id ? (
                <RepetirPlato
                  receta={r}
                  alHecho={() => traer(lunes ?? undefined)}
                  cerrar={() => setRepitiendo(null)}
                />
              ) : (
                <button
                  onClick={() => setRepitiendo(r.id)}
                  className="t-apoyo mt-1 flex h-12 items-center gap-1.5 font-extrabold text-tinta"
                >
                  <Ico nombre="refrescar" tam={18} grosor={2.4} />
                  Que vuelva cada semana
                </button>
              )}

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
            vacío y escríbela aquí abajo.
          </p>

          {/*
            ── LA RECETA ESCRITA ──

            Haris: *«las recetas deberían poder escribirse si es que no
            tienen un enlace»*. Y sirve también cuando SÍ lo tiene: «le
            pongo menos azúcar que en el vídeo» es justo lo que hay que
            apuntar, y es el único trozo que es de esta casa.
          */}
          <label className="mt-4 block">
            <span className="rotulo">Cómo se hace</span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Se mezcla la harina con la levadura, se deja reposar una hora…"
              className="entrada mt-2 w-full resize-none py-3"
            />
          </label>

          {/*
            ── Y LO QUE LLEVA ──

            Un campo de texto y no una lista de campos con su botón de
            añadir. Quien copia una receta de una página pega los
            ingredientes de golpe; con campos sueltos habría que
            repartirlos a mano uno por uno, que es exactamente el
            trabajo que esto viene a quitar.
          */}
          <label className="mt-4 block">
            <span className="rotulo">Lo que lleva</span>
            <textarea
              value={loQueLleva}
              onChange={(e) => setLoQueLleva(e.target.value)}
              rows={5}
              placeholder={'Medio kilo de harina\nDos huevos\nLeche\nSal'}
              className="entrada mt-2 w-full resize-none py-3"
            />
          </label>
          <p className="t-apoyo mt-1.5">
            Uno por línea. Desde la pantalla de la cocina se añaden todos a la compra de un
            toque.
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
