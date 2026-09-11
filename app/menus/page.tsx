import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../barra'
import Cabecera from '../cabecera'
import { Volver } from '../iconos'
import Semana from './semana'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LOS MENÚS DE LA SEMANA
  ═══════════════════════════════════════════════════════════════

  Lo ve toda la casa, incluida quien ayuda — y ésa es la razón de que
  exista. Un menú que la persona que cocina no puede leer no es un
  menú: es una nota entre dos.

  Y debajo, el cajón de las ideas: el vídeo que alguien vio, la receta
  de un blog, «el pollo de la abuela» sin enlace ninguno. Separados no
  sirven de mucho — la lista de enlaces se queda en un cajón de cosas
  que nunca se cocinan, y el menú obliga a acordarse de dónde estaba
  aquello. Juntos, se elige del cajón y queda puesto en el día.
*/
export default async function PaginaMenus() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  return (
    <main className="min-h-screen pb-40 lg:pb-16">
      <Cabecera ancho>
        <Volver href="/dia" />
        <h1 className="t-titulo mt-2.5">Menús</h1>
      </Cabecera>

      <div className="columna">
        <Semana />
      </div>

      {/* Encendía «Inicio» estando en Menús. Ninguna pestaña de abajo
          es ésta: se dice, en vez de marcar una que no es. */}
      <Barra activa="dia" />
    </main>
  )
}
