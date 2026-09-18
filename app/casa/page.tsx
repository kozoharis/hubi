import { hoyAqui } from '@/lib/tablon'
import { laPared, lasQueSeVenEnLaCocina, loApuntado, loDestacado, losMenus } from '@/lib/pared'
import { loDeHoy } from '@/lib/rutinas'
import { genteDeLaCasa } from '@/lib/gente'
import { Ico } from '../iconos'
import { pintaDe } from '../iconos'
import { AMBITO, PastillaAmbito } from '../piezas'
import Link from '@/app/enlace'
import Cosa from './cosa'
import Rutinas from './rutinas'
import Fotos from './fotos'
import LoQueQuepa from './lo-que-quepa'
import { Nada, Rotulo } from './rotulo'

/*
  ── Y LAS FOTOS YA NO ESTÁN AQUÍ ──

  Estaban abajo a la izquierda, y eran el bloque que más ocupaba con
  diferencia. Se han ido a dos sitios mejores, y las dos veces se ven
  MÁS que antes:

    · **El descanso** (`descanso.tsx`). A los tres minutos sin tocar
      nada, llenan la pared entera. Antes eran un rectángulo de 760 px
      en una esquina; ahora son la pantalla.

    · **Notas**, que es el tablón. Ahí se ven y ahí se ponen — el botón
      de subir una foto sigue estando, que es lo que no se podía perder.

  Quitar una función para ganar sitio habría sido el error de siempre.
  Lo que se ha quitado es su SITIO, no la función.
*/

export const dynamic = 'force-dynamic'

/** Una cosa de la compra, con el menú del que vino si lo tiene. */
type ConMenu = { id: string; que: string; para_menu_id?: string | null }

/*
  ═══════════════════════════════════════════════════════════════
  HOY · la pantalla en la que se queda la pared
  ═══════════════════════════════════════════════════════════════

  Es la que se ve el 95 % del tiempo: a las demás se va a mirar algo
  concreto y la pared vuelve sola aquí a los tres minutos
  (`vuelve-a-hoy.tsx`).

  Así que ésta no puede ser una lista más. Es el resumen de la casa, y
  contesta de un vistazo —desde la puerta— las cinco preguntas que se
  hacen todos los días:

      ¿Qué hay hoy?        → lo apuntado, con su hora
      ¿Y lo importante?    → lo que alguien dejó a la vista
      ¿Qué se come?        → la comida y la cena de hoy
      ¿Falta algo?         → la lista de la compra
      ¿Y lo que viene?     → los próximos días, en pequeño

  ─────────────────────────────────────────────────────────────
  Y SE MIRA, NO SE LEE

  La rejilla que reparte todo eso —dos filas, cada una partida por la
  mitad, y la foto pequeña dentro— está explicada donde se dibuja, en
  el `return`. Aquí basta con la idea: cada cosa tiene un sitio fijo,
  para que nadie tenga que recorrer la pantalla buscándola.

  ─────────────────────────────────────────────────────────────
  LO QUE SE PIDE, Y LO QUE NO SE FILTRA

  Todo se pide sin una sola condición de visibilidad, a propósito: la
  que filtra es la base. Está explicado en `lib/pared.ts`.
*/

export default async function Hoy() {
  const { supabase, casa } = await laPared()
  const hoy = hoyAqui()

  /* Hasta dentro de dos semanas: de ahí sale «después». */
  const dentroDeDos = sumarDias(hoy, 14)

  const [cosas, menus, destacado, laCompra, rutinas, notas, gente] = await Promise.all([
    loApuntado(supabase, casa, hoy, dentroDeDos),
    losMenus(supabase, casa, hoy, hoy),
    loDestacado(supabase, casa),
    /*
      La compra. Envuelta, como todo lo que puede no estar: una casa que
      tenga la compra apagada (`hogares.usa_compra`) no debe romper la
      pantalla de la cocina, que es donde más falta hace que no se rompa
      nada.
    */
    (async () => {
      try {
        /*
          Y las MISMAS listas que la pestaña de la compra, no todas.

          Antes esto pedía la compra entera sin mirar de qué lista era,
          y la pestaña de al lado sí miraba. O sea que una lista que
          alguien no quiere ver en la cocina no salía en La compra… y
          salía aquí, en letra grande, en la primera pantalla. Dos
          pantallas de la misma pared contestando distinto a la misma
          pregunta.
        */
        const cuales = await lasQueSeVenEnLaCocina(supabase, casa)

        let pide = supabase
          .from('compra')
          /* Con `para_menu_id` (paso 87): es lo que permite avisar de
             que falta algo para la cena de mañana. Si la base todavía
             no lo tiene, se vuelve a pedir sin ello más abajo. */
          .select('id, que, para_menu_id')
          .eq('hogar_id', casa)
          .eq('comprado', false)
          .is('archivado_en', null)

        /* Lo que no está en ninguna lista es de la casa y sale siempre.
           Ver `lasQueSeVenEnLaCocina`. */
        pide =
          cuales.length > 0
            ? pide.or(`lista_id.is.null,lista_id.in.(${cuales.map((l) => l.id).join(',')})`)
            : pide.is('lista_id', null)

        const { data, error } = await pide
          .order('creado_en', { ascending: true })
          .limit(30)

        if (!error) return (data ?? []) as ConMenu[]

        /* La red de siempre: sin la columna, Postgres rechaza la
           consulta ENTERA. Se vuelve a pedir sin ella y la compra sigue
           saliendo — solo se queda sin el aviso. */
        const otra = await supabase
          .from('compra')
          .select('id, que')
          .eq('hogar_id', casa)
          .eq('comprado', false)
          .is('archivado_en', null)
          .order('creado_en', { ascending: true })
          .limit(30)

        if (otra.error) return []
        return (otra.data ?? []) as ConMenu[]
      } catch {
        return []
      }
    })(),
    /* Lo que toca hoy. `loDeHoy` ya envuelve sus fallos y devuelve
       vacío si las tablas no están. */
    loDeHoy(supabase, casa),
    /*
      ── EL CORCHO ──

      Haris: *«veo que las notas no salen en el inicio, creo que
      deberían, por lo menos un aviso»*.

      Y tiene razón: una nota clavada en el corcho de una cocina existe
      para que la vea quien pase, y quien pasa mira la pantalla de
      Inicio — no se va a la pestaña de Notas a comprobar si hay algo.
      Un corcho que hay que ir a consultar no es un corcho.

      Aquí NO se decide cuáles salen: la restrictiva del paso 63 ya
      filtra, igual que en la pestaña. `guardada_en is null` sí, que es
      otra cosa: una nota retirada no cuelga de ninguna pared.
    */
    (async () => {
      try {
        const { data, error } = await supabase
          .from('notas')
          .select('id, texto')
          .eq('hogar_id', casa)
          .is('guardada_en', null)
          .order('creada_en', { ascending: false })
          .limit(8)
        if (error) return [] as { id: string; texto: string }[]
        return (data ?? []) as { id: string; texto: string }[]
      } catch {
        return [] as { id: string; texto: string }[]
      }
    })(),
    /* Los nombres Y SUS COLORES, para poder decir DE QUIÉN es cada
       cosa. En una casa de dos da igual; en una con niños, «17:00 ·
       Inglés» sin decir de quién no sirve de nada.

       `genteDeLaCasa` en vez de `perfiles` a secas: trae el color, que
       es lo que la pared puede enseñar a dos metros —un nombre a esa
       distancia no se lee—, y además se limita a esta casa. Ya viene
       envuelto y con respaldo si falta la columna del color. */
    genteDeLaCasa(supabase, casa).catch(() => []),
  ])

  const nombreDe = new Map(gente.map((p) => [p.id, p.nombre.split(' ')[0]]))

  /* La misma lista, con el color, para las caras de cada renglón. */
  const losDeCasa = gente.map((g) => ({ id: g.id, nombre: g.nombre, color: g.color }))

  /*
    ── Y AQUÍ HABÍA UNA CONSULTA QUE YA NO HACE FALTA ──

    `loApuntado` pedía TODO lo apuntado del mes entero, y era sólo para
    poner un punto debajo de los días del calendario chico. Al irse el
    mes de esta pantalla, esa consulta se quedaba pidiendo treinta días
    de cosas para no pintar ninguna.

    Una pared se recarga sola cada pocos minutos, así que una consulta
    de menos aquí no es una micro-optimización: es una consulta menos
    cada vez, todo el día, todos los días.
  */

  const pendientes = cosas.filter((c) => c.estado !== 'hecho')
  const deHoy = pendientes.filter((c) => c.fecha === hoy)
  const luego = pendientes.filter((c) => c.fecha !== hoy).slice(0, 4)

  /*
    ── LOS PLATOS DE HOY, EN PLURAL ──

    Desde el paso 85 una comida puede tener varios platos. Aquí no se
    abre una fila por plato: esta pantalla tiene que caber entera, y lo
    que hace falta saber al pasar por la cocina es QUÉ SE COME, no
    cuántas cosas son. Así que se juntan en un renglón —«Lentejas ·
    Merluza»— y lo que lleva cada uno se suma.
  */
  const comida = menus.filter((m) => m.momento === 'comida')
  const cena = menus.filter((m) => m.momento === 'cena')

  /*
    ══════════════════════════════════════════════════════════════
    «OYE, QUE HAY QUE COMPRAR ALGO PARA MAÑANA»
    ══════════════════════════════════════════════════════════════

    Haris: *«puede saltar un aviso en la pantalla de inicio, automática,
    donde te avise: oye, no te olvides de comprar lo que toque»*.

    Y es el remate de todo lo del paso 87. Saber que falta cilantro
    sirve de poco si hay que entrar en la pestaña de la Compra para
    enterarse: el único momento en que ese dato cambia algo es cuando
    todavía se puede ir a comprarlo, y ése es justamente el momento en
    que nadie está mirando la Compra.

    ─────────────────────────────────────────────────────────────
    SOLO LO DE HOY Y LO DE MAÑANA

    Lo del sábado no es un aviso, es una lista. Un cartel permanente
    diciendo que falta algo para algún día de la semana es un cartel
    que a los tres días ya no se lee — y entonces tampoco se lee el
    día que sí importa.

    Si no hay nada que corra, aquí no aparece nada. Una pantalla que
    avisa siempre no avisa nunca.
  */
  const mañana = (() => {
    const d = new Date(`${hoy}T12:00:00`)
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  const conMenu = [...new Set(laCompra.map((c) => c.para_menu_id).filter(Boolean))] as string[]

  const queCorren =
    conMenu.length === 0
      ? []
      : ((
          await supabase
            .from('menus')
            .select('id, fecha, momento')
            .eq('hogar_id', casa)
            .in('id', conMenu)
            .gte('fecha', hoy)
            .lte('fecha', mañana)
        ).data ?? []) as { id: string; fecha: string; momento: string }[]

  const urgen = new Set(queCorren.map((m) => m.id))
  const loQueUrge = laCompra.filter((c) => c.para_menu_id && urgen.has(c.para_menu_id))

  /* Para qué comida es la más cercana, dicho como se dice en casa. */
  const laPrimera = [...queCorren].sort((a, b) =>
    a.fecha === b.fecha ? a.momento.localeCompare(b.momento) : a.fecha.localeCompare(b.fecha)
  )[0]

  const paraCuando = !laPrimera
    ? ''
    : `${laPrimera.momento === 'cena' ? 'la cena' : 'la comida'} de ${
        laPrimera.fecha === hoy ? 'hoy' : 'mañana'
      }`

  /*
    ── Y SI LO DE HOY SE PUEDE HACER ──

    Se piden solo los ingredientes de las DOS recetas de hoy, no el
    cajón entero. Aquí no hace falta elegir nada: hace falta saber si
    falta algo, y eso son dos filas.

    Envuelto como todo lo del paso 80: sin esa columna, Postgres
    rechazaría la consulta entera y esta pantalla se quedaría sin
    menús por una casilla que no existe.
  */
  const conReceta = [...comida, ...cena]
    .map((m) => m.receta_id)
    .filter(Boolean) as string[]
  const loQueLleva = await (async () => {
    if (conReceta.length === 0) return new Map<string, string[]>()
    try {
      const { data, error } = await supabase
        .from('recetas')
        .select('id, ingredientes')
        .eq('hogar_id', casa)
        .in('id', conReceta)
      if (error) return new Map<string, string[]>()
      return new Map(
        ((data ?? []) as { id: string; ingredientes: string[] | null }[]).map((r) => [
          r.id,
          (r.ingredientes ?? []).filter((i) => (i ?? '').trim().length > 1),
        ])
      )
    } catch {
      return new Map<string, string[]>()
    }
  })()

  /*
    ── LO DESTACADO VA DENTRO DE HOY, NO EN SU PROPIA SECCIÓN ──

    Tenía rótulo propio, su aire de sección y sus 44 px de separación,
    para decir algo que ya es la respuesta a «¿qué hay hoy?». Alguien
    deja una cosa A LA VISTA precisamente porque es lo primero que hay
    que ver — y estaba en tercer lugar, debajo de dos listas.

    Ahora encabeza la lista de Hoy, con su chincheta y su color. Se
    gana un rótulo, una separación y una decisión menos por pantalla.

    Y se quita el duplicado: una tarea de hoy que además esté destacada
    salía dos veces, una en cada bloque.
  */
  const destacadoIds = new Set(destacado.map((c) => c.id))
  const deHoySinRepetir = deHoy.filter((c) => !destacadoIds.has(c.id))

  return (
    /*
      ═══════════════════════════════════════════════════════════
      DOS FILAS, Y CADA UNA PARTIDA POR LA MITAD
      ═══════════════════════════════════════════════════════════

      Haris, con la pared delante: *«la imagen se parte… lo de hoy me
      parece demasiado grande… hay como un popurrí de cosas»*. Y luego
      lo que quería: *«haría la foto, pero en pequeño, que esté dentro;
      lo otro lo organizaría en dos filas, y esas dos filas pueden
      partirse alguna a la mitad — por ejemplo compra y en casa (las
      tareas del hogar)»*.

      Los tres problemas eran uno solo, y conviene dejarlo escrito.

      ── EL POPURRÍ ──

      Eran dos columnas, y por la derecha caían cinco bloques uno
      detrás de otro: aviso, menú, compra, corcho, después. Cinco
      rótulos en fila india. Una columna con cinco secciones no es una
      columna organizada: es una lista de secciones, y hay que LEERLA
      para saber dónde está cada cosa. En una pared que se mira dos
      segundos desde la puerta, eso es no enseñar nada.

      Lo que arregla el popurrí no es quitar cosas —todas hacen falta—
      sino **darle a cada una un sitio fijo en una rejilla**. En una
      rejilla no se lee: se mira donde uno ya sabe que está.

      ── LA REJILLA ──

          ╔═══════════════════════════════════════════════╗
          ║  ⚠ NO TE OLVIDES DE COMPRAR · sólo si corre   ║
          ╚═══════════════════════════════════════════════╝
          ┌──────────────┬──────────────┬───────────────┐
          │  HOY         │ LO DE CADA   │  QUÉ SE COME  │
          │  lo de hoy   │ DÍA          │  comida       │
          │  y lo que    │ las rutinas  │  cena         │
          │  viene       │              │               │
          ├──────────────┼──────────────┼───────────────┤
          │  FALTA EN    │ EN EL CORCHO │               │
          │  CASA        │ las notas    │   [la foto]   │
          │  la compra   │              │               │
          └──────────────┴──────────────┴───────────────┘

      Dos filas iguales. A la izquierda, lo ancho partido en dos
      mitades —que es exactamente el ejemplo que puso él, la compra y
      las tareas de casa—; a la derecha, una columna estrecha de punta
      a punta. Y encima de todo, cuando hace falta, el aviso cruzando
      la pantalla.

      ── Y POR QUÉ ESA COLUMNA ESTRECHA ──

      Porque lo de la derecha se contesta con tres palabras:
      «Lentejas», «mar 16 sep». Lo de la izquierda lleva frases enteras
      —«Llevar la documentación a Silvia»— y necesita ancho. El reparto
      es 1,6 a 1 y no la mitad y la mitad, por eso.

      ── LO DE HOY YA NO ES LO MÁS GRANDE ──

      Era una columna entera de arriba abajo. Ahora es un cuarto de la
      pantalla, y no ha perdido nada: sigue siendo lo primero arriba a
      la izquierda, que es donde empieza a mirar cualquiera. Lo que ha
      perdido es el sitio que ocupaba sin usarlo — los días sin nada
      apuntado eran medio cristal en blanco.

      ── Y LAS MITADES SE CIERRAN SOLAS ──

      Si hoy no hay rutinas, «Hoy» se queda con la fila ancha entera en
      vez de dejar media en blanco. Igual con el corcho y la compra. Un
      hueco vacío con forma de sección es lo que hace que una pantalla
      parezca rota.

      ── LO QUE NO CAMBIA ──

      Ninguna lista tiene un tope escrito a mano. `LoQueQuepa` mide el
      hueco de verdad y enseña los que caben, que es lo que Haris pidió
      cuando tiró los topes fijos: *«que sea adaptable… todas las
      tabletas son de 1920, 2K o incluso 4K»*. Aquí se le sigue pasando
      TODO lo que hay.

      Y por debajo de 1024 esto se apila y se desplaza, como siempre:
      por debajo de 1024 no hay ninguna pared — quien abre esto en un
      teléfono acaba en `/en-la-cocina`.
    */
    <div className="flex flex-col gap-8 pt-5 lg:h-full lg:gap-6 lg:overflow-hidden">
      {/*
        ══════════════════════════════════════════════════════════
        EL AVISO · UNA MARCA, NO UN CARTEL
        ══════════════════════════════════════════════════════════

        Haris pidió el aviso —*«puede saltar un aviso en la pantalla de
        inicio, automática: oye, no te olvides de comprar lo que
        toque»*— y luego, viéndolo: *«el aviso rojo tan grande no me
        gusta; hazlo visual para verlo, que quede elegante»*.

        Las dos cosas son ciertas a la vez, y la manera de que no se
        peleen no es hacerlo más pequeño: es cambiar de QUÉ está hecho.

        ── LO QUE FALLABA ──

        Era una banda roja de lado a lado. Y una banda de color cruzando
        una pared entera no dice «mira esto»: dice «algo va mal». En
        una cocina, todos los días, eso es una alarma de coche — a la
        tercera vez nadie la mira, y entonces tampoco se mira el día
        que sí importa. Además rompía lo que el punto 28 del
        planteamiento pide de esta aplicación: sereno, cálido, con el
        color usado con moderación.

        ── LO QUE LO HACE VISIBLE AHORA ──

        No el tamaño: la ESCASEZ. En toda la pantalla no hay ni un solo
        color saturado — papel cálido, tarjetas blancas, filos suaves de
        arena, oliva y rosa al 6 px. Así que un círculo rojo de 42 px
        es lo único encendido del cristal, y se ve desde la puerta
        precisamente porque es lo único.

        Un número grande dentro y una frase corta al lado. Nada de
        fondo de color, nada de borde rojo, nada de ancho completo:
        una pastilla blanca como las demás tarjetas de la casa,
        pegada al margen derecho —el mismo margen donde acaban las
        pestañas y la columna del menú—, para que no parezca que
        flota.

        ── Y SIGUE COSTANDO LO MISMO DE ALTO ──

        Unos 58 px, que es lo que hay que restarle a las dos filas. Por
        eso sólo aparece cuando falta algo para HOY o para MAÑANA. Lo
        del sábado no es un aviso: es una lista, y está en su pestaña.
        Una pantalla que avisa siempre no avisa nunca.
      */}
      {loQueUrge.length > 0 && (
        <div className="flex shrink-0 justify-end">
          <Link
            href="/casa/compra"
            className="tocable flex items-center gap-4 rounded-full border border-borde bg-superficie py-2 pl-2 pr-6"
          >
            {/*
              El único disco de color de la pantalla. Relleno, no
              contorno: a dos metros un contorno de 2 px desaparece y
              un disco no.
            */}
            <span
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--t-alerta)', color: '#FFFFFF' }}
            >
              <Ico nombre="bolsa" tam={22} grosor={2.4} />
            </span>

            <span className="flex items-baseline gap-2.5">
              {/* El número manda: es el dato. */}
              <span
                className="text-[27px] font-extrabold leading-none tabular-nums"
                style={{ color: 'var(--t-alerta)' }}
              >
                {loQueUrge.length}
              </span>
              <span className="text-[19px] font-extrabold leading-none text-tinta-suave">
                {loQueUrge.length === 1 ? 'cosa que comprar' : 'cosas que comprar'}
                {paraCuando ? ` para ${paraCuando}` : ''}
              </span>
            </span>

            <span aria-hidden className="shrink-0 text-apagado">
              <Ico nombre="flecha" tam={20} grosor={2.4} />
            </span>
          </Link>
        </div>
      )}

      {/*
        ══════════════════════════════════════════════════════════
        FILA 1 · LO QUE PASA HOY
        ══════════════════════════════════════════════════════════
      */}
      <div className="flex min-h-0 flex-col gap-8 lg:grid lg:flex-[1.25] lg:grid-cols-[1.6fr_1fr] lg:gap-9">
        {/* ── Izquierda: lo apuntado | lo de cada día ── */}
        <div
          className={`grid min-h-0 gap-8 lg:gap-9 ${
            rutinas.length > 0 ? 'lg:grid-cols-2' : ''
          }`}
        >
          <div className="flex min-h-0 flex-col">
            <Rotulo>Hoy</Rotulo>

            {/*
              ── HOY Y LO QUE VIENE, EN LA MISMA LISTA ──

              «Después» estaba en la otra columna, con el menú y la
              compra, y no es de esa familia. Es la misma pregunta que
              «Hoy», sólo que un poco más lejos — el punto 18 del
              planteamiento lo dice con todas las letras: para Juan
              Miguel y Conchita no hay diferencia entre evento, tarea,
              recordatorio y vencimiento. Todo son *cosas que tengo que
              recordar*.

              ⚠️  Y VA EN UNA SOLA LISTA, NO EN DOS PEGADAS.

              Esto se probó primero con dos: «Hoy» arriba, una raya, el
              rótulo «Después» y otra lista debajo. Medido en una
              tableta de 924 px, no cabía — y no cabía de la peor
              manera: las dos listas se repartían el hueco a 2 contra 1
              y a la de abajo le tocaban 53 px para una tarjeta de 72.
              `LoQueQuepa` enseña el primero aunque no quepa (y hace
              bien: una columna vacía diciendo «y 3 más» es peor), así
              que lo que se veía era una tarjeta cortada por la mitad.

              Un rótulo y una raya cuestan 75 px de alto. Aquí eso es
              una tarjeta entera, y lo que compran es decir con
              palabras algo que las propias tarjetas ya dicen: las de
              hoy llevan la hora —«10:30»— y las de después llevan el
              día —«LUN 21 SEP»—. Nadie las confunde.

              Así que una sola caja, una sola medida y ningún recorte
              raro: primero lo de hoy, luego lo que viene, y lo que no
              quepa lo dice el renglón del final.
            */}
            {destacado.length === 0 && deHoySinRepetir.length === 0 && luego.length === 0 ? (
              <Nada>Hoy no hay nada apuntado.</Nada>
            ) : (
              <LoQueQuepa elResto="y {n} más apuntadas">
                {[
                  ...destacado.map((c) => <ALaVista key={c.id} cosa={c} />),
                  ...deHoySinRepetir.map((c) => (
                    /* Con `id`: lo de HOY se tacha desde la pared, que
                       es donde tachar significa algo. Lo de después,
                       no. */
                    <Cosa
                      key={c.id}
                      id={c.id}
                      titulo={c.titulo}
                      cuando={c.hora ? c.hora.slice(0, 5) : ''}
                      talla="hoy"
                      dequienes={c.dequienes ?? []}
                      gente={losDeCasa}
                    />
                  )),
                  /* La raya que separa hoy de lo que viene. Va DENTRO
                     de la lista, como un renglón más de 1 px: así la
                     mide el mismo medidor y no puede quedarse colgando
                     debajo de una lista recortada. Sólo cuando hay
                     cosas a los dos lados — una raya con nada encima
                     es un renglón que no dice nada. */
                  ...(luego.length > 0 && (destacado.length > 0 || deHoySinRepetir.length > 0)
                    ? [<div key="raya" className="h-px bg-borde" />]
                    : []),
                  ...luego.map((c) => (
                    <Cosa
                      key={c.id}
                      titulo={c.titulo}
                      cuando={diaCorto(c.fecha, Number(hoy.slice(0, 4)))}
                      talla="columna"
                    />
                  )),
                ]}
              </LoQueQuepa>
            )}
          </div>

          {/*
            ── LO DE CADA DÍA, AL LADO Y NO DEBAJO ──

            Estaba pegado bajo «Hoy», separado por una raya fina, y las
            dos listas se repartían el alto de una columna: el día que
            había cuatro recados y siete rutinas, las dos salían
            recortadas a la vez.

            Es el ejemplo que puso Haris —*«la compra y en casa, las
            tareas del hogar»*— y funciona por lo mismo que allí: son
            dos listas de renglones cortos, y dos listas cortas una al
            lado de otra caben en la mitad de alto que una detrás de
            otra.

            Sigue siendo la misma pieza, con su propio rótulo y su
            «Quedan 3» dentro.
          */}
          {rutinas.length > 0 && (
            <div className="flex min-h-0 flex-col">
              <Rutinas
                rutinas={rutinas.map((r) => ({
                  id: r.id,
                  que: r.que,
                  hora: r.hora,
                  hecha: r.hecha,
                  dequien: r.para ? (nombreDe.get(r.para) ?? null) : null,
                }))}
              />
            </div>
          )}
        </div>

        {/* ── Derecha: qué se come ── */}
        <div className="flex min-h-0 flex-col">
          <Rotulo>Qué se come</Rotulo>

          {comida.length === 0 && cena.length === 0 ? (
            <Nada>Hoy no hay menú puesto.</Nada>
          ) : (
            /*
              ── LOS DOS PLATOS TAMBIÉN SE MIDEN ──

              Iban sueltos, con `shrink-0`: ocupaban lo que ocupaban y,
              si no cabían, la cena se cortaba por la mitad contra el
              borde de la fila. Una tarjeta partida no parece una
              decisión, parece una avería — es literalmente lo que
              Haris vio en la foto.

              Con `LoQueQuepa` no se corta nada: o cabe entera, o se
              dice «y 1 más en el Menú». En una pared de las normales
              esto no salta nunca; salta en la pequeña, que es donde
              antes se rompía en silencio.
            */
            <LoQueQuepa hueco={8} elResto="y {n} más, en el Menú">
              {[
                <Plato
                  key="comida"
                  momento="Comida"
                  que={juntos(comida)}
                  lleva={cuantoLleva(comida, loQueLleva)}
                  mirado={comida.length > 0 && comida.every((m) => m.comprobado_en)}
                  faltan={comida.reduce((n, m) => n + (m.faltan?.length ?? 0), 0)}
                />,
                <Plato
                  key="cena"
                  momento="Cena"
                  que={juntos(cena)}
                  lleva={cuantoLleva(cena, loQueLleva)}
                  mirado={cena.length > 0 && cena.every((m) => m.comprobado_en)}
                  faltan={cena.reduce((n, m) => n + (m.faltan?.length ?? 0), 0)}
                />,
              ]}
            </LoQueQuepa>
          )}
        </div>
      </div>

      {/*
        ══════════════════════════════════════════════════════════
        FILA 2 · LO QUE HAY EN LA CASA
        ══════════════════════════════════════════════════════════
      */}
      <div className="flex min-h-0 flex-col gap-8 lg:grid lg:flex-1 lg:grid-cols-[1.6fr_1fr] lg:gap-9">
        {/* ── Izquierda: lo que falta | lo que hay clavado ── */}
        <div
          className={`grid min-h-0 gap-8 lg:gap-9 ${
            laCompra.length > 0 && notas.length > 0 ? 'lg:grid-cols-2' : ''
          }`}
        >
          {/*
            ── LA COMPRA ──

            Es la única de las cosas de esta pantalla que un aparato
            PUEDE tocar: su nivel en `compra` es `anadir`, a propósito,
            porque una tableta colgada en la cocina existe sobre todo
            para apuntar que se ha acabado la leche.
          */}
          {laCompra.length > 0 && (
            <div className="flex min-h-0 flex-col">
              <div className="flex shrink-0 items-baseline gap-4">
                <Rotulo>Falta en casa</Rotulo>
                <p className="mb-3 text-[19px] font-extrabold text-tinta-suave">
                  {laCompra.length === 1 ? '1 cosa' : `${laCompra.length} cosas`}
                </p>
              </div>

              {/*
                ── Y DENTRO, OTRAS DOS COLUMNAS ──

                Haris: *«tal vez lo de falta en casa puede dividirse en
                dos columnas verticales, para que puedan entrar
                cosas»*.

                Sigue teniendo sentido con media fila: «papas» ocupa un
                tercio del ancho y el resto era papel en blanco a la
                derecha de cada renglón. Y ahora hace más falta, porque
                lo que se ha perdido con la rejilla es alto.

                Dos `LoQueQuepa` y no uno partido en dos: cada uno mide
                SU columna. Un solo medidor con una rejilla dentro
                contaría mal, porque los renglones dejarían de ir uno
                debajo de otro — y entonces el recorte se equivocaría
                justo el día que hay muchas cosas, que es el día que
                importa.
              */}
              <div
                className="flex min-h-0 flex-1 gap-6 rounded-[24px] border bg-superficie px-6 py-4"
                style={{ borderColor: 'var(--t-borde)', borderLeft: `6px solid ${AMBITO.oliva}` }}
              >
                {[laCompra.slice(0, Math.ceil(laCompra.length / 2)),
                  laCompra.slice(Math.ceil(laCompra.length / 2))].map((mitad, n) =>
                  mitad.length === 0 ? null : (
                    <div key={n} className="flex min-h-0 min-w-0 flex-1 flex-col">
                      <LoQueQuepa hueco={4} elResto="y {n} más">
                        {mitad.map((c) => (
                          <p
                            key={c.id}
                            className="flex items-start gap-2.5 text-[20px] font-extrabold leading-snug text-tinta"
                          >
                            <span
                              className="mt-[9px] block h-[7px] w-[7px] shrink-0 rounded-full"
                              style={{ background: AMBITO.oliva }}
                            />
                            <span className="min-w-0">{c.que}</span>
                          </p>
                        ))}
                      </LoQueQuepa>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/*
            ══════════════════════════════════════════════════════
            EL CORCHO, EN INICIO
            ══════════════════════════════════════════════════════

            Haris: *«veo que las notas no salen en el inicio, creo que
            deberían, por lo menos un aviso»*.

            Y el argumento es el propio corcho: una nota clavada en la
            cocina existe para que la vea quien pase. Quien pasa mira
            Inicio — no se va a la pestaña de Notas a comprobar si hay
            algo. Un corcho que hay que ir a consultar no es un corcho:
            es un cajón.

            Va entero y no como un contador («tienes 3 notas»), porque
            un contador obliga a ir a leerlas: dice que hay algo y no
            dice qué, que es lo único que hacía falta. Lo que no quepa
            lo recorta `LoQueQuepa` y lo dice con todas las letras.
          */}
          {notas.length > 0 && (
            <div className="flex min-h-0 flex-col">
              <Rotulo>En el corcho</Rotulo>
              <LoQueQuepa hueco={8}>
                {notas.map((n) => (
                  <p
                    key={n.id}
                    className="flex items-start gap-3 rounded-[18px] border bg-superficie px-5 py-2.5 text-[20px] font-extrabold leading-snug text-tinta"
                    style={{
                      borderColor: 'var(--t-borde)',
                      borderLeft: `5px solid ${AMBITO.rosa}`,
                    }}
                  >
                    {/* Una nota puede ser larga y esto es un resumen:
                        se corta en dos renglones. Para leerla entera
                        está la pestaña, a un toque. */}
                    <span className="line-clamp-2 min-w-0">{n.texto}</span>
                  </p>
                ))}
              </LoQueQuepa>
            </div>
          )}
        </div>

        {/*
          ══════════════════════════════════════════════════════════
          LA FOTO · PEQUEÑA, DENTRO, Y CON FORMA DE FOTO
          ══════════════════════════════════════════════════════════

          Haris: *«la imagen se parte»*, y *«haría la foto, pero en
          pequeño, que esté dentro»*.

          Lo de que se partía era de verdad y tenía una causa concreta.
          La foto estaba abajo de la columna de Hoy, y esa columna era
          la mitad ancha de la pantalla: 1.100 px de ancho por el alto
          que sobrara, unos 300. Un rectángulo de casi cuatro a uno. La
          foto se recorta desde el centro para llenar la caja que le
          den, así que de una foto de familia se veía una franja: las
          cabezas fuera por arriba y los pies por abajo.

          No era un fallo de dibujo. Era pedirle a una foto que tuviera
          la forma del hueco que sobrase.

          ── AHORA TIENE SU PROPIA CASILLA ──

          Un cuarto de la rejilla, la de abajo a la derecha, que es la
          columna estrecha: mide entre 1,8 y 2 a 1 en todas las paredes
          medidas —1280, 1480 y 1920—. Eso ya es una foto, no una
          franja. Y el tope de ancho lo remata en las grandes: en una
          pared de 1920 la casilla mediría 680 px de ancho y 360 de
          alto, y con el tope se queda en 560 por 360, que es casi
          exactamente el 16 por 10 de siempre.

          Es la primera vez en esta pantalla que la foto tiene un sitio
          en vez de quedarse con las sobras. Y era justo lo que fallaba:
          las sobras no tienen forma.

          ── Y SIGUE SIENDO LA MISMA PIEZA ──

          `fotos.tsx`, no una copia: el carrusel, el fundido de dos
          capas y la regla de que de noche no cambia son los mismos que
          en el descanso. Aquí no sube nada — subir se hace desde el
          móvil, y un botón de subir en una pared lo toca cualquiera
          que entre.
        */}
        <div className="hidden min-h-0 lg:block">
          <div className="ml-auto h-full w-full max-w-[440px]">
            <Fotos alto />
          </div>
        </div>
      </div>
    </div>
  )
}

/*
  Lo que alguien dejó A LA VISTA, ahora en lo alto de Hoy.

  Se distingue por tres cosas y ninguna es un rótulo: la pastilla de su
  ámbito a la izquierda, el filo de color, y la chincheta. Con eso basta
  para que se lea distinto sin gastar una sección entera.
*/
function ALaVista({
  cosa,
}: {
  cosa: { id: string; titulo: string; fecha: string | null; hora: string | null }
}) {
  const p = pintaDe(cosa.titulo)
  return (
    <div
      className="flex items-center gap-5 rounded-[28px] border bg-superficie px-6 py-3.5"
      style={{ borderColor: 'var(--t-borde)', borderLeft: `6px solid ${AMBITO[p.ambito]}` }}
    >
      <PastillaAmbito icono={p.icono} ambito={p.ambito} tam={48} />
      <span className="min-w-0 flex-1">
        <span className="block text-[24px] font-extrabold leading-tight text-tinta">
          {cosa.titulo}
        </span>
        {cosa.fecha && (
          <span className="mt-0.5 block text-[17px] font-bold text-tenue">
            {enPalabras(cosa.fecha, cosa.hora)}
          </span>
        )}
      </span>
      <span className="shrink-0 text-apagado">
        <Ico nombre="chincheta" tam={22} grosor={2.1} />
      </span>
    </div>
  )
}

/*
  Un plato. Sin plato puesto NO se esconde la fila: se dice que está
  vacía.

  Es lo contrario de lo que hace `Dato` en la aplicación —allí un valor
  vacío no pinta la fila—, y la diferencia es real. En una ficha, una
  etiqueta con un hueco al lado parece un dato que falta. Aquí, que la
  cena esté sin poner es justamente lo que alguien necesita ver al pasar
  por la cocina a las siete.
*/
/*
  Los platos de una comida, en un renglón. Un punto medio entre ellos y
  no una coma: la coma se confunde con el nombre del plato —«lentejas
  con chorizo, y arroz»— y el punto medio no se confunde con nada.
*/
function juntos(platos: { que: string | null }[]): string | null {
  const nombres = platos.map((p) => (p.que ?? '').trim()).filter(Boolean)
  return nombres.length > 0 ? nombres.join(' · ') : null
}

/** Cuántos ingredientes hay que comprobar entre todos los platos. */
function cuantoLleva(
  platos: { receta_id?: string | null }[],
  loQueLleva: Map<string, string[]>
): number {
  return platos.reduce((n, p) => n + (loQueLleva.get(p.receta_id ?? '')?.length ?? 0), 0)
}

function Plato({
  momento,
  que,
  lleva = 0,
  mirado = false,
  faltan = 0,
}: {
  momento: string
  que: string | null
  /** Cuántos ingredientes tiene su receta. Cero = no hay nada que comprobar. */
  lleva?: number
  mirado?: boolean
  faltan?: number
}) {
  /*
    ── AQUÍ SE ENSEÑA, EN EL MENÚ SE CONTESTA ──

    Esta pantalla tiene que caber entera, así que no abre el panel de
    «¿tienes todo esto?»: dice el estado y lleva a la pestaña del Menú,
    donde hay sitio para preguntarlo bien.

    Y no es una redirección escondida: es un toque explícito sobre el
    plato, con su renglón diciendo adónde va. La regla de
    `en-la-cocina/page.tsx` sigue en pie — lo que no puede pasar es que
    una pantalla te lleve a otra sin que tú se lo pidas.
  */
  const hayQueComprobar = lleva > 0

  const cuerpo = (
    /*
      ── Y SIN LA TACITA, TAMBIÉN AQUÍ ──

      Haris: *«puedes hacer la parte de qué se come y falta en casa algo
      más pequeñas»*.

      Lo primero que sobraba eran las dos pastillas de 48 px con la
      misma taza dibujada, una encima de otra. Dos iconos idénticos no
      distinguen la comida de la cena — eso ya lo hace la palabra
      «COMIDA» y «CENA». Lo que hacían era robar 64 px de ancho al
      plato y 12 de alto a la columna entera, que es justo lo que hacía
      falta para que quepa el corcho.
    */
    <div
      className="flex items-center gap-4 rounded-[20px] border bg-superficie px-5 py-2.5"
      style={{
        borderColor: 'var(--t-borde)',
        borderLeft: `6px solid ${AMBITO.arena}`,
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-extrabold uppercase tracking-wider text-tenue">
          {momento}
        </span>
        <span
          className={`block text-[22px] font-extrabold leading-tight ${
            que ? 'text-tinta' : 'text-apagado'
          }`}
        >
          {que ?? 'Sin poner'}
        </span>

        {hayQueComprobar && (
          <span
            className="mt-0.5 block text-[16px] font-extrabold"
            style={{
              color: !mirado
                ? 'var(--t-tenue)'
                : faltan > 0
                  ? 'var(--t-alerta)'
                  : 'var(--t-bien)',
            }}
          >
            {!mirado
              ? `¿Tienes lo que lleva? · ${lleva}`
              : faltan > 0
                ? `Faltan ${faltan} ${faltan === 1 ? 'cosa' : 'cosas'}`
                : 'Está todo para hacerlo'}
          </span>
        )}
      </span>
    </div>
  )

  if (!hayQueComprobar) return cuerpo

  return (
    <Link href="/casa/menu" className="tocable block">
      {cuerpo}
    </Link>
  )
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** «2026-09-13» + 14 → «2026-09-27». */
function sumarDias(iso: string, cuantos: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + cuantos)
  return d.toISOString().slice(0, 10)
}

/** «4 de octubre» · «4 de octubre · 12:00». Con el año si no es éste. */
function enPalabras(iso: string, hora: string | null): string {
  const [a, m, d] = iso.split('-').map(Number)
  const ano = new Date().getFullYear()
  const cuando = `${d} de ${MESES_LARGOS[m - 1]}${a === ano ? '' : ` de ${a}`}`
  return hora ? `${cuando} · ${hora.slice(0, 5)}` : cuando
}

/**
 * «mar 16 sep», y «mar 10 ago 2027» cuando no es de este año.
 *
 * El año no estaba, y en la pared salió esto:
 *
 *     lun 14 sep   Presentación del cole de Paula
 *     mar 10 ago   Último día para cancelar: IONOS
 *
 * Todo correcto por dentro —la de IONOS es de 2027 y va ordenada— y
 * todo equivocado por fuera: puesto debajo del 14 de septiembre, un «10
 * de agosto» sin año se lee como una fecha pasada, y una pantalla que
 * parece enseñar cosas caducadas deja de creerse.
 *
 * Corto es bueno, pero no a costa de decir algo que no es.
 */
export function diaCorto(fecha: string | null, anoDeHoy: number): string {
  if (!fecha) return ''
  const [a, m, d] = fecha.split('-').map(Number)
  /* Mediodía y no medianoche: con la hora a cero, un desfase de zona de
     una hora hacia atrás cambia el día. */
  const f = new Date(a, m - 1, d, 12)
  const base = `${DIAS[f.getDay()]} ${d} ${MESES[m - 1]}`
  return a === anoDeHoy ? base : `${base} ${a}`
}
