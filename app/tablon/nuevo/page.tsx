import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Nuevo from './formulario'
import { elEspacio } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

export default async function PaginaNuevo({
  searchParams,
}: {
  searchParams: Promise<{ texto?: string; para?: string; volver?: string }>
}) {
  /*
    ── LO QUE VIENE DE OTRA PANTALLA ──

    «Con fecha», en el hilo del asesor, mandaba aquí con un enlace a
    secas: se perdía lo escrito, no se sabía para quién era, y al
    volver se acababa en la Agenda, a dos pantallas de donde se estaba.

    Ahora viaja en la dirección. `volver` además es lo que hace que el
    botón de atrás devuelva al sitio de donde se vino y no al de
    siempre.
  */
  const traido = await searchParams

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
    const hogarId = await elEspacio(supabase)
    if (hogarId) {
      /* `clase = 'persona'`: una pantalla de cocina es un miembro más
         de esta tabla, y sin esto saldría en «Para quién» como si
         fuera alguien. Dejarle un recado a una pared no lo lee
         nadie. */
      const { data, error } = await supabase
        .from('miembros')
        .select('perfil_id, aceptado_en')
        .eq('hogar_id', hogarId)
        .eq('clase', 'persona')

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

  /* Solo se admite un `volver` de dentro de HUBI. Sin esto, una
     dirección con `?volver=https://…` convertiría este botón en un
     salto a donde quisiera quien mandara el enlace. */
  const volver =
    traido.volver && /^\/[A-Za-z0-9/_-]*$/.test(traido.volver) ? traido.volver : '/agenda'

  return (
    <Nuevo
      perfiles={gente}
      yo={user.id}
      textoInicial={(traido.texto ?? '').slice(0, 600)}
      paraInicial={traido.para ?? null}
      volver={volver}
    />
  )
}
