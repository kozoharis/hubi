import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../barra'
import Cabecera from '../cabecera'
import { Volver } from '../iconos'
import { esImpuesto, type Impuesto } from '@/lib/impuesto'
import type { Categoria } from '@/lib/rutas'
import Fijos from './fijos'
import { elEspacio, elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LO QUE SE PAGA TODOS LOS MESES
  ═══════════════════════════════════════════════════════════════

  Internet, el teléfono, el alquiler, los seguros, las suscripciones.

  Es la última pieza de las cuentas, y la que las cierra: hasta ahora
  las cuentas solo sabían lo que alguien había fotografiado. Lo que se
  paga siempre, y por eso mismo nadie fotografía, no estaba en ningún
  sitio — ni el gasto, ni el aviso de que faltaba la factura.

  Pantalla aparte y no dentro de Ajustes, a propósito: esto no es una
  configuración, es dinero. Se mira, se corrige y se consulta como se
  mira el balance.
*/
export default async function PaginaPagos() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  /* Solo las partidas donde puede acabar dinero: las hojas que son de
     gasto o de ingreso. Ofrecer una carpeta 'neutro' sería ofrecer un
     sitio donde el pago se apunta y luego no cuenta en ningún balance. */
  const { data } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, icono, orden, naturaleza')
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('activa', true)

  const categorias = (data ?? []) as Categoria[]
  const conHijas = new Set(categorias.map((c) => c.padre_id).filter(Boolean))
  const hojas = categorias.filter(
    (c) => !conHijas.has(c.id) && (c.naturaleza === 'gasto' || c.naturaleza === 'ingreso')
  )

  const camino = (c: Categoria) => {
    const partes: string[] = []
    let actual: Categoria | undefined = c
    while (actual) {
      partes.unshift(actual.nombre)
      actual = actual.padre_id ? categorias.find((x) => x.id === actual!.padre_id) : undefined
    }
    return partes.join(' › ')
  }

  /* El impuesto de la casa, para poder preguntar el tipo al crear un
     pago. En dos intentos, que es del sql/46. */
  let impuesto: Impuesto = 'ninguno'
  try {
    const casa = await elEspacio(supabase)
    if (casa) {
      const { data: fila } = await supabase
        .from('hogares')
        .select('impuesto')
        .eq('id', casa)
        .maybeSingle()
      if (fila && esImpuesto(fila.impuesto)) impuesto = fila.impuesto
    }
  } catch {
    /* Como siempre: sin impuesto. */
  }

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href="/cuentas" />
        <h1 className="t-titulo mt-2.5">Pagos fijos</h1>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5">
        <Fijos
          partidas={hojas.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            camino: camino(c),
            naturaleza: c.naturaleza ?? 'gasto',
          }))}
          impuesto={impuesto}
        />
      </div>

      {/* Ninguna pestaña de abajo es ésta. Ponía `activa="finca"`, que
          es una clave que ya no existe —las actividades se identifican
          por su id— y por tanto no encendía nada igual. Se dice
          explícitamente en vez de dejarlo a que falle bien. */}
      <Barra activa="cuentas" />
    </main>
  )
}
