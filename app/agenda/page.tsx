import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../barra'
import MappelCaja from '../mappel-caja'
import Cabecera from '../cabecera'
import Encabezado from '../encabezado'
import { PastillaAmbito, Pildora } from '../piezas'
import Lista from './lista'
import Mes from './mes'
import Dia from './dia'
import { enlaceAgenda, lunesDeISO } from '@/lib/agenda-enlace'
import { hoyAqui } from '@/lib/tablon'

export const dynamic = 'force-dynamic'

/*
  La Agenda.

  Antes eran dos pestañas —Tareas y Calendario— que leían de la MISMA
  tabla. Una lista y un mes de lo mismo. Tenerlas separadas obligaba a
  Juan Miguel a decidir dónde buscar algo que estaba en los dos sitios,
  que es justo la distinción que el punto 18 dice que no debe existir
  para ellos:

    "No quiero que exista una diferencia conceptual complicada entre
     evento, tarea, recordatorio y deadline. Para ellos todo debe ser:
     COSAS QUE TENGO QUE RECORDAR."

  Ahora es una sola sección con dos maneras de mirarla. Y de paso quedó
  libre la quinta pestaña, que es la que ocupa Los Helechos.
*/

export default async function Agenda({
  searchParams,
}: {
  searchParams: Promise<{
    vista?: string
    ver?: string
    mes?: string
    dia?: string
    semana?: string
    de?: string
    tarea?: string
  }>
}) {
  const p = await searchParams

  /*
    ── TRES ESCALAS, Y SIEMPRE SE SABE EN CUÁL ESTÁS ──

    Semana enseña los siete días resumidos. Mes, los treinta. Y se
    entra a UN día para verlo hora a hora.

    El día no es una tercera pestaña arriba: se llega tocando un día
    en la semana o en el mes, que es como funciona cualquier agenda —
    y poner tres pestañas para dos maneras de mirar y una de entrar
    haría elegir entre cosas que no son comparables.
  */
  const enMes = p.vista === 'mes'
  const enDia = p.vista === 'dia'

  /*
    ── LA AGENDA ENTERA ES PANORÁMICA ──

    Las tres vistas, no sólo la semana.

    Lo estuvo un rato: la semana panorámica y el mes y el día en
    `columna`, «hasta que les tocara su tanda». Y era peor que el
    fallo que arreglaba — dentro de la MISMA pantalla, dos de las tres
    pestañas medían 1100 y la otra llegaba al borde, así que pasar de
    Semana a Mes movía todo de sitio.

    Una pantalla no puede tener dos anchos según la pestaña. O es
    panorámica o no lo es, y la Agenda lo es: el mes es una rejilla de
    siete columnas con su lista al lado, y el día son las horas con su
    contexto al lado. Las tres quieren el ancho entero.
  */

  /*
    ── Y CAMBIAR DE ESCALA NO BORRA DÓNDE ESTABAS ──

    Estos tres botones eran direcciones enteras escritas a mano
    —`/agenda`, `/agenda?vista=mes`—, así que cada uno se llevaba por
    delante el mes, la semana y el filtro de calendario. Mirabas marzo,
    pulsabas «Mes», y aparecías en el mes de hoy.

    Ahora cada escala se lleva lo que le sirve y suelta lo que no:

      Semana  la semana del día que estabas mirando, la pestaña y el filtro
      Mes     el mes que estabas mirando —o el del día o la semana— y el filtro
      El día  el día y el filtro

    Lo que no aplica se quita en vez de arrastrarse: un `ver=hechas`
    colgando de la vista de Mes no hace nada y ensucia la dirección.
  */
  const actuales = {
    vista: p.vista, ver: p.ver, mes: p.mes,
    dia: p.dia, semana: p.semana, de: p.de,
  }

  /* De un día se sale a SU semana y a SU mes, no a los de hoy. */
  const semanaDestino = p.semana ?? (p.dia ? lunesDeISO(p.dia) : null)
  const mesDestino = p.mes ?? (p.dia ?? p.semana)?.slice(0, 7) ?? null

  const supabase = await clienteSesion()
  if (!(await quien(supabase))) redirect('/entrar')

  /*
    ── LOS SEGMENTOS, ESCRITOS UNA VEZ ──

    Los usan las dos cabeceras —la del móvil y la banda de escritorio—
    y llevan dentro toda la lógica de qué semana y qué mes arrastra
    cada uno. Copiarlos sería tener dos sitios donde arreglar el mismo
    enlace, y el enlace de éstos ya se arregló una vez.

    ─────────────────────────────────────────────────────────
    LAS TRES ESTÁN SIEMPRE

    «El día» sólo se pintaba estando dentro de un día, con este
    razonamiento: *es una escala a la que se entra, no una entre la
    que elegir*. Suena bien y es falso en la práctica — el resultado
    era que la fila de pestañas cambiaba de número al moverte, y una
    pestaña que aparece y desaparece deja de leerse como pestaña.

    Ahora son tres siempre, y «El día» lleva al día que estés mirando
    o, si no estás en ninguno, a hoy. Que es lo que cualquiera espera
    que haga un botón que pone «El día».

    ─────────────────────────────────────────────────────────
    Y SE LEEN ENTERAS

    `flex-1` sólo en el móvil, que es donde la fila ocupa el ancho de
    la pantalla y repartirla a partes iguales es lo correcto. En
    grande, cada una mide LO QUE MIDE SU PALABRA: con `flex-1` dentro
    de una banda apretada se encogían hasta salir «Se…» donde pone
    «Semana».

    Una pastilla que hay que adivinar no es una pastilla.
  */
  const diaDestino = p.dia ?? hoyAqui()

  const segmentos = (
    <div className="flex gap-2" role="group" aria-label="Cómo verlo">
      {/* «Semana» y no «Lista»: las dos vistas acaban enseñando una
          lista —al tocar un día del Mes también sale una—, así que
          «Lista» no distinguía nada. Lo que las diferencia es cuánto
          abarcan. */}
      <Pildora
        puesta={!enMes && !enDia}
        className="flex-1 lg:flex-none"
        href={enlaceAgenda(actuales, {
          vista: null, mes: null, dia: null, semana: semanaDestino,
        })}
      >
        Semana
      </Pildora>
      <Pildora
        puesta={enMes}
        className="flex-1 lg:flex-none"
        href={enlaceAgenda(actuales, {
          vista: 'mes', mes: mesDestino, ver: null, semana: null, dia: null,
        })}
      >
        Mes
      </Pildora>
      <Pildora
        puesta={enDia}
        className="flex-1 lg:flex-none"
        href={enlaceAgenda(actuales, {
          vista: 'dia', dia: diaDestino, ver: null, mes: null, semana: null,
        })}
      >
        El día
      </Pildora>
    </div>
  )

  return (
    <main className="min-h-dvh pb-40 lg:pb-16">
      <Cabecera panoramica>
        {/* En el móvil, la cabecera de siempre. */}
        <div className="lg:hidden">
          <div className="flex h-14 items-center gap-3">
            <PastillaAmbito icono="calendario" ambito="azul" tam={44} />
            <h1 className="t-titulo">Agenda</h1>
          </div>
          <div className="mt-2">{segmentos}</div>
        </div>

        {/* En grande, la banda común: identidad a la izquierda,
            acciones a la derecha, y los segmentos debajo del título y
            de su tamaño. */}
        <Encabezado
          icono="calendario"
          ambito="azul"
          titulo="Agenda"
          controles={segmentos}
          caja={<MappelCaja donde="agenda" />}
          accion={{ texto: 'Apuntar algo', href: '/tablon/nuevo', icono: 'mas' }}
        />
      </Cabecera>

      <div className="ancho-panoramica pt-2">
        {/* La caja de MAPPEL, con la sugerencia de aquí. Lo que cambia
            entre pantallas es lo que se propone, no lo que hace.

            En grande sube a la banda de arriba, con el botón de
            apuntar: las acciones van todas juntas y en el mismo sitio
            en todas las pantallas. */}
        <div className="mb-4 lg:hidden">
          <MappelCaja donde="agenda" />
        </div>
        {enDia ? (
          <Dia dia={p.dia} de={p.de} />
        ) : enMes ? (
          <Mes mes={p.mes} dia={p.dia} de={p.de} />
        ) : (
          <Lista ver={p.ver} semana={p.semana} de={p.de} tarea={p.tarea} />
        )}
      </div>

      <Barra activa="agenda" />
    </main>
  )
}
