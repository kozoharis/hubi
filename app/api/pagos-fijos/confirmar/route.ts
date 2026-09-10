import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'

export const dynamic = 'force-dynamic'

/*
  «SÍ, ESTE MES SE PAGÓ».

  Un apunte que nació de un pago programado está PREVISTO: cuenta en el
  balance, pero marcado, porque HUBI no lo ha visto pagar — lo ha
  supuesto porque tocaba. Esto lo confirma.

  Y también lo contrario: «este mes no se pagó» lo quita. Un recibo
  devuelto, una baja a mitad de mes, un cobro que la compañía no pasó.
  Sin esa salida, el único remedio sería dejar el balance mintiendo o
  borrar el pago fijo entero.
*/
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const cuerpo = (await peticion.json().catch(() => ({}))) as {
    id?: string
    /** true = se pagó · false = no se pagó, quítalo del balance */
    pagado?: boolean
  }

  const id = String(cuerpo.id ?? '')
  if (!id) return NextResponse.json({ error: 'Falta cuál.' }, { status: 400 })

  if (cuerpo.pagado === false) {
    const { data, error } = await supabase
      .from('movimientos')
      .delete()
      .eq('id', id)
      .eq('previsto', true)
      .select('id')

    /* `.eq('previsto', true)` es la red: esta ruta NO puede borrar un
       apunte de verdad, con su factura detrás, si algún día alguien le
       manda el identificador equivocado. */
    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: 'No se ha podido quitar.', detalle: error?.message ?? 'Cero filas.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ bien: true, quitado: true })
  }

  const { data, error } = await supabase
    .from('movimientos')
    .update({ previsto: false })
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido confirmar.', detalle: error?.message ?? 'Cero filas.' },
      { status: 500 }
    )
  }
  return NextResponse.json({ bien: true })
}
