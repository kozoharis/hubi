import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  CÓMO SE LLEVA UNA ACTIVIDAD
  ═══════════════════════════════════════════════════════════════

  Tres decisiones, y las tres son de la familia, no nuestras:

  · ¿Se divide en partes?   La finca de Juan Miguel es una sola. La de
                            otro tiene la huerta, la viña y el
                            invernadero. Un reformista tiene ocho obras.

  · ¿Cómo llamas a cada una?  «el apartamento», «la obra», «la parcela».
                            Con artículo, porque en castellano no se
                            puede adivinar el género: «el garaje» pero
                            «la nave».

  · ¿Se reparte lo común?   En Los Helechos la luz se parte entre tres
                            porque los tres se alquilan igual. En obras
                            eso sería mentir: repartir la gasolina
                            entre una reforma de 40.000 € y un baño de
                            3.000 no dice nada de ninguna de las dos.

  Hasta hoy estos tres interruptores solo existían en SQL. O sea: para
  decir «mi finca la llevo por parcelas» había que llamar a un
  programador.

  ─────────────────────────────────────────────────────────────
  APAGAR LA DIVISIÓN NO BORRA NADA

  Si alguien la enciende, crea tres partes, y luego la apaga, las
  partes se quedan donde están y los apuntes siguen enganchados a
  ellas. Simplemente dejan de enseñarse. Volver a encenderla las
  devuelve tal cual.

  Un interruptor que destruye lo que hay debajo es un interruptor que
  nadie se atreve a tocar.
*/

type Entrada = {
  id?: string
  usa_unidades?: boolean
  palabra_unidad?: string | null
  reparte_comunes?: boolean
}

/*
  «obra» → «la obra». «apartamento» → «el apartamento».

  Se acepta que la persona escriba solo el sustantivo, porque es lo
  natural, y se le pone el artículo aquí. Adivinar el género por la
  terminación acierta en la mayoría —-a femenino, el resto masculino—
  y falla en unos cuantos conocidos, que están puestos a mano. Si
  alguien escribe ya el artículo, se respeta el suyo.
*/
const FEMENINOS = new Set(['nave', 'parte', 'sede', 'flota', 'clase', 'torre', 'planta'])
const MASCULINOS = new Set(['dia', 'día', 'sofa', 'sofá', 'mapa', 'clima'])

function conArticulo(bruto: string): string | null {
  const texto = String(bruto ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 30)

  if (texto.length < 3) return null
  if (/^(el|la|los|las)\s+/.test(texto)) return texto

  const ultima = texto.split(' ').pop() ?? texto
  const femenino =
    FEMENINOS.has(ultima) ||
    (!MASCULINOS.has(ultima) && (ultima.endsWith('a') || ultima.endsWith('ion')))

  return `${femenino ? 'la' : 'el'} ${texto}`
}

// ── Cambiar cómo se lleva ────────────────────────────────────
export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: Entrada
  try {
    cuerpo = (await peticion.json()) as Entrada
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const id = String(cuerpo.id ?? '')
  if (!id) return NextResponse.json({ error: 'Falta la actividad.' }, { status: 400 })

  const { data: seccion } = await supabase
    .from('categorias')
    .select('id, nombre, padre_id')
    .eq('id', id)
    .maybeSingle()

  if (!seccion || seccion.padre_id) {
    return NextResponse.json({ error: 'Esa actividad no existe.' }, { status: 404 })
  }

  const cambios: Record<string, unknown> = {}

  if (cuerpo.usa_unidades !== undefined) {
    cambios.usa_unidades = cuerpo.usa_unidades === true

    /* Al apagar la división, repartir deja de significar nada. Se
       apaga también, para que no quede un ajuste encendido que no
       gobierna nada y que dentro de un año nadie sepa qué hacía ahí. */
    if (cuerpo.usa_unidades !== true) cambios.reparte_comunes = false
  }

  if (cuerpo.palabra_unidad !== undefined) {
    const palabra = cuerpo.palabra_unidad ? conArticulo(cuerpo.palabra_unidad) : null
    if (cuerpo.palabra_unidad && !palabra) {
      return NextResponse.json(
        { error: 'Esa palabra es muy corta. Escribe cómo llamas a cada una: «obra», «parcela», «piso»…' },
        { status: 400 }
      )
    }
    cambios.palabra_unidad = palabra
  }

  if (cuerpo.reparte_comunes !== undefined) {
    cambios.reparte_comunes = cuerpo.reparte_comunes === true
  }

  if (Object.keys(cambios).length === 0) return NextResponse.json({ bien: true })

  /*
    SI SE ENCIENDE LA DIVISIÓN, TIENE QUE HABER UNA PALABRA.

    Sin ella la pantalla pondría «+ Nueva» a secas y «Cada» colgando,
    que es peor que no tener la función. Se pone una honesta por
    defecto y la persona la cambia si quiere.
  */
  if (cambios.usa_unidades === true && cambios.palabra_unidad === undefined) {
    const { data: actual } = await supabase
      .from('categorias')
      .select('palabra_unidad')
      .eq('id', id)
      .maybeSingle()

    if (!actual?.palabra_unidad) cambios.palabra_unidad = 'la parte'
  }

  const { data, error } = await supabase
    .from('categorias')
    .update(cambios)
    .eq('id', id)
    .select('id')

  /* El `.select()` es la comprobación: sin política, un UPDATE afecta
     a cero filas y devuelve que todo ha ido bien. */
  if (error || !data || data.length === 0) {
    return NextResponse.json(
      {
        error: error?.message?.includes('usa_unidades')
          ? 'Falta ejecutar sql/25 y sql/26 en la base de datos.'
          : 'No se ha podido guardar.',
        detalle: error?.message,
      },
      { status: error ? 500 : 409 }
    )
  }

  return NextResponse.json({ bien: true })
}
