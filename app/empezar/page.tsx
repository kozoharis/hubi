import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { miHogar } from '@/lib/hogar'
import { leerPerfil } from '@/lib/perfil'
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

  return <Empezar nombre={perfil.nombre.split(' ')[0]} />
}
