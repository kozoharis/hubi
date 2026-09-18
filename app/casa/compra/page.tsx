import { laPared, lasQueSeVenEnLaCocina } from '@/lib/pared'
import { loQueSeOfrece } from '@/lib/lo-de-siempre'
import { pasilloDe, PASILLOS } from '@/lib/comprables'
import { hoyAqui } from '@/lib/tablon'
import { comoSeLlamaElDia } from '@/lib/menus'
import { Rotulo } from '../rotulo'
import Lista, { type Cosa, type Grupo, type ParaUnMenu, type PorPasillo } from './lista'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LA COMPRA · la razón de que haya una tableta en una cocina
  ═══════════════════════════════════════════════════════════════

  Se acaba la leche, se apunta la leche. Dos pasos hasta la pared y ya
  está — sin buscar el móvil, sin desbloquearlo, sin abrir nada.

  ─────────────────────────────────────────────────────────────
  Y DESDE EL PASO 87, ORDENADA POR PARA QUÉ ES

  Haris: *«juega un poco con todo el espacio para que pueda ser
  divertido y entendible qué es para qué: casa general, menú (qué
  menú)… tal vez cuándo hay que comprarlo, sobre todo si es para el
  menú, colocar una nota, porque sin ello no se puede cocinar y nos
  quedamos sin menú y luego a improvisar»*.

  Y eligió, entre las tres maneras posibles de ordenar esta pantalla,
  **por para qué es**. Es la decisión de fondo y conviene dejarla
  escrita, porque la alternativa era razonable:

      POR PARA QUÉ ES   ·  primero lo del menú, con su día y su plato;
                           debajo, lo de la casa. Sirve para decidir
                           EN CASA: qué es lo que no puede faltar.

      POR DÓNDE SE COMPRA · primero los pasillos del súper. Sirve para
                           el carro: se recorre la tienda una vez.

  Se hacen las dos, pero una manda: **las zonas son el para qué, y los
  pasillos viven DENTRO de cada zona.** Así, en casa se lee «esto es de
  la cena del jueves», y en el súper se sigue yendo por pasillos sin
  cruzar la tienda tres veces.

  ─────────────────────────────────────────────────────────────
  UNA COSA CON MENÚ SALE UNA SOLA VEZ

  Lo que viene de un menú se apuntó en una lista, así que también
  encajaría en «de casa» o en su lista. Sale SOLO en su menú: dos
  renglones iguales en dos sitios de la misma pantalla se compran dos
  veces.
*/

/* El día de después, en la misma forma que se guarda. */
function elDiaSiguiente(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/* Cuándo hace falta, dicho como se dice en una casa. */
function cuandoEs(fecha: string, hoy: string): string {
  if (fecha < hoy) return 'Era para antes'
  if (fecha === hoy) return 'Hoy'
  if (fecha === elDiaSiguiente(hoy)) return 'Mañana'
  return `El ${comoSeLlamaElDia(fecha).split(' ')[0].toLowerCase()}`
}

/* Lo que se compra, repartido por zonas de la tienda. Solo las zonas
   que tengan algo: un rótulo «Congelados» encima de nada es un renglón
   que hay que leer para descubrir que no dice nada. */
function porPasillos(cosas: Cosa[]): PorPasillo[] {
  return PASILLOS.map((pasillo) => ({
    pasillo,
    cosas: cosas.filter((c) => pasilloDe(c.que) === pasillo),
  })).filter((z) => z.cosas.length > 0)
}

export default async function Compra() {
  const { supabase, casa } = await laPared()
  const hoy = hoyAqui()

  const CON = 'id, que, comprado, lista_id, para_menu_id'
  const SIN = 'id, que, comprado, lista_id'

  const [laCompra, lasListas, historia] = await Promise.all([
    /*
      Con `para_menu_id` y, si la base todavía no lo tiene, sin él. Es
      la red de siempre: Postgres rechaza la consulta ENTERA cuando
      falta una columna, no esa columna. Sin la red, un paso sin dar
      dejaría la compra en blanco — que en esta pantalla significa «no
      falta nada en casa», o sea una mentira.
    */
    (async () => {
      const q = (columnas: string) =>
        supabase
          .from('compra')
          .select(columnas)
          .eq('hogar_id', casa)
          .is('archivado_en', null)
          .order('comprado', { ascending: true })
          .order('creado_en', { ascending: true })
          .limit(120)

      const primera = await q(CON)
      if (!primera.error) return (primera.data ?? []) as unknown as Cosa[]

      const segunda = await q(SIN)
      return (segunda.data ?? []) as unknown as Cosa[]
    })(),
    /*
      Las listas que se ven aquí: la de siempre de la casa —que es
      donde apunta esta misma pantalla— y las que alguien haya marcado
      (paso 77).

      ⚠️  Antes aquí SOLO estaban las marcadas, y ése era el fallo de
      «apunto la leche y no sale»: la pared apuntaba en una lista y
      miraba en otra. Está contado entero en `lasQueSeVenEnLaCocina`.
    */
    lasQueSeVenEnLaCocina(supabase, casa),
    /*
      Lo ya comprado en esta casa, para poder ofrecerlo sin escribirlo.
      Es la misma fuente que en el móvil: la compra archivada. Si falla,
      se ofrece solo lo corriente — que es exactamente lo que pasa en
      una casa recién empezada.
    */
    (async () => {
      try {
        const { data, error } = await supabase
          .from('compra')
          .select('que')
          .eq('hogar_id', casa)
          .not('archivado_en', 'is', null)
          .limit(600)
        if (error) return [] as string[]
        return ((data ?? []) as { que: string }[]).map((c) => c.que)
      } catch {
        return [] as string[]
      }
    })(),
  ])

  /*
    ── LOS MENÚS DE LOS QUE VIENE ALGO ──

    Se piden solo los que hagan falta, por su identificador. Y desde el
    paso 85 una comida puede tener varios platos, así que puede haber
    dos filas del mismo día y momento: se juntan con un punto medio,
    igual que en la pared de Hoy.
  */
  const deMenus = [...new Set(laCompra.map((c) => c.para_menu_id).filter(Boolean))] as string[]

  const susMenus =
    deMenus.length === 0
      ? []
      : (
          (
            await supabase
              .from('menus')
              .select('id, fecha, momento, que')
              .eq('hogar_id', casa)
              .in('id', deMenus)
          ).data ?? []
        ) as { id: string; fecha: string; momento: string; que: string | null }[]

  const porId = new Map(susMenus.map((m) => [m.id, m]))

  /*
    Una zona por COMIDA, no por plato: si la cena del jueves son
    lentejas y merluza, lo que falta para las dos se compra junto y se
    lee junto.
  */
  const porComida = new Map<string, ParaUnMenu>()

  for (const c of laCompra) {
    const m = c.para_menu_id ? porId.get(c.para_menu_id) : undefined
    if (!m) continue

    const clave = `${m.fecha}·${m.momento}`
    const platos = susMenus
      .filter((x) => x.fecha === m.fecha && x.momento === m.momento)
      .map((x) => (x.que ?? '').trim())
      .filter(Boolean)
      .join(' · ')

    const ya = porComida.get(clave)
    if (ya) {
      ya.cosas.push(c)
    } else {
      porComida.set(clave, {
        clave,
        fecha: m.fecha,
        momento: m.momento === 'cena' ? 'Cena' : 'Comida',
        platos,
        cuando: cuandoEs(m.fecha, hoy),
        /* Hoy o mañana: eso es lo que hay que comprar hoy o no se
           cocina. Lo del sábado puede esperar. */
        apura: m.fecha <= elDiaSiguiente(hoy),
        cosas: [c],
      })
    }
  }

  /* Lo de antes primero: en una compra el único orden que importa es
     que lo de mañana va delante de lo del sábado. */
  const menus = [...porComida.values()].sort((a, b) =>
    a.fecha === b.fecha ? a.momento.localeCompare(b.momento) : a.fecha.localeCompare(b.fecha)
  )

  /* Y lo que no viene de ningún menú, por su lista y por pasillos. */
  const sinMenu = laCompra.filter((c) => !c.para_menu_id)

  const grupos: Grupo[] = [
    { id: null, nombre: null, zonas: porPasillos(sinMenu.filter((c) => !c.lista_id)) },
    ...lasListas.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      zonas: porPasillos(sinMenu.filter((c) => c.lista_id === l.id)),
    })),
  ]

  const visibles = [
    ...menus.flatMap((m) => m.cosas),
    ...grupos.flatMap((g) => g.zonas.flatMap((z) => z.cosas)),
  ]
  const faltan = visibles.filter((c) => !c.comprado).length
  const delMenu = menus.flatMap((m) => m.cosas).filter((c) => !c.comprado).length

  /*
    Los botones de apuntar sin escribir. Se calculan con TODA la compra
    abierta —no solo con la que se ve— para no ofrecer algo que ya está
    apuntado en una lista que aquí no sale: alguien lo tocaría, se
    apuntaría una segunda leche y en el súper acabarían dos.
  */
  const sugerencias = loQueSeOfrece(historia, laCompra.map((c) => c.que))

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <Rotulo>La compra</Rotulo>
        <p className="text-[20px] font-extrabold text-tinta-suave">
          {faltan === 0 ? 'No falta nada' : faltan === 1 ? 'Falta 1 cosa' : `Faltan ${faltan} cosas`}
        </p>
        {/* Y de ésas, cuántas son de un menú. Es el dato que decide si
            hay que ir hoy al súper o puede esperar. */}
        {delMenu > 0 && (
          <p className="text-[20px] font-extrabold" style={{ color: 'var(--t-alerta)' }}>
            {delMenu === 1 ? '1 es para un menú' : `${delMenu} son para los menús`}
          </p>
        )}
      </div>

      <Lista menus={menus} grupos={grupos} sugerencias={sugerencias} />
    </section>
  )
}
