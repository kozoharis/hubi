import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { SIN_CASA } from '@/lib/hogar'
import { hoyAqui } from '@/lib/tablon'
import { elEspacio } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  EL PARTE DEL DÍA
  ═══════════════════════════════════════════════════════════════

  Las horas de MÁS y qué pasó. Un solo verbo: se manda el parte entero
  y se guarda encima del que hubiera de ese día.

  ─────────────────────────────────────────────────────────────
  LO NORMAL NO SE APUNTA

  El horario está acordado y no cambia: pedirle que lo escriba cada
  día es dar trabajo a cambio de un dato que ya saben los dos. Lo que
  se guarda aquí es lo que se SALE de lo acordado — que es lo que hay
  que cuadrar a fin de mes y lo que se olvida.

  ─────────────────────────────────────────────────────────────
  Y SOLO SE PUEDE ESCRIBIR EL PROPIO

  `quien` no se acepta del navegador: se coge de la sesión. Aunque
  alguien mandara el identificador de otra persona, aquí se ignora — y
  además las políticas del SQL 41 lo cortan por su lado.

  No es paranoia: es lo único que hace que el número valga algo a fin
  de mes. Un parte que el empleador puede escribir no es el parte de
  ella.
*/
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const hogarId = await elEspacio(supabase)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 403 })

  let cuerpo: { extra?: number | string | null; nota?: string | null; fecha?: string }
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  /* La fecha la pone el servidor salvo que se pida otra, y nunca con
     `new Date()` a secas: la hora del servidor puede ir un día por
     delante de la de aquí, y un parte de las once de la noche se
     apuntaría en el día siguiente. */
  const fecha =
    typeof cuerpo.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cuerpo.fecha)
      ? cuerpo.fecha
      : hoyAqui()

  /* Se admite «1,5» además de «1.5»: en un teclado español la coma es
     lo que sale, y rechazarla sería culpar a la persona de escribir
     su idioma. */
  const bruto =
    typeof cuerpo.extra === 'string'
      ? Number(cuerpo.extra.replace(',', '.'))
      : typeof cuerpo.extra === 'number'
        ? cuerpo.extra
        : null

  /*
    HORAS DE MÁS, NO HORAS DEL DÍA.

    El horario acordado no se apunta: lo que se guarda aquí es lo que
    se sale de él. Por eso el tope es 12 y no 24 —doce horas de más en
    un día no existe— y por eso un cero es lo mismo que no poner nada:
    un día sin horas de más es un día normal, no un dato.
  */
  const extra =
    bruto == null || Number.isNaN(bruto) || bruto <= 0
      ? null
      : Math.min(12, Math.round(bruto * 4) / 4)

  const nota = String(cuerpo.nota ?? '').trim().slice(0, 600) || null

  /* Sin horas de más y sin nota no hay parte: es un día normal. Se
     borra la fila en vez de guardar una vacía que luego nadie entiende
     qué hace ahí — y así «este mes, tres días con horas de más» cuenta
     tres y no treinta. */
  if (extra == null && !nota) {
    const { error } = await supabase
      .from('dias_en_casa')
      .delete()
      .eq('hogar_id', hogarId)
      .eq('quien', user.id)
      .eq('fecha', fecha)

    if (error) {
      return NextResponse.json(
        { error: 'No se ha podido quitar el parte.', detalle: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json({ bien: true, vacio: true })
  }

  /* `upsert` y no `insert`: el parte de un día se corrige, y dos
     toques seguidos con mala cobertura darían un error de clave
     repetida sobre algo que en realidad estaba guardado. */
  const { data, error } = await supabase
    .from('dias_en_casa')
    .upsert(
      {
        hogar_id: hogarId,
        quien: user.id,
        fecha,
        horas_extra: extra,
        nota,
        cambiado_en: new Date().toISOString(),
      },
      { onConflict: 'quien,fecha' }
    )
    .select('fecha')

  /* El `.select()`: sin él, un guardado que las políticas no permitan
     afecta a cero filas y contesta que todo ha ido bien. */
  if (error || !data || data.length === 0) {
    console.error('[HUBI] No se ha podido guardar el parte:', error)
    return NextResponse.json(
      {
        error: 'No se ha podido guardar.',
        detalle: error?.message ?? 'Esto todavía no está disponible en esta casa.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true, fecha, extra, nota })
}
