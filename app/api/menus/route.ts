import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { hoyAqui } from '@/lib/tablon'
import { elLunesDe, laSemanaDe, esEnlace } from '@/lib/menus'
import { elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  LOS MENÚS DE LA SEMANA Y EL CAJÓN DE RECETAS.

  Todo con la sesión de quien pregunta: la frontera de la casa la pone
  la base de datos. Y aquí, a diferencia de la agenda o el corcho, la
  casa ENTERA lo ve —incluida quien ayuda—, porque quien cocina tiene
  que poder leer lo que toca hoy. Está explicado en el sql/48.
*/

// ── LA SEMANA ────────────────────────────────────────────────
export async function GET(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const pedida = new URL(peticion.url).searchParams.get('lunes') ?? ''
  const lunes = /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? elLunesDe(pedida) : elLunesDe(hoyAqui())
  const dias = laSemanaDe(lunes)

  const casa = await elEspacioO(supabase)

  /*
    Lo del paso 81 —la tanda y la comprobación— se pide primero y, si
    la base todavía no lo tiene, se vuelve a pedir sin ello. Es la
    misma red que ya hay abajo para los ingredientes, y por lo mismo:
    Postgres rechaza la consulta ENTERA cuando falta una columna, no
    esa columna. Sin la red, un paso sin dar deja la semana en blanco.
  */
  const MENU_CON =
    'id, fecha, momento, que, receta_id, grupo_id, cada_semanas, repite_hasta, comprobado_en, faltan'
  const MENU_SIN = 'id, fecha, momento, que, receta_id'

  let { data, error } = await supabase
    .from('menus')
    .select(MENU_CON)
    .eq('hogar_id', casa)
    .gte('fecha', dias[0])
    .lte('fecha', dias[6])

  if (error) {
    const segunda = await supabase
      .from('menus')
      .select(MENU_SIN)
      .eq('hogar_id', casa)
      .gte('fecha', dias[0])
      .lte('fecha', dias[6])
    data = segunda.data as typeof data
    error = segunda.error
  }

  if (error) {
    /* Sin las tablas todavía: se contesta vacío en vez de romper la
       pantalla. El sql/48 puede no estar ejecutado. */
    return NextResponse.json({ lunes, dias, menus: [], recetas: [], listas: [], sinTablas: true })
  }

  /*
    Los ingredientes son del paso 80. Si no está dado, Postgres rechaza
    la consulta ENTERA —no la columna— y el cajón de las recetas se
    quedaría vacío por una casilla que todavía no existe. Así que se
    pide con ellos y, si falla, se vuelve a pedir sin ellos.

    Es la tercera vez que esta red hace falta en este proyecto, y las
    tres por lo mismo: **una columna nueva nunca puede ser obligatoria
    para lo que ya funcionaba.**
  */
  const CON = 'id, titulo, url, nota, ingredientes'
  const SIN = 'id, titulo, url, nota'

  let { data: recetas, error: falloRecetas } = await supabase
    .from('recetas')
    .select(CON)
    .eq('hogar_id', casa)
    .order('creado_en', { ascending: false })
    .limit(100)

  if (falloRecetas) {
    const segunda = await supabase
      .from('recetas')
      .select(SIN)
      .eq('hogar_id', casa)
      .order('creado_en', { ascending: false })
      .limit(100)
    recetas = segunda.data as typeof recetas
    falloRecetas = segunda.error
  }

  /*
    Y las listas de la compra, porque lo que falte de un menú hay que
    poder mandarlo a una sin salir de aquí — que fue justo lo que se
    decidió: «me preguntas a cuál».

    Si el sql/23 no está, se contesta vacío y la pantalla lo dice; no
    se rompe la semana por eso.
  */
  const { data: listas } = await supabase
    .from('listas_compra')
    /* `hora` y `asignado_a` viajan aunque aquí no se pinten: si desde
       el menú se le pone día a la lista, hay que devolverle a la API de
       listas TODO lo que ya tenía. Esa API gobierna el día, la hora y
       la tarea de la Agenda a la vez, y un campo que no se manda se
       entiende como «quítalo». */
    .select('id, nombre, fecha, hora, asignado_a')
    .eq('hogar_id', casa)
    .is('archivada_en', null)
    .order('creada_en', { ascending: true })
    .limit(30)

  return NextResponse.json({
    lunes,
    dias,
    menus: data ?? [],
    recetas: recetas ?? [],
    listas: listas ?? [],
  })
}

// ── PONER O CAMBIAR LO DE UN DÍA ─────────────────────────────
export async function PUT(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const cuerpo = (await peticion.json().catch(() => ({}))) as {
    fecha?: string
    momento?: string
    que?: string
    receta_id?: string | null
  }

  const fecha = String(cuerpo.fecha ?? '')
  const momento = cuerpo.momento === 'cena' ? 'cena' : 'comida'
  const que = String(cuerpo.que ?? '').trim().slice(0, 200)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'La fecha no es válida.' }, { status: 400 })
  }

  /*
    VACÍO SIGNIFICA QUITARLO.

    Es lo que espera cualquiera: borras el texto y ese día se queda sin
    nada. Guardar una cadena vacía dejaría un menú fantasma que ocupa
    sitio, sale en la pantalla como un renglón en blanco y encima
    bloquea el índice único de ese día.
  */
  if (!que) {
    const { error } = await supabase
      .from('menus')
      .delete()
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('fecha', fecha)
      .eq('momento', momento)

    if (error) {
      return NextResponse.json(
        { error: 'No se ha podido quitar.', detalle: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json({ bien: true, quitado: true })
  }

  /*
    Se busca y se cambia, o se crea. Con `upsert` haría falta declarar
    el índice único aquí, y el día que ese índice cambie de nombre esto
    fallaría en silencio. Dos pasos son más largos y no dependen de
    cómo se llame nada.
  */
  const { data: yaHay } = await supabase
    .from('menus')
    .select('id')
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('fecha', fecha)
    .eq('momento', momento)
    .maybeSingle()

  const campos = {
    hogar_id: await elEspacioO(supabase),
    fecha,
    momento,
    que,
    receta_id: cuerpo.receta_id ?? null,
    creado_por: user.id,
  }

  const { data, error } = yaHay
    ? await supabase
        .from('menus')
        .update(campos)
        .eq('hogar_id', await elEspacioO(supabase))
        .eq('id', yaHay.id)
        .select('id')
    : await supabase.from('menus').insert(campos).select('id')

  /* Con `.select()`: un escrito que la seguridad no permite contesta
     «todo bien» habiendo tocado cero filas. */
  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido guardar.', detalle: error.message },
      { status: 500 }
    )
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido guardar. Los menús todavía no están disponibles en esta casa.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ bien: true, id: data[0].id })
}

// ── «¿TIENES TODO ESTO?» ─────────────────────────────────────
/*
  La lista de comprobación del paso 81.

  Dos respuestas y nada más: SÍ deja el menú comprobado y sin nada que
  falte; NO guarda lo que falta y, si se ha elegido lista, lo apunta en
  la compra.

  ─────────────────────────────────────────────────────────────
  Y LOS INGREDIENTES NO PASAN POR EL FILTRO DE LA COMPRA

  `/api/compra` tiene un colador —`esAlgoQueSeCompra`— que descarta lo
  que seguro que no es un producto. Existe por el DICTADO: al partir
  una frase hablada se cuelan verbos, días de la semana y nombres de
  personas.

  Aquí no hay nada de eso. Un ingrediente lo escribió alguien de la
  casa en una receta, una línea por cosa. Pasarlo por ese colador solo
  puede hacer daño: «sal al gusto» o «un chorrito de vino» tienen todas
  las papeletas de no parecer productos, y desaparecerían sin decir
  nada. Así que se apunta tal cual, que es como se escribió.
*/
export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const casa = await elEspacioO(supabase)
  const cuerpo = (await peticion.json().catch(() => ({}))) as {
    id?: string
    faltan?: string[]
    lista_id?: string | null
  }

  const id = String(cuerpo.id ?? '')
  if (!id) return NextResponse.json({ error: 'Falta cuál.' }, { status: 400 })

  const faltan = [
    ...new Set(
      (cuerpo.faltan ?? [])
        .map((i) => String(i ?? '').trim().replace(/\s+/g, ' ').slice(0, 80))
        .filter((i) => i.length > 1)
    ),
  ].slice(0, 30)

  // ── 1 · Queda comprobado ──
  const { data, error } = await supabase
    .from('menus')
    .update({ comprobado_en: new Date().toISOString(), faltan })
    .eq('hogar_id', casa)
    .eq('id', id)
    .select('id, que, fecha')

  /* Sin el paso 81 no se puede dejar constancia, pero lo que falta sí
     se puede apuntar en la compra. Se hace y se dice. */
  const sinPaso81 = Boolean(error && /comprobado_en|faltan/.test(error.message))

  if (error && !sinPaso81) {
    return NextResponse.json(
      { error: 'No se ha podido guardar la comprobación.', detalle: error.message },
      { status: 500 }
    )
  }
  if (!sinPaso81 && (!data || data.length === 0)) {
    return NextResponse.json({ error: 'Ese menú ya no está.' }, { status: 404 })
  }

  // ── 2 · Y lo que falta, a la compra ──
  let apuntados = 0
  if (faltan.length > 0 && cuerpo.lista_id) {
    const filas = faltan.map((que) => ({
      hogar_id: casa,
      que,
      cantidad: null,
      seccion_id: null,
      lista_id: cuerpo.lista_id,
      anadido_por: user.id,
    }))

    const { data: puestos, error: falloCompra } = await supabase
      .from('compra')
      .insert(filas)
      .select('id')

    if (falloCompra) {
      return NextResponse.json(
        {
          error: 'Se ha guardado la comprobación, pero no se ha podido apuntar en la compra.',
          detalle: falloCompra.message,
          comprobado: true,
        },
        { status: 500 }
      )
    }
    apuntados = puestos?.length ?? 0
  }

  return NextResponse.json({
    bien: true,
    faltan,
    apuntados,
    sinPaso81,
    menu: data?.[0] ?? null,
  })
}

// ── UNA IDEA NUEVA PARA EL CAJÓN ─────────────────────────────
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const cuerpo = (await peticion.json().catch(() => ({}))) as {
    titulo?: string
    url?: string
    nota?: string
    /* Una línea por ingrediente (paso 80). «Medio kilo de harina»,
       «dos huevos». Se guardan tal cual: en la pared se mandan a la
       compra sin tocarlos. */
    ingredientes?: string[]
  }

  const titulo = String(cuerpo.titulo ?? '').trim().slice(0, 120)
  const url = String(cuerpo.url ?? '').trim()

  if (titulo.length < 2) {
    return NextResponse.json({ error: 'Ponle un nombre para reconocerlo.' }, { status: 400 })
  }

  /* Un enlace que no lo es se rechaza aquí y se dice. Guardarlo y que
     luego no abra nada es peor: quien lo pegó ya no se acuerda de qué
     copió. */
  if (url && !esEnlace(url)) {
    return NextResponse.json(
      { error: 'Eso no parece un enlace. Tiene que empezar por https://' },
      { status: 400 }
    )
  }

  /* Sin líneas vacías, sin duplicados y con un tope: lo que se pega
     de una página trae renglones sueltos, y una receta con cuarenta
     ingredientes no es una receta de casa. */
  const ingredientes = [
    ...new Set(
      (cuerpo.ingredientes ?? [])
        .map((i) => String(i ?? '').trim().replace(/\s+/g, ' ').slice(0, 80))
        .filter((i) => i.length > 1)
    ),
  ].slice(0, 30)

  const laFila = {
    hogar_id: await elEspacioO(supabase),
    titulo,
    url: url || null,
    /* 2000 y no 500: una receta escrita entera no cabe en 500 letras,
       y ésa es justo la que no tiene enlace. */
    nota: String(cuerpo.nota ?? '').trim().slice(0, 2000) || null,
    creado_por: user.id,
  }

  let { data, error } = await supabase
    .from('recetas')
    .insert({ ...laFila, ingredientes })
    .select('id, titulo, url, nota, ingredientes')

  /*
    Si la rechaza por la columna nueva, se guarda SIN ella. Perder los
    ingredientes es un incordio; perder la receta que alguien acaba de
    escribir, no.
  */
  if (error && /ingredientes/.test(error.message)) {
    ;({ data, error } = await supabase
      .from('recetas')
      .insert(laFila)
      .select('id, titulo, url, nota'))
  }

  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido guardar.', detalle: error.message },
      { status: 500 }
    )
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido guardar. Los menús todavía no están disponibles en esta casa.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ bien: true, receta: data[0] })
}

// ── QUITAR UNA IDEA ──────────────────────────────────────────
export async function DELETE(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const id = new URL(peticion.url).searchParams.get('receta') ?? ''
  if (!id) return NextResponse.json({ error: 'Falta cuál.' }, { status: 400 })

  /* Los menús que la usaban NO se caen: `on delete set null`. Lo que se
     comió el martes se comió, aunque la receta ya no esté guardada. */
  const { data, error } = await supabase
    .from('recetas')
    .delete()
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido quitar.', detalle: error?.message ?? 'Cero filas.' },
      { status: 500 }
    )
  }
  return NextResponse.json({ bien: true })
}
