import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { miHogar } from '@/lib/hogar'
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

  /*
    ─────────────────────────────────────────────────────────────
    SOLO LOS QUE ESTÁN DENTRO

    «Para quién» no puede ofrecer a alguien que todavía no ha aceptado
    la invitación: dejarle un recado a quien no ha entrado es dejarlo
    en un sitio donde nadie lo va a leer. Y con varias casas, quien
    tenga dos aparece en las dos listas de perfiles.

    Envuelto: si el SQL 34 no está, se comporta como hasta hoy.
  */
  let dentro: string[] | null = null
  try {
    const hogarId = await miHogar(supabase, user.id)
    if (hogarId) {
      const { data, error } = await supabase
        .from('miembros')
        .select('perfil_id, aceptado_en')
        .eq('hogar_id', hogarId)

      if (!error && data) {
        dentro = data
          .filter((m: { aceptado_en: string | null }) => m.aceptado_en)
          .map((m: { perfil_id: string }) => m.perfil_id)
      }
    }
  } catch {
    /* Se queda como estaba. */
  }

  /* Si la lista sale vacía por lo que sea, NO se recorta: quedarse sin
     poder asignar nada es peor que ofrecer a alguien de más. */
  const gente =
    dentro && dentro.length > 0
      ? (perfiles ?? []).filter((p) => dentro!.includes(p.id as string))
      : (perfiles ?? [])

  return <Nuevo perfiles={gente} yo={user.id} />
}
