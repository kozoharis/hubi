import { hoyAqui } from '@/lib/tablon'
import { elLunesDe } from '@/lib/menus'
import { laPared, loApuntado, loDestacado, losMenus } from '@/lib/pared'
import { loDeHoy } from '@/lib/rutinas'
import { Ico } from '../iconos'
import { pintaDe } from '../iconos'
import { AMBITO, PastillaAmbito } from '../piezas'
import Link from '@/app/enlace'
import Cosa from './cosa'
import Mes from './calendario/mes'
import Rutinas from './rutinas'
import Tiempo from './tiempo'
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
  DOS COLUMNAS, Y NO POR SIMETRÍA

  A la izquierda lo de HOY y lo destacado: son las dos cosas que llevan
  frases largas y que hay que leer enteras. A la derecha lo que se
  contesta con tres palabras — qué se come, qué falta, qué viene.

  El reparto es 1,4 a 1 y no la mitad y la mitad: una lista de tareas
  con títulos de diez palabras necesita sitio; «Lentejas con chorizo»,
  no.

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

  /* Y el mes entero, solo para los puntitos del calendario pequeño. */
  const [ano, mes] = hoy.split('-').map(Number)
  const delMes = `${ano}-${String(mes).padStart(2, '0')}`
  const ultimo = String(new Date(ano, mes, 0).getDate()).padStart(2, '0')

  const [cosas, menus, destacado, laCompra, delMesEntero, rutinas, gente] = await Promise.all([
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
        const { data, error } = await supabase
          .from('compra')
          .select('id, que')
          .eq('hogar_id', casa)
          .eq('comprado', false)
          .is('archivado_en', null)
          .order('creado_en', { ascending: true })
          .limit(30)
        if (error) return []
        return (data ?? []) as { id: string; que: string }[]
      } catch {
        return []
      }
    })(),
    loApuntado(supabase, casa, `${delMes}-01`, `${delMes}-${ultimo}`),
    /* Lo que toca hoy. `loDeHoy` ya envuelve sus fallos y devuelve
       vacío si las tablas no están. */
    loDeHoy(supabase, casa),
    /* Los nombres, para poder decir DE QUIÉN es cada rutina. En una
       casa de dos da igual; en una con niños, «17:00 · Inglés» sin
       decir de quién no sirve de nada. */
    supabase.from('perfiles').select('id, nombre'),
  ])

  const nombreDe = new Map(
    ((gente.data ?? []) as { id: string; nombre: string }[]).map((p) => [
      p.id,
      p.nombre.split(' ')[0],
    ])
  )

  const conAlgo = new Set(delMesEntero.map((c) => c.fecha).filter(Boolean) as string[])

  const pendientes = cosas.filter((c) => c.estado !== 'hecho')
  const deHoy = pendientes.filter((c) => c.fecha === hoy)
  const luego = pendientes.filter((c) => c.fecha !== hoy).slice(0, 4)

  const comida = menus.find((m) => m.momento === 'comida') ?? null
  const cena = menus.find((m) => m.momento === 'cena') ?? null

  /*
    ── Y SI LO DE HOY SE PUEDE HACER ──

    Se piden solo los ingredientes de las DOS recetas de hoy, no el
    cajón entero. Aquí no hace falta elegir nada: hace falta saber si
    falta algo, y eso son dos filas.

    Envuelto como todo lo del paso 80: sin esa columna, Postgres
    rechazaría la consulta entera y esta pantalla se quedaría sin
    menús por una casilla que no existe.
  */
  const conReceta = [comida?.receta_id, cena?.receta_id].filter(Boolean) as string[]
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
      TRES COLUMNAS, Y LA PANTALLA MANDA
      ═══════════════════════════════════════════════════════════

      Haris: *«habría que intentar comprimirlo para que no tengan que
      desplazar hacia abajo… se ve mejor todo en una única pantalla»*.

      Antes eran dos columnas **a partir de 1280 px**, y ahí estaba
      medio problema: una tableta de 10 u 11 pulgadas en horizontal
      mide entre 1024 y 1194, o sea que esta pantalla nunca llegaba a
      tener dos columnas en el sitio para el que se hizo. Todo caía en
      una sola y había que desplazarse un metro.

      Ahora son tres desde 1024. Por debajo de eso se apila y se
      desplaza, y está bien: por debajo de 1024 no hay ninguna pared —
      quien abre esto en un teléfono acaba en `/en-la-cocina`.

      ─────────────────────────────────────────────────────────
      Y NINGUNA LISTA TIENE UN TOPE ESCRITO A MANO

      La primera versión traía topes fijos —tres recados, tres
      rutinas, ocho de la compra— calculados para 800 px de alto. Haris
      lo tiró, con razón: *«que sea adaptable… todas las tabletas son
      de 1920, 2K o incluso 4K»*. Un tope escrito a mano es una
      pantalla concreta metida en el código, y resuelve la pequeña
      estropeando la grande.

      `LoQueQuepa` mide el hueco de verdad y enseña los que caben.
      Aquí se le pasa TODO lo que hay.
    */
    <div className="pt-6 lg:grid lg:h-full lg:grid-cols-[1.45fr_1fr_1fr] lg:gap-7 lg:overflow-hidden">
      {/* ══ 1 · LO QUE HAY QUE HACER ══ */}
      <div className="flex min-h-0 flex-col">
        <Rotulo>Hoy</Rotulo>

        {destacado.length === 0 && deHoySinRepetir.length === 0 ? (
          <Nada>Hoy no hay nada apuntado.</Nada>
        ) : (
          <LoQueQuepa peso={2} elResto={(n) => `y ${n} más para hoy`}>
            {[
              ...destacado.map((c) => <ALaVista key={c.id} cosa={c} />),
              ...deHoySinRepetir.map((c) => (
                /* Con `id`: lo de HOY se tacha desde la pared, que es
                   donde tachar significa algo. Lo de «Después», no. */
                <Cosa
                  key={c.id}
                  id={c.id}
                  titulo={c.titulo}
                  cuando={c.hora ? c.hora.slice(0, 5) : ''}
                  talla="hoy"
                />
              )),
            ]}
          </LoQueQuepa>
        )}

        {/*
          ── LO DE CADA DÍA, PEGADO Y SEPARADO POR UNA RAYA ──

          Era una sección con su rótulo y sus 44 px de aire. Y para
          Juan Miguel y Conchita «lo de hoy» y «lo de cada día» son la
          misma pregunta — es literalmente el punto 18 del
          planteamiento: para ellos todo son *cosas que tengo que
          recordar*.

          Una raya fina cuesta 1 px y dice lo mismo que una sección
          entera: que esto es otra cosa, pero de la misma familia.
        */}
        {rutinas.length > 0 && (
          <>
            <div className="my-4 h-px shrink-0 bg-borde" />
            <Rutinas
              rutinas={rutinas.map((r) => ({
                id: r.id,
                que: r.que,
                hora: r.hora,
                hecha: r.hecha,
                dequien: r.para ? (nombreDe.get(r.para) ?? null) : null,
              }))}
            />
          </>
        )}
      </div>

      {/* ══ 2 · LA CASA ══ */}
      <div className="mt-9 flex min-h-0 flex-col lg:mt-0">
        <Rotulo>Qué se come</Rotulo>

        {!comida && !cena ? (
          <Nada>Hoy no hay menú puesto.</Nada>
        ) : (
          <div className="shrink-0 space-y-2.5">
            <Plato
              momento="Comida"
              que={comida?.que ?? null}
              lleva={loQueLleva.get(comida?.receta_id ?? '')?.length ?? 0}
              mirado={Boolean(comida?.comprobado_en)}
              faltan={comida?.faltan?.length ?? 0}
            />
            <Plato
              momento="Cena"
              que={cena?.que ?? null}
              lleva={loQueLleva.get(cena?.receta_id ?? '')?.length ?? 0}
              mirado={Boolean(cena?.comprobado_en)}
              faltan={cena?.faltan?.length ?? 0}
            />
          </div>
        )}

        {/*
          ── LA COMPRA ──

          Es la única de las cosas de esta pantalla que un aparato
          PUEDE tocar: su nivel en `compra` es `anadir`, a propósito,
          porque una tableta colgada en la cocina existe sobre todo
          para apuntar que se ha acabado la leche.

          En una columna y no en dos: la columna del centro mide ahora
          un tercio de la pared, y «bolsas de basura» partido en dos
          renglones dentro de media columna no se lee mejor que en una.
        */}
        {laCompra.length > 0 && (
          <>
            <div className="mt-9 flex shrink-0 items-baseline gap-4">
              <Rotulo>Falta en casa</Rotulo>
              <p className="mb-3 text-[19px] font-extrabold text-tinta-suave">
                {laCompra.length === 1 ? '1 cosa' : `${laCompra.length} cosas`}
              </p>
            </div>

            <div
              className="flex min-h-0 flex-1 flex-col rounded-[28px] border bg-superficie px-6 py-4"
              style={{ borderColor: 'var(--t-borde)', borderLeft: `6px solid ${AMBITO.oliva}` }}
            >
              <LoQueQuepa hueco={4}>
                {laCompra.map((c) => (
                  <p
                    key={c.id}
                    className="flex items-start gap-2.5 text-[21px] font-extrabold leading-snug text-tinta"
                  >
                    <span
                      className="mt-[10px] block h-[7px] w-[7px] shrink-0 rounded-full"
                      style={{ background: AMBITO.oliva }}
                    />
                    <span className="min-w-0">{c.que}</span>
                  </p>
                ))}
              </LoQueQuepa>
            </div>
          </>
        )}
      </div>

      {/* ══ 3 · LO QUE VIENE ══ */}
      {/*
        `pb-24` en grande y no en las otras dos: el micrófono está
        fijo abajo a la derecha, o sea encima de esta columna. Sin ese
        hueco se comería las dos últimas filas del mes.
      */}
      <div className="mt-9 flex min-h-0 flex-col lg:mt-0 lg:pb-24">
        {/*
          ── EL TIEMPO ──

          Lo primero que mira cualquiera por la mañana en una cocina. Y
          en una casa con finca no es curiosidad: es si hay que regar,
          si se puede tender y si conviene adelantar la recogida.

          Si la previsión no llega, este bloque no se pinta — ni cartel
          de error ni hueco gris. Lo decide `tiempo.tsx`.
        */}
        <div className="shrink-0">
          <Tiempo />
        </div>

        {luego.length > 0 && (
          <>
            <div className="mt-9 shrink-0">
              <Rotulo>Después</Rotulo>
            </div>
            <LoQueQuepa>
              {luego.map((c) => (
                <Cosa
                  key={c.id}
                  titulo={c.titulo}
                  cuando={diaCorto(c.fecha, Number(hoy.slice(0, 4)))}
                  talla="columna"
                />
              ))}
            </LoQueQuepa>
          </>
        )}

        {/*
          ── EL MES ──

          Abajo del todo, la misma rejilla que en el Calendario: hoy en
          círculo, un punto en los días que tienen algo, y la semana en
          curso teñida.

          No es repetir el Calendario: es la pregunta que ninguna de
          las listas de esta pantalla contesta — «¿en qué parte del mes
          estamos?» y «el día 4, ¿qué día cae?». Sin un mes delante eso
          se cuenta con los dedos.
        */}
        <div className="mt-9 shrink-0">
          <Rotulo>El mes</Rotulo>
          <Mes hoy={hoy} conAlgo={conAlgo} lunes={elLunesDe(hoy)} />
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
    <div
      className="flex items-center gap-4 rounded-[24px] border bg-superficie px-5 py-3.5"
      style={{
        borderColor: 'var(--t-borde)',
        borderLeft: `6px solid ${AMBITO.arena}`,
      }}
    >
      <span
        className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[16px]"
        style={{
          background: `color-mix(in srgb, ${AMBITO.arena} 16%, var(--t-superficie))`,
          color: AMBITO.arena,
        }}
      >
        <Ico nombre="taza" tam={24} grosor={2.1} />
      </span>
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
