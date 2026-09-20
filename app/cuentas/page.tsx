import Link from '@/app/enlace'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { actividadesDe } from '@/lib/actividades'
import { gastadoEnCasa } from '@/lib/gastos-casa'
import Barra from '../barra'
import MappelCaja from '../mappel-caja'
import Cabecera from '../cabecera'
import Encabezado from '../encabezado'
import { Ico } from '../iconos'
import { Fila, PastillaAmbito, seccionPintada, TarjetaAccion, Vacio } from '../piezas'
import NuevaActividad from '../ajustes/nueva-actividad'
import { elEspacio, elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  CUENTAS · una de las cinco pestañas
  ═══════════════════════════════════════════════════════════════

  Todo el dinero de la casa en un sitio: las actividades con su
  balance, lo que se va en la casa y lo que se paga todos los meses.

  ─────────────────────────────────────────────────────────────
  POR QUÉ EXISTE, Y NO ES SOLO ORDEN

  Las actividades ESTABAN en la barra, cada una con su pestaña: aquí
  la Finca y Los Helechos. Eso tenía dos problemas.

  El primero, que la barra no tenía forma fija —tres funciones y dos
  nombres propios que cambian en cada casa—, así que no se podía
  aprender ni explicar por teléfono.

  El segundo es el que de verdad dolía: con esas dos ocupando sitio no
  quedaba hueco para nada más, y La compra, los Menús, las Notas, La
  casa y el asesor acababan todos colgando del Inicio. Mil doscientas
  líneas de Inicio, y media pantalla de scroll para llegar al médico
  de las diez.

  Juntándolas aquí se abre ese hueco. El precio está dicho y aceptado:
  quien abre la Finca a diario paga un toque más.

  ─────────────────────────────────────────────────────────────
  Y EL DINERO DE LA CASA ESTABA EN TRES SITIOS

  «Cuentas de casa» colgaba del Inicio, «Pagos fijos» no colgaba de
  ningún sitio —había que saberse la dirección— y cada actividad iba
  por su cuenta. Tres maneras de mirar lo mismo. Ahora es una.
*/
export default async function Cuentas() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const hogarId = await elEspacio(supabase)
  if (!hogarId) redirect('/empezar')

  const actividades = await actividadesDe(supabase)

  /*
    El balance de cada actividad este mes, y lo de la casa, a la vez.

    Los movimientos se piden UNA vez y se reparten aquí, en vez de una
    consulta por actividad: con ocho obras serían ocho viajes a la base
    de datos para pintar una pantalla, y eso se nota en un móvil con
    mala cobertura.
  */
  const hoy = new Date()
  const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`

  const espacio = await elEspacioO(supabase)
  const [{ data: categorias }, { data: movimientos }, gastoCasa, previstos] = await Promise.all([
    supabase.from('categorias').select('id, padre_id').eq('hogar_id', espacio),
    supabase
      .from('movimientos')
      .select('tipo, importe, categoria_id')
      .eq('hogar_id', espacio)
      .gte('fecha', `${mes}-01`)
      .lte('fecha', `${mes}-31`),
    gastadoEnCasa(supabase),
    /*
      ── LO QUE ESTÁ APUNTADO PERO NADIE HA CONFIRMADO ──

      Los pagos fijos se apuntan solos cuando les toca —si no, las
      cuentas estarían siempre incompletas— pero nacen marcados como
      previstos: MAPPEL no los ha visto pagar, los ha supuesto porque
      tocaba.

      Hasta hoy eso sólo se veía entrando en Pagos fijos, que es una
      pantalla a la que se entra cuando te acuerdas. Y es justo el
      dato que hace que un balance esté bien o mal.

      Envuelto, como todo lo del SQL 47: sin la columna `previsto`
      esta consulta falla entera y lo que se pierde es el aviso, no la
      pantalla.
    */
    supabase
      .from('movimientos')
      .select('importe, categoria_id')
      .eq('hogar_id', espacio)
      .eq('previsto', true)
      .limit(200)
      .then(
        (r: { data: { importe: number; categoria_id: string | null }[] | null }) => r.data ?? [],
        () => [] as { importe: number; categoria_id: string | null }[]
      ),
  ])

  /*
    ═══════════════════════════════════════════════════════════════
    AQUÍ CADA CUENTA DECÍA «+0 €», Y ERA VERDAD
    ═══════════════════════════════════════════════════════════════

    Haris, mirando la lista: *«no pongas lo de +0 € que el balance
    aparezca una vez dentro»*.

    El «+0 €» no era un fallo: era el balance DEL MES en curso, y el
    día 2 de mes es cero en todas las cuentas de todas las casas del
    mundo. O sea que la primera cosa que se leía al abrir Cuentas era
    un número correcto que no dice nada — y que encima parece una
    avería, porque un cero verde con un más delante se lee como «aquí
    no hay nada».

    Lo que sí se viene a saber de un vistazo es SI ESTÁ PASANDO ALGO:
    cuánto se ha apuntado y si queda algo por confirmar. El balance
    está dentro, una vez, grande y con su periodo elegible, que es
    donde un número así significa algo.
  */
  const apuntes = new Map<string, number>()
  const sinConfirmar = new Map<string, number>()

  for (const a of actividades) {
    const suyas = ramaDe(categorias ?? [], a.id)
    apuntes.set(
      a.id,
      (movimientos ?? []).filter(
        (m) => m.categoria_id && suyas.has(m.categoria_id as string)
      ).length
    )
    sinConfirmar.set(
      a.id,
      previstos.filter((m) => m.categoria_id && suyas.has(m.categoria_id)).length
    )
  }

  /* Y el total, para la banda de arriba. Se cuentan TODOS los de la
     casa, también los que no cuelgan de ninguna actividad: un recibo
     de la luz de casa sin confirmar es exactamente igual de urgente
     que uno de la finca. */
  const porConfirmar = previstos.length
  const euroPorConfirmar = previstos.reduce((s, m) => s + Number(m.importe), 0)

  const nombreMes = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(hoy)

  return (
    <main className="min-h-dvh pb-40 lg:pb-16">
      {/* El «volver» solo en el móvil: en grande el rail está a la
          vista y el Inicio está a un toque, siempre en el mismo sitio.
          Una flecha atrás encima de una navegación permanente es un
          segundo camino para lo mismo. */}
      <Cabecera trabajo>
        <div className="lg:hidden">
          {/*
            AQUÍ NO VA UN «VOLVER».

            Ésta es una de las cinco pestañas, y una pestaña no cuelga
            de ninguna parte: la navegación es la barra de abajo (o el
            rail, en grande). Papeles y Agenda nunca lo tuvieron;
            Cuentas y el Día a día sí, y eso hacía que dos de las cinco
            parecieran pantallas de dentro de otra.

            El botón de atrás se queda donde SÍ significa algo: en las
            pantallas que cuelgan de una pestaña — una carpeta, los
            pagos, los menús, una tarea.
          */}
          <div className="flex h-14 items-center gap-3">
            <PastillaAmbito icono="euro" ambito="pizarra" tam={44} />
            <h1 className="t-titulo">Cuentas</h1>
          </div>
        </div>

        <Encabezado
          icono="euro"
          ambito="pizarra"
          titulo="Cuentas"
          pie={`Todo el dinero de la casa · ${nombreMes}`}
          caja={<MappelCaja donde="cuentas" />}
        />
      </Cabecera>

      <div className="ancho-trabajo pt-1">
        {/*
          La caja de MAPPEL. La misma que en Inicio y en Papeles, con la
          sugerencia de aquí: lo que cambia entre pantallas es lo que
          se propone, no lo que hace.
        */}
        {/* En grande la caja sube a la banda de arriba, con el resto
            de las acciones. */}
        <div className="mb-4 lg:hidden">
          <MappelCaja donde="cuentas" />
        </div>

        {/*
          ══ LO QUE LLEVAS Y LO QUE SE VA ══

          Dos bloques que no se comparan entre sí y por eso pueden ir
          en paralelo.

          A la izquierda LAS ACTIVIDADES: la finca, la obra, los pisos.
          Cada una con su balance, y ahí la pregunta es «¿cómo va?».

          A la derecha LA CASA: los gastos corrientes y lo que se paga
          todos los meses. La pregunta es otra —«¿cuánto se va sin que
          nadie lo mire?»— y mezclarlas en una sola tira hacía que lo
          de la casa quedara siempre debajo, al final del todo, que es
          donde se deja de mirar.

          En el móvil siguen una detrás de otra y en el mismo orden.
        */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">

        <section className="lg:col-start-1 lg:row-start-1">
        {/*
          ══ LO QUE PIDE ATENCIÓN ══

          Arriba del todo y SÓLO cuando hay algo. Un recuadro
          permanente diciendo «no hay nada pendiente» es ruido en la
          pantalla que se abre para mirar el dinero, y además enseña a
          no mirarlo.

          Es el mismo principio que lo vencido en la Agenda: lo que
          reclama algo no se esconde detrás de un botón que hay que
          saber que existe.
        */}
        {porConfirmar > 0 && (
          <Link
            href="/pagos"
            className="tocable mt-4 flex items-center gap-3.5 rounded-[20px] border px-4 py-3.5 lg:mt-0"
            style={{ borderColor: 'var(--t-alerta)', background: 'var(--t-alerta-velo)' }}
          >
            <span
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px]"
              style={{ background: 'var(--t-alerta)', color: '#FFFFFF' }}
            >
              <Ico nombre="reloj" tam={22} grosor={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="t-tarjeta block">
                {porConfirmar === 1
                  ? '1 apunte sin confirmar'
                  : `${porConfirmar} apuntes sin confirmar`}
              </span>
              <span className="t-apoyo mt-0.5 block">
                {Math.round(euroPorConfirmar).toLocaleString('es-ES')} € que mappel ha
                apuntado porque tocaba, pero no ha visto pagar
              </span>
            </span>
            <Ico nombre="flecha" tam={21} grosor={2.3} className="shrink-0" />
          </Link>
        )}

        {/* ══ LAS ACTIVIDADES ══ */}
        {actividades.length > 0 ? (
          <>
            <h2 className={`t-seccion mt-4 ${porConfirmar > 0 ? 'lg:mt-7' : 'lg:mt-0'}`}>
              Cómo va cada una
            </h2>
            <p className="t-apoyo mt-1">Entra en cada una para ver su balance</p>

            <ul className="mt-3 space-y-2.5">
              {actividades.map((a) => {
                const cuantos = apuntes.get(a.id) ?? 0
                const suyosSinConfirmar = sinConfirmar.get(a.id) ?? 0
                const pintada = seccionPintada(a.segmento)
                return (
                  <li key={a.id}>
                    <Fila href={a.ruta} alto="alta" ambito={pintada.ambito}>
                      <PastillaAmbito icono={pintada.icono} ambito={pintada.ambito} tam={48} />
                      <span className="min-w-0 flex-1">
                        <span className="t-tarjeta block truncate">{a.nombre}</span>
                        {/* Qué está pasando en esta cuenta, en una
                            línea: cuánto se ha apuntado este mes y si
                            queda algo por confirmar.

                            Sin color de estado. El color aquí sería el
                            del signo de un balance, y el balance ya no
                            está: teñir de verde «12 apuntes» sería
                            decir que doce apuntes son buenos, que es
                            una opinión que nadie ha pedido. */}
                        <span className="t-apoyo mt-0.5 block">
                          {cuantos === 0
                            ? `Nada apuntado en ${nombreMes}`
                            : `${cuantos} ${cuantos === 1 ? 'apunte' : 'apuntes'} en ${nombreMes}`}
                          {suyosSinConfirmar > 0 && (
                            <span style={{ color: 'var(--t-alerta)' }}>
                              {' · '}
                              {suyosSinConfirmar} sin confirmar
                            </span>
                          )}
                        </span>
                      </span>
                      <Ico nombre="flecha" tam={21} grosor={2.3} className="shrink-0" />
                    </Fila>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <div className="mt-4">
            <Vacio
              titulo="Todavía no llevas las cuentas de nada"
              explicacion="Una finca, una obra, unos pisos… aquí abajo se empieza."
            />
          </div>
        )}

        {/* Crear una actividad desde aquí. Mandar a Ajustes a alguien
            que está mirando justo sus cuentas es hacerle dar un rodeo
            para volver al mismo sitio.

            Debajo de las actividades y no al final de la pantalla: es
            «y una más», y eso se entiende pegado a la lista a la que
            se añade, no después de los gastos de la casa. */}
        <div className="mt-6">
          <NuevaActividad />
        </div>
        </section>

        <section className="lg:col-start-2 lg:row-start-1">
        {/*
          ══ LA CASA ══

          Lo que se va fuera de las actividades: la compra, el taller,
          las reparaciones. Es lo que estaba en el Inicio con el nombre
          «Cuentas de casa» y una tarjeta morada.

          Va SIEMPRE, aunque no haya nada apuntado: es el sitio donde
          se mira, y si desapareciera cuando está a cero habría que
          recordar que existe.
        */}
        <h2 className="t-seccion mt-8 lg:mt-0">La casa</h2>
        <p className="t-apoyo mt-1">Lo que no es de ninguna actividad</p>

        <div className="mt-3 space-y-2.5">
          <TarjetaAccion
            href="/gastos"
            icono="euro"
            ambito="arena"
            titulo={
              gastoCasa.total > 0
                ? `${Math.round(gastoCasa.total).toLocaleString('es-ES')} € este trimestre`
                : 'Gastos de la casa'
            }
            pie={
              gastoCasa.total > 0
                ? gastoCasa.mayor
                  ? `Lo que más, ${gastoCasa.mayor.toLowerCase()}`
                  : 'Ver el desglose'
                : 'Todavía no hay nada apuntado'
            }
          />

          {/*
            Y los pagos fijos, que hasta hoy no colgaban de NINGÚN
            sitio: había que saberse la dirección de memoria. Internet,
            el teléfono, los seguros — justamente el dinero que se va
            solo y que nadie fotografía.
          */}
          <TarjetaAccion
            href="/pagos"
            icono="reloj"
            ambito="pizarra"
            titulo="Lo que se paga todos los meses"
            pie="Internet, teléfono, seguros, suscripciones"
          />
        </div>
        </section>

        </div>
      </div>

      <Barra activa="cuentas" />
    </main>
  )
}

/** La rama entera de una raíz: ella y todo lo que cuelga. */
function ramaDe(
  categorias: { id: string; padre_id: string | null }[],
  raizId: string
): Set<string> {
  const hijos = new Map<string, string[]>()
  for (const c of categorias) {
    if (!c.padre_id) continue
    hijos.set(c.padre_id, [...(hijos.get(c.padre_id) ?? []), c.id])
  }

  const dentro = new Set<string>([raizId])
  const cola = [raizId]
  while (cola.length) {
    const actual = cola.pop()!
    for (const h of hijos.get(actual) ?? []) {
      if (dentro.has(h)) continue
      dentro.add(h)
      cola.push(h)
    }
  }
  return dentro
}
