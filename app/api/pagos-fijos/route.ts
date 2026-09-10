import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { miHogar, SIN_CASA } from '@/lib/hogar'
import { hoyAqui } from '@/lib/tablon'
import { pagosAlDia, papelesQueFaltan } from '@/lib/pagos-al-dia'
import type { Cada } from '@/lib/pagos-fijos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/*
  LO QUE SE PAGA TODOS LOS MESES.

  Con la sesión de quien pregunta, no con la clave de servidor: la
  frontera entre casas la pone la base de datos y así no hay nada que
  recordar. La cita diaria sí usa la clave, porque tiene que recorrer
  todas las casas y no hay ninguna sesión detrás.
*/

const CADAS = ['mensual', 'trimestral', 'anual']

function elImporte(v: unknown): number | null {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null
}

// ── LO QUE HAY ───────────────────────────────────────────────
export async function GET() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 403 })

  const hoy = hoyAqui()

  /*
    SE PONEN AL DÍA AL ABRIR LA PANTALLA.

    La cita diaria de Vercel también lo hace, pero solo una vez al día.
    Sin esto, quien programa un pago hoy no vería absolutamente nada
    hasta mañana por la mañana — y pensaría, con toda la razón, que no
    funciona. Es idempotente, así que llamarlo de más no cuesta nada.
  */
  await pagosAlDia(supabase, hoy, hogarId)

  const { data, error } = await supabase
    .from('pagos_fijos')
    .select(
      'id, que, proveedor, categoria_id, importe, impuesto_tipo, cada, dia, desde, hasta, espera_papel, activo'
    )
    .order('que')

  if (error) {
    /* Sin la tabla todavía. Se contesta vacío en vez de romper la
       pantalla: el sql/47 puede no estar ejecutado. */
    return NextResponse.json({ pagos: [], faltan: [], sinTabla: true })
  }

  const faltan = await papelesQueFaltan(supabase, hoy, hogarId)

  /*
    LO QUE ESTÁ APUNTADO PERO SIN CONFIRMAR.

    Cuenta en el balance —si no, las cuentas seguirían incompletas, que
    es lo que veníamos a arreglar— pero HUBI no lo ha visto pagar: lo
    ha supuesto porque tocaba. Se enseña para que alguien diga sí o no,
    y hasta entonces se sabe que está sin confirmar.
  */
  const { data: previstos } = await supabase
    .from('movimientos')
    .select('id, concepto, importe, fecha, periodo')
    .eq('previsto', true)
    .order('fecha', { ascending: false })
    .limit(30)

  return NextResponse.json({ pagos: data ?? [], faltan, previstos: previstos ?? [] })
}

// ── UNO NUEVO ────────────────────────────────────────────────
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 403 })

  const cuerpo = (await peticion.json().catch(() => ({}))) as Record<string, unknown>

  const que = String(cuerpo.que ?? '').trim().slice(0, 80)
  const importe = elImporte(cuerpo.importe)
  const categoriaId = String(cuerpo.categoria_id ?? '')
  const cada = CADAS.includes(String(cuerpo.cada)) ? (String(cuerpo.cada) as Cada) : 'mensual'
  const dia = Math.min(28, Math.max(1, Math.round(Number(cuerpo.dia) || 1)))

  if (que.length < 2) {
    return NextResponse.json({ error: 'Ponle un nombre: «Internet», «El seguro».' }, { status: 400 })
  }
  if (importe === null) {
    return NextResponse.json({ error: 'El importe no es válido.' }, { status: 400 })
  }
  if (!categoriaId) {
    return NextResponse.json({ error: 'Falta decir dónde cuenta.' }, { status: 400 })
  }

  const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(cuerpo.desde ?? ''))
    ? String(cuerpo.desde)
    : hoyAqui()

  const { data, error } = await supabase
    .from('pagos_fijos')
    .insert({
      hogar_id: hogarId,
      que,
      proveedor: String(cuerpo.proveedor ?? '').trim().slice(0, 80) || null,
      categoria_id: categoriaId,
      importe,
      impuesto_tipo:
        cuerpo.impuesto_tipo == null || cuerpo.impuesto_tipo === ''
          ? null
          : Number(cuerpo.impuesto_tipo),
      cada,
      dia,
      desde,
      espera_papel: cuerpo.espera_papel !== false,
      creado_por: user.id,
    })
    .select('id')

  /* Con `.select()`: un insert que la seguridad no permite contesta
     «todo bien» habiendo escrito cero filas. */
  if (error) {
    console.error('[HUBI] No se ha podido crear el pago fijo:', error)
    return NextResponse.json(
      { error: 'No se ha podido guardar.', detalle: error.message },
      { status: 500 }
    )
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido guardar. Los pagos fijos todavía no están disponibles en esta casa.' },
      { status: 409 }
    )
  }

  /* Y se ponen al día en el momento: quien acaba de programar el
     alquiler quiere ver los meses apuntados ya, no mañana. */
  await pagosAlDia(supabase, hoyAqui(), hogarId)

  return NextResponse.json({ bien: true, id: data[0].id })
}

// ── CAMBIAR O QUITAR ─────────────────────────────────────────
export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const cuerpo = (await peticion.json().catch(() => ({}))) as Record<string, unknown>
  const id = String(cuerpo.id ?? '')
  if (!id) return NextResponse.json({ error: 'Falta cuál.' }, { status: 400 })

  const cambios: Record<string, unknown> = {}
  if (typeof cuerpo.activo === 'boolean') cambios.activo = cuerpo.activo
  if (typeof cuerpo.espera_papel === 'boolean') cambios.espera_papel = cuerpo.espera_papel
  if (cuerpo.importe !== undefined) {
    const i = elImporte(cuerpo.importe)
    if (i === null) return NextResponse.json({ error: 'El importe no es válido.' }, { status: 400 })
    cambios.importe = i
  }
  if (cuerpo.hasta !== undefined) {
    cambios.hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(cuerpo.hasta)) ? cuerpo.hasta : null
  }

  if (Object.keys(cambios).length === 0) return NextResponse.json({ bien: true })

  const { data, error } = await supabase
    .from('pagos_fijos')
    .update(cambios)
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido cambiar.', detalle: error?.message ?? 'Cero filas.' },
      { status: 500 }
    )
  }
  return NextResponse.json({ bien: true })
}

export async function DELETE(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const id = new URL(peticion.url).searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'Falta cuál.' }, { status: 400 })

  /*
    LOS APUNTES YA HECHOS NO SE BORRAN.

    Quitar un pago fijo significa «esto ya no se paga más», no «esto
    nunca se pagó». Llevarse por delante los ocho meses que sí se
    pagaron cambiaría las cuentas de un trimestre ya cerrado, y encima
    sin avisar. El enlace se suelta —`on delete set null`— y los
    apuntes se quedan donde están.
  */
  const { data, error } = await supabase
    .from('pagos_fijos')
    .delete()
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido quitar.', detalle: error?.message ?? 'Cero filas.' },
      { status: 500 }
    )
  }
  return NextResponse.json({ bien: true })
}
