import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { miHogar } from '@/lib/hogar'
import { actividadesDe } from '@/lib/actividades'
import Grabar from './grabar'

export const dynamic = 'force-dynamic'

/*
  ─────────────────────────────────────────────────────────────
  LOS EJEMPLOS SALEN DE ESTA CASA

  Decían «Recuérdale a Conchita que mañana llame al médico» y
  «Enséñame las facturas de la finca». En casa de Juan Miguel eso es
  útil de verdad: son su mujer y su finca. En cualquier otra casa son
  el nombre de una desconocida y una actividad que no tienen.

  Y en una pantalla de voz el ejemplo no es decoración: es lo ÚNICO
  que le dice a alguien qué puede pedir. Un ejemplo que nombra a gente
  que no conoces enseña a no fiarte de la pantalla.

  Así que se cogen de aquí: alguien de tu casa que no seas tú, y una
  de tus actividades. Si no hay ninguna de las dos cosas —una persona
  sola, recién llegada— las frases se escriben sin nombres y siguen
  siendo verdad.
*/
export default async function Hablar() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  let otro: string | null = null
  let actividad: string | null = null

  try {
    const hogarId = await miHogar(supabase, user.id)

    if (hogarId) {
      /* Alguien de la casa que no sea yo. «Recuérdate a ti mismo» no
         enseña nada de lo que esta pantalla sabe hacer. */
      const { data: dentro } = await supabase
        .from('miembros')
        .select('perfil_id')
        .eq('hogar_id', hogarId)
        .neq('perfil_id', user.id)
        .limit(4)

      const ids = (dentro ?? []).map((m: { perfil_id: string }) => m.perfil_id)

      if (ids.length > 0) {
        const { data: quienes } = await supabase
          .from('perfiles')
          .select('nombre')
          .in('id', ids)
          .limit(1)

        const nombre = (quienes?.[0]?.nombre as string | undefined) ?? null
        /* Solo el nombre de pila: «Recuérdale a María Jesús Pérez
           Gómez» no es una frase que nadie vaya a decir en voz alta. */
        otro = nombre ? nombre.split(' ')[0] : null
      }

      const suyas = await actividadesDe(supabase)
      actividad = suyas[0]?.nombre ?? null
    }
  } catch {
    /* Sin nombres, los ejemplos van en genérico. Nunca falla por esto:
       es una pantalla de ayuda, no puede tumbar la voz. */
  }

  return <Grabar otro={otro} actividad={actividad} />
}
