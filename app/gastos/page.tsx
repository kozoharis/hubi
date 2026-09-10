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
        /*
          Arena, que es el ámbito de la Casa.

          Antes era `#0EA5E9`, un cian que NO ESTABA DECLARADO en la
          paleta y que se había convertido por acumulación en el color
          de «lo del día a día» — el mismo de La compra. Ahora la Casa
          tiene su color en la tabla como cualquier otra sección.
        */
        ambito: 'arena',
        ruta: '/gastos',
        /* Desde Fase 2 esto vive dentro de Cuentas, así que la
           pestaña que se enciende es ésa. Antes no se encendía
           ninguna porque ninguna lo contenía. */
        pestana: 'cuentas',
        apartamentos: false,
      }}
      searchParams={searchParams}
    />
  )
}
