import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { miHogar } from '@/lib/hogar'
import { casasDe } from '@/lib/casas'
import { leerPerfil } from '@/lib/perfil'
import Casas from '../casas'
import Empezar from './empezar'

export const dynamic = 'force-dynamic'

/*
  La primera pantalla de una persona nueva.

  Quien ya tiene casa no pinta nada aquí: se le devuelve al inicio.
  Una pantalla de «crea tu casa» delante de alguien que ya tiene la
  suya es la clase de cosa que hace dudar de si se ha borrado algo.
*/
export default async function PaginaEmpezar() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  if (await miHogar(supabase, user.id)) redirect('/')

  const perfil = await leerPerfil(supabase, user.id, user.email)

  /*
    ¿LE HAN INVITADO A ALGUNA?

    Sin esto, quien recibe una invitación y entra por primera vez
    acabaría aquí creando SU casa — sin enterarse de que le estaban
    esperando en otra. Y una vez creada la suya, la invitación se
    queda ahí sin que nadie la vea.

    Si hay invitación, se enseña primero y la de crear casa queda
    debajo: quien llega invitado viene a entrar en la casa de alguien,
    no a montar la suya.
  */
  const casas = await casasDe(supabase, user.id)
  const ofrecidas = casas.filter((c) => c.pendiente)

  return (
    <>
      {ofrecidas.length > 0 && (
        <div className="mx-auto w-full max-w-md px-5 pt-6">
          <Casas casas={casas} />
          <p className="mt-5 text-center text-[15.5px] font-semibold leading-snug text-tenue">
            O crea tu propia casa aquí abajo. Puedes tener las dos.
          </p>
        </div>
      )}
      <Empezar nombre={perfil.nombre.split(' ')[0]} />
    </>
  )
}
