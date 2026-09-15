import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { quien } from '@/lib/supabase/quien'
import { elEspacio } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  EL TABLÓN DE FOTOS
  ═══════════════════════════════════════════════════════════════

  Las fotos que pasan en la pantalla de la cocina. Se suben desde el
  móvil de cualquiera de la casa y desde la propia tableta, con su
  cámara.

  ─────────────────────────────────────────────────────────────
  QUIÉN COMPRUEBA QUÉ, Y POR QUÉ ASÍ

  Hay dos clientes de Supabase en juego y la división no es un capricho:

      clienteSesion()   →  la persona (o la pantalla) que pregunta.
                           Es quien escribe en `fotos_casa`, así que
                           la cerradura de verdad es la RLS del paso 73.

      clienteServidor() →  la llave de servicio. SOLO toca el cubo de
                           Storage, que es privado y no tiene ni una
                           política.

  O sea: **la autorización la decide la base, no este fichero.** Si
  mañana alguien cambia una política, esto empieza a fallar solo, que es
  lo que tiene que pasar. Al revés —comprobar aquí y escribir con la
  llave de servicio— este fichero SERÍA la cerradura, y una cerradura
  escrita en JavaScript se olvida de una rama el día que se añade la
  tercera.

  Por eso el orden importa y es éste:

      1 · se sube el fichero al cubo   (llave de servicio)
      2 · se escribe la fila           (sesión → la RLS decide)
      3 · si 2 falla, se borra lo de 1

  Nunca al revés. Una fila sin fichero es una foto rota en la pared; un
  fichero sin fila es un byte perdido que no ve nadie.
*/

const CUBO = 'fotos-casa'

/* El tablón no crece para siempre. Es un corcho, no un álbum: la más
   nueva empuja a la más vieja. Google Fotos ya existe y es mejor. */
const CUANTAS_CABEN = 24

const TIPOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/* Ocho megas, lo mismo que dice el cubo. Está en dos sitios a propósito:
   aquí para contestar bien y rápido, y en el cubo porque es la única
   que no se puede saltar. */
const TOPE = 8 * 1024 * 1024


// ═══════════════════════════════════════════════════════════════
// LAS FOTOS, CON SU DIRECCIÓN FIRMADA
// ═══════════════════════════════════════════════════════════════
export async function GET() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const hogarId = await elEspacio(supabase)
  if (!hogarId) return NextResponse.json({ error: 'No se sabe de qué casa.' }, { status: 403 })

  /*
    Con la sesión: quien no pueda verlas —la ayuda, el asesor— recibe
    una lista vacía porque la política no le devuelve filas. No hace
    falta comprobarlo aquí, y es mejor que no se compruebe: una sola
    regla.
  */
  const { data, error } = await supabase
    .from('fotos_casa')
    .select('id, ruta, pie, creado_en')
    .eq('hogar_id', hogarId)
    .order('creado_en', { ascending: false })
    .limit(CUANTAS_CABEN)

  if (error) {
    /* Sin el paso 73 todavía: se contesta vacío en vez de romper la
       pantalla de la cocina, que es donde más falta hace que no se
       rompa nada. */
    return NextResponse.json({ fotos: [], sinTabla: true })
  }

  const filas = data ?? []
  if (filas.length === 0) return NextResponse.json({ fotos: [] })

  /*
    Direcciones firmadas y no un cubo público. Caducan a las dos horas:
    de sobra para una pared que se repinta cada cinco minutos, y poco
    para que una dirección copiada sirva de algo mañana.
  */
  const admin = clienteServidor()
  const { data: firmadas } = await admin.storage
    .from(CUBO)
    .createSignedUrls(filas.map((f) => f.ruta as string), 2 * 60 * 60)

  const porRuta = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]))

  return NextResponse.json({
    fotos: filas
      .map((f) => ({
        id: f.id as string,
        pie: (f.pie as string | null) ?? null,
        creado_en: f.creado_en as string,
        url: porRuta.get(f.ruta as string) ?? null,
      }))
      /* Una fila cuya foto ya no está en el cubo no se enseña rota: no
         se enseña. */
      .filter((f) => f.url),
  })
}


// ═══════════════════════════════════════════════════════════════
// SUBIR UNA
// ═══════════════════════════════════════════════════════════════
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const hogarId = await elEspacio(supabase)
  if (!hogarId) return NextResponse.json({ error: 'No se sabe de qué casa.' }, { status: 403 })

  const formulario = await peticion.formData().catch(() => null)
  const fichero = formulario?.get('foto')

  if (!(fichero instanceof File)) {
    return NextResponse.json({ error: 'No ha llegado ninguna foto.' }, { status: 400 })
  }

  const extension = TIPOS[fichero.type]
  if (!extension) {
    return NextResponse.json(
      {
        error: 'Eso no es una foto.',
        detalle: 'Valen fotos normales: JPG, PNG o WEBP.',
      },
      { status: 400 }
    )
  }

  if (fichero.size > TOPE) {
    return NextResponse.json(
      {
        error: 'La foto pesa demasiado.',
        detalle: 'El máximo son 8 MB. Normalmente mappel la reduce antes de mandarla.',
      },
      { status: 400 }
    )
  }

  const pieCrudo = String(formulario?.get('pie') ?? '').trim().replace(/\s+/g, ' ')
  const pie = pieCrudo.length > 0 ? pieCrudo.slice(0, 80) : null

  /* La casa delante en la ruta. Sirve para dos cosas: que se vea de un
     vistazo de quién es cada fichero, y que borrar una casa entera sea
     borrar una carpeta. */
  const ruta = `${hogarId}/${crypto.randomUUID()}.${extension}`

  const admin = clienteServidor()

  const { error: alSubir } = await admin.storage
    .from(CUBO)
    .upload(ruta, fichero, { contentType: fichero.type, upsert: false })

  if (alSubir) {
    console.error('[MAPPEL] No se ha podido guardar la foto:', alSubir.message)
    return NextResponse.json(
      {
        error: 'No se ha podido guardar la foto.',
        /* Si falta el cubo, el mensaje de Supabase lo dice, y eso es
           mejor que un «algo ha ido mal». */
        detalle: alSubir.message,
      },
      { status: 500 }
    )
  }

  /* Y ahora la fila, CON LA SESIÓN. Aquí es donde la base decide si
     quien sube tiene derecho — incluida la pantalla de la cocina, que
     sí lo tiene. */
  const { error: alApuntar } = await supabase
    .from('fotos_casa')
    .insert({ hogar_id: hogarId, ruta, subida_por: user.id, pie })
    .select('id')

  if (alApuntar) {
    /* Sin fila no hay foto, así que el fichero sobra. Se quita para no
       ir dejando bytes de nadie por el cubo. */
    await admin.storage.from(CUBO).remove([ruta])

    console.error('[MAPPEL] La foto no ha entrado en el tablón:', alApuntar.message)
    return NextResponse.json(
      { error: 'No se ha podido poner en el tablón.', detalle: alApuntar.message },
      { status: 403 }
    )
  }

  await hacerSitio(hogarId)

  return NextResponse.json({ bien: true })
}


// ═══════════════════════════════════════════════════════════════
// QUITAR UNA
// ═══════════════════════════════════════════════════════════════
export async function DELETE(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const hogarId = await elEspacio(supabase)
  if (!hogarId) return NextResponse.json({ error: 'No se sabe de qué casa.' }, { status: 403 })

  const cuerpo = (await peticion.json().catch(() => null)) as { id?: string } | null
  const id = String(cuerpo?.id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'No se sabe qué foto.' }, { status: 400 })
  }

  /*
    Se borra CON LA SESIÓN y se mira qué ha vuelto. Si la política dice
    que no —una pantalla de cocina, por ejemplo— no vuelve nada, y esto
    contesta que no se ha podido. No se comprueba aquí quién es: se
    intenta, y manda la base.
  */
  const { data, error } = await supabase
    .from('fotos_casa')
    .delete()
    .eq('hogar_id', hogarId)
    .eq('id', id)
    .select('ruta')

  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido quitar.', detalle: error.message },
      { status: 500 }
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      {
        error: 'No se ha podido quitar esa foto.',
        detalle: 'Las fotos se quitan desde el móvil, no desde la pantalla de la cocina.',
      },
      { status: 403 }
    )
  }

  const admin = clienteServidor()
  await admin.storage.from(CUBO).remove(data.map((f) => f.ruta as string))

  return NextResponse.json({ bien: true })
}


/*
  ── EL CORCHO NO CRECE PARA SIEMPRE ──

  Pasadas veinticuatro, la más nueva empuja a la más vieja.

  Esto SÍ va con la llave de servicio, y es la única excepción del
  fichero, así que conviene decir por qué: no es alguien borrando una
  foto —eso está prohibido para una pantalla y comprobado por la RLS—,
  es el tablón haciéndose sitio. Si fuera con la sesión, una foto subida
  desde la tableta no podría empujar a ninguna, y el corcho crecería sin
  fin justo por el lado por el que más se usa.

  Y si falla, no pasa nada: la foto ya está puesta. Se intentará en la
  siguiente.
*/
async function hacerSitio(hogarId: string) {
  try {
    const admin = clienteServidor()

    const { data } = await admin
      .from('fotos_casa')
      .select('id, ruta')
      .eq('hogar_id', hogarId)
      .order('creado_en', { ascending: false })

    const sobran = (data ?? []).slice(CUANTAS_CABEN)
    if (sobran.length === 0) return

    await admin
      .from('fotos_casa')
      .delete()
      .in('id', sobran.map((f) => f.id as string))

    await admin.storage.from(CUBO).remove(sobran.map((f) => f.ruta as string))
  } catch (e) {
    console.error('[MAPPEL] No se ha podido hacer sitio en el tablón:', e)
  }
}
