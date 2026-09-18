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

  /*
    ══════════════════════════════════════════════════════════════
    DOS VISTAS, Y NO UNA PANTALLA INTERMINABLE
    ══════════════════════════════════════════════════════════════

    Haris: *«dentro de Menú pondría lo de las recetas, pero como una
    pestaña aparte… ahora hemos puesto muchas y es un scroll
    infinito»*.

    Tenía razón y el motivo es de bulto: el cajón de recetas crece sin
    tope y la semana no. Con veinte recetas debajo, para ver el jueves
    hay que pasar por encima de veinte fichas que no tienen nada que
    ver con esta semana.

    Son dos preguntas distintas —«qué comemos esta semana» y «qué
    sabemos cocinar»— y por eso son dos vistas y no una lista larga.
    Dos pestañas, no dos pantallas: se cambia sin salir de Menú y sin
    volver a pedir nada al servidor.
  */
  const [vista, setVista] = useState<'semana' | 'recetas'>('semana')

  // ── El cajón de ideas ──
  const [abierto, setAbierto] = useState(false)
  /*
    ── Y DENTRO DEL CAJÓN, SOLO EL TÍTULO ──

    Haris: *«que salga sólo el título y luego, si quieres ver, se
    despliega; es que si no es muy largo»*.

    Una receta con enlace, receta escrita y once ingredientes ocupa
    media pantalla. Veinte así son veinte pantallas para encontrar una.
    El título es lo único que hace falta para reconocerla; lo demás
    solo cuando se va a usar.

    Una abierta cada vez: dos desplegadas vuelven a ser la lista larga.
  */
  const [desplegada, setDesplegada] = useState<string | null>(null)
  /*
    ── CUÁL SE ESTÁ CAMBIANDO ──

    Haris: *«los menús deben poder editarse, por si quieres hacer
    alguna corrección o ajuste»*.

    Nulo quiere decir «una nueva». Con identificador, el MISMO
    formulario de abajo sale relleno y guarda encima de ésa. Un segundo
    formulario para corregir sería la misma pantalla escrita dos veces,
    y la próxima casilla que se añada solo aparecería en una.
  */
  const [cambiando, setCambiando] = useState<string | null>(null)
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

  /*
    ── LOS PLATOS DE ESA COMIDA. EN PLURAL ──

    Haris: *«en una cena o comida pueden haber varios platos, no sólo
    uno»*.

    Esto era `loDe`, en singular, y devolvía el menú de ese día y ese
    momento. No era un descuido de esta pantalla: la base tenía un
    índice único de una comida y una cena por día desde el paso 48, y
    todo lo de arriba estaba escrito contra esa idea.

    El paso 85 lo cambia por otro que permite varios platos y sigue
    impidiendo el mismo dos veces. Aquí se nota en una línea — `filter`
    en vez de `find` — y en que cada comida pinta una fila por plato y
    una más, vacía, para el siguiente.
  */
  function losDe(fecha: string, momento: Momento): Menu[] {
    return menus.filter((m) => m.fecha === fecha && m.momento === momento)
  }

  /*
    Se guarda al salir del campo, no mientras se escribe.

    Guardar en cada tecla haría veinte viajes por «macarrones» y, con
    mala cobertura, llegarían desordenados: se quedaría guardado
    «macarron». Al salir del campo se manda una vez y lo que hay
    escrito es lo que queda.
  */
  async function guardar(
    fecha: string,
    momento: Momento,
    que: string,
    recetaId?: string | null,
    /*
      CUÁL de los platos de esa comida.

      Nulo quiere decir «uno nuevo», y es lo que manda la fila vacía
      que hay debajo del último. Sin este dato habría que adivinar, y
      adivinar aquí significa pisar el primer plato cada vez que
      alguien quiere poner el segundo.
    */
    id?: string | null
  ) {
    const antes = id ? menus.find((m) => m.id === id) : undefined
    const limpio = que.trim()

    if (antes && (antes.que ?? '') === limpio && recetaId === undefined) return
    /* Una fila vacía que se deja vacía no es nada que guardar. */
    if (!antes && !limpio) return

    /*
      Mientras se guarda, el plato nuevo lleva un identificador de
      mentira. Lleva el plato dentro porque ahora puede haber dos a la
      vez en la misma comida, y hacen falta dos identificadores
      distintos.

      Y lleva el plato, y no la hora, porque el índice del paso 85
      garantiza que en una comida no hay dos veces lo mismo: el texto ya
      es único ahí. `Date.now()` también valdría, pero es una función
      impura y esto se escribe durante el render.
    */
    const deMentira = `nuevo-${fecha}-${momento}-${limpio}`

    /* Se pinta ya y se manda después: escribir la cena y ver el texto
       parpadear medio segundo después hace dudar de si se ha guardado. */
    setMenus((lista) => {
      if (antes) {
        if (!limpio) return lista.filter((m) => m.id !== antes.id)
        return lista.map((m) =>
          m.id === antes.id
            ? {
                ...m,
                que: limpio,
                receta_id: recetaId !== undefined ? recetaId : m.receta_id,
                /* Si cambia el plato, lo comprobado deja de valer: los
                   ingredientes son otros. */
                comprobado_en: null,
                faltan: null,
              }
            : m
        )
      }
      if (!limpio) return lista
      return [
        ...lista,
        {
          id: deMentira,
          fecha,
          momento,
          que: limpio,
          receta_id: recetaId ?? null,
        },
      ]
    })

    const r = await fetch(api('/api/menus'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: antes?.id,
        fecha,
        momento,
        que: limpio,
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
      const cual = antes?.id ?? deMentira
      setMenus((lista) => lista.map((m) => (m.id === cual ? { ...m, id: d.id! } : m)))
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
        id: cambiando ?? undefined,
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

    /* Cambiada: se queda donde estaba. Sacarla a lo alto del cajón por
       haberle corregido una letra movería el sitio de todo lo demás. */
    setRecetas((x) =>
      cambiando ? x.map((r) => (r.id === cambiando ? d.receta! : r)) : [d.receta!, ...x]
    )
    cerrarElCajon()
  }

  /* El formulario se cierra siempre igual: vaciarlo a mano en cada
     salida es como se acaba teniendo un campo que conserva lo de la vez
     anterior. */
  function cerrarElCajon() {
    setTitulo('')
    setUrl('')
    setNota('')
    setLoQueLleva('')
    setCambiando(null)
    setAbierto(false)
  }

  /*
    ── CORREGIR UNA ──

    Se abre el mismo formulario con lo que hay dentro. Y se hace aquí y
    no en la API: lo que ya está en la pantalla no hace falta volver a
    pedirlo.
  */
  function corregir(r: Receta) {
    setTitulo(r.titulo)
    setUrl(r.url ?? '')
    setNota(r.nota ?? '')
    setLoQueLleva((r.ingredientes ?? []).join('\n'))
    setCambiando(r.id)
    setAbierto(true)
    setDesplegada(r.id)
    setVista('recetas')
    setAviso(null)
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

  /*
    ══════════════════════════════════════════════════════════════
    LO QUE HACE FALTA PARA LA SEMANA DE ESCRITORIO
    ══════════════════════════════════════════════════════════════
  */

  /* Qué menú tiene abierta la comprobación. En el móvil la ficha se
     pinta dentro de su día y esto no hace falta; en grande se abre
     debajo de la semana y hay que saber de cuál es. */
  const elQueSeComprueba = comprobando ? (menus.find((m) => m.id === comprobando) ?? null) : null

  /* Y qué tanda está abierta, por lo mismo. */
  const laTandaAbierta = laTanda ? (menus.find((m) => m.grupo_id === laTanda) ?? null) : null

  /*
    Lo que falta en la semana entera, sin repetir.

    Dos platos que llevan huevos no son dos apuntes de huevos en la
    lista de la compra: es uno. Se normaliza por minúsculas para
    juntar «Huevos» con «huevos», pero se guarda la primera forma que
    se escribió — que es como la escribió una persona.
  */
  const loQueFaltaEstaSemana = [
    ...new Map(
      menus
        .flatMap((m) => m.faltan ?? [])
        .map((c) => [c.trim().toLowerCase(), c.trim()])
    ).values(),
  ].filter((c) => c.length > 0)

  const [pasando, setPasando] = useState(false)

  /*
    ── PASARLO A LA COMPRA ──

    Todo de una vez. La API de la compra ya admite una lista de cosas
    —`cosas: [{ que }]`— así que esto es una sola petición y no nueve.

    No se elige lista ni sección: va a la de siempre de la casa, que es
    donde acaba la compra de la casa. Preguntar «¿en qué lista?» al
    final de una tarea que ya se ha hecho entera es la pregunta de más
    que hace que la siguiente vez se apunte en un papel.
  */
  async function pasarloALaCompra() {
    if (loQueFaltaEstaSemana.length === 0) return
    setPasando(true)
    setAviso(null)

    const r = await fetch(api('/api/compra'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cosas: loQueFaltaEstaSemana.map((que) => ({ que })) }),
    })
    setPasando(false)

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string; detalle?: string }
      setAviso(d.detalle ?? d.error ?? 'No se ha podido apuntar en la compra.')
      return
    }

    /* Y se quita de «falta»: ya está apuntado, así que la tira se
       apaga sola. Si se dejara puesta, se pasaría dos veces. */
    setMenus((lista) => lista.map((m) => (m.faltan?.length ? { ...m, faltan: [] } : m)))
  }

  /*
    ══════════════════════════════════════════════════════════════
    EL FORMULARIO, UNA VEZ Y EN DOS SITIOS
    ══════════════════════════════════════════════════════════════

    Haris: *«cuando editas un menú, que no se vaya a la parte de abajo,
    sino que aparezca directo debajo de donde está»*.

    Y tenía razón: el formulario vivía al final de la pantalla, así que
    corregir la tercera receta de veinte te mandaba al fondo, lejos de
    la que estabas mirando, y al guardar había que volver a buscarla.
    Con veinte recetas eso no es un detalle: es no saber qué estás
    cambiando.

    Ahora se pinta DONDE haga falta — debajo de la receta que se
    corrige, o al final cuando es una nueva— y es el mismo formulario,
    no dos. Una función que devuelve la pantalla, con el estado a mano:
    dos copias serían dos sitios donde añadir la próxima casilla.
  */
  function elFormulario() {
    return (
          <div className="mt-4 rounded-[20px] border border-borde bg-superficie px-4 py-4">
            {/* Qué se está haciendo, escrito. El mismo formulario sirve
                para guardar una nueva y para corregir una, y sin esta
                línea no habría manera de saber cuál de las dos. */}
            {cambiando && <p className="t-tarjeta mb-3">Cambiar esta receta</p>}

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
                {guardando ? 'Guardando…' : cambiando ? 'Guardar los cambios' : 'Guardar'}
              </BotonPrincipal>
              <BotonSecundario onClick={cerrarElCajon}>Dejarlo</BotonSecundario>
            </div>
          </div>
    )
  }

  return (
    <div>
      {/*
        ── LAS DOS PESTAÑAS ──

        Al lado del título y no debajo, que es donde Haris las pidió:
        *«un botón que aparezca a la derecha de Menú, que será
        recetas o ideas; eso ayuda a entender»*.

        Y con la palabra, no con un dibujo: el punto 5 del
        planteamiento. «Recetas» dice qué hay detrás; un icono de libro
        hay que aprendérselo.
      */}
      <div className="mt-4 flex gap-2">
        <Pestana puesta={vista === 'semana'} alTocar={() => setVista('semana')}>
          La semana
        </Pestana>
        <Pestana puesta={vista === 'recetas'} alTocar={() => setVista('recetas')}>
          Recetas{recetas.length > 0 ? ` · ${recetas.length}` : ''}
        </Pestana>
      </div>

      {vista === 'semana' && (
        <>
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

          {/*
            ═══════════════════════════════════════════════════════════
            LOS SIETE DÍAS, EN SIETE COLUMNAS
            ═══════════════════════════════════════════════════════════

            Es la pantalla que más gana con esto, y por una razón que no
            tiene que ver con caber: **se ve que el miércoles repite el
            puchero del lunes**. En una lista vertical de siete tarjetas,
            para darse cuenta hay que acordarse de lo que ponía cuatro
            pantallas más arriba. Al lado, se ve sin leer.

            Y los huecos se leen como «esta semana no está planeada», no
            como «formulario a medio rellenar», que es lo que parecían
            siete campos vacíos uno debajo de otro.

            ─────────────────────────────────────────────────────────
            EL COLOR, MEDIDO

            La regla de esta pantalla: **solo hay color donde falta algo.**

            De once manchas de color se baja a cuatro líneas ámbar. Lo que
            se ha ido, y por qué:

              · El distintivo verde de «tienes lo que lleva» — tenerlo es
                lo normal, y lo normal se dice callando. Se queda el tic,
                en gris.
              · «Se repite» pasa de ámbar a gris: repetir es un dato, no
                un aviso.
              · «Ver la receta» deja el teal y se va a gris con una
                flecha.
              · Lo que falta pierde la caja de color y se queda en una
                línea de texto ámbar.

            Esto es del escritorio. En el móvil la pantalla es una columna
            y el color no se acumula igual: ahí se queda como estaba.
          */}
          <div className="denso-trabajo mt-4 hidden grid-cols-7 gap-2 lg:grid">
            {dias.map((fecha) => (
              <div key={fecha} className="min-w-0">
                <p className="rotulo mb-1.5 truncate text-center">{comoSeLlamaElDia(fecha)}</p>
                <div className="flex flex-col gap-2 rounded-[14px] border border-borde bg-superficie p-2">
                  {MOMENTOS.flatMap(({ valor, texto }) => {
                    /*
                      ── UNA FILA POR PLATO, Y UNA MÁS PARA EL SIGUIENTE ──

                      En una comida caben varios platos (paso 85). La fila
                      vacía del final es el «añadir otro»: se escribe en
                      ella y se apunta uno más.

                      Sólo aparece cuando ya hay algo puesto. Un día sin
                      menú sigue teniendo UNA fila vacía y ni una más — con
                      siete días y dos comidas, catorce huecos de más serían
                      media pantalla de nada.
                    */
                    const puestos = losDe(fecha, valor)
                    const filas: (Menu | null)[] = puestos.length > 0 ? [...puestos, null] : [null]

                    return filas.map((puesto, i) => {
                    const suya = puesto?.receta_id
                      ? recetas.find((r) => r.id === puesto.receta_id)
                      : undefined
                    const lleva = suya?.ingredientes ?? []
                    const deVerdad = puesto && !puesto.id.startsWith('nuevo-')
                    const sinMirar = Boolean(deVerdad && lleva.length > 0 && !puesto!.comprobado_en)
                    const faltan = puesto?.faltan ?? []

                    return (
                      <div
                        key={`${valor}-${puesto?.id ?? `otro-${puestos.length}`}`}
                        className="min-w-0"
                      >
                        <div className="mb-1 flex items-center justify-between gap-1">
                          {/* El rótulo sólo encima del primero: «COMIDA»
                              repetido en cada plato es la misma palabra
                              diciendo dos cosas distintas. */}
                          <span className="rotulo">{i === 0 ? texto : ''}</span>
                          {/* El desplegable de platos guardados, en pequeño.
                              Mismo `select` del sistema que en el móvil: lo
                              que cambia es el tamaño del tirador, no la
                              manera de elegir. */}
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
                                  if (r) guardar(fecha, valor, r.titulo, r.id, puesto?.id ?? null)
                                }}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
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
                                className="roza flex h-[26px] w-[26px] items-center justify-center rounded-[8px] text-tenue"
                              >
                                <Ico nombre="flecha" tam={14} grosor={2.4} className="rotate-90" />
                              </span>
                            </label>
                          )}
                        </div>

                        <Renglon
                          valor={puesto?.que ?? ''}
                          alSalir={(v) => guardar(fecha, valor, v, undefined, puesto?.id ?? null)}
                          corto
                        />

                        {/* Y debajo, lo que se sabe de ese plato. Tres
                            líneas como mucho, todas en gris menos la de lo
                            que falta. */}
                        {suya?.url && (
                          <a
                            href={suya.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="roza mt-1 flex items-center gap-1 rounded-[7px] text-[12px] font-bold text-tenue"
                          >
                            <span aria-hidden>▸</span>
                            <span className="truncate">Ver la receta</span>
                          </a>
                        )}

                        {deVerdad && lleva.length > 0 && (
                          <button
                            onClick={() => setComprobando(puesto!.id)}
                            className={
                              'mt-1 flex w-full items-center gap-1 text-left text-[12px] font-bold ' +
                              (faltan.length > 0 && !sinMirar ? 'text-alerta' : 'text-tenue')
                            }
                          >
                            {!sinMirar && faltan.length === 0 && (
                              <Ico nombre="check" tam={13} grosor={2.6} />
                            )}
                            <span className="truncate">
                              {sinMirar
                                ? `¿Tienes lo que lleva? · ${lleva.length}`
                                : faltan.length > 0
                                  ? `Faltan ${faltan.length} ${faltan.length === 1 ? 'cosa' : 'cosas'}`
                                  : 'Está todo'}
                            </span>
                          </button>
                        )}

                        {puesto?.grupo_id && (
                          <button
                            onClick={() =>
                              setLaTanda((g) => (g === puesto.grupo_id ? null : puesto.grupo_id!))
                            }
                            className="mt-1 flex w-full items-center gap-1 text-left text-[12px] font-bold text-tenue"
                          >
                            <Ico nombre="refrescar" tam={13} grosor={2.4} />
                            <span className="truncate">
                              {puesto.cada_semanas === 2
                                ? 'Cada dos semanas'
                                : puesto.cada_semanas === 3
                                  ? 'Cada tres semanas'
                                  : 'Cada semana'}
                            </span>
                          </button>
                        )}
                      </div>
                      )
                    })
                  })}
                </div>
              </div>
            ))}
          </div>

          {/*
            ── LO QUE SE ABRE, SE ABRE DEBAJO ──

            Ésta es la única decisión del dibujo que la medida obliga a
            cambiar, y conviene que esté dicha: la ficha de «¿tienes lo que
            lleva?» tiene nueve renglones con casillas y tres botones, y
            eso no entra en una columna de 154 px por mucho que se apriete.

            Se abre debajo de la semana, a lo ancho. No encima —nada tapa
            la semana— y no al lado, que dejaría los días en 112. Es lo
            mismo que hace la ficha de la Agenda, y por el mismo motivo.

            Lo que NO cambia: escribir sigue siendo en el sitio. Esto es
            para la comprobación, que es otra cosa.
          */}
          {comprobando && elQueSeComprueba && (
            <div className="mt-3 hidden lg:block">
              <Comprobar
                menu={elQueSeComprueba}
                ingredientes={
                  recetas.find((r) => r.id === elQueSeComprueba.receta_id)?.ingredientes ?? []
                }
                listas={listas}
                alGuardar={(f) => yaComprobado(elQueSeComprueba.id, f)}
                cerrar={() => setComprobando(null)}
              />
            </div>
          )}

          {/* Y la de la tanda, igual: debajo, a lo ancho, y sólo la que
              se ha abierto. */}
          {laTandaAbierta && (
            <div className="mt-3 hidden rounded-[16px] border border-borde bg-superficie px-5 py-4 lg:block">
              <p className="t-cuerpo leading-snug">
                <strong className="text-tinta">{laTandaAbierta.que}</strong>
                {laTandaAbierta.repite_hasta
                  ? ` está puesto hasta el ${comoSeLlamaElDia(laTandaAbierta.repite_hasta)}.`
                  : ' se repite.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <BotonSecundario
                  onClick={() => alargarLaTanda(laTandaAbierta.grupo_id!)}
                  desactivado={conLaTanda}
                >
                  {conLaTanda ? 'Un momento…' : 'Alargar tres meses más'}
                </BotonSecundario>
                <BotonDestructivo
                  onClick={() => quitarLaTanda(laTandaAbierta.grupo_id!)}
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

          {/*
            ── LA TIRA DE LA COMPRA ──

            Lo que falta en TODA la semana, junto y en un sitio. Suelto,
            día por día, son cuatro avisos que hay que ir recogiendo; aquí
            es una frase y un botón.

            Y es lo único de color de la pantalla, a propósito: de once
            manchas se ha bajado a ésta.
          */}
          {loQueFaltaEstaSemana.length > 0 && (
            <div className="mt-3 hidden items-center gap-3 rounded-[14px] border border-borde bg-fondo px-4 py-2.5 lg:flex">
              <span className="shrink-0 text-[14px] font-extrabold" style={{ color: 'var(--t-alerta)' }}>
                Faltan {loQueFaltaEstaSemana.length}{' '}
                {loQueFaltaEstaSemana.length === 1 ? 'cosa' : 'cosas'} esta semana
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {loQueFaltaEstaSemana.slice(0, 9).map((c) => (
                  <span
                    key={c}
                    className="truncate rounded-full border border-borde bg-superficie px-2.5 py-0.5 text-[13px] text-tinta-suave"
                  >
                    {c}
                  </span>
                ))}
                {loQueFaltaEstaSemana.length > 9 && (
                  <span className="self-center text-[13px] text-tenue">
                    y {loQueFaltaEstaSemana.length - 9} más
                  </span>
                )}
              </span>
              <button
                onClick={pasarloALaCompra}
                disabled={pasando}
                className="objetivo shrink-0 rounded-full bg-accion px-4 text-[13.5px] font-extrabold tracking-wide text-accion-tinta disabled:opacity-50"
              >
                {pasando ? 'Un momento…' : 'PASARLO A LA COMPRA'}
              </button>
            </div>
          )}

          {/* ── Los siete días ── */}
          <ul className="mt-4 space-y-2.5 lg:hidden">
            {dias.map((fecha) => (
              <li key={fecha} className="rounded-[20px] border border-borde bg-superficie px-4 py-3.5">
                <p className="rotulo">{comoSeLlamaElDia(fecha)}</p>

                <div className="mt-2 space-y-2">
                  {MOMENTOS.flatMap(({ valor, texto }) => {
                    /*
                      ── UNA FILA POR PLATO, Y UNA MÁS PARA EL SIGUIENTE ──

                      En una comida caben varios platos (paso 85). La fila
                      vacía del final es el «añadir otro»: se escribe en
                      ella y se apunta uno más.

                      Sólo aparece cuando ya hay algo puesto. Un día sin
                      menú sigue teniendo UNA fila vacía y ni una más — con
                      siete días y dos comidas, catorce huecos de más serían
                      media pantalla de nada.
                    */
                    const puestos = losDe(fecha, valor)
                    const filas: (Menu | null)[] = puestos.length > 0 ? [...puestos, null] : [null]

                    return filas.map((puesto, i) => {
                    const suya = puesto?.receta_id
                      ? recetas.find((r) => r.id === puesto.receta_id)
                      : undefined
                    const lleva = suya?.ingredientes ?? []
                    const nuevoDeVerdad = puesto && !puesto.id.startsWith('nuevo-')
                    const sinMirar = Boolean(nuevoDeVerdad && lleva.length > 0 && !puesto!.comprobado_en)
                    const faltan = puesto?.faltan ?? []

                    return (
                      <div key={`${valor}-${puesto?.id ?? `otro-${puestos.length}`}`}>
                        <div className="flex items-center gap-2.5">
                          {/* El rótulo sólo delante del primero. El hueco se
                              queda, para que los platos de una misma comida
                              sigan alineados en columna. */}
                          <span className="t-apoyo w-[62px] shrink-0 font-extrabold">
                            {i === 0 ? texto : ''}
                          </span>
                          <Renglon
                            valor={puesto?.que ?? ''}
                            alSalir={(v) => guardar(fecha, valor, v, undefined, puesto?.id ?? null)}
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
                                  if (r) guardar(fecha, valor, r.titulo, r.id, puesto?.id ?? null)
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
                    })
                  })}
                </div>
              </li>
            ))}
          </ul>

        </>
      )}

      {aviso && (
        <div className="mt-4">
          <Aviso titulo="No se ha podido guardar" explicacion={aviso} />
        </div>
      )}

      {vista === 'recetas' && (
        <>
          {/*
            ── GUARDAR UNA IDEA, ARRIBA ──

            Y no al final. Con veinte recetas, un botón detrás de las
            veinte es un botón que hay que buscar — que es justo lo que
            Haris llamó *«un scroll infinito»*.

            Cuando se está corrigiendo una, esto no sale: el formulario
            se pinta pegado a esa receta, y dos formularios abiertos a
            la vez es no saber cuál se guarda.
          */}
          {!abierto ? (
            <div className="mt-4">
              <BotonPrincipal onClick={() => setAbierto(true)} icono="mas">
                Guardar una idea
              </BotonPrincipal>
            </div>
          ) : (
            !cambiando && elFormulario()
          )}

          {recetas.length === 0 ? (
            <div className="mt-4">
              <Vacio
                titulo="El cajón está vacío"
                explicacion="Aquí se guarda lo que vayáis viendo: un vídeo de YouTube, una receta de una página, o solo el nombre de algo que sale bien."
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {recetas.map((r) => (
                <li key={r.id} className="rounded-[20px] border border-borde bg-superficie px-4 py-3.5">
                  {/*
                    ── SOLO EL TÍTULO, Y LO DEMÁS SI SE PIDE ──

                    La ficha entera —enlace, receta escrita, once
                    ingredientes, los siete días, «que vuelva»,
                    «cambiarla», «quitar»— ocupa media pantalla. Veinte
                    así son veinte pantallas para encontrar una.

                    El título es lo único que hace falta para
                    reconocerla. Se toca y se abre; se vuelve a tocar y
                    se cierra.

                    La flecha dice que hay algo debajo. Sin ella, una
                    lista de títulos parece una lista de títulos y nadie
                    toca.
                  */}
                  <button
                    type="button"
                    onClick={() => setDesplegada((x) => (x === r.id ? null : r.id))}
                    aria-expanded={desplegada === r.id}
                    className="flex w-full items-center gap-3 text-left"
                    style={{ minHeight: 48 }}
                  >
                    <span className="t-tarjeta min-w-0 flex-1">{r.titulo}</span>
                    <span
                      aria-hidden
                      className="shrink-0 text-tenue"
                      style={{
                        transform: desplegada === r.id ? 'rotate(180deg)' : undefined,
                      }}
                    >
                      <Ico nombre="flecha" tam={18} grosor={2.4} className="rotate-90" />
                    </span>
                  </button>

                  {desplegada === r.id && (
                    <>
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

                    {/*
                      ── CORREGIRLA ──

                      Delante de «Quitar», y no al revés: hasta ahora la única
                      manera de arreglar una receta era quitarla y volver a
                      escribirla, y eso además dejaba sin enlazar los menús
                      que ya la usaban. El botón de al lado es el que hace
                      daño; éste tiene que ir antes.
                    */}
                    <div className="mt-1 flex items-center gap-5">
                      <button
                        onClick={() => corregir(r)}
                        className="t-apoyo flex h-12 items-center gap-1.5 font-extrabold text-tinta"
                      >
                        <Ico nombre="lapiz" tam={18} grosor={2.4} />
                        Cambiarla
                      </button>

                      {/* Era texto suelto de 14 px: 20 px de alto en una lista
                          donde todo lo demás pasa de 48. */}
                      <button
                        onClick={() => quitarIdea(r.id)}
                        className="t-apoyo flex h-12 items-center font-extrabold"
                        style={{ color: 'var(--t-alerta)' }}
                      >
                        Quitar
                      </button>
                    </div>
                    </>
                  )}

                  {/*
                    ── Y EL FORMULARIO, AQUÍ MISMO ──

                    Haris: *«que no se vaya a la parte de abajo, sino que
                    aparezca directo debajo de donde está»*. Debajo de
                    ESTA receta, con lo que hay dentro, y al guardar se
                    cierra y se queda la ficha corregida en su sitio.
                  */}
                  {cambiando === r.id && abierto && elFormulario()}
                </li>
              ))}
            </ul>
          )}

        </>
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
  corto = false,
}: {
  valor: string
  alSalir: (v: string) => void
  /*
    El mismo campo, en una columna de 154 px. Lo único que cambia es
    el aire: 8 px de lado en vez de 12, y 40 de alto en vez de 48.

    Y 40 y no menos porque 44 es el suelo de objetivo con ratón y esto
    tiene el hueco de la columna alrededor — que también es zona de
    clic del campo. Por debajo de eso no se baja aunque quepan tres
    líneas más: escribir la cena del jueves es LA acción de esta
    pantalla.
  */
  corto?: boolean
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
      className={
        'min-w-0 flex-1 rounded-[16px] border border-transparent bg-fondo font-extrabold text-tinta placeholder:font-semibold placeholder:text-apagado focus:outline-none ' +
        (corto
          ? 'w-full rounded-[10px] px-2 py-1.5 text-[14px] leading-snug'
          : 't-cuerpo px-3 py-3')
      }
      style={{ minHeight: corto ? 40 : 48 }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accion)')}
      onBlurCapture={(e) => (e.currentTarget.style.borderColor = 'transparent')}
    />
  )
}

/*
  ══════════════════════════════════════════════════════════════
  UNA PESTAÑA DE LAS DE DENTRO
  ══════════════════════════════════════════════════════════════

  No es la barra de abajo ni el rail: eso navega entre pantallas. Esto
  parte UNA pantalla en dos vistas, y por eso tiene su propia forma —
  una pastilla, la puesta en tinta y la otra en papel.

  48 px de alto, que es el suelo de MAPPEL para algo que se toca con el
  pulgar. Y la palabra entera, nunca un icono solo.
*/
function Pestana({
  children,
  puesta,
  alTocar,
}: {
  children: React.ReactNode
  puesta: boolean
  alTocar: () => void
}) {
  return (
    <button
      type="button"
      onClick={alTocar}
      aria-pressed={puesta}
      className="t-apoyo flex h-12 items-center rounded-full border px-5 font-extrabold"
      style={{
        background: puesta ? 'var(--t-tinta)' : 'var(--t-superficie)',
        color: puesta ? 'var(--t-fondo)' : 'var(--t-tinta)',
        borderColor: puesta ? 'var(--t-tinta)' : 'var(--t-borde)',
      }}
    >
      {children}
    </button>
  )
}
