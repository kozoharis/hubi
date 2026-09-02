import { NextResponse, after, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { accesoDrive, asegurarRaiz, idDeCarpeta, moverYRenombrar } from '@/lib/google/drive'
import { limpiar } from '@/lib/rutas'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/*
  ═══════════════════════════════════════════════════════════════
  CREAR, RENOMBRAR Y RETIRAR UNIDADES
  ═══════════════════════════════════════════════════════════════

  Una unidad es DE QUIÉN es el gasto: «Helechos 2», «Piso abuela»,
  «Obra Manuel». Y cada una tiene su carpeta en el Drive de la casa.

  ─────────────────────────────────────────────────────────────
  LA CARPETA SE CREA AHORA, NO AL GUARDAR EL PRIMER PAPEL

  Se podría esperar: crear la carpeta la primera vez que alguien
  fotografíe una factura de esa obra. Sería más barato y dejaría
  menos carpetas vacías.

  Pero entonces, si la conexión con Drive está rota, nadie se entera
  HOY. Se entera dentro de tres semanas, con una factura en la mano,
  cuando el documento no aparezca por ningún sitio y ya nadie
  recuerde qué se tocó. Es exactamente lo que el punto 23 del
  planteamiento prohíbe: descubrir tarde que la integración no
  funcionaba.

  Creándola ahora, el fallo sale con la unidad delante y con la causa
  clara. Y además la persona abre su Drive y ve la carpeta, que es lo
  que hace que se entienda de una vez dónde vive todo esto.

  ─────────────────────────────────────────────────────────────
  PERO SI DRIVE FALLA, LA UNIDAD SE CREA IGUAL

  Lo que NO se hace es abortar. La unidad es una fila en nuestra base
  de datos y sirve para llevar las cuentas aunque Google esté caído.
  Se crea, se avisa de que su carpeta no se ha podido hacer, y la
  carpeta se creará sola en cuanto se guarde el primer documento —que
  es el camino de siempre y ese sí que funciona.

  Al revés sería peor: quedarse sin poder apuntar los gastos de una
  obra porque Google no contestó en ese momento.
*/

type Entrada = {
  id?: string
  seccion_id?: string
  nombre?: string
  referencia?: string | null
  presupuesto?: number | string | null
}

function elNombre(v: unknown): string {
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

function elDinero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** El segmento de la sección en Drive: HELECHOS, OBRAS… */
async function raizDeLaSeccion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  seccionId: string
): Promise<{ segmento: string; hogarId: string | null } | null> {
  const { data } = await supabase
    .from('categorias')
    .select('id, segmento_drive, padre_id')
    .eq('id', seccionId)
    .maybeSingle()

  if (!data || data.padre_id) return null

  let hogarId: string | null = null
  try {
    const { data: conHogar } = await supabase
      .from('categorias')
      .select('hogar_id')
      .eq('id', seccionId)
      .maybeSingle()
    hogarId = (conHogar?.hogar_id as string | null) ?? null
  } catch {
    /* Todavía no hay hogares. No es motivo para no crear la carpeta. */
  }

  return { segmento: data.segmento_drive as string, hogarId }
}

/** Crea (o encuentra) la carpeta de una unidad y devuelve su id. */
async function carpetaDeLaUnidad(
  segmentoSeccion: string,
  nombreUnidad: string,
  hogarId: string | null
): Promise<string | null> {
  try {
    const { acceso, raiz } = await accesoDrive()
    if (!acceso) return null

    /* La raíz viene ya resuelta de la conexión guardada. Pedirla otra
       vez sería una llamada de más a Google en cada unidad nueva. */
    const donde = raiz || (await asegurarRaiz(acceso))

    return await idDeCarpeta(acceso, donde, [segmentoSeccion, limpiar(nombreUnidad)], hogarId)
  } catch (e) {
    console.error('[HUBI] No se ha podido crear la carpeta de la unidad:', e)
    return null
  }
}

// ── Crear ────────────────────────────────────────────────────
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

  if (nombre.length < 2) {
    return NextResponse.json({ error: 'Ponle un nombre.' }, { status: 400 })
  }
  if (!seccionId) {
    return NextResponse.json({ error: 'Falta la sección.' }, { status: 400 })
  }

  const seccion = await raizDeLaSeccion(supabase, seccionId)
  if (!seccion) {
    return NextResponse.json({ error: 'Esa sección no existe.' }, { status: 404 })
  }

  /*
    DOS CON EL MISMO NOMBRE, NO.

    No por manía de orden: dos «Obra Manuel» compartirían carpeta en
    Drive y al oírlo por voz no habría manera de saber a cuál se
    refiere. Se avisa con esas palabras en vez de crearla y que el lío
    aparezca tres semanas después.
  */
  const { data: repetida } = await supabase
    .from('unidades')
    .select('id')
    .eq('seccion_id', seccionId)
    .eq('activa', true)
    .ilike('nombre', nombre)
    .maybeSingle()

  if (repetida) {
    return NextResponse.json({ error: `Ya hay una que se llama «${nombre}».` }, { status: 409 })
  }

  // El siguiente sitio en la lista.
  const { data: ultima } = await supabase
    .from('unidades')
    .select('orden')
    .eq('seccion_id', seccionId)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()

  const carpeta = await carpetaDeLaUnidad(seccion.segmento, nombre, seccion.hogarId)

  const { data, error } = await supabase
    .from('unidades')
    .insert({
      seccion_id: seccionId,
      nombre,
      referencia: cuerpo.referencia?.toString().trim() || null,
      presupuesto: elDinero(cuerpo.presupuesto),
      orden: Number(ultima?.orden ?? 0) + 1,
      carpeta_drive_id: carpeta,
    })
    .select('id, nombre, orden')
    .single()

  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes('unidades')
          ? 'Falta ejecutar sql/25-unidades.sql y sql/26-unidades-en-drive.sql.'
          : 'No se ha podido crear.',
        detalle: error.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    bien: true,
    unidad: data,
    carpeta: Boolean(carpeta),
    /* Se dice, no se calla. Si la carpeta no está, la persona tiene
       que saberlo ahora y no cuando falte un papel. */
    aviso: carpeta
      ? null
      : 'Se ha creado, pero su carpeta en Google Drive no. Se creará sola al guardar el primer documento.',
  })
}

// ── Renombrar y editar ───────────────────────────────────────
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
  if (!id) return NextResponse.json({ error: 'Falta la unidad.' }, { status: 400 })

  const { data: antes } = await supabase
    .from('unidades')
    .select('id, nombre, seccion_id, carpeta_drive_id')
    .eq('id', id)
    .maybeSingle()

  if (!antes) {
    return NextResponse.json({ error: 'Esa ya no está.' }, { status: 404 })
  }

  const cambios: Record<string, unknown> = {}

  if (cuerpo.nombre !== undefined) {
    const nombre = elNombre(cuerpo.nombre)
    if (nombre.length < 2) {
      return NextResponse.json({ error: 'Ponle un nombre.' }, { status: 400 })
    }
    cambios.nombre = nombre
  }
  if (cuerpo.referencia !== undefined) {
    cambios.referencia = cuerpo.referencia?.toString().trim() || null
  }
  if (cuerpo.presupuesto !== undefined) {
    cambios.presupuesto = elDinero(cuerpo.presupuesto)
  }

  if (Object.keys(cambios).length === 0) return NextResponse.json({ bien: true })

  const { data, error } = await supabase
    .from('unidades')
    .update(cambios)
    .eq('id', id)
    .select('id')

  /* El `.select()` no es decoración: con seguridad por filas, un
     UPDATE sin permiso no falla — cambia CERO filas y dice que todo
     ha ido bien. */
  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido guardar el cambio.', detalle: error?.message },
      { status: error ? 500 : 409 }
    )
  }

  /*
    Y QUE LA CARPETA DE DRIVE SE LLAME IGUAL.

    Va después de contestar —con `after`, que en Vercel es la única
    forma de que un trabajo lanzado al final se termine de verdad— y
    NO puede tumbar el cambio: el nombre en HUBI ya está guardado. Si
    Google falla, quedan la carpeta con el nombre viejo y la unidad
    con el nuevo, que es feo pero no pierde nada. Abortar el cambio
    porque Google no contesta sí sería perderlo.
  */
  const nuevoNombre = cambios.nombre as string | undefined
  if (nuevoNombre && antes.carpeta_drive_id && nuevoNombre !== antes.nombre) {
    const carpeta = antes.carpeta_drive_id as string
    after(async () => {
      try {
        const { acceso } = await accesoDrive()
        if (!acceso) return
        /* Misma carpeta de origen y destino: esto solo renombra. Mandar
           padres distintos aquí dejaría la carpeta suelta en el Drive. */
        await moverYRenombrar(acceso, carpeta, limpiar(nuevoNombre), carpeta, carpeta)
      } catch (e) {
        console.error('[HUBI] Unidad renombrada, carpeta de Drive no:', e)
      }
    })
  }

  return NextResponse.json({ bien: true })
}

// ── Retirar ──────────────────────────────────────────────────
/*
  NO SE BORRA: SE RETIRA.

  Una obra terminada no desaparece —sus gastos del año pasado siguen
  contando en la declaración—, simplemente deja de salir al apuntar
  cosas nuevas. Y su carpeta en Drive se queda intacta.

  Borrarla de verdad dejaría sus movimientos huérfanos y las cuentas
  de años anteriores dirían otra cosa de un día para otro. Eso no se
  le hace a nadie que lleve sus números aquí.
*/
export async function DELETE(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const id = new URL(peticion.url).searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'Falta la unidad.' }, { status: 400 })

  const { data, error } = await supabase
    .from('unidades')
    .update({ activa: false })
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido retirar.', detalle: error?.message },
      { status: error ? 500 : 409 }
    )
  }

  return NextResponse.json({ bien: true })
}

/*
  Aquí NO se usa nunca la clave de servidor, y es a propósito: todo lo
  de esta ruta es del hogar de quien ha entrado, y las políticas por
  hogar son justamente lo que impide tocar lo de otra casa. Si algún
  día alguien la mete «para que funcione», habrá abierto un boquete.
*/
