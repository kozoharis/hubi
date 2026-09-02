import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../barra'
import Cabecera from '../cabecera'
import { Ico } from '../iconos'
import Lista from './lista'
import Mes from './mes'

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
  const enMes = p.vista === 'mes'

  const supabase = await clienteSesion()
  if (!(await quien(supabase))) redirect('/entrar')

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <div className="flex h-12 items-center">
          <h1 className="text-[27px] font-extrabold tracking-tight">Agenda</h1>
        </div>

        {/* Las dos formas de mirar lo mismo. Con texto, no solo icono:
            un dibujo suelto obliga a adivinar. */}
        <div className="mt-2 flex gap-2" role="group" aria-label="Cómo verlo">
          <Ojo texto="Lista" icono="check" puesto={!enMes} href="/agenda" />
          <Ojo texto="Mes" icono="calendario" puesto={enMes} href="/agenda?vista=mes" />
        </div>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-2">
        {enMes ? (
          <Mes mes={p.mes} dia={p.dia} de={p.de} />
        ) : (
          <Lista ver={p.ver} semana={p.semana} de={p.de} />
        )}
      </div>

      <Barra activa="agenda" />
    </main>
  )
}

function Ojo({
  texto,
  icono,
  puesto,
  href,
}: {
  texto: string
  icono: 'check' | 'calendario'
  puesto: boolean
  href: string
}) {
  return (
    <Link
      href={href}
      aria-current={puesto ? 'page' : undefined}
      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[15.5px] font-extrabold"
      style={
        puesto
          ? { background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }
          : {
              background: 'var(--t-superficie)',
              color: 'var(--t-tinta-suave)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      <Ico nombre={icono} tam={19} grosor={2.2} />
      {texto}
    </Link>
  )
}
