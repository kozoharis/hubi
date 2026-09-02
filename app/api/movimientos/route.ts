import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'

export const dynamic = 'force-dynamic'

/** Apunta un gasto o un ingreso a mano, sin documento. */
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const cuerpo = (await peticion.json()) as {
    tipo?: string
    concepto?: string
    importe?: string
    fecha?: string
    categoria_id?: string
    nota?: string
    apartamento?: number | null
    personas?: number | null
    noches?: number | null
    huesped?: string
    referencia?: string
  }

  const tipo = cuerpo.tipo === 'ingreso' ? 'ingreso' : 'gasto'
  const concepto = (cuerpo.concepto ?? '').trim()
  const importe = Number(String(cuerpo.importe ?? '').replace(',', '.'))
  const fecha = cuerpo.fecha ?? new Date().toISOString().slice(0, 10)

  if (!concepto) {
    return NextResponse.json({ error: 'Falta decir qué es.' }, { status: 400 })
  }
  if (!Number.isFinite(importe) || importe <= 0) {
    return NextResponse.json({ error: 'El importe no es válido.' }, { status: 400 })
  }
  if (!cuerpo.categoria_id) {
    return NextResponse.json({ error: 'Falta elegir la categoría.' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'La fecha no es válida.' }, { status: 400 })
  }

  /*
    Los datos de Los Helechos.

    Todos opcionales: la Finca no los manda, y un gasto común de la
    casa tampoco lleva apartamento. `entero` deja fuera cualquier cosa
    que no sea un número dentro de rango — la base de datos también lo
    comprueba, pero un aviso claro aquí vale más que un error 500.
  */
  const apartamento = entero(cuerpo.apartamento, 1, 3)
  const personas = tipo === 'ingreso' ? entero(cuerpo.personas, 1, 20) : null
  const noches = tipo === 'ingreso' ? entero(cuerpo.noches, 1, 365) : null
  const huesped = tipo === 'ingreso' ? (cuerpo.huesped ?? '').trim().slice(0, 120) : ''
  const referencia = tipo === 'ingreso' ? (cuerpo.referencia ?? '').trim().slice(0, 40) : ''

  const { data, error } = await supabase
    .from('movimientos')
    .insert({
      tipo,
      concepto,
      importe,
      fecha,
      categoria_id: cuerpo.categoria_id,
      nota: (cuerpo.nota ?? '').trim() || null,
      creado_por: user.id,
      apartamento,
      personas,
      noches,
      huesped: huesped || null,
      referencia: referencia || null,
    })
    .select('id, fecha')
    .single()

  if (error) {
    /* 23505 es el índice único del número de reserva. No es una avería:
       es que esa reserva ya estaba apuntada, y hay que decirlo tal
       cual en vez de soltar un "no se ha podido apuntar" que deja a
       cualquiera intentándolo otra vez. */
    if (error.code === '23505' && referencia) {
      return NextResponse.json(
        { error: `La reserva ${referencia} ya estaba apuntada.` },
        { status: 409 }
      )
    }
    console.error('[Family Hub] Fallo apuntando movimiento:', error)
    return NextResponse.json({ error: 'No se ha podido apuntar.' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, fecha: data.fecha })
}

/** Un número entero dentro de rango, o nada. Nunca a medias. */
function entero(valor: unknown, min: number, max: number): number | null {
  const n = Number(valor)
  if (!Number.isInteger(n) || n < min || n > max) return null
  return n
}
