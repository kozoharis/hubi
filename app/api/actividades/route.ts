import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { limpiar } from '@/lib/rutas'
import { elEspacioO } from '@/lib/espacio'

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

/*
  Los papeles NO llevan plantilla, y es a propósito.

  Las partidas de gasto cambian mucho de una actividad a otra —una
  finca gasta en productos y una obra en albañilería—. Los papeles no:
  el contrato y el seguro los tiene una finca, un piso y una obra
  igual. Inventar tres listas distintas de lo mismo solo daría tres
  sitios donde arreglar la misma errata.

  Las suyas las añade cada familia desde «Cómo la llevas», que es el
  punto 11 del planteamiento. Esto es de dónde se parte, no la ley.
*/
const PAPELES = ['Contratos', 'Seguros', 'Otros papeles']

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
    /* Era `#14B8A6`, que es el color de ACCIÓN. Cada actividad que se
       creaba nacía marcada con el color de «pulsa esto». Los cuatro
       pasan a la paleta apagada, que es la que identifica. */
    color: '#6FA88A',
    fondo: '#E9F2ED',
    divide: false,
    palabra: null,
    reparte: false,
    gastos: ['Agua', 'Luz', 'Productos', 'Obras y mejoras', 'Maquinaria', 'Mantenimiento', 'Otros'],
    ingresos: ['Ventas', 'Otros ingresos'],
  },
  obra: {
    /* Un casco, no un ladrillo. A tamaño de pestaña un ladrillo se
       lee como una caja; el casco se reconoce de un vistazo y dice
       «obra» sin que nadie tenga que interpretarlo. */
    icono: '👷',
    color: '#C09A62',
    fondo: '#F5EDE0',
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
    color: '#9AA85E',
    fondo: '#EFF1E3',
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
    color: '#6B93D6',
    fondo: '#E7EDF8',
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
    .eq('hogar_id', await elEspacioO(supabase))
    .is('padre_id', null)
    .or(`nombre.ilike.${nombre},segmento_drive.eq.${segmento}`)

  const misma = (yaHay ?? [])[0]

  if (misma) {
    if (misma.activa === false) {
      const { data: revivida } = await supabase
        .from('categorias')
        .update({ activa: true, lleva_cuentas: true })
        .eq('hogar_id', await elEspacioO(supabase))
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
    .eq('hogar_id', await elEspacioO(supabase))
    .is('padre_id', null)
    .order('orden', { ascending: false })
    .limit(1)

  const orden = ((ultimas?.[0]?.orden as number | null) ?? 0) + 1

  /*
    EL ESPACIO SE MANDA, Y SE MANDA DESDE AQUÍ.

    Antes no se mandaba: la columna tenía `default mi_hogar()` y la
    política exigía `hogar_id = mi_hogar()`, así que dejarlo en blanco
    era más seguro que aceptarlo del navegador.

    Las dos mitades de ese razonamiento se han caído. La política pasa
    a preguntar `soy_de(hogar_id)` —«¿eres miembro de ESE espacio?»—,
    que a quien tiene dos les dice que sí a los dos; y el valor por
    defecto ya no está, precisamente para que nadie lo herede sin
    querer. Y el espacio no viene del navegador: lo pone el servidor.
  */
  const { data: creada, error } = await supabase
    .from('categorias')
    .insert({
      hogar_id: await elEspacioO(supabase),
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

  /* El espacio, una vez, para todo lo que cuelga de la actividad
     recién creada. Es el mismo en el que se acaba de crear ella. */
  const espacioActividad = await elEspacioO(supabase)

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
          hogar_id: espacioActividad,
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

    /*
      ── Y LA TERCERA: LOS PAPELES ──

      Contrato, póliza, licencia, escritura. No son dinero: no salen
      ni entran, y por eso van en una carpeta 'neutro' —donde un
      importe leído por la cámara se guarda con el papel pero NO se
      apunta en el balance—.

      Normalmente esto ya lo ha hecho el disparador del SQL 42 al
      insertar la raíz, dos líneas más arriba. Se mira antes de crear
      nada: si el SQL todavía no se ha ejecutado, la actividad nueva
      tiene sus papeles igual; y si se ejecutó, aquí no pasa nada.
    */
    const { data: yaEstan } = await supabase
      .from('categorias')
      .select('id')
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('padre_id', raiz)
      .eq('segmento_drive', 'DOCUMENTOS')
      .maybeSingle()

    let dePapeles = yaEstan?.id as string | undefined

    if (!dePapeles) {
      const { data: creado } = await supabase
        .from('categorias')
        .insert({
          hogar_id: espacioActividad,
          padre_id: raiz,
          nombre: 'Documentos',
          segmento_drive: 'DOCUMENTOS',
          icono: '📄',
          orden: 3,
          naturaleza: 'neutro',
        })
        .select('id')
        .maybeSingle()

      dePapeles = creado?.id as string | undefined
    } else {
      /* Ya las puso el disparador con sus tres carpetas dentro. */
      dePapeles = undefined
    }

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
      ...(dePapeles
        ? PAPELES.map((n, i) => ({
            padre_id: dePapeles,
            nombre: n,
            segmento_drive: limpiar(n),
            orden: i + 1,
            naturaleza: 'neutro',
          }))
        : []),
    ]

    if (partidas.length > 0) {
      await supabase
        .from('categorias')
        .insert(partidas.map((x) => ({ ...x, hogar_id: espacioActividad })))
    }
  } catch (e) {
    console.error('[HUBI] Actividad creada, partidas a medias:', e)
  }

  return NextResponse.json({ bien: true, id: raiz })
}

/*
  ═══════════════════════════════════════════════════════════════
  QUITAR UNA ACTIVIDAD
  ═══════════════════════════════════════════════════════════════

  Faltaba, y era de las cosas que más rabia dan: te equivocas al
  crearla —el nombre mal, el tipo que no era— y se queda ahí para
  siempre, ocupando una pestaña abajo.

  ─────────────────────────────────────────────────────────────
  Y HACE DOS COSAS DISTINTAS SEGÚN LO QUE TENGA DENTRO

  · **Vacía** → se borra de verdad. Es el caso de la equivocación de
    hace dos minutos, y ahí «retirarla» sería dejar basura escondida
    que dentro de un año nadie sabe qué es. Con ella se van sus
    partidas y sus partes, que tampoco tienen nada.

  · **Con apuntes o papeles** → se retira. Borrarla de verdad
    agujerearía las cuentas de años anteriores: el total de 2025 dejaría
    de cuadrar y nadie entendería por qué. Se esconde, y volver a
    crearla con el mismo nombre la devuelve entera.

  La diferencia se le DICE a quien pulsa, antes de pulsar. Un botón
  que unas veces borra y otras no, sin avisar, es un botón en el que
  no se puede confiar.
*/
export async function DELETE(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const id = new URL(peticion.url).searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'Falta la actividad.' }, { status: 400 })

  /* Que sea una actividad de verdad y no una partida: `padre_id` nulo
     y con cuentas. Sin esto, un identificador escrito a mano borraría
     la carpeta Salud desde esta misma ruta. */
  const { data: suya } = await supabase
    .from('categorias')
    .select('id, nombre, padre_id, lleva_cuentas')
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('id', id)
    .is('padre_id', null)
    .maybeSingle()

  if (!suya) {
    return NextResponse.json({ error: 'Esa actividad no existe.' }, { status: 404 })
  }

  if (suya.lleva_cuentas !== true) {
    return NextResponse.json(
      { error: 'Eso es una carpeta, no una actividad. Se apaga desde Ajustes.' },
      { status: 400 }
    )
  }

  /* Todo lo que cuelga de ella: los dos grupos y sus partidas. Se
     necesita para contar, porque los apuntes no cuelgan de la raíz
     sino de las partidas. */
  const dentro = [id]
  try {
    const { data: todas } = await supabase
      .from('categorias')
      .select('id, padre_id')
      .eq('hogar_id', await elEspacioO(supabase))
    const hijasDe = new Map<string, string[]>()
    for (const c of todas ?? []) {
      const p = (c.padre_id as string | null) ?? ''
      if (!p) continue
      hijasDe.set(p, [...(hijasDe.get(p) ?? []), c.id as string])
    }
    /* Anchura y con tope: un ciclo en los datos —una categoría que
       fuera hija de sí misma— colgaría el servidor para siempre. */
    for (let i = 0; i < dentro.length && dentro.length < 400; i++) {
      for (const h of hijasDe.get(dentro[i]) ?? []) {
        if (!dentro.includes(h)) dentro.push(h)
      }
    }
  } catch {
    /* Si esto falla se sigue con la raíz sola: el recuento saldrá bajo
       y lo peor que puede pasar es que el borrado lo impida la clave
       ajena de los documentos. Nunca al revés. */
  }

  const espacio = await elEspacioO(supabase)
  const [{ count: apuntes }, { count: papeles }] = await Promise.all([
    supabase
      .from('movimientos')
      .select('id', { count: 'exact', head: true })
      .eq('hogar_id', espacio)
      .in('categoria_id', dentro),
    supabase
      .from('documentos')
      .select('id', { count: 'exact', head: true })
      .eq('hogar_id', espacio)
      .in('categoria_id', dentro)
      .is('eliminado_en', null),
  ])

  const cuantos = (apuntes ?? 0) + (papeles ?? 0)

  // ── Con cosas dentro: se retira ──────────────────────────
  if (cuantos > 0) {
    const { data, error } = await supabase
      .from('categorias')
      .update({ activa: false })
      .eq('hogar_id', espacio)
      .eq('id', id)
      .select('id')

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: 'No se ha podido retirar.', detalle: error?.message },
        { status: error ? 500 : 409 }
      )
    }

    return NextResponse.json({
      bien: true,
      retirada: true,
      apuntes: apuntes ?? 0,
      papeles: papeles ?? 0,
    })
  }

  // ── Vacía: se va de verdad ───────────────────────────────
  /* Las hijas se van solas: `padre_id` tiene `on delete cascade`, y
     `unidades.seccion_id` también. Borrarlas a mano antes sería
     repetir a medias lo que la base de datos ya hace entero. */
  const { data, error } = await supabase
    .from('categorias')
    .delete()
    .eq('hogar_id', espacio)
    .eq('id', id)
    .is('padre_id', null)
    .select('id')

  if (error || !data || data.length === 0) {
    console.error('[HUBI] No se ha podido borrar la actividad:', error)
    return NextResponse.json(
      {
        error: 'No se ha podido borrar.',
        detalle:
          error?.message ??
          'Puede que tenga algo enganchado. Prueba a retirarla desde Ajustes.',
      },
      { status: error ? 500 : 409 }
    )
  }

  return NextResponse.json({ bien: true, retirada: false })
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
    .eq('hogar_id', await elEspacioO(supabase))
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
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('id', id)
      .maybeSingle()

    if (!actual?.palabra_unidad) cambios.palabra_unidad = 'la parte'
  }

  const { data, error } = await supabase
    .from('categorias')
    .update(cambios)
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('id', id)
    .select('id')

  /* El `.select()` es la comprobación: sin política, un UPDATE afecta
     a cero filas y devuelve que todo ha ido bien. */
  if (error || !data || data.length === 0) {
    return NextResponse.json(
      {
        error: error?.message?.includes('usa_unidades')
          ? 'Las actividades todavía no están disponibles en esta casa.'
          : 'No se ha podido guardar.',
        detalle: error?.message,
      },
      { status: error ? 500 : 409 }
    )
  }

  return NextResponse.json({ bien: true })
}
