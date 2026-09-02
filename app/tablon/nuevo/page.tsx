import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Nuevo from './formulario'

export const dynamic = 'force-dynamic'

export default async function PaginaNuevo() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id, nombre')
    .order('nombre')

  return <Nuevo perfiles={perfiles ?? []} yo={user.id} />
}
