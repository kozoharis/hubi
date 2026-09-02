'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { pasilloDe, PASILLOS } from '@/lib/comprables'
import { Ico } from '../iconos'
import Programar from './programar'

type Cosa = {
  id: string
  que: string
  cantidad: string | null
  comprado: boolean
  anadido_por: string
  seccion_id: string | null
  lista_id: string | null
}

export type ListaCompra = {
  id: string
  nombre: string
  seccion_id: string | null
  fecha: string | null
  hora: string | null
  asignado_a: string | null
}

type Seccion = { id: string; nombre: string; segmento: string }

/*
  Qué secciones NO se ofrecen como destino de la compra.

  La casa queda fuera porque es lo normal: se apunta pan y no se piensa
  "para quién". Etiquetarlo todo como "Casa" es ruido en cada línea.

  Y SEGUROS queda fuera porque no es un sitio donde se compre nada.
  Estaba saliendo en la fila de destinos junto a la Finca y Los
  Helechos, y ahí no pinta nada: nadie apunta lechugas "para Seguros".
  Salían todas las carpetas raíz sin preguntarse cuáles tienen sentido
  para una lista de la compra.

  Fuera también VEHÍCULOS: se pensó que aceite o bombillas serían
  compras que uno quiere separar, y no — la compra del coche se hace en
  el taller, no en el supermercado. Una fila de destinos con cosas que
  nadie usa es una fila que hay que leer entera cada vez para no elegir
  la equivocada. */
const NO_ETIQUETA = ['CASA', 'DOCUMENTOS', 'PERSONAL', 'SALUD', 'SEGUROS', 'VEHICULOS', 'VEHÍCULOS']

/*
  La lista, por dentro.

  Dos reglas mandan sobre todo lo demás:

  1 · TACHAR ES UN TOQUE, Y EN CUALQUIER SITIO DE LA LÍNEA. En un
  supermercado se lleva el móvil en una mano y el carro en la otra.
  Una casilla de 20 px es imposible; la línea entera, de 64 px de alto,
  no falla.

  2 · SE VE AL INSTANTE. Se tacha en la pantalla antes de que el
  servidor conteste, y si el servidor dice que no, se vuelve atrás y se
  explica. Esperar medio segundo por artículo con quince artículos es
  esperar ocho segundos mirando una lista quieta.
*/
export default function Pantalla({
  inicial,
  nombres,
  yo,
  habituales,
  secciones,
  listas,
}: {
  inicial: Cosa[]
  nombres: Record<string, string>
  yo: string
  habituales: string[]
  secciones: Seccion[]
  listas: ListaCompra[]
}) {
  const router = useRouter()
  const [, empezar] = useTransition()

  const [cosas, setCosas] = useState<Cosa[]>(inicial)
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [cerrando, setCerrando] = useState(false)

  /*
    EN QUÉ LISTA ESTÁS.

    Un solo control con dos significados, y a propósito: el botón que
    tocas decide QUÉ LISTA VES y, a la vez, DÓNDE VA lo que apuntes.
    Es como se piensa de verdad —"estoy con la compra de la finca"—, y
    ahorra el segundo control que haría falta para separarlos.

    Antes solo decidía el destino: se podía apuntar algo "para la
    finca" y seguía saliendo revuelto con el pan de casa, así que no
    había forma de ir a la tienda con la lista de una sola cosa.

    `null` es la compra de casa, que es el 90%: apuntar pan no puede
    costar una decisión.
  */
  const [destino, setDestino] = useState<string | null>(null)
  const [programando, setProgramando] = useState(false)
  const [creando, setCreando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')

  /*
    EN QUÉ LISTA DE ESA CATEGORÍA.

    Dentro de casa puede haber "Del lunes" y "Fin de mes". Este segundo
    nivel SOLO se enseña cuando hay más de una: con una sola, la
    pantalla se ve exactamente igual que antes y nadie paga una
    decisión que no necesita.
  */
  const [listaActiva, setListaActiva] = useState<string | null>(null)

  const etiquetables = secciones.filter((x) => !NO_ETIQUETA.includes(x.segmento.toUpperCase()))
  const nombreSeccion = (id: string | null) =>
    id ? (secciones.find((x) => x.id === id)?.nombre ?? null) : null

  const deLaCategoria = listas.filter((l) => (l.seccion_id ?? null) === destino)

  /* Con una sola lista, se usa ésa sin preguntar. Con varias, la
     elegida; y si no hay ninguna elegida todavía, la primera. */
  const listaId =
    deLaCategoria.find((l) => l.id === listaActiva)?.id ?? deLaCategoria[0]?.id ?? null
  const laLista = deLaCategoria.find((l) => l.id === listaId) ?? null

  /* Solo lo de la lista que se está mirando. Lo que quedó sin lista
     —apuntado antes de que existieran— se ve en la primera de su
     categoría, para que no desaparezca de la vista de nadie. */
  const deEstaLista = cosas.filter((c) => {
    if ((c.seccion_id ?? null) !== destino) return false

    /*
      SIN LISTAS, SE VE TODO. Ésta es la salida de emergencia.

      Si la tabla de listas no existe todavía, o esta categoría no
      tiene ninguna, no hay nada por lo que filtrar — y filtrar por
      algo que no existe es esconderlo todo. Antes de que nada más se
      cumpla: si no hay listas, entra.
    */
    if (deLaCategoria.length === 0) return true

    /* Lo apuntado antes de que existieran las listas no se queda
       fuera: se ve en la primera de su categoría. */
    if (!c.lista_id) return listaId === deLaCategoria[0]?.id

    return c.lista_id === listaId
  })
  const pendientes = deEstaLista.filter((c) => !c.comprado)
  const tachadas = deEstaLista.filter((c) => c.comprado)

  /* Cuántas cosas hay en cada lista, para poder ponerlo en su botón:
     así se ve que la finca tiene cuatro cosas esperando sin tener que
     entrar a mirar. */
  const cuantasEn = (id: string | null) =>
    cosas.filter((c) => !c.comprado && (c.seccion_id ?? null) === id).length

  const cuantasEnLista = (id: string) =>
    cosas.filter((c) => !c.comprado && c.lista_id === id).length

  async function crearLista() {
    const nombre = nombreNuevo.trim()
    if (nombre.length < 2) return

    setAviso(null)
    const r = await fetch('/api/compra/listas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, seccion_id: destino }),
    })
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setAviso(d.error ?? 'No se ha podido crear la lista.')
      return
    }
    const d = (await r.json()) as { lista?: { id: string } }
    if (d.lista) setListaActiva(d.lista.id)
    setNombreNuevo('')
    setCreando(false)
    empezar(() => router.refresh())
  }

  async function anadir(que: string) {
    const limpio = que.trim()
    if (!limpio) return

    setTexto('')
    setAviso(null)

    /*
      SE PINTA ANTES DE MANDARLO.

      Quien apunta la compra apunta seis cosas seguidas. Si cada una
      tarda medio segundo en aparecer, se escribe la siguiente sobre
      una lista que aún no ha cambiado y se acaba dudando de si se
      apuntó. Aparece ya; si falla, se quita y se dice.
    */
    const provisional: Cosa = {
      id: `nuevo-${Date.now()}`,
      que: limpio,
      cantidad: null,
      comprado: false,
      anadido_por: yo,
      seccion_id: destino,
      lista_id: listaId,
    }
    setCosas((c) => [...c, provisional])

    try {
      const r = await fetch('/api/compra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ que: limpio, seccion_id: destino, lista_id: listaId }),
      })
      if (!r.ok) throw new Error((await r.json()).error)
      empezar(() => router.refresh())
    } catch (e) {
      setCosas((c) => c.filter((x) => x.id !== provisional.id))
      setAviso(e instanceof Error ? e.message : 'No se ha podido apuntar.')
    }
  }

  async function tachar(cosa: Cosa) {
    const antes = cosa.comprado
    setCosas((c) => c.map((x) => (x.id === cosa.id ? { ...x, comprado: !antes } : x)))

    try {
      const r = await fetch(`/api/compra/${cosa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comprado: !antes }),
      })
      if (!r.ok) throw new Error((await r.json()).error)
    } catch (e) {
      setCosas((c) => c.map((x) => (x.id === cosa.id ? { ...x, comprado: antes } : x)))
      setAviso(e instanceof Error ? e.message : 'No se ha podido cambiar.')
    }
  }

  async function quitar(cosa: Cosa) {
    const copia = cosas
    setCosas((c) => c.filter((x) => x.id !== cosa.id))

    try {
      const r = await fetch(`/api/compra/${cosa.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error((await r.json()).error)
    } catch (e) {
      setCosas(copia)
      setAviso(e instanceof Error ? e.message : 'No se ha podido quitar.')
    }
  }

  async function yaHeComprado() {
    setCerrando(true)
    setAviso(null)
    try {
      const r = await fetch('/api/compra', { method: 'PATCH' })
      if (!r.ok) throw new Error((await r.json()).error)
      setCosas((c) => c.filter((x) => !x.comprado))
      empezar(() => router.refresh())
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se ha podido guardar.')
    }
    setCerrando(false)
  }

  return (
    <>
      {/*
        ── PARA QUÉ ES ──

        Solo sale si la familia tiene alguna sección aparte de la casa.
        Con una casa y nada más, esto no aparece y la pantalla queda
        exactamente igual que antes: cero decisiones para apuntar pan.
      */}
      {etiquetables.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          <Chip
            texto={cuenta('Casa', cuantasEn(null))}
            activo={destino === null}
            alPulsar={() => setDestino(null)}
          />
          {etiquetables.map((x) => (
            <Chip
              key={x.id}
              texto={cuenta(x.nombre, cuantasEn(x.id))}
              activo={destino === x.id}
              alPulsar={() => setDestino(x.id)}
            />
          ))}
        </div>
      )}

      {/*
        LAS LISTAS DE ESTA CATEGORÍA.

        Segunda fila, y solo cuando hace falta: con una sola lista no
        se enseña nada —la pantalla se ve igual que siempre— y el "+"
        aparece siempre, pequeño, por si alguien quiere separar la
        compra del lunes de la de fin de mes.
      */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {deLaCategoria.length > 1 &&
          deLaCategoria.map((l) => (
            <Chip
              key={l.id}
              texto={cuenta(l.nombre, cuantasEnLista(l.id))}
              activo={listaId === l.id}
              alPulsar={() => setListaActiva(l.id)}
            />
          ))}

        {!creando && (
          <button
            onClick={() => setCreando(true)}
            className="flex h-11 items-center gap-1.5 rounded-full border border-dashed border-borde px-3.5 text-[14.5px] font-extrabold text-tenue"
          >
            <Ico nombre="mas" tam={16} grosor={2.4} />
            Otra lista
          </button>
        )}
      </div>

      {creando && (
        <div className="mt-2 flex gap-2">
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && crearLista()}
            placeholder="Del lunes, Fin de mes…"
            autoFocus
            className="entrada flex-1 text-[16px]"
          />
          <button
            onClick={crearLista}
            className="h-[58px] shrink-0 rounded-[16px] bg-boton px-5 text-[16px] font-extrabold text-boton-texto"
          >
            Crear
          </button>
          <button
            onClick={() => {
              setCreando(false)
              setNombreNuevo('')
            }}
            className="h-[58px] shrink-0 rounded-[16px] border border-borde px-4 text-[16px] font-extrabold text-tinta-suave"
          >
            No
          </button>
        </div>
      )}

      {/* ── Apuntar ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          anadir(texto)
        }}
        className="mt-3 flex gap-2.5"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={destino ? `Para ${nombreSeccion(destino)}…` : 'Leche, pan, huevos…'}
          aria-label="Qué hay que comprar"
          className="h-[60px] min-w-0 flex-1 rounded-[18px] border-2 border-borde bg-fondo px-4 text-[18px] font-semibold text-tinta placeholder:text-tenue focus:border-verde focus:outline-none"
        />
        <button
          type="submit"
          disabled={!texto.trim()}
          aria-label="Añadir a la compra"
          className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[18px] bg-boton text-boton-texto disabled:opacity-35"
        >
          <Ico nombre="mas" tam={26} grosor={2.4} />
        </button>
      </form>

      <p className="mt-2.5 text-[15px] font-semibold leading-snug text-tenue">
        También puedes decirlo: «apunta leche, pan y huevos en la compra».
      </p>

      {aviso && (
        <p className="mt-4 rounded-[16px] bg-coral-suave px-4 py-3.5 text-[16px] font-semibold leading-snug text-coral">
          {aviso}
        </p>
      )}

      {/* ── Lo que falta ── */}
      {deEstaLista.length === 0 ? (
        <p className="mt-6 rounded-[20px] bg-superficie px-6 py-10 text-center text-[17px] font-medium text-tinta-suave">
          {destino
            ? `La compra de ${nombreSeccion(destino)} está vacía.`
            : 'La lista está vacía.'}
        </p>
      ) : (
        <>
          <h2 className="rotulo mt-6">
            {pendientes.length === 0
              ? 'Todo cogido'
              : `Falta por coger · ${pendientes.length}`}
          </h2>

          {/*
            POR ZONAS DE LA TIENDA, NO POR ORDEN DE DICTADO.

            Veinte cosas en el orden en que se dictaron obligan a
            cruzar el supermercado cuatro veces. Agrupadas, se hace de
            una pasada: fruta, carne, frescos, despensa… y limpieza al
            final, que es como está puesta una tienda.

            A NADIE SE LE PREGUNTA EN QUÉ ZONA VA CADA COSA. Se deduce
            del nombre —es trabajo del sistema, no de quien dicta— y se
            hace al pintar la lista, así que lo ya apuntado se reordena
            solo en cuanto mejoremos la tabla.

            Con menos de cinco cosas no se agrupa: encabezados para una
            lista de tres es ceremonia por nada.
          */}
          {pendientes.length < 5 ? (
            <ul className="mt-2.5 space-y-2">
              {pendientes.map((c) => (
                <Linea
                  key={c.id}
                  cosa={c}
                  de={nombres[c.anadido_por] ?? ''}
                  seccion={nombreSeccion(c.seccion_id)}
                  mio={c.anadido_por === yo}
                  alTachar={() => tachar(c)}
                  alQuitar={() => quitar(c)}
                />
              ))}
            </ul>
          ) : (
            PASILLOS.map((zona) => {
              const suyas = pendientes.filter((c) => pasilloDe(c.que) === zona)
              if (suyas.length === 0) return null
              return (
                <section key={zona} className="mt-4">
                  <p className="text-[14px] font-extrabold tracking-wider text-tenue">
                    {zona.toUpperCase()}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {suyas.map((c) => (
                      <Linea
                        key={c.id}
                        cosa={c}
                        de={nombres[c.anadido_por] ?? ''}
                        seccion={nombreSeccion(c.seccion_id)}
                        mio={c.anadido_por === yo}
                        alTachar={() => tachar(c)}
                        alQuitar={() => quitar(c)}
                      />
                    ))}
                  </ul>
                </section>
              )
            })
          )}
        </>
      )}

      {/*
        PONERLE DÍA A ESTA LISTA.

        Debajo de la lista y no arriba: primero se apunta lo que hace
        falta y solo después tiene sentido decir cuándo se va. Y solo
        aparece si hay algo que comprar — programar una lista vacía no
        es nada.
      */}
      {pendientes.length > 0 && !programando && (
        <button
          onClick={() => setProgramando(true)}
          className="mt-4 flex h-[56px] w-full items-center justify-center gap-2.5 rounded-[18px] border border-borde bg-superficie text-[16.5px] font-extrabold text-tinta"
        >
          <Ico nombre="calendario" tam={20} grosor={2.2} />
          {laLista?.fecha
            ? `${enPalabras(laLista.fecha, laLista.hora)}${
                laLista.asignado_a ? ` · ${(nombres[laLista.asignado_a] ?? '').split(' ')[0]}` : ''
              }`
            : 'Poner día a esta compra'}
        </button>
      )}

      {programando && (
        <Programar
          lista={laLista}
          nombreCategoria={nombreSeccion(destino) ?? 'casa'}
          seccionId={destino}
          cuantas={pendientes.length}
          gente={Object.entries(nombres).map(([id, nombre]) => ({ id, nombre }))}
          yo={yo}
          alCerrar={() => setProgramando(false)}
        />
      )}

      {/* ── Lo ya cogido ── */}
      {tachadas.length > 0 && (
        <>
          <h2 className="rotulo mt-7">En el carro · {tachadas.length}</h2>
          <ul className="mt-2.5 space-y-2">
            {tachadas.map((c) => (
              <Linea
                key={c.id}
                cosa={c}
                de={nombres[c.anadido_por] ?? ''}
                seccion={nombreSeccion(c.seccion_id)}
                mio={c.anadido_por === yo}
                alTachar={() => tachar(c)}
                alQuitar={() => quitar(c)}
              />
            ))}
          </ul>

          <button
            onClick={yaHeComprado}
            disabled={cerrando}
            className="mt-5 flex h-[62px] w-full items-center justify-center gap-2.5 rounded-[18px] bg-verde text-[18px] font-extrabold text-white disabled:opacity-40"
          >
            <Ico nombre="check" tam={22} grosor={2.4} />
            {cerrando ? 'Guardando…' : 'Ya he comprado'}
          </button>
          <p className="mt-2.5 text-center text-[15px] font-semibold leading-snug text-tenue">
            Quita de la lista lo que ya está en el carro.
          </p>
        </>
      )}

      {/* ── Lo de siempre ── */}
      {habituales.length > 0 && (
        <>
          <h2 className="rotulo mt-8">Lo que soléis comprar</h2>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug text-tenue">
            Toca para añadirlo sin escribirlo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {habituales.map((h) => (
              <button
                key={h}
                onClick={() => anadir(h)}
                className="flex h-[50px] items-center gap-1.5 rounded-full border border-borde bg-superficie px-4 text-[16.5px] font-bold text-tinta"
              >
                <Ico nombre="mas" tam={17} grosor={2.6} className="text-tenue" />
                {h}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

/** "el lunes 8 a las 10:00" — el día tal como se dice. */
function enPalabras(fecha: string, hora: string | null): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const f = new Date(a, m - 1, d)
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const cuando = `${dias[f.getDay()]} ${d} de ${meses[m - 1]}`
  return hora ? `${cuando} · ${hora.slice(0, 5)}` : cuando
}

/** "La Finca" → "La Finca · 4" cuando hay algo esperando. */
function cuenta(nombre: string, n: number): string {
  return n > 0 ? `${nombre} · ${n}` : nombre
}

function Chip({
  texto,
  activo,
  alPulsar,
}: {
  texto: string
  activo: boolean
  alPulsar: () => void
}) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      aria-pressed={activo}
      className={`flex h-[46px] items-center rounded-full border-2 px-4 text-[16px] font-extrabold ${
        activo ? 'border-verde bg-verde-suave text-verde' : 'border-borde bg-superficie text-tinta-suave'
      }`}
    >
      {texto}
    </button>
  )
}

function Linea({
  cosa,
  de,
  seccion,
  mio,
  alTachar,
  alQuitar,
}: {
  cosa: Cosa
  de: string
  seccion: string | null
  mio: boolean
  alTachar: () => void
  alQuitar: () => void
}) {
  return (
    <li
      className={`flex items-stretch overflow-hidden rounded-[18px] border bg-superficie ${
        cosa.comprado ? 'border-borde opacity-60' : 'border-borde'
      }`}
    >
      {/*
        Toda la línea tacha, no una casilla.

        Con el móvil en una mano y el carro en la otra, acertar en un
        cuadradito de 20 px es imposible. Aquí el objetivo son 64 px de
        alto por casi todo el ancho.
      */}
      <button
        onClick={alTachar}
        aria-pressed={cosa.comprado}
        className="flex min-h-[64px] flex-1 items-center gap-3.5 px-4 py-3 text-left"
      >
        <span
          className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2 ${
            cosa.comprado ? 'border-verde bg-verde text-white' : 'border-borde'
          }`}
        >
          {cosa.comprado && <Ico nombre="check" tam={17} grosor={3} />}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block text-[18px] font-bold leading-snug ${
              cosa.comprado ? 'text-tinta-suave line-through' : 'text-tinta'
            }`}
          >
            {cosa.que}
            {cosa.cantidad && (
              <span className="font-semibold text-tenue"> · {cosa.cantidad}</span>
            )}
          </span>
          {/* Solo se dice quién lo apuntó si lo apuntó el otro. Ver tu
              propio nombre en cada línea no informa de nada. */}
          {(seccion || (!mio && de)) && (
            <span className="mt-0.5 block text-[14px] font-extrabold tracking-wider text-tenue">
              {[seccion?.toUpperCase(), !mio && de ? de.split(' ')[0].toUpperCase() : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>
      </button>

      <button
        onClick={alQuitar}
        aria-label={`Quitar ${cosa.que} de la lista`}
        className="flex w-[56px] shrink-0 items-center justify-center border-l border-borde text-[26px] font-light leading-none text-tenue"
      >
        {/* Una equis, que la entiende todo el mundo. Un icono de
            papelera hay que aprendérselo; esto no. */}
        ×
      </button>
    </li>
  )
}
