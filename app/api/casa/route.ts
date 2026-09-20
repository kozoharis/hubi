import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { SIN_CASA } from '@/lib/hogar'
import { esImpuesto } from '@/lib/impuesto'
import { elEspacio } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  CREAR LA CASA
  ═══════════════════════════════════════════════════════════════

  Esta ruta casi no hace nada, y eso es lo correcto: todo el trabajo
  —el hogar, la persona dentro como propietaria, las carpetas base y
  la actividad— lo hace `crear_mi_casa` dentro de la base de datos, en
  UNA transacción. Ver sql/30.

  Si esto se hubiera montado como cuatro inserciones desde aquí, entre
  la primera y la cuarta cabe que se corte la cobertura, se cierre la
  pestaña o Vercel congele la función. Y quedarse a medias significa
  una persona con hogar y sin carpetas, o un hogar sin nadie dentro:
  nadie se enteraría hasta ir a guardar la primera factura.

  Se llama con la SESIÓN, no con la clave de servidor. La función sabe
  quién es por `auth.uid()`, así que nadie puede crear una casa a
  nombre de otro pasando un identificador a mano.
*/

const ACTIVIDADES = ['finca', 'obra', 'alquileres'] as const

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { nombre?: string; actividad?: string | null }
  try {
    cuerpo = (await peticion.json()) as { nombre?: string; actividad?: string | null }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const nombre = String(cuerpo.nombre ?? '').trim().slice(0, 60)
  if (nombre.length < 2) {
    return NextResponse.json({ error: 'Ponle un nombre a tu casa.' }, { status: 400 })
  }

  /* Lo que no esté en la lista es «ninguna». Nunca se pasa a la base
     de datos algo que venga del navegador sin comprobarlo. */
  const suelto = String(cuerpo.actividad ?? '')
  const actividad = (ACTIVIDADES as readonly string[]).includes(suelto) ? suelto : null

  const { data, error } = await supabase.rpc('crear_mi_casa', {
    nombre_casa: nombre,
    actividad,
  })

  if (error) {
    console.error('[MAPPEL] No se ha podido crear la casa:', error)

    /* El caso concreto que va a pasar de verdad: el SQL 30 todavía no
       se ha ejecutado. Merece decirse con nombre y apellidos en vez de
       un «algo ha fallado» que no ayuda a nadie. */
    const faltaLaFuncion = /crear_mi_casa|function|does not exist|schema cache/i.test(
      error.message
    )

    return NextResponse.json(
      {
        error: faltaLaFuncion
          ? 'mappel todavía no sabe crear casas nuevas. No es cosa tuya: avisa a quien lo mantiene.'
          : 'No se ha podido crear tu casa. Inténtalo en un minuto.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true, hogar: data })
}

/*
  ─────────────────────────────────────────────────────────────
  LO QUE ESTA CASA USA Y LO QUE NO

  Por ahora una sola cosa: si sale la lista de la compra. Va aquí y no
  en una ruta propia porque es un ajuste DE LA CASA, igual que su
  nombre, y una ruta por interruptor acabaría en veinte rutas que
  hacen lo mismo.
*/
export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const hogarId = await elEspacio(supabase)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 403 })

  type Cuerpo = {
    usa_compra?: boolean
    nombre?: string
    impuesto?: string
    /* El sitio de la casa, del paso 93. Van los cuatro juntos o
       ninguno: media coordenada no es un sitio. */
    sitio?: { nombre?: string; lat?: number; lon?: number; zona?: string } | null
  }

  let cuerpo: Cuerpo
  try {
    cuerpo = (await peticion.json()) as Cuerpo
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const cambios: Record<string, unknown> = {}
  if (typeof cuerpo.usa_compra === 'boolean') cambios.usa_compra = cuerpo.usa_compra

  /* El impuesto de la casa. Solo tres valores, y se comprueban aquí
     además de en la base de datos: un aviso claro vale más que un 500. */
  if (cuerpo.impuesto !== undefined) {
    if (!esImpuesto(cuerpo.impuesto)) {
      return NextResponse.json({ error: 'Ese impuesto no existe.' }, { status: 400 })
    }
    cambios.impuesto = cuerpo.impuesto
  }
  /*
    ── DÓNDE ESTÁ LA CASA ──

    Se comprueba aquí además de en la base de datos, y no es
    desconfiar de la base: es que estos números llegan de un buscador
    de pueblos y de un sensor del navegador, y los dos pueden
    devolver cualquier cosa un mal día. Un aviso en la pantalla vale
    más que un 500 con un `check` violado dentro.

    `sitio: null` es «quítalo», que es lo que deja la casa otra vez
    con el sitio del código. Tiene que poder deshacerse: quien se
    equivoca de Madrid —hay uno en Colombia— necesita poder volver
    atrás sin buscar el suyo a ciegas.
  */
  if (cuerpo.sitio !== undefined) {
    if (cuerpo.sitio === null) {
      cambios.sitio_nombre = null
      cambios.sitio_lat = null
      cambios.sitio_lon = null
      cambios.sitio_zona = null
    } else {
      const lat = Number(cuerpo.sitio.lat)
      const lon = Number(cuerpo.sitio.lon)
      const zona = String(cuerpo.sitio.zona ?? '').trim().slice(0, 64)
      const comoSeLlama = String(cuerpo.sitio.nombre ?? '').trim().slice(0, 80)

      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return NextResponse.json({ error: 'Ese sitio no es un sitio.' }, { status: 400 })
      }
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        return NextResponse.json({ error: 'Ese sitio no es un sitio.' }, { status: 400 })
      }
      /* El huso tiene que ser uno de verdad: es lo que se le manda a
         Open-Meteo para partir los días, y uno inventado hace que la
         previsión no llegue —sin decir por qué—. Se comprueba
         preguntándole al propio navegador del servidor. */
      let zonaBuena = 'Europe/Madrid'
      try {
        new Intl.DateTimeFormat('es-ES', { timeZone: zona })
        zonaBuena = zona
      } catch {
        return NextResponse.json({ error: 'Ese huso horario no existe.' }, { status: 400 })
      }

      cambios.sitio_nombre = comoSeLlama || 'Tu casa'
      cambios.sitio_lat = lat
      cambios.sitio_lon = lon
      cambios.sitio_zona = zonaBuena
    }
  }

  if (cuerpo.nombre !== undefined) {
    const nombre = String(cuerpo.nombre).trim().slice(0, 60)
    if (nombre.length < 2) {
      return NextResponse.json({ error: 'La casa necesita un nombre.' }, { status: 400 })
    }
    cambios.nombre = nombre
  }

  if (Object.keys(cambios).length === 0) return NextResponse.json({ bien: true })

  let { data, error } = await supabase
    .from('hogares')
    .update(cambios)
    .eq('id', hogarId)
    .select('id')

  /*
    ── Y SI EL PASO 93 NO SE HA EJECUTADO TODAVÍA ──

    Postgres rechaza el UPDATE entero por una columna que no conoce,
    no sólo esa columna. Sin este respaldo, publicar esto antes de
    tocar la base de datos dejaría sin poder cambiarse el NOMBRE de la
    casa, ni el impuesto, ni la compra — cosas que no tienen nada que
    ver con el sitio.

    Se reintenta sin las cuatro columnas nuevas y se avisa, porque
    aquí callar sería peor: quien acaba de elegir su pueblo tiene que
    saber que no se ha guardado.
  */
  if (error && /sitio_/.test(error.message ?? '')) {
    const sinElSitio: Record<string, unknown> = { ...cambios }
    delete sinElSitio.sitio_nombre
    delete sinElSitio.sitio_lat
    delete sinElSitio.sitio_lon
    delete sinElSitio.sitio_zona

    if (Object.keys(sinElSitio).length === 0) {
      return NextResponse.json(
        {
          error: 'Todavía no se puede guardar dónde está la casa.',
          detalle: 'Ejecuta el paso 93 en Supabase.',
        },
        { status: 409 }
      )
    }

    ;({ data, error } = await supabase
      .from('hogares')
      .update(sinElSitio)
      .eq('id', hogarId)
      .select('id'))
  }

  /*
    `hogares` no tiene política de UPDATE: hasta hoy nadie cambiaba
    nada de la casa. Así que esto puede devolver cero filas sin dar
    ningún error, y hay que decirlo — con el nombre del archivo que
    falta, para no mandar a nadie a buscar a ciegas.
  */
  if (error || !data || data.length === 0) {
    console.error('[MAPPEL] No se ha podido cambiar la casa:', error)
    return NextResponse.json(
      {
        error: 'No se ha podido guardar el cambio.',
        detalle: error?.message ?? 'Esto todavía no está disponible en esta casa.',
      },
      { status: error ? 500 : 409 }
    )
  }

  return NextResponse.json({ bien: true })
}
