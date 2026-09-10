import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  RECUPERAR UNA COMPRA DE OTRA SEMANA
  ═══════════════════════════════════════════════════════════════

  La compra de casa se repite casi igual: leche, pan, huevos, fruta,
  papel. Volver a escribirla entera cada semana es trabajo inventado —
  y encima es donde se olvidan cosas, porque se escribe de memoria.

  Aquí se copian los artículos de una lista ya cerrada a la que está
  abierta. Se copian, no se mueven: la cerrada se queda como está,
  porque es el registro de lo que se compró aquel día.

  ─────────────────────────────────────────────────────────────
  Y NO SE REPITE LO QUE YA ESTÁ

  Si en la lista de ahora ya hay leche, no entran dos leches. Una
  lista con la mitad de las líneas repetidas se convierte en algo que
  hay que limpiar antes de ir al súper, y entonces no ha ahorrado
  nada.
*/
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { de?: string; a?: string }
  try {
    cuerpo = (await peticion.json()) as { de?: string; a?: string }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const de = String(cuerpo.de ?? '')
  const a = String(cuerpo.a ?? '')

  if (!de || !a) {
    return NextResponse.json({ error: 'Falta saber de qué lista y a cuál.' }, { status: 400 })
  }
  if (de === a) {
    return NextResponse.json({ error: 'Es la misma lista.' }, { status: 400 })
  }

  /* Que las dos sean de esta casa: las políticas ya lo garantizan,
     pero si una no lo fuera esto devolvería «cero cosas» y nadie
     entendería por qué. Mejor decirlo. */
  const { data: laVieja } = await supabase
    .from('listas_compra')
    .select('id, seccion_id')
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('id', de)
    .maybeSingle()

  const { data: laNueva } = await supabase
    .from('listas_compra')
    .select('id, seccion_id')
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('id', a)
    .maybeSingle()

  if (!laVieja || !laNueva) {
    return NextResponse.json({ error: 'Esa lista ya no está.' }, { status: 404 })
  }

  const { data: viejas, error: alLeer } = await supabase
    .from('compra')
    .select('que, cantidad, seccion_id')
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('lista_id', de)

  if (alLeer) {
    console.error('[HUBI] No se ha podido leer la lista vieja:', alLeer)
    return NextResponse.json(
      { error: 'No se ha podido leer esa compra.', detalle: alLeer.message },
      { status: 500 }
    )
  }

  if (!viejas || viejas.length === 0) {
    return NextResponse.json({ error: 'Esa compra no tenía nada dentro.' }, { status: 409 })
  }

  /* Lo que ya está apuntado, para no repetirlo. Se compara en
     minúsculas y sin acentos: «Plátanos» y «platanos» son lo mismo
     para quien va al súper, y salir con las dos líneas es salir con
     una lista sucia. */
  const { data: yaHay } = await supabase
    .from('compra')
    .select('que')
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('lista_id', a)
    .is('archivado_en', null)

  const igual = (t: string) =>
    t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const puestas = new Set((yaHay ?? []).map((c) => igual(c.que as string)))

  const nuevas: { que: string; cantidad: string | null; seccion_id: string | null }[] = []
  const vistas = new Set<string>()

  for (const v of viejas) {
    const clave = igual(v.que as string)
    if (!clave || puestas.has(clave) || vistas.has(clave)) continue
    vistas.add(clave)
    nuevas.push({
      que: v.que as string,
      cantidad: (v.cantidad as string | null) ?? null,
      seccion_id: (v.seccion_id as string | null) ?? null,
    })
  }

  if (nuevas.length === 0) {
    return NextResponse.json(
      { ok: true, cuantas: 0, aviso: 'Ya tenías todo eso apuntado.' },
      { status: 200 }
    )
  }

  const { data, error } = await supabase
    .from('compra')
    .insert(
      nuevas.map((n) => ({
        ...n,
        lista_id: a,
        anadido_por: user.id,
        comprado: false,
      }))
    )
    .select('id, que, cantidad, comprado, seccion_id, lista_id')

  /* El `.select()`: sin él, una inserción que las políticas no
     permitan devuelve «todo bien» habiendo metido cero filas. */
  if (error || !data || data.length === 0) {
    console.error('[HUBI] No se ha podido recuperar la compra:', error)
    return NextResponse.json(
      { error: 'No se ha podido recuperar.', detalle: error?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, cuantas: data.length, apuntadas: data })
}
