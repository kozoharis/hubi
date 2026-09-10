'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { pasilloDe, PASILLOS } from '@/lib/comprables'
import { Ico } from '../iconos'
import { Aviso } from '../piezas'
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
  Una compra que ya se hizo. Se guarda entera —con lo que llevaba
  dentro y con su ticket— para dos cosas: mirar atrás, y volver a
  usarla la semana siguiente sin escribirla de nuevo.
*/
export type Cerrada = {
  id: string
  nombre: string
  seccion_id: string | null
  cerrada: string | null
  cosas: number
  ticket_id: string | null
}

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
  anteriores = [],
  ticketEn,
}: {
  inicial: Cosa[]
  nombres: Record<string, string>
  yo: string
  habituales: string[]
  secciones: Seccion[]
  listas: ListaCompra[]
  /** Las compras ya cerradas, para poder recuperarlas. */
  anteriores?: Cerrada[]
  /** La carpeta donde va el ticket del súper. Null si esta casa no la tiene. */
  ticketEn: string | null
}) {
  const router = useRouter()
  const [, empezar] = useTransition()

  const [cosas, setCosas] = useState<Cosa[]>(inicial)

  /*
    ═══════════════════════════════════════════════════════════
    LA LISTA SE VUELVE A LEER DEL SERVIDOR. ESTO FALTABA.
    ═══════════════════════════════════════════════════════════

    `useState(inicial)` copia lo que había AL ABRIR la pantalla y no
    vuelve a mirar. Con `router.refresh()` el servidor mandaba la
    lista nueva y aquí no entraba nunca — así que:

      · lo recién apuntado se quedaba con su identificador
        provisional, y al tocarlo para tacharlo el servidor contestaba
        que esa cosa no existe;
      · lo que apuntaba el otro desde su móvil no aparecía;
      · y la lista solo se ponía al día saliendo y volviendo a entrar,
        que es justo lo que se notaba como «hay que darle a guardar».

    Se compara por CONTENIDO y no por identidad del array: React manda
    un array nuevo en cada dibujado, y comparar la referencia haría
    que esto se disparara siempre y pisara lo que se acaba de tocar.
  */
  const huella = inicial
    .map((c) => `${c.id}:${c.comprado ? 1 : 0}:${c.que}:${c.lista_id ?? ''}`)
    .join('|')
  const ultimaHuella = useRef(huella)

  /* Un contador para los identificadores provisionales. Antes iba con
     `Date.now()`, que es impuro y además puede repetirse si se apuntan
     dos cosas en el mismo milisegundo. */
  const nuevos = useRef(0)

  /* La compra que se acaba de cerrar, para ofrecer el ticket ahí
     mismo. Se guarda en la pantalla y no viene del servidor: solo
     tiene sentido en los segundos siguientes a cerrarla. */
  const [recienCerrada, setReciencerrada] = useState<{ id: string; nombre: string } | null>(null)
  const [recuperando, setRecuperando] = useState<string | null>(null)

  useEffect(() => {
    if (ultimaHuella.current === huella) return
    ultimaHuella.current = huella
    setCosas(inicial)
    /* `inicial` va fuera a propósito: lo que decide si hay que
       recargar es la huella, no el array. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huella])
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

  /* Cambiar el nombre o quitar la lista que se está mirando. Estaba
     todo en la API desde el principio y no había forma de llegar:
     se podían crear listas y no tocarlas nunca más. */
  const [tocando, setTocando] = useState(false)
  const [otroNombre, setOtroNombre] = useState('')
  const [seguroQuitar, setSeguroQuitar] = useState(false)

  /*
    EN QUÉ LISTA DE ESA CATEGORÍA.

    Dentro de casa puede haber "Del lunes" y "Fin de mes". Este segundo
    nivel SOLO se enseña cuando hay más de una: con una sola, la
    pantalla se ve exactamente igual que antes y nadie paga una
    decisión que no necesita.
  */
  const [listaActiva, setListaActiva] = useState<string | null>(null)

  /*
    ── LA COMPRA ES DE LA CASA ──

    Salían tres destinos —Casa, Alquileres, Obras— y era una decisión
    que nadie quiere tomar con el móvil en una mano: se apunta pan y no
    se piensa «¿pan de quién?». Tres pastillas que hay que leer enteras
    cada vez para no darle a la equivocada, todos los días, a cambio de
    algo que casi nunca hace falta.

    Ahora solo sale la de la casa. PERO la fila reaparece sola si
    alguna sección tiene algo apuntado: lo que ya se etiquetó no puede
    desaparecer de la vista porque hayamos cambiado de idea — eso es
    perder la compra de alguien sin decírselo.
  */
  const conAlgo = new Set(cosas.map((c) => c.seccion_id).filter(Boolean) as string[])

  const etiquetables = secciones.filter(
    (x) => !NO_ETIQUETA.includes(x.segmento.toUpperCase()) && conAlgo.has(x.id)
  )
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
  /* Las compras cerradas de esta misma categoría. La de la finca no
     se ofrece cuando estás en la de casa: son dos compras distintas. */
  const anterioresDeAqui = anteriores.filter((c) => (c.seccion_id ?? null) === destino)

  const pendientes = deEstaLista.filter((c) => !c.comprado)
  const tachadas = deEstaLista.filter((c) => c.comprado)

  /* Cuántas cosas hay en cada lista, para poder ponerlo en su botón:
     así se ve que la finca tiene cuatro cosas esperando sin tener que
     entrar a mirar. */
  const cuantasEn = (id: string | null) =>
    cosas.filter((c) => !c.comprado && (c.seccion_id ?? null) === id).length

  const cuantasEnLista = (id: string) =>
    cosas.filter((c) => !c.comprado && c.lista_id === id).length

  async function renombrar() {
    const nombre = otroNombre.trim()
    if (!laLista || nombre.length < 2 || nombre === laLista.nombre) {
      setTocando(false)
      return
    }
    setAviso(null)

    const r = await fetch('/api/compra/listas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      /* `solo_nombre` es lo que evita que renombrar le quite el día a
         la compra y borre su tarea de la Agenda. */
      body: JSON.stringify({ id: laLista.id, nombre, solo_nombre: true }),
    })

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string; detalle?: string }
      setAviso(d.detalle ?? d.error ?? 'No se ha podido cambiar el nombre.')
      return
    }
    setTocando(false)
    empezar(() => router.refresh())
  }

  async function quitarLista() {
    if (!laLista) return
    setAviso(null)

    const r = await fetch(`/api/compra/listas?id=${laLista.id}`, { method: 'DELETE' })
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string; detalle?: string }
      setAviso(d.detalle ?? d.error ?? 'No se ha podido quitar.')
      return
    }

    const d = (await r.json().catch(() => ({}))) as { guardadas?: number }
    if (d.guardadas && d.guardadas > 0) {
      setAviso(
        d.guardadas === 1
          ? 'Quitada. La cosa que quedaba dentro se ha guardado con ella, no se ha perdido.'
          : `Quitada. Las ${d.guardadas} cosas que quedaban dentro se han guardado con ella, no se han perdido.`
      )
    }

    setSeguroQuitar(false)
    setTocando(false)
    setListaActiva(null)
    empezar(() => router.refresh())
  }

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
      id: `nuevo-${++nuevos.current}`,
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
      const d = (await r.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        apuntadas?: { id: string; que: string; cantidad: string | null; lista_id: string | null }[]
      } | null

      if (!r.ok || d?.ok !== true) throw new Error(d?.error ?? 'No se ha podido apuntar.')

      /*
        SE CAMBIA EL PROVISIONAL POR EL DE VERDAD.

        Sin esto, la línea se queda con un identificador inventado —
        «nuevo-1757…»— y el primer toque para tacharla o quitarla va a
        una dirección que no existe. Era exactamente lo que pasaba: se
        apuntaba bien y luego no se podía tocar.
      */
      const real = d.apuntadas?.[0]
      if (real) {
        setCosas((c) =>
          c.map((x) =>
            x.id === provisional.id
              ? { ...x, id: real.id, que: real.que, cantidad: real.cantidad, lista_id: real.lista_id }
              : x
          )
        )
        ultimaHuella.current = ''
      }
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
      /* Se vuelve a leer para que el otro móvil y éste digan lo mismo.
         La huella se limpia primero: si no, el efecto vería la misma
         de antes y descartaría la recarga. */
      ultimaHuella.current = ''
      empezar(() => router.refresh())
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
      ultimaHuella.current = ''
      empezar(() => router.refresh())
    } catch (e) {
      setCosas(copia)
      setAviso(e instanceof Error ? e.message : 'No se ha podido quitar.')
    }
  }

  /*
    ── YA HE COMPRADO ──

    Archiva lo tachado y, si no queda nada pendiente, CIERRA la lista:
    queda guardada entera y se abre otra vacía con el mismo nombre.

    Así la compra de un día es una cosa con principio y final a la que
    se le puede enganchar el ticket — y a la que se puede volver la
    semana que viene sin escribirla de nuevo.
  */
  async function yaHeComprado() {
    setCerrando(true)
    setAviso(null)
    try {
      const r = await fetch('/api/compra', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lista_id: listaId }),
      })
      const d = (await r.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        cerrada?: { id: string; nombre: string } | null
      } | null

      if (!r.ok || d?.ok !== true) throw new Error(d?.error ?? 'No se ha podido guardar.')

      setCosas((c) => c.filter((x) => !x.comprado))
      /* Se recuerda cuál se acaba de cerrar para ofrecer el ticket
         justo ahí: es el único momento en que la persona tiene el
         papel en la mano. */
      if (d.cerrada) setReciencerrada(d.cerrada)
      ultimaHuella.current = ''
      empezar(() => router.refresh())
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se ha podido guardar.')
    }
    setCerrando(false)
  }

  /* Copiar una compra de otra semana a la de ahora. Se copia, no se
     mueve: la vieja es el registro de lo que se compró aquel día. */
  async function recuperar(deLista: Cerrada) {
    setRecuperando(deLista.id)
    setAviso(null)
    try {
      const r = await fetch('/api/compra/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ de: deLista.id, a: listaId }),
      })
      const d = (await r.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        cuantas?: number
        aviso?: string
      } | null

      if (!r.ok || d?.ok !== true) throw new Error(d?.error ?? 'No se ha podido recuperar.')

      if (d.aviso) setAviso(d.aviso)
      ultimaHuella.current = ''
      empezar(() => router.refresh())
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se ha podido recuperar.')
    }
    setRecuperando(null)
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
            className="flex h-12 items-center gap-1.5 rounded-full border border-dashed border-borde px-3.5 text-[15px] font-extrabold text-tenue"
          >
            <Ico nombre="mas" tam={16} grosor={2.4} />
            Otra lista
          </button>
        )}

        {/*
          ── CAMBIARLA O QUITARLA ──

          Se podían crear listas y no tocarlas nunca más: ni corregir
          una falta de ortografía, ni quitar la de las Navidades pasadas.
          Y una lista que no se puede quitar se queda ahí para siempre
          estorbando entre las que sí se usan.

          Va en pequeño y al lado de «Otra lista», no como un botón
          grande: es una acción de mantenimiento, no algo que se hace
          cada día. Y solo aparece cuando hay una lista con nombre
          delante — sin listas no hay nada que cambiar.
        */}
        {laLista && !creando && !tocando && (
          <button
            onClick={() => {
              setOtroNombre(laLista.nombre)
              setSeguroQuitar(false)
              setTocando(true)
            }}
            className="flex h-12 items-center gap-1.5 rounded-full px-2 text-[15px] font-extrabold text-tenue underline decoration-borde underline-offset-4"
          >
            Cambiar «{laLista.nombre}»
          </button>
        )}
      </div>

      {tocando && laLista && (
        <div className="mt-2.5 rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <p className="rotulo">Cómo se llama</p>
          <div className="mt-2 flex gap-2">
            <input
              value={otroNombre}
              onChange={(e) => setOtroNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && renombrar()}
              maxLength={60}
              autoFocus
              className="entrada flex-1 text-[16px]"
            />
            <button
              onClick={renombrar}
              disabled={otroNombre.trim().length < 2}
              className="t-cuerpo h-[60px] shrink-0 rounded-[16px] px-5 font-extrabold disabled:opacity-40"
              style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
            >
              Guardar
            </button>
          </div>

          {/*
            Quitar va abajo, separado, en dos toques y sin el color de
            guardar. Es la única acción de aquí que no se deshace desde
            esta pantalla.
          */}
          <div className="mt-4 border-t border-borde pt-3.5">
            {!seguroQuitar ? (
              <button
                onClick={() => setSeguroQuitar(true)}
                className="t-apoyo flex h-12 items-center font-extrabold"
                style={{ color: 'var(--t-alerta)' }}
              >
                Quitar esta lista
              </button>
            ) : (
              <div
                className="rounded-[16px] border px-4 py-3.5"
                style={{
                  background: 'var(--t-alerta-velo)',
                  borderColor: 'color-mix(in srgb, var(--t-alerta) 45%, transparent)',
                }}
              >
                <p className="t-cuerpo font-extrabold" style={{ color: 'var(--t-alerta)' }}>
                  ¿Quitamos «{laLista.nombre}»?
                </p>
                {/* Se dice exactamente qué pasa con lo de dentro. Es la
                    única duda real que tiene quien va a tocar esto. */}
                <p className="t-apoyo mt-1.5 text-tinta-suave">
                  {cuantasEnLista(laLista.id) > 0
                    ? `Lo que queda dentro (${cuantasEnLista(laLista.id)}) se guarda con ella. No se pierde: se puede recuperar como cualquier compra cerrada.`
                    : 'Está vacía, así que no se pierde nada.'}
                </p>
                <div className="mt-3 flex gap-2.5">
                  <button
                    onClick={quitarLista}
                    className="t-cuerpo h-[60px] flex-1 rounded-[16px] border bg-superficie font-extrabold"
                    style={{
                      borderColor: 'var(--t-alerta)',
                      color: 'var(--t-alerta)',
                    }}
                  >
                    Sí, quitarla
                  </button>
                  <button
                    onClick={() => setSeguroQuitar(false)}
                    className="t-cuerpo h-[60px] flex-1 rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta"
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setTocando(false)}
              className="t-apoyo ml-4 flex h-12 items-center font-extrabold"
            >
              Dejarlo
            </button>
          </div>
        </div>
      )}

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
            className="t-cuerpo h-[60px] shrink-0 rounded-[16px] px-5 font-extrabold"
            style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
          >
            Crear
          </button>
          <button
            onClick={() => {
              setCreando(false)
              setNombreNuevo('')
            }}
            className="t-cuerpo h-[60px] shrink-0 rounded-[16px] border border-borde bg-superficie px-4 font-extrabold text-tinta"
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
          className="h-[60px] min-w-0 flex-1 rounded-[16px] border border-borde bg-superficie px-4 text-[19px] font-bold text-tinta placeholder:font-semibold placeholder:text-tenue focus:border-[color:var(--color-accion)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!texto.trim()}
          aria-label="Añadir a la compra"
          className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[16px] disabled:opacity-35"
          style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
        >
          <Ico nombre="mas" tam={26} grosor={2.4} />
        </button>
      </form>

      <p className="t-apoyo mt-2.5">
        También puedes decirlo: «apunta leche, pan y huevos en la compra».
      </p>

      {aviso && (
        <div className="mt-4">
          <Aviso titulo="No se ha podido" explicacion={aviso} />
        </div>
      )}

      {/* ── Lo que falta ── */}
      {deEstaLista.length === 0 ? (
        <p className="t-cuerpo mt-6 rounded-[20px] border border-borde bg-superficie px-6 py-8 text-center text-tinta-suave">
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
                  <p className="rotulo">
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
          className="t-cuerpo mt-4 flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta"
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
            className="t-tarjeta mt-5 flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[16px] disabled:opacity-40"
            style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
          >
            <Ico nombre="check" tam={22} grosor={2.4} />
            {cerrando ? 'Guardando…' : 'Ya he comprado'}
          </button>
          <p className="t-apoyo mt-2.5 text-center">
            Quita de la lista lo que ya está en el carro.
          </p>

          {/*
            ── EL TICKET, AQUÍ Y NO EN OTRO SITIO ──

            Justo debajo de «Ya he comprado», porque ése es el momento
            exacto: acabas de salir del súper, tienes el papel en una
            mano y el móvil en la otra. Ponerlo arriba, antes de
            comprar, sería un botón que no sirve todavía.

            Va con la carpeta ya elegida —Casa → Compras— así que son
            dos toques: éste y la foto. Y se puede cambiar antes de
            guardar, que hace falta el día que la compra sea para la
            finca.
          */}
          {ticketEn && (
            <Link
              href={`/guardar?en=${ticketEn}`}
              className="t-tarjeta mt-3 flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[16px] border border-borde bg-superficie text-tinta"
            >
              <Ico nombre="foto" tam={22} grosor={2.2} />
              Guardar el ticket
            </Link>
          )}
        </>
      )}

      {/*
        ═══════════════════════════════════════════════════════
        LA COMPRA QUE SE ACABA DE CERRAR
        ═══════════════════════════════════════════════════════

        Sale al terminar y no antes. Es el único momento en que la
        persona tiene el papel del súper en la mano — dos minutos
        después ya está en el bolsillo del abrigo y no vuelve a
        aparecer hasta que se lava.

        Y el ticket va enganchado A ESTA COMPRA, no suelto en una
        carpeta: así, dentro de tres meses, «la compra del 8 de
        septiembre» tiene su lista y su importe en el mismo sitio.
      */}
      {recienCerrada && (
        <div
          className="mt-5 rounded-[20px] border px-4 py-4"
          style={{
            background: 'var(--t-bien-velo)',
            borderColor: 'color-mix(in srgb, var(--t-bien) 42%, transparent)',
          }}
        >
          <p className="t-tarjeta flex items-center gap-2">
            <span style={{ color: 'var(--t-bien)' }} className="flex">
              <Ico nombre="check" tam={20} grosor={2.4} />
            </span>
            Compra guardada
          </p>
          <p className="t-apoyo mt-1.5 text-tinta-suave">
            «{recienCerrada.nombre}» queda guardada entera. La lista de arriba empieza
            vacía, y puedes recuperar ésta cuando quieras.
          </p>

          {ticketEn && (
            <Link
              href={`/guardar?en=${ticketEn}&lista=${recienCerrada.id}`}
              className="t-tarjeta mt-3 flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[16px]"
              style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
            >
              <Ico nombre="foto" tam={22} grosor={2.2} />
              Guardar el ticket
            </Link>
          )}
          <button
            onClick={() => setReciencerrada(null)}
            className="t-cuerpo mt-2 h-[48px] w-full rounded-[16px] font-extrabold text-tinta"
          >
            Ahora no
          </button>
        </div>
      )}

      {/*
        ═══════════════════════════════════════════════════════
        ¿RECUPERAS UNA DE OTRA SEMANA?
        ═══════════════════════════════════════════════════════

        La compra de casa se repite casi igual: leche, pan, huevos,
        fruta, papel. Escribirla entera cada semana es trabajo
        inventado — y es donde se olvidan cosas, porque se escribe de
        memoria en vez de mirar la de la semana pasada.

        Sale solo con la lista VACÍA. Con cosas apuntadas ya se está
        haciendo la de esta semana, y ofrecerlo ahí sería un botón que
        estorba en la pantalla donde más prisa hay.

        Y lo repetido no entra dos veces: la que se recupera se cruza
        con lo que ya haya puesto.
      */}
      {pendientes.length === 0 && !recienCerrada && anterioresDeAqui.length > 0 && (
        <section className="mt-6">
          <h2 className="rotulo">¿Recuperas una de otra semana?</h2>
          <p className="t-apoyo mt-1.5">
            Se copian sus cosas aquí. La de aquel día se queda como está.
          </p>
          <ul className="mt-3 space-y-2">
            {anterioresDeAqui.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => recuperar(c)}
                  disabled={recuperando !== null || !listaId}
                  className="flex min-h-[76px] w-full items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-4 py-3 text-left disabled:opacity-50"
                >
                  <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] bg-fondo text-tinta-suave">
                    <Ico nombre="bolsa" tam={21} grosor={2.1} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="t-tarjeta block truncate">
                      {cuandoSeCerro(c.cerrada)}
                    </span>
                    <span className="t-apoyo mt-0.5 block truncate">
                      {c.cosas === 1 ? '1 cosa' : `${c.cosas} cosas`}
                      {c.ticket_id ? ' · con ticket' : ''}
                    </span>
                  </span>
                  <Ico nombre="mas" tam={20} grosor={2.4} className="shrink-0 text-tinta-suave" />
                </button>
              </li>
            ))}
          </ul>
        </section>
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
                className="t-cuerpo flex h-[48px] items-center gap-1.5 rounded-full border border-borde bg-superficie px-4 font-extrabold text-tinta"
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
      /* Eran 46 px con borde de dos y relleno del verde de sección.
         Ahora la píldora del sistema: 48 px, borde de uno, y la
         elegida se rellena de tinta. */
      className="flex h-12 items-center rounded-full border px-4 text-[15px] font-extrabold"
      style={
        activo
          ? { background: 'var(--t-tinta)', color: 'var(--t-fondo)', borderColor: 'var(--t-tinta)' }
          : {
              background: 'var(--t-superficie)',
              color: 'var(--t-tinta-suave)',
              borderColor: 'var(--t-borde)',
            }
      }
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
      /* `llega` es de entrada y se dispara sola al montarse; la
         opacidad de lo tachado va con transición para que la fila
         se apague acompañando al tic, no antes que él. */
      className={`llega flex items-stretch overflow-hidden rounded-[20px] border border-borde bg-superficie transition-opacity duration-300 ${
        cosa.comprado ? 'opacity-60' : ''
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
        {/* Tachado es un ESTADO —«ya está»—, así que va en el verde
            de estado y no en el de sección. Y el círculo se queda: la
            zona pulsable son los 64 px de la fila entera. */}
        <span
          className="casilla flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2"
          style={{
            borderColor: cosa.comprado ? 'var(--t-bien)' : 'var(--t-borde)',
            background: cosa.comprado ? 'var(--t-bien)' : 'transparent',
            color: 'var(--t-superficie)',
          }}
        >
          {cosa.comprado && (
            <span className="tic flex">
              <Ico nombre="check" tam={17} grosor={3} />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`tachable block text-[19px] font-extrabold leading-snug ${
              cosa.comprado ? 'tachable-puesto text-tinta-suave' : 'text-tinta'
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
            <span className="rotulo mt-0.5 block">
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
        className="flex w-[56px] shrink-0 items-center justify-center border-l border-borde text-[26px] font-light leading-none text-apagado"
      >
        {/* Una equis, que la entiende todo el mundo. Un icono de
            papelera hay que aprendérselo; esto no. */}
        ×
      </button>
    </li>
  )
}

/*
  «Hoy» · «Ayer» · «El lunes» · «El 28 de agosto»

  En días y no en fecha: al buscar la compra de la semana pasada nadie
  piensa «la del 1 de septiembre», piensa «la del lunes». La fecha
  entera solo cuando ya está lejos y el día de la semana no ayuda.
*/
function cuandoSeCerro(iso: string | null): string {
  if (!iso) return 'Una compra de antes'

  const cuando = new Date(iso)
  if (Number.isNaN(cuando.getTime())) return 'Una compra de antes'

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dia = new Date(cuando)
  dia.setHours(0, 0, 0, 0)

  const dias = Math.round((hoy.getTime() - dia.getTime()) / 86_400_000)

  if (dias <= 0) return 'La de hoy'
  if (dias === 1) return 'La de ayer'

  const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  if (dias < 7) return `La del ${nombres[dia.getDay()]}`

  const meses = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre',
  ]
  return `La del ${dia.getDate()} de ${meses[dia.getMonth()]}`
}
