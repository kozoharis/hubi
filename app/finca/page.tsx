import { redirect, notFound } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'

export const dynamic = 'force-dynamic'

/*
  LA FINCA YA NO ES UNA PANTALLA: ES UN DATO.

  Aquí había un archivo con el nombre, el color y el icono escritos a
  mano, idéntico al de Los Helechos salvo por esas tres cosas. Ahora
  hay UNA sola pantalla de cuentas —`/seccion/[id]`— que los lee de la
  base de datos, y por eso sirve igual para la finca de Juan Miguel
  que para las ocho obras de un reformista.

  Esta dirección se queda como puerta: alguien puede tenerla guardada
  en el móvil, o escrita en un aviso antiguo. Reenvía a la de verdad
  en vez de dar un error — romper un enlace que alguien usa a diario
  es de las cosas que hacen desconfiar de una aplicación.
*/
export default async function Finca() {
  const supabase = await clienteSesion()

  const { data } = await supabase
    .from('categorias')
    .select('id')
    .eq('segmento_drive', 'FINCA')
    .is('padre_id', null)
    .maybeSingle()

  if (!data) notFound()
  redirect(`/seccion/${data.id}`)
}
