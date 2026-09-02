import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Activar from './activar'

export const dynamic = 'force-dynamic'

export default async function Avisos() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  return <Activar clavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''} />
}
