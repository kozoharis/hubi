import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { limpiar } from '@/lib/rutas'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LAS PARTIDAS: CREAR, RENOMBRAR Y RETIRAR
  ═══════════════════════════════════════════════════════════════

  Una partida es QUÉ CLASE de gasto es: albañilería, instalaciones,
  carpintería, luz, agua, productos.

  ─────────────────────────────────────────────────────────────
  NO CONFUNDIR CON LA UNIDAD. ES EL OTRO EJE.

      LA UNIDAD    es DE QUIÉN es   → Obra Manuel, Helechos 2
      LA PARTIDA   es DE QUÉ es     → Albañilería, Carpintería

  Si «carpintería» se creara como unidad, se perdería para siempre
  poder preguntar «¿cuánto llevo en carpintería este año, en TODAS
  las obras?» — la pregunta que hace un reformista en febrero con la
  declaración delante. Separados, se cruzan y sale la tabla que de
  verdad quiere ver.

  ─────────────────────────────────────────────────────────────
  ESTO ES EL PUNTO 11, Y LLEVABA SIN HACERSE DESDE EL PRIMER DÍA

  «Las categorías NO deben estar rígidamente escritas en el código.
  Debe poder hacerse + NUEVA CATEGORÍA.» En la base de datos siempre
  estuvieron; los botones no existían, así que para añadir una había
  que ejecutar SQL. O sea: llamar a un programador para apuntar que
  ahora también se gasta en carpintería.
*/

type Entrada = {
  id?: string
  /** La actividad de la que cuelga: Finca, Obras… */
  seccion_id?: string
  nombre?: string
  /** 'gasto' o 'ingreso'. Decide bajo qué grupo entra. */
  naturaleza?: string
}

function elNombre(v: unknown): string {
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
}

/*
  El grupo GASTOS o INGRESOS de una actividad, creándolo si falta.

  El árbol de HUBI es siempre el mismo —actividad → GASTOS → partida—
  y esa forma es la que hace que las cuentas cuadren y que las
  carpetas de Drive salgan ordenadas. Una actividad recién creada
  todavía no tiene esos dos grupos, así que se hacen aquí la primera
  vez que alguien añade una partida. Nadie tiene que saber que
  existen.
*/
async function grupoDe(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  seccionId: string,
  naturaleza: 'gasto' | 'ingreso'
): Promise<{ id: string } | { error: string }> {
  const nombre = naturaleza === 'gasto' ? 'Gastos' : 'Ingresos'
  const segmento = naturaleza === 'gasto' ? 'GASTOS' : 'INGRESOS'

  const { data: existe } = await supabase
    .from('categorias')
    .select('id')
    .eq('padre_id', seccionId)
    .eq('segmento_drive', segmento)
    .maybeSingle()

  if (existe) return { id: existe.id as string }

  const { data, error } = await supabase
    .from('categorias')
    .insert({
      padre_id: seccionId,
      nombre,
      segmento_drive: segmento,
      naturaleza,
      orden: naturaleza === 'gasto' ? 1 : 2,
    })
    .select('id')
    .maybeSingle()

  /* Sin `.select()` esto no se notaría: con seguridad por filas, un
     INSERT sin permiso no falla — inserta CERO filas y dice que todo
     ha ido bien. */
  if (error || !data) {
    return { error: error?.message ?? 'No se ha podido preparar la sección.' }
  }
  return { id: data.id as string }
}

// ── Crear una partida ────────────────────────────────────────
export async function POST(peticion: NextRequest) {
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

  const nombre = elNombre(cuerpo.nombre)
  const seccionId = String(cuerpo.seccion_id ?? '')
  const naturaleza = cuerpo.naturaleza === 'ingreso' ? 'ingreso' : 'gasto'

  if (nombre.length < 2) {
    return NextResponse.json({ error: 'Ponle un nombre.' }, { status: 400 })
  }
  if (!seccionId) {
    return NextResponse.json({ error: 'Falta la actividad.' }, { status: 400 })
  }

  // Que sea de verdad una actividad, y no una hoja cualquiera.
  const { data: seccion } = await supabase
    .from('categorias')
    .select('id, padre_id')
    .eq('id', seccionId)
    .maybeSingle()

  if (!seccion || seccion.padre_id) {
    return NextResponse.json({ error: 'Esa actividad no existe.' }, { status: 404 })
  }

  const grupo = await grupoDe(supabase, seccionId, naturaleza)
  if ('error' in grupo) {
    return NextResponse.json({ error: grupo.error }, { status: 500 })
  }

  /*
    ¿YA HAY UNA QUE SE LLAME ASÍ?

    No es manía de orden: dos partidas «Carpintería» compartirían
    carpeta en Drive, y al mirar las cuentas el gasto saldría partido
    en dos líneas iguales sin que se entienda por qué. Se avisa ahora,
    con esas palabras, en vez de dejar el lío para dentro de un año.

    Se mira también entre las RETIRADAS: si existe una desactivada con
    ese nombre, lo suyo es volver a encenderla y no crear una gemela
    que dejaría los gastos viejos colgando de la otra.
  */
  const { data: repetida } = await supabase
    .from('categorias')
    .select('id, activa')
    .eq('padre_id', grupo.id)
    .ilike('nombre', nombre)
    .maybeSingle()

  if (repetida) {
    if (repetida.activa) {
      return NextResponse.json({ error: `Ya tienes una partida «${nombre}».` }, { status: 409 })
    }

    const { data: revivida } = await supabase
      .from('categorias')
      .update({ activa: true })
      .eq('id', repetida.id)
      .select('id, nombre')

    if (revivida && revivida.length > 0) {
      return NextResponse.json({
        bien: true,
        partida: revivida[0],
        aviso: `«${nombre}» ya existía retirada. Se ha vuelto a activar con todo lo que tenía apuntado.`,
      })
    }
  }

  const { data: ultima } = await supabase
    .from('categorias')
    .select('orden')
    .eq('padre_id', grupo.id)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('categorias')
    .insert({
      padre_id: grupo.id,
      nombre,
      /* El nombre de su carpeta en Drive. Sin tildes ni signos, en
         mayúsculas: MATERIALES, OBRAS_Y_MEJORAS. Se calcula del
         nombre para que nadie tenga que inventárselo. */
      segmento_drive: limpiar(nombre),
      naturaleza,
      orden: Number(ultima?.orden ?? 0) + 1,
    })
    .select('id, nombre')
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(
      { error: 'No se ha podido crear la partida.', detalle: error?.message },
      { status: 500 }
    )
  }

  /*
    LA CARPETA DE DRIVE NO SE CREA AQUÍ, Y ES A PROPÓSITO.

    A diferencia de las unidades, la carpeta de una partida lleva el
    año y el trimestre dentro —GASTOS/2026/T3/CARPINTERIA—, así que
    crearla ahora significaría inventarse un año y dejar carpetas
    vacías de trimestres que quizá no lleguen a usarse nunca. Se crea
    sola al guardar el primer papel, que es el camino de siempre.
  */
  return NextResponse.json({ bien: true, partida: data })
}

// ── Renombrar ────────────────────────────────────────────────
/*
  Se cambia el nombre, PERO NO su carpeta de Drive.

  Es una decisión, no un olvido. La carpeta de una partida no es una
  sola: son todas las de todos los trimestres —2025/T1/LUZ,
  2025/T2/LUZ…—. Renombrarlas todas serían decenas de llamadas a
  Google, y a medio camino un fallo dejaría media docena con el
  nombre viejo y otra media con el nuevo.

  Lo que se ve en HUBI cambia al momento. Las carpetas antiguas se
  quedan con el nombre con el que nacieron, que además es lo honesto:
  aquellos papeles se guardaron llamándose así.
*/
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
  const nombre = elNombre(cuerpo.nombre)

  if (!id) return NextResponse.json({ error: 'Falta la partida.' }, { status: 400 })
  if (nombre.length < 2) {
    return NextResponse.json({ error: 'Ponle un nombre.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('categorias')
    .update({ nombre })
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido cambiar el nombre.', detalle: error?.message },
      { status: error ? 500 : 409 }
    )
  }

  return NextResponse.json({ bien: true })
}

// ── Retirar ──────────────────────────────────────────────────
/*
  NO SE BORRA: SE RETIRA.

  Borrar una partida dejaría sus gastos sin sitio y las cuentas del
  año pasado dirían otra cosa de un día para otro. A quien lleva sus
  números aquí eso no se le hace.

  Retirada, deja de salir al apuntar cosas nuevas y lo viejo sigue
  contando. Y si algún día se vuelve a crear con el mismo nombre, se
  reactiva ésta en vez de nacer una gemela.
*/
export async function DELETE(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const id = new URL(peticion.url).searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'Falta la partida.' }, { status: 400 })

  /* Cuántos apuntes se quedan colgando. No impide retirarla —es
     legítimo dejar de usar una partida— pero se cuenta para poder
     decirlo, que no es lo mismo retirar algo vacío que algo con
     cuarenta facturas dentro. */
  const { count } = await supabase
    .from('movimientos')
    .select('id', { count: 'exact', head: true })
    .eq('categoria_id', id)

  const { data, error } = await supabase
    .from('categorias')
    .update({ activa: false })
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido retirar.', detalle: error?.message },
      { status: error ? 500 : 409 }
    )
  }

  return NextResponse.json({ bien: true, apuntes: count ?? 0 })
}
