import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { limpiar } from '@/lib/rutas'

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

/*
  ═══════════════════════════════════════════════════════════════
  CREAR UNA ACTIVIDAD NUEVA
  ═══════════════════════════════════════════════════════════════

  Faltaba, y era un agujero grande: se podían crear partidas y partes
  DENTRO de una actividad, pero no la actividad. O sea que la familia
  se quedaba con lo que eligió el primer día, y para añadir «Obras» a
  una casa que ya tenía «Finca» había que llamar a un programador —
  justo lo que el punto 11 dice que no puede pasar.

  ─────────────────────────────────────────────────────────────
  LAS MISMAS PLANTILLAS QUE AL EMPEZAR

  Finca, obras, alquileres o «otra cosa». Son las mismas cuatro que
  se ofrecen al crear la casa, a propósito: dos vocabularios distintos
  para lo mismo obligarían a la persona a traducir.

  ─────────────────────────────────────────────────────────────
  POR QUÉ ESTO NO ES UNA FUNCIÓN DE LA BASE DE DATOS

  Crear la casa sí lo es —sql/30—, porque quedarse a medias allí deja
  a alguien con hogar y sin nada dentro, y no se descubre hasta mucho
  después. Aquí, quedarse a medias deja una actividad con menos
  partidas de las previstas: se ve, y se arregla desde la propia
  pantalla de partidas en diez segundos.

  A cambio se gana algo que hoy vale más que la elegancia: **no hace
  falta ejecutar ningún SQL nuevo para que esto funcione.**
*/

const PLANTILLAS: Record<
  string,
  {
    icono: string
    color: string
    fondo: string
    divide: boolean
    palabra: string | null
    reparte: boolean
    gastos: string[]
    ingresos: string[]
  }
> = {
  finca: {
    icono: '🌿',
    color: '#14B8A6',
    fondo: '#DFF7F3',
    divide: false,
    palabra: null,
    reparte: false,
    gastos: ['Agua', 'Luz', 'Productos', 'Obras y mejoras', 'Maquinaria', 'Mantenimiento', 'Otros'],
    ingresos: ['Ventas', 'Otros ingresos'],
  },
  obra: {
    icono: '🧱',
    color: '#F59E0B',
    fondo: '#FEF1DC',
    divide: true,
    palabra: 'la obra',
    reparte: false,
    gastos: [
      'Albañilería',
      'Estructura',
      'Instalaciones',
      'Carpintería',
      'Materiales',
      'Mano de obra',
      'Otros',
    ],
    ingresos: ['Certificaciones', 'Otros ingresos'],
  },
  alquileres: {
    icono: '🔑',
    color: '#8B5CF6',
    fondo: '#EEE8FE',
    divide: true,
    palabra: 'el piso',
    /* Lo común se reparte solo aquí: pisos parecidos, luz partida a
       partes iguales. Entre obras de tamaños distintos sería mentir. */
    reparte: true,
    gastos: ['Luz', 'Agua', 'Comunidad', 'Limpieza', 'Reparaciones', 'Otros'],
    ingresos: ['Alquiler', 'Otros ingresos'],
  },
  otra: {
    icono: '📁',
    color: '#3B82F6',
    fondo: '#E4EEFE',
    divide: false,
    palabra: null,
    reparte: false,
    /* Una sola partida de cada, para que se pueda apuntar algo desde
       el primer minuto. Las suyas las pone él, que es el punto. */
    gastos: ['Otros'],
    ingresos: ['Otros ingresos'],
  },
}

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { nombre?: string; tipo?: string }
  try {
    cuerpo = (await peticion.json()) as { nombre?: string; tipo?: string }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const nombre = String(cuerpo.nombre ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
  if (nombre.length < 2) {
    return NextResponse.json({ error: 'Ponle un nombre.' }, { status: 400 })
  }

  const plantilla = PLANTILLAS[String(cuerpo.tipo ?? '')] ?? PLANTILLAS.otra
  const segmento = limpiar(nombre)

  if (!segmento) {
    return NextResponse.json(
      { error: 'Ese nombre no sirve para una carpeta. Usa letras y números.' },
      { status: 400 }
    )
  }

  /*
    ¿YA TIENE UNA ASÍ?

    Se mira antes de intentarlo. La base de datos también lo impide
    —la clave es (hogar, padre, nombre)— pero un choque de clave
    devuelve un error técnico que no le dice nada a nadie, y sobre
    todo: si la que existe está RETIRADA, lo correcto no es crear otra
    igual sino devolverle la suya.
  */
  const { data: yaHay } = await supabase
    .from('categorias')
    .select('id, nombre, activa')
    .is('padre_id', null)
    .or(`nombre.ilike.${nombre},segmento_drive.eq.${segmento}`)

  const misma = (yaHay ?? [])[0]

  if (misma) {
    if (misma.activa === false) {
      const { data: revivida } = await supabase
        .from('categorias')
        .update({ activa: true, lleva_cuentas: true })
        .eq('id', misma.id)
        .select('id')

      if (revivida && revivida.length > 0) {
        return NextResponse.json({
          bien: true,
          id: misma.id,
          aviso: `«${misma.nombre}» ya existía retirada y se ha vuelto a activar, con lo que tuviera dentro.`,
        })
      }
    }

    return NextResponse.json(
      { error: `Ya tienes algo llamado «${misma.nombre}».` },
      { status: 409 }
    )
  }

  /* Dónde se coloca: detrás de lo que ya haya. */
  const { data: ultimas } = await supabase
    .from('categorias')
    .select('orden')
    .is('padre_id', null)
    .order('orden', { ascending: false })
    .limit(1)

  const orden = ((ultimas?.[0]?.orden as number | null) ?? 0) + 1

  /*
    `hogar_id` NO se manda: la columna tiene `default mi_hogar()` y la
    política de creación exige `hogar_id = mi_hogar()`. Mandarlo a mano
    desde el navegador sería justo la puerta que esa política cierra.
  */
  const { data: creada, error } = await supabase
    .from('categorias')
    .insert({
      nombre,
      segmento_drive: segmento,
      icono: plantilla.icono,
      color: plantilla.color,
      fondo: plantilla.fondo,
      orden,
      activa: true,
      lleva_cuentas: true,
      usa_unidades: plantilla.divide,
      palabra_unidad: plantilla.palabra,
      reparte_comunes: plantilla.reparte,
    })
    .select('id')
    .maybeSingle()

  /* Con seguridad por filas, un INSERT sin permiso no falla: no crea
     nada y no dice nada. El `.select()` es lo que lo delata. */
  if (error || !creada?.id) {
    console.error('[HUBI] No se ha podido crear la actividad:', error)
    return NextResponse.json(
      { error: 'No se ha podido crear la actividad.', detalle: error?.message },
      { status: 500 }
    )
  }

  const raiz = creada.id as string

  /*
    Y lo de dentro. Si algo de esto falla, la actividad YA existe y se
    ve: lo que faltará son partidas, y ésas se añaden desde su propia
    pantalla. Por eso no se aborta ni se deshace nada — deshacerlo
    sería borrarle algo que ya está viendo.
  */
  try {
    const { data: grupos } = await supabase
      .from('categorias')
      .insert([
        {
          padre_id: raiz,
          nombre: 'Gastos',
          segmento_drive: 'GASTOS',
          icono: '💸',
          orden: 1,
          naturaleza: 'gasto',
        },
        {
          padre_id: raiz,
          nombre: 'Ingresos',
          segmento_drive: 'INGRESOS',
          icono: '💰',
          orden: 2,
          naturaleza: 'ingreso',
        },
      ])
      .select('id, segmento_drive')

    const deGasto = (grupos ?? []).find((g) => g.segmento_drive === 'GASTOS')?.id
    const deIngreso = (grupos ?? []).find((g) => g.segmento_drive === 'INGRESOS')?.id

    const partidas = [
      ...(deGasto
        ? plantilla.gastos.map((n, i) => ({
            padre_id: deGasto,
            nombre: n,
            segmento_drive: limpiar(n),
            orden: i + 1,
            naturaleza: 'gasto',
          }))
        : []),
      ...(deIngreso
        ? plantilla.ingresos.map((n, i) => ({
            padre_id: deIngreso,
            nombre: n,
            segmento_drive: limpiar(n),
            orden: i + 1,
            naturaleza: 'ingreso',
          }))
        : []),
    ]

    if (partidas.length > 0) await supabase.from('categorias').insert(partidas)
  } catch (e) {
    console.error('[HUBI] Actividad creada, partidas a medias:', e)
  }

  return NextResponse.json({ bien: true, id: raiz })
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
