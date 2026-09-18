import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacio } from '@/lib/espacio'
import { genteDeLaCasa, elAsesor } from '@/lib/gente'
import { cuantasNotas, notasDe, conFecha } from '@/lib/notas'
import { loDeHoy } from '@/lib/rutinas'
import { hoyAqui } from '@/lib/tablon'
import Barra from '../barra'
import MappelCaja from '../mappel-caja'
import Cabecera from '../cabecera'
import Encabezado from '../encabezado'
import Link from '@/app/enlace'
import { Ico, type Icono } from '../iconos'
import type { Ambito } from '@/lib/ambitos'
import { ambitoDeColor, PastillaAmbito, TarjetaAccion } from '../piezas'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  EL DÍA A DÍA · una de las cinco pestañas
  ═══════════════════════════════════════════════════════════════

  La compra, los menús, los recados, lo que toca hoy en casa y el
  asesor. Lo que se hace todos los días, junto.

  ─────────────────────────────────────────────────────────────
  POR QUÉ ESTO NO EXISTÍA HASTA HOY

  Porque no cabía. La barra tiene cinco huecos y dos los ocupaban las
  actividades —la Finca y Los Helechos—, así que todo esto colgaba del
  Inicio: cinco tarjetas más el saludo, más hablar, más guardar, más
  lo de hoy, más lo que viene. Mil doscientas líneas y media pantalla
  de scroll para llegar al médico de las diez.

  Las actividades se han ido a Cuentas y aquí está el hueco que
  dejaron. Y el cambio no es de orden: la compra se abre varias veces
  al día y la Finca una vez por semana. Estaba al revés.

  ─────────────────────────────────────────────────────────────
  NO ES UN MENÚ DE CINCO BOTONES

  Ésa era la trampa fácil, y sería mover el problema del Inicio a otra
  pantalla. Cada tarjeta dice CÓMO ESTÁ lo suyo —«3 cosas por coger»,
  «2 de 4», «Silvia te espera»— y muchas veces con leerla basta y no
  hace falta entrar en ninguna.

  ─────────────────────────────────────────────────────────────
  Y CADA UNO VE LO SUYO

  A quien ayuda en casa esta pantalla le va dirigida: la compra, los
  menús y lo que toca hoy son literalmente su trabajo. Lo que no le
  corresponde —el asesor— no le sale, y no por seguridad —de eso se
  encargan las políticas de la base de datos— sino porque una tarjeta
  que no lleva a ningún sitio no se lee como «esto no es para ti», se
  lee como «esto está roto».
*/
/*
  Los platos de una comida, en un renglón. Un punto medio entre ellos,
  que no se confunde con el nombre de un plato como sí hace la coma
  («lentejas con chorizo, y arroz»). Desde el paso 85 una comida puede
  tener varios.
*/
function juntos(menus: { momento: string; que: string | null }[], cual: string): string | null {
  const nombres = menus
    .filter((m) => m.momento === cual)
    .map((m) => (m.que ?? '').trim())
    .filter(Boolean)
  return nombres.length > 0 ? nombres.join(' · ') : null
}

export default async function DiaADia() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const hogarId = await elEspacio(supabase)
  if (!hogarId) redirect('/empezar')

  const gente = await genteDeLaCasa(supabase, hogarId)
  const yo = gente.find((g) => g.id === user.id)
  const soyLaAyuda = yo?.rol === 'ayuda'
  const soyElAsesor = yo?.rol === 'asesor'

  /* ¿Esta casa usa la lista de la compra? Envuelto: la columna es del
     SQL 32 y, sin ella, Postgres rechaza la consulta entera en vez de
     decir «esa columna no existe». */
  let usaCompra = true
  try {
    const { data: casa } = await supabase
      .from('hogares')
      .select('usa_compra')
      .eq('id', hogarId)
      .maybeSingle()
    if (casa && casa.usa_compra === false) usaCompra = false
  } catch {
    /* Sin la columna todavía: se comporta como siempre. */
  }

  /* Las cuatro cuentas, a la vez. Ninguna necesita el resultado de la
     anterior: en fila serían cuatro esperas donde basta una. */
  const [{ count: porComprar, data: laCompra }, notas, deHoy, laGestoria, elMenu, elCorcho] = await Promise.all([
    /*
      ── LAS COSAS, NO SÓLO CUÁNTAS ──

      En el móvil bastaba el número: la tarjeta dice «3 cosas por
      coger» y se entra. En grande hay sitio para enseñarlas, y
      enseñarlas ahorra el viaje entero — la mitad de las veces se
      entra en la compra sólo para acordarse de qué falta.

      Se piden ocho y el recuento exacto a la vez: `count` sin `head`
      devuelve las dos cosas en una sola consulta.
    */
    supabase
      .from('compra')
      .select('id, que, cantidad', { count: 'exact' })
      .eq('hogar_id', hogarId)
      .eq('comprado', false)
      .is('archivado_en', null)
      .order('creado_en', { ascending: true })
      .limit(8),

    cuantasNotas(supabase, user.id),

    loDeHoy(supabase, hogarId, soyLaAyuda ? user.id : null, hoyAqui()),

    /* Cuántas cosas ha dejado el asesor sin ver. Envuelto por lo
       mismo de siempre: si falta la tabla, la pantalla entera no
       puede caerse por una tarjeta. */
    (async () => {
      const suyo = elAsesor(gente)
      if (!suyo) return null
      try {
        const { data } = await supabase
          .from('notas')
          .select('id, vista_en')
          .eq('hogar_id', hogarId)
          .eq('escrita_por', suyo.id)
          .is('guardada_en', null)
          .limit(50)
        return {
          nombre: suyo.nombre.split(' ')[0],
          color: suyo.color,
          esperando: (data ?? []).filter((n) => !n.vista_en).length,
        }
      } catch {
        return { nombre: suyo.nombre.split(' ')[0], color: suyo.color, esperando: 0 }
      }
    })(),

    /*
      ── LO QUE SE COME HOY ──

      La comida y la cena de hoy, nada más. Envuelto porque las tablas
      son del SQL 48: sin ellas esto contesta una lista vacía y la
      pantalla sale igual.
    */
    (async () => {
      try {
        const { data } = await supabase
          .from('menus')
          .select('momento, que')
          .eq('hogar_id', hogarId)
          .eq('fecha', hoyAqui())
        return (data ?? []) as { momento: string; que: string }[]
      } catch {
        return []
      }
    })(),

    /* Y las cuatro últimas del corcho. `notasDe` ya viene envuelto. */
    notasDe(supabase).then((n) => conFecha(n).slice(0, 4)),
  ])

  const hechas = deHoy.filter((r) => r.hecha).length
  const laComida = juntos(elMenu, 'comida')
  const laCena = juntos(elMenu, 'cena')

  /*
    La compra, los menús y lo de hoy los ve todo el mundo. El asesor,
    solo la familia — y a él mismo no se le enseña una tarjeta que
    lleva a hablar consigo mismo.
  */
  const veAsesor = !soyLaAyuda && !soyElAsesor && laGestoria !== null

  return (
    <main className="min-h-dvh pb-40 lg:pb-16">
      <Cabecera trabajo>
        <div className="lg:hidden">
          {/* El volver, solo en el móvil: en grande el rail ya lleva
              al Inicio y está siempre a la vista. */}
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
          <PastillaAmbito icono="taza" ambito="arena" tam={44} />
          {/* Aquí sí se llama por su nombre entero. En la barra pone
              «Día a día» porque a 12 px no cabe más. */}
          <h1 className="t-titulo">El día a día</h1>
        </div>
        </div>

        <Encabezado
          icono="taza"
          ambito="arena"
          titulo="El día a día"
          pie="La compra, la casa, los menús y el corcho"
          caja={<MappelCaja donde="dia" />}
        />
      </Cabecera>

      <div className="ancho-trabajo pt-1">
        {/*
          La caja de MAPPEL. La misma que en Inicio y en Papeles, con la
          sugerencia de aquí: lo que cambia entre pantallas es lo que
          se propone, no lo que hace.
        */}
        {/* En grande sube a la banda de arriba, con el resto de las
            acciones de MAPPEL. */}
        <div className="pb-1.5 lg:hidden">
          <MappelCaja donde="dia" />
        </div>

        {/*
          ══ LAS CINCO, A LA VEZ ══

          Esta pantalla no es una lista que se lee de arriba abajo: son
          cinco sitios distintos —la compra, la casa de hoy, los menús,
          el corcho y el asesor— y se viene aquí sabiendo a cuál se va.

          En el móvil van en fila porque no hay otra, y el orden
          importa: la compra primero, que es lo que se toca todos los
          días.

          En grande no hay motivo para hacer deslizar hasta el corcho.
          Dos por fila y están las cinco delante, cada una con su
          color, y se toca la que se venía a tocar sin leer las otras
          cuatro. El orden se conserva: en una rejilla de dos columnas
          se sigue leyendo izquierda-derecha, arriba-abajo.

          `lg:space-y-0` no es maquillaje: `space-y` mete margen entre
          hermanos y dentro de una rejilla eso desencaja las filas. En
          grande manda `gap`, que es lo que sabe de rejillas.
        */}
        {/* ── LAS CINCO PUERTAS · SÓLO EN EL MÓVIL ──
            En grande, debajo, la pantalla enseña lo que hay dentro. */}
        <div className="space-y-2.5 lg:hidden">
        {/*
          ── LA COMPRA, LA PRIMERA ──

          Es lo que más se usa de todo MAPPEL: un papel se guarda una vez
          por semana, la compra es todos los días. Y el estado va en el
          título, no en el pie: «3 cosas por coger» es la respuesta, no
          una etiqueta.
        */}
        {usaCompra && (
          <TarjetaAccion
            href="/compra"
            icono="bolsa"
            ambito="arena"
            titulo="La compra"
            pie={
              !porComprar
                ? 'La lista está vacía'
                : porComprar === 1
                  ? 'Falta 1 cosa por coger'
                  : `Faltan ${porComprar} cosas por coger`
            }
            /* Con algo apuntado reclama un poco; vacía, no. Un «0» que
               llama la atención es un reproche por algo que no has
               hecho mal. */
            estado={porComprar && porComprar > 0 ? 'atencion' : undefined}
          />
        )}

        {/*
          ── LO QUE TOCA HOY EN CASA ──

          Las rutinas de la semana. Para quien ayuda es su lista; para
          la familia es cómo va el día.
        */}
        {deHoy.length > 0 && (
          <TarjetaAccion
            href="/lacasa"
            icono="check"
            ambito="verde"
            titulo={soyLaAyuda ? 'Lo que te toca hoy' : 'La casa hoy'}
            pie={`${hechas} de ${deHoy.length} hecho${deHoy.length === 1 ? '' : 's'}`}
            estado={hechas === deHoy.length ? 'bien' : undefined}
          />
        )}

        {/*
          ── LOS MENÚS ──

          Debajo de la compra a propósito: son la misma escena. Se mira
          qué toca de cena y de ahí sale lo que falta por comprar.
        */}
        <TarjetaAccion
          href="/menus"
          icono="hoja"
          ambito="oliva"
          titulo="Menús"
          pie="Lo que toca esta semana"
        />

        {/*
          ── EL CORCHO ──

          Lo que hay para ti se dice en el título. Es lo único de esta
          pantalla que te está esperando a TI en concreto, y por eso es
          lo único que puede encenderse.
        */}
        <TarjetaAccion
          href="/notas"
          icono="chincheta"
          ambito="ciruela"
          titulo={
            notas.paraMi > 0
              ? notas.paraMi === 1
                ? 'Hay una nota para ti'
                : `Hay ${notas.paraMi} notas para ti`
              : 'Notas'
          }
          pie={
            notas.puestas === 0
              ? 'Deja un recado en el corcho'
              : notas.puestas === 1
                ? '1 puesta en el corcho'
                : `${notas.puestas} puestas en el corcho`
          }
          estado={notas.paraMi > 0 ? 'atencion' : undefined}
        />

        {/* ── EL ASESOR, CON SU COLOR ── */}
        {veAsesor && laGestoria && (
          <TarjetaAccion
            href="/asesor"
            icono="papel"
            ambito={ambitoDeColor(laGestoria.color)}
            titulo={laGestoria.nombre}
            pie={
              laGestoria.esperando > 0
                ? laGestoria.esperando === 1
                  ? 'Te ha dejado algo'
                  : `Te ha dejado ${laGestoria.esperando} cosas`
                : 'Lo que os habéis dejado'
            }
            estado={laGestoria.esperando > 0 ? 'atencion' : undefined}
          />
        )}
        </div>

        {/*
          ═══════════════════════════════════════════════════════════
          EN GRANDE, LA CASA DE HOY · no un menú de cinco botones
          ═══════════════════════════════════════════════════════════

          Ésta era la pantalla más vacía de MAPPEL en un ordenador:
          cinco tarjetas grandes en la esquina de arriba y medio metro
          de papel debajo. Y el motivo no era el ancho — era que la
          pantalla no tenía contenido: su único trabajo era llevar a
          otras cinco.

          En un teléfono eso está bien, porque no cabe otra cosa y
          porque cada tarjeta ya dice cómo está lo suyo. En un
          ordenador, donde el rail de la izquierda ya lleva a todas
          partes, una pantalla cuyo único trabajo es llevar a otro
          sitio es un paso de más.

          Así que en grande deja de ser un menú y contesta la pregunta
          por la que se entra: **¿qué pasa hoy en casa?** Lo que falta
          por comprar, lo que toca hacer, lo que se come y lo que os
          habéis dejado escrito. Sin pulsar nada.

          ── COLUMNAS DE ALTURA LIBRE ──

          Dos a 1024, tres en un monitor. Y `columns` y no una rejilla
          por lo mismo que en el corcho de Notas: la compra puede
          tener ocho renglones y el menú dos, y una rejilla igualaría
          las dos a la altura de la más alta dejando un palmo de papel
          en blanco.

          ── Y CADA BLOQUE SIGUE SIENDO UNA PUERTA ──

          El título de cada uno lleva a su pantalla. Lo que cambia es
          que ya no hay que entrar para saber qué hay.
        */}
        <div className="hidden lg:block">
          <div className="[&>section]:mb-4 [&>section]:break-inside-avoid lg:columns-2 lg:gap-4 monitor:columns-3">
            {usaCompra && (
              <Bloque
                titulo="La compra"
                icono="bolsa"
                ambito="arena"
                href="/compra"
                pie={
                  (porComprar ?? 0) === 0
                    ? 'La lista está vacía'
                    : `${porComprar} ${porComprar === 1 ? 'cosa' : 'cosas'} por coger`
                }
              >
                {(laCompra ?? []).length === 0 ? (
                  <Callado>No hay nada apuntado.</Callado>
                ) : (
                  <ul className="space-y-1.5">
                    {(laCompra as { id: string; que: string; cantidad: string | null }[]).map((c) => (
                      <li key={c.id} className="flex items-baseline gap-2 text-[15px]">
                        <span aria-hidden className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-apagado" />
                        <span className="min-w-0 flex-1 truncate font-semibold">{c.que}</span>
                        {c.cantidad && (
                          <span className="shrink-0 text-[13px] text-tenue">{c.cantidad}</span>
                        )}
                      </li>
                    ))}
                    {(porComprar ?? 0) > (laCompra ?? []).length && (
                      <li className="text-[13px] text-tenue">
                        y {(porComprar ?? 0) - (laCompra ?? []).length} más
                      </li>
                    )}
                  </ul>
                )}
              </Bloque>
            )}

            <Bloque
              titulo="La casa hoy"
              icono="check"
              ambito="verde"
              href="/lacasa"
              pie={
                deHoy.length === 0
                  ? 'Hoy no toca nada'
                  : `${hechas} de ${deHoy.length} hechos`
              }
            >
              {deHoy.length === 0 ? (
                <Callado>Hoy no hay nada puesto en el plan.</Callado>
              ) : (
                <ul className="space-y-1.5">
                  {deHoy.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 text-[15px]">
                      {/* El tic no es un botón: esta pantalla cuenta lo
                          que hay, y marcar se hace donde se está
                          haciendo el trabajo. Un control que parece
                          pulsable y no lo es sería peor que ninguno. */}
                      <span
                        aria-hidden
                        className={
                          'flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full ' +
                          (r.hecha ? 'text-white' : 'border border-borde')
                        }
                        style={r.hecha ? { background: 'var(--t-bien)' } : undefined}
                      >
                        {r.hecha && <Ico nombre="check" tam={11} grosor={3} />}
                      </span>
                      <span
                        className={
                          'min-w-0 flex-1 truncate font-semibold ' +
                          (r.hecha ? 'text-tenue line-through' : '')
                        }
                      >
                        {r.que}
                      </span>
                      {r.hora && (
                        <span className="shrink-0 text-[13px] tabular-nums text-tenue">
                          {r.hora.slice(0, 5)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>

            <Bloque
              titulo="Hoy se come"
              icono="hoja"
              ambito="oliva"
              href="/menus"
              pie="Lo que toca esta semana"
            >
              {!laComida && !laCena ? (
                <Callado>Hoy no hay nada puesto.</Callado>
              ) : (
                <dl className="space-y-2">
                  <div>
                    <dt className="rotulo">Comida</dt>
                    <dd className="text-[15px] font-semibold">
                      {laComida ?? <span className="text-apagado">Sin poner</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="rotulo">Cena</dt>
                    <dd className="text-[15px] font-semibold">
                      {laCena ?? <span className="text-apagado">Sin poner</span>}
                    </dd>
                  </div>
                </dl>
              )}
            </Bloque>

            <Bloque
              titulo={notas.paraMi > 0
                ? notas.paraMi === 1 ? 'Hay una nota para ti' : `Hay ${notas.paraMi} notas para ti`
                : 'El corcho'}
              icono="chincheta"
              ambito="ciruela"
              href="/notas"
              destacado={notas.paraMi > 0}
              pie={
                notas.puestas === 0
                  ? 'Deja un recado'
                  : `${notas.puestas} ${notas.puestas === 1 ? 'puesta' : 'puestas'}`
              }
            >
              {elCorcho.length === 0 ? (
                <Callado>No hay ninguna nota puesta.</Callado>
              ) : (
                <ul className="space-y-2">
                  {elCorcho.map((n) => (
                    <li key={n.id} className="text-[15px] leading-snug">
                      <span className="line-clamp-2 font-semibold">{n.texto}</span>
                      <span className="mt-0.5 block text-[13px] text-tenue">{n.cuando}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>

            {veAsesor && laGestoria && (
              <Bloque
                titulo={laGestoria.nombre}
                icono="papel"
                ambito={ambitoDeColor(laGestoria.color)}
                href="/asesor"
                destacado={laGestoria.esperando > 0}
                pie={
                  laGestoria.esperando > 0
                    ? laGestoria.esperando === 1
                      ? 'Te ha dejado algo'
                      : `Te ha dejado ${laGestoria.esperando} cosas`
                    : 'Lo que os habéis dejado'
                }
              >
                <Callado>
                  {laGestoria.esperando > 0
                    ? 'Entra a verlo cuando puedas.'
                    : 'Nada nuevo por ahora.'}
                </Callado>
              </Bloque>
            )}
          </div>
        </div>
      </div>

      <Barra activa="dia" />
    </main>
  )
}

/*
  ═══════════════════════════════════════════════════════════════
  UN BLOQUE DE LA CASA
  ═══════════════════════════════════════════════════════════════

  Cabecera con su pastilla de color y su título —que es un enlace a la
  pantalla de esa cosa—, el estado en una línea, y debajo LO QUE HAY.

  ── LA PASTILLA SE QUEDA, EL CHEVRÓN SE VA ──

  La pastilla identifica: reconocer la compra por el color arena es
  lo mismo que se hace en el móvil, en el Inicio y en la pared, y
  quitarlo aquí rompería el idioma.

  El chevrón no: un chevrón promete «te llevo a otra pantalla», y este
  bloque ya te está enseñando lo que hay dentro. Lo que lleva es el
  título, que es lo que se pulsa cuando de verdad hace falta entrar.

  ── Y SÓLO SE ENCIENDE LO QUE TE ESPERA A TI ──

  `destacado` es para las notas que te han dejado y para lo que ha
  dejado el asesor. Es lo único de esta pantalla que reclama algo de
  una persona concreta, y por eso es lo único que puede llevar color
  de fondo. Cinco bloques encendidos serían cinco bloques apagados.
*/
function Bloque({
  titulo,
  pie,
  icono,
  ambito,
  href,
  destacado = false,
  children,
}: {
  titulo: string
  pie: string
  icono: Icono
  ambito: Ambito
  href: string
  destacado?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={
        'rounded-[20px] border px-4 py-4 ' +
        (destacado ? 'border-atencion-velo bg-atencion-velo' : 'border-borde bg-superficie')
      }
    >
      <div className="flex items-start gap-3">
        <PastillaAmbito icono={icono} ambito={ambito} tam={36} />
        <div className="min-w-0 flex-1">
          <Link href={href} className="block">
            <span className="t-tarjeta block truncate">{titulo}</span>
          </Link>
          <span className="mt-0.5 block truncate text-[13.5px] font-bold text-tenue">{pie}</span>
        </div>
      </div>

      <div className="mt-3 border-t border-borde/60 pt-3">{children}</div>
    </section>
  )
}

/** Lo que se dice cuando no hay nada que enseñar. En gris y en una
    línea: un bloque vacío no puede ocupar lo que uno lleno. */
function Callado({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] leading-snug text-tenue">{children}</p>
}
