import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../barra'
import HubiCaja from '../hubi-caja'
import Cabecera from '../cabecera'
import { PastillaAmbito, Pildora } from '../piezas'
import Lista from './lista'
import Mes from './mes'
import Dia from './dia'
import { enlaceAgenda, lunesDeISO } from '@/lib/agenda-enlace'

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

  return (
    <main className="min-h-screen pb-40 lg:pb-16">
      <Cabecera ancho>
        <div className="flex h-14 items-center gap-3">
          <PastillaAmbito icono="calendario" ambito="azul" tam={44} />
          <h1 className="t-titulo">Agenda</h1>
        </div>

        {/* Las dos formas de mirar lo mismo. Con texto, no solo icono:
            un dibujo suelto obliga a adivinar.

            Y son la píldora del sistema: la puesta se rellena de
            tinta, igual que Semana/Mes en cualquier otra pantalla.
            Antes iban con `--t-boton`, el color de antes. */}
        {/* En grande no se estiran a media pantalla: dos botones de
            550 px cada uno para elegir entre semana y mes es una
            botonera de sala de espera. Se quedan del tamaño de su
            palabra. */}
        <div className="mt-2 flex gap-2 lg:max-w-[360px]" role="group" aria-label="Cómo verlo">
          {/* «Semana» y no «Lista»: las dos vistas acaban enseñando una
              lista —al tocar un día del Mes también sale una—, así que
              «Lista» no distinguía nada. Lo que las diferencia es
              cuánto abarcan. */}
          <Pildora
            puesta={!enMes && !enDia}
            className="flex-1"
            href={enlaceAgenda(actuales, {
              vista: null, mes: null, dia: null, semana: semanaDestino,
            })}
          >
            Semana
          </Pildora>
          <Pildora
            puesta={enMes}
            className="flex-1"
            href={enlaceAgenda(actuales, {
              vista: 'mes', mes: mesDestino, ver: null, semana: null, dia: null,
            })}
          >
            Mes
          </Pildora>
          {/* El día solo sale cuando estás dentro de uno: es una
              escala a la que se entra, no una entre la que elegir. Y
              así se puede volver a la semana de un toque. */}
          {enDia && (
            <Pildora
              puesta
              className="flex-1"
              href={enlaceAgenda(actuales, {
                vista: 'dia', ver: null, mes: null, semana: null,
              })}
            >
              El día
            </Pildora>
          )}
        </div>
      </Cabecera>

      <div className="columna pt-2">
        {/* La caja de HUBI, con la sugerencia de aquí. Lo que cambia
            entre pantallas es lo que se propone, no lo que hace. */}
        <div className="mb-4 lg:max-w-[560px]">
          <HubiCaja donde="agenda" />
        </div>
        {enDia ? (
          <Dia dia={p.dia} de={p.de} />
        ) : enMes ? (
          <Mes mes={p.mes} dia={p.dia} de={p.de} />
        ) : (
          <Lista ver={p.ver} semana={p.semana} de={p.de} />
        )}
      </div>

      <Barra activa="agenda" />
    </main>
  )
}
