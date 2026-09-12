import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacio } from '@/lib/espacio'
import { genteDeLaCasa, elAsesor } from '@/lib/gente'
import { cuantasNotas } from '@/lib/notas'
import { loDeHoy } from '@/lib/rutinas'
import { hoyAqui } from '@/lib/tablon'
import Barra from '../barra'
import HubiCaja from '../hubi-caja'
import Cabecera from '../cabecera'
import Encabezado from '../encabezado'
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
  const [{ count: porComprar }, notas, deHoy, laGestoria] = await Promise.all([
    supabase
      .from('compra')
      .select('id', { count: 'exact', head: true })
      .eq('hogar_id', hogarId)
      .eq('comprado', false)
      .is('archivado_en', null),

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
  ])

  const hechas = deHoy.filter((r) => r.hecha).length

  /*
    La compra, los menús y lo de hoy los ve todo el mundo. El asesor,
    solo la familia — y a él mismo no se le enseña una tarjeta que
    lleva a hablar consigo mismo.
  */
  const veAsesor = !soyLaAyuda && !soyElAsesor && laGestoria !== null

  return (
    <main className="min-h-screen pb-40 lg:pb-16">
      <Cabecera ancho>
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
          caja={<HubiCaja donde="dia" />}
        />
      </Cabecera>

      <div className="columna pt-1">
        {/*
          La caja de HUBI. La misma que en Inicio y en Papeles, con la
          sugerencia de aquí: lo que cambia entre pantallas es lo que
          se propone, no lo que hace.
        */}
        {/* En grande sube a la banda de arriba, con el resto de las
            acciones de HUBI. */}
        <div className="pb-1.5 lg:hidden">
          <HubiCaja donde="dia" />
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
        <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {/*
          ── LA COMPRA, LA PRIMERA ──

          Es lo que más se usa de todo HUBI: un papel se guarda una vez
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
      </div>

      <Barra activa="dia" />
    </main>
  )
}
