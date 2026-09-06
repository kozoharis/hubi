import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Cuentas from '../cuentas'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LAS CUENTAS DE CASA
  ═══════════════════════════════════════════════════════════════

  Todo lo que NO es una actividad, junto: la compra, las reparaciones,
  el restaurante, el taller, la ITV, los seguros, la medicación.

  ─────────────────────────────────────────────────────────────
  POR QUÉ NO ES «UNA SECCIÓN MÁS»

  Las actividades tienen una raíz propia y se suman solas: todo lo que
  cuelga de FINCA es de la finca. Esto no tiene raíz: son cinco
  carpetas distintas —Casa, Vehículos, Seguros, Salud, Personal— que
  no comparten padre y que nadie querría ver por separado. Lo que se
  pregunta no es «cuánto me he gastado en el coche», es **cuánto se
  nos va al trimestre**.

  Por eso la pantalla es la misma de siempre con `raiz: null`, que ahí
  significa «todo lo que no lleva cuentas propias». Copiarla habría
  sido tener dos sitios donde arreglar el mismo fallo, y donde uno de
  los dos se queda sin arreglar.

  ─────────────────────────────────────────────────────────────
  NO LLEVA PESTAÑA ABAJO

  Se entra desde la tarjeta del Inicio. Las cinco de abajo están
  ocupadas y el suelo de 48 px por botón no se negocia por hacer sitio
  a una sección más.
*/
export default async function Gastos({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; ancla?: string }>
}) {
  const supabase = await clienteSesion()
  if (!(await quien(supabase))) redirect('/entrar')

  return (
    <Cuentas
      seccion={{
        raiz: null,
        nombre: 'Cuentas de casa',
        icono: 'casa',
        /* Azul, el mismo de La compra: es el color con el que ya
           asocian «lo del día a día». El verde es de la Finca y el
           morado de los alquileres — dárselo a esto sería decir que
           son la misma cosa. */
        color: '#0EA5E9',
        fondo: '#DCF0FB',
        ruta: '/gastos',
        /* Ninguna pestaña de abajo se enciende: no es ninguna de
           ellas. Marcar «Inicio» sería mentir sobre dónde estás. */
        pestana: 'gastos',
        apartamentos: false,
      }}
      searchParams={searchParams}
    />
  )
}
