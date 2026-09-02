import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Apuntar from './formulario'
import type { Categoria } from '@/lib/rutas'

export const dynamic = 'force-dynamic'

/*
  Apuntar a mano.

  Recibe de qué sección se apunta. Con la Finca sola daba igual —solo
  había una— pero desde que existe Los Helechos, enseñar las dos listas
  mezcladas obligaría a distinguir "Luz" (de la finca) de "Suministros"
  (de la casa) en una misma pantalla. Cada sección enseña lo suyo.
*/
export default async function PaginaApuntar({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string }>
}) {
  const { seccion } = await searchParams
  const deQuien = seccion === 'HELECHOS' ? 'HELECHOS' : 'FINCA'
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const { data } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, icono, orden, naturaleza')
    .eq('activa', true)
    .order('orden')

  const todas = (data ?? []) as Categoria[]
  const porId = new Map(todas.map((c) => [c.id, c]))
  const raiz = todas.find((c) => c.segmento_drive === deQuien && !c.padre_id)
  const conHijas = new Set(todas.map((c) => c.padre_id).filter(Boolean))

  // Solo las categorías finales que cuelgan de esta sección.
  const opciones = todas.filter((c) => {
    if (conHijas.has(c.id)) return false
    let actual: Categoria | undefined = c
    while (actual) {
      if (actual.id === raiz?.id) return true
      actual = actual.padre_id ? porId.get(actual.padre_id) : undefined
    }
    return false
  })

  return (
    <Apuntar
      categorias={opciones}
      nombre={raiz?.nombre ?? 'Finca'}
      volver={deQuien === 'HELECHOS' ? '/helechos' : '/finca'}
      conApartamentos={deQuien === 'HELECHOS'}
    />
  )
}
