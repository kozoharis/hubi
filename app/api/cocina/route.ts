import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  QUÉ SE VE EN LA PANTALLA DE LA COCINA
  ═══════════════════════════════════════════════════════════════

  Una sola llamada, y por dentro una sola función de la base
  (`poner_al_dia_la_cocina`, SQL 69). Aquí no se decide nada: se pasa
  lo que la persona ha marcado y se devuelve cuántas cosas ha tocado.

  ─────────────────────────────────────────────────────────────
  POR QUÉ NO SE ESCRIBE LA TABLA DIRECTAMENTE

  Porque son dos escrituras que tienen que ir juntas: lo que la casa
  DICE que se ve (`hogares.tipos_en_casa`) y lo que las filas TIENEN
  puesto (`visible_en_casa`). Si se hicieran por separado, una podría
  salir bien y la otra no, y la casa quedaría diciendo una cosa
  mientras la pantalla enseña otra — que es la peor de las averías,
  porque nadie la ve hasta que alguien lee en la cocina algo que creía
  que no estaba.

  El paso 69 además le quitó a la app el permiso de escribir esas dos
  columnas, así que este camino no es una preferencia: es el único.

  ─────────────────────────────────────────────────────────────
  Y POR QUÉ EL PERMISO NO SE COMPRUEBA AQUÍ

  Lo comprueba la función: tiene que ser de la casa, no ser una
  pantalla, y ser de la familia o el dueño. Repetirlo aquí sería tener
  dos reglas que mantener a la vez, y la de arriba —la de la base— es
  la que de verdad manda.
*/

const TIPOS_QUE_HUBI_CONOCE = [
  'tarea',
  'recado',
  'vencimiento',
  'coche',
  'papeles',
  'cita',
  'farmacia',
]

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Hay que entrar.' }, { status: 401 })

  const casa = await elEspacioO(supabase)
  if (!casa) return NextResponse.json({ error: 'Sin casa.' }, { status: 400 })

  const cuerpo = (await peticion.json().catch(() => null)) as {
    tipos?: unknown
    notas?: unknown
    tambienLoYaDecidido?: unknown
  } | null

  if (!cuerpo) {
    return NextResponse.json({ error: 'No se ha entendido la petición.' }, { status: 400 })
  }

  /* Se filtra contra la lista que HUBI conoce en vez de pasar lo que
     venga. Un tipo inventado no rompería nada —no encontraría filas—
     pero se quedaría guardado en la casa para siempre, y dentro de un
     año nadie sabría de dónde salió. */
  const tipos = Array.isArray(cuerpo.tipos)
    ? [...new Set(cuerpo.tipos.filter((t): t is string => typeof t === 'string'))].filter((t) =>
        TIPOS_QUE_HUBI_CONOCE.includes(t)
      )
    : []

  const { data, error } = await supabase.rpc('poner_al_dia_la_cocina', {
    casa,
    los_tipos: tipos,
    con_las_notas: cuerpo.notas === true,
    tambien_lo_ya_decidido: cuerpo.tambienLoYaDecidido === true,
  })

  if (error) {
    console.error('[HUBI] No se ha podido decidir lo de la cocina:', error.message)
    return NextResponse.json(
      {
        error:
          error.message.includes('familia')
            ? 'Esto lo decide la familia.'
            : 'No se ha podido guardar. Inténtalo otra vez.',
      },
      { status: 400 }
    )
  }

  /* `returns table` llega como una lista de una fila. */
  const fila = (Array.isArray(data) ? data[0] : data) as
    | { cosas_tocadas?: number; recados_tocados?: number }
    | null
    | undefined

  return NextResponse.json({
    bien: true,
    cosas: fila?.cosas_tocadas ?? 0,
    recados: fila?.recados_tocados ?? 0,
  })
}
