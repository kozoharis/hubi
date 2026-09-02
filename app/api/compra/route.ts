import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { avisarDeCompra } from '@/lib/push'
import { esAlgoQueSeCompra } from '@/lib/comprables'

export const dynamic = 'force-dynamic'

/*
  Añadir a la compra.

  Siempre una LISTA, aunque sea de uno. Por voz llegan tres de golpe
  —"apunta leche, pan y huevos"— y con un solo artículo por petición
  habría que decidir qué pasa si el segundo falla. Entran los que
  entren, y se dice cuántos.
*/
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const cuerpo = (await peticion.json()) as {
    cosas?: { que?: string; cantidad?: string | null }[]
    que?: string
    /* Para qué sección es: la finca, Los Helechos… Vacío = la casa,
       que es la mayoría de la compra. */
    seccion_id?: string | null
    /* En qué lista de esa categoría va. Null = la de siempre. */
    lista_id?: string | null
  }

  /* Se admite el atajo de una sola cosa, porque la pantalla escribe
     de una en una y obligarla a envolverla en una lista sería pedir
     ceremonia por nada. */
  const brutas = cuerpo.cosas ?? (cuerpo.que ? [{ que: cuerpo.que }] : [])

  /*
    EN QUÉ LISTA CAE ESTO.

    Por voz nunca llega `lista_id`: quien dicta "apunta leche y pan" no
    dice —ni tiene por qué— en cuál de las listas de casa va. Si se
    dejara vacío, lo apuntado quedaría suelto y podía no salir en la
    pantalla que estuviera mirando.

    ─────────────────────────────────────────────────────────────
    Y AQUÍ ROMPÍ LA COMPRA ENTERA. Merece quedar escrito.

    Metí `lista_id` en la fila que se guarda sin preguntarme qué pasa
    si la base de datos todavía no tiene esa columna —porque el SQL de
    las listas no se hubiera ejecutado aún—. Postgres rechaza la fila
    entera, y el resultado no es "las listas no funcionan": es QUE NO
    SE PUEDE APUNTAR NADA. Una función nueva a medio instalar tumbó la
    que llevaba semanas funcionando.

    La regla que sale de aquí: una columna nueva NUNCA puede ser
    obligatoria para lo que ya funcionaba. Si no está, se apunta sin
    ella y se avisa. Lo que no puede pasar es que alguien dicte la
    compra, oiga "apuntado" y no haya nada.
  */
  let listaId = (cuerpo.lista_id || null) as string | null
  let faltaElSql = false

  if (!listaId) {
    let busca = supabase
      .from('listas_compra')
      .select('id')
      .is('archivada_en', null)
      .order('creada_en')
      .limit(1)

    /* La casa es la sección VACÍA, así que se pregunta por nula; las
       demás, por su identificador. Antes esto se hacía con un
       `undefined` que la base de datos no entiende. */
    busca = cuerpo.seccion_id
      ? busca.eq('seccion_id', cuerpo.seccion_id)
      : busca.is('seccion_id', null)

    const { data: yaHay, error: falloBuscando } = await busca

    if (falloBuscando) {
      faltaElSql = true
    } else {
      listaId = yaHay?.[0]?.id ?? null

      if (!listaId) {
        const { data: nueva, error: falloCreando } = await supabase
          .from('listas_compra')
          .insert({
            nombre: 'La compra',
            seccion_id: cuerpo.seccion_id || null,
            creada_por: user.id,
          })
          .select('id')
          .maybeSingle()

        if (falloCreando) faltaElSql = true
        else listaId = nueva?.id ?? null
      }
    }
  }

  const cosas: {
    que: string
    cantidad: string | null
    seccion_id: string | null
    anadido_por: string
    lista_id?: string | null
  }[] = brutas
    .map((c) => ({
      que: (c.que ?? '').trim().slice(0, 120),
      cantidad: (c.cantidad ?? '')?.trim().slice(0, 40) || null,
      seccion_id: cuerpo.seccion_id || null,
      anadido_por: user.id,
      /* La columna solo se manda si la base de datos la tiene. Sin
         esto, una instalación a medias no deja apuntar NADA. */
      ...(faltaElSql ? {} : { lista_id: listaId }),
    }))
    .filter((c) => c.que.length > 0)

  /*
    SOLO LO QUE SE COMPRA.

    Se filtra AQUÍ y no en la pantalla porque por aquí pasan los dos
    caminos —lo escrito a mano y lo dictado—, y el que ensucia es el
    dictado: al partir la frase se cuelan el verbo con el que se pidió,
    un día de la semana o el nombre de quien va a ir. Cada línea de
    ésas hay que borrarla a mano, que es justo lo que esta pantalla
    venía a evitar.

    Se rechaza lo que SEGURO que no es un producto, no se aprueba solo
    lo conocido: una bombona de butano es una compra legítima y no está
    en ninguna tabla. Ante la duda, entra.
  */
  const { data: gente } = await supabase.from('perfiles').select('nombre')
  const nombres = (gente ?? []).map((g) => (g.nombre as string) ?? '')

  const buenas = cosas.filter((c) => esAlgoQueSeCompra(c.que, nombres))

  if (buenas.length === 0) {
    return NextResponse.json(
      {
        error:
          cosas.length > 0
            ? 'No he reconocido nada que se compre. Dime los productos, por ejemplo: leche, pan y huevos.'
            : 'No has dicho qué hay que comprar.',
      },
      { status: 400 }
    )
  }

  const descartadas = cosas.length - buenas.length
  cosas.length = 0
  cosas.push(...buenas)

  let { data, error } = await supabase.from('compra').insert(cosas).select('id, que')

  /*
    ÚLTIMA RED. Si aun así la rechaza por la columna nueva, se apunta
    SIN ella. Perder la organización por listas es un incordio; perder
    la compra que alguien acaba de dictar, no.
  */
  if (error && /lista_id|listas_compra/.test(error.message)) {
    faltaElSql = true
    const sinLista = cosas.map(({ lista_id: _fuera, ...resto }) => resto)
    ;({ data, error } = await supabase.from('compra').insert(sinLista).select('id, que'))
  }

  if (error) {
    console.error('[HUBI] Fallo apuntando en la compra:', error)
    return NextResponse.json(
      { error: 'No se ha podido apuntar.', detalle: error.message },
      { status: 500 }
    )
  }

  /*
    Un solo aviso, y solo al otro.

    Es la diferencia entre esto y montarlo sobre las tareas: allí
    habría sonado una vez por artículo. Aquí, "Conchita ha añadido 3
    cosas a la compra" y ya. Un aviso que suena tres veces seguidas se
    silencia, y con él se silencian los que importan.

    Va sin esperar: si el aviso falla, la compra ya está apuntada.
  */
  avisarDeCompra(user.id, cosas.length).catch((e) =>
    console.error('[HUBI] Apuntado sin avisar:', e)
  )

    /* Si faltaba el SQL se dice, pero DESPUÉS de haber apuntado: el
     aviso es para quien mantiene HUBI, no una excusa para no guardar. */
  return NextResponse.json({
    ok: true,
    cuantas: data?.length ?? cosas.length,
    lista_id: listaId,
    /* Si algo se ha caído por no ser un producto, se DICE cuántas: que
       alguien dicte cinco cosas, se apunten tres y no se entere es
       peor que apuntar las cinco. */
    descartadas,
    aviso: faltaElSql
      ? 'Apuntado, pero sin lista: falta ejecutar sql/23-listas-compra.sql.'
      : null,
  })
}

/*
  "Ya he comprado": guardar lo tachado.

  No se borra. Deja de verse en la lista y sigue contando para saber
  qué compráis a menudo — así, la próxima vez, HUBI puede ofrecer la
  leche sin que nadie la escriba.
*/
export async function PATCH() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('compra')
    .update({ archivado_en: new Date().toISOString() })
    .eq('comprado', true)
    .is('archivado_en', null)
    .select('id')

  if (error) {
    console.error('[HUBI] Fallo cerrando la compra:', error)
    return NextResponse.json(
      { error: 'No se ha podido guardar.', detalle: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, cuantas: data?.length ?? 0 })
}
