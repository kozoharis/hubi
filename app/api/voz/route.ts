import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { escuchar } from '@/lib/voz'
import { entenderFrase } from '@/lib/entender-voz'
import { cadena, type Categoria } from '@/lib/rutas'
import { ramaDe } from '@/lib/carpetas'
import { citasDeLaFamilia } from '@/lib/agenda-google'
import { calcular, euros } from '@/lib/periodos'
import { hoyAqui } from '@/lib/tablon'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/**
 * Escucha una frase y decide qué se ha pedido.
 *
 * No guarda nada por su cuenta salvo cuando la respuesta es solo
 * información —una búsqueda o una consulta de cuentas—, que no cambia
 * nada. Todo lo que crea o modifica pasa antes por una confirmación.
 */
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  /*
    Dos caminos de entrada.

    El rápido: el móvil manda TEXTO, porque él mismo ha transcrito
    mientras la persona hablaba. Aquí solo hay que interpretarlo.

    El de siempre: el móvil manda AUDIO, porque su navegador no sabe
    transcribir. Sigue funcionando igual, sin tocar nada.
  */
  const tipo = peticion.headers.get('content-type') ?? ''
  let texto: string | undefined
  let audio: File | undefined
  let pista: string | undefined

  if (tipo.includes('application/json')) {
    const cuerpo = (await peticion.json().catch(() => ({}))) as {
      texto?: string
      pista?: string
    }
    texto = cuerpo.texto?.trim()
    pista = cuerpo.pista

    if (!texto) {
      return NextResponse.json({ error: 'No se ha oído nada.' }, { status: 400 })
    }
    if (texto.length > 1000) {
      return NextResponse.json(
        { error: 'Eso ha sido muy largo. Prueba con una frase más corta.' },
        { status: 413 }
      )
    }
  } else {
    let formulario: FormData
    try {
      formulario = await peticion.formData()
    } catch {
      return NextResponse.json({ error: 'La grabación es demasiado larga.' }, { status: 413 })
    }

    const subido = formulario.get('audio')
    if (!(subido instanceof File) || subido.size < 1000) {
      return NextResponse.json({ error: 'No se ha oído nada.' }, { status: 400 })
    }
    if (subido.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'La grabación es demasiado larga. Prueba con una frase más corta.' },
        { status: 413 }
      )
    }
    audio = subido
  }

  /* Con la sesión: así la frontera del hogar la pone la base de datos.
     Con la clave de servidor se veían los perfiles y las carpetas de
     TODAS las familias. */
  const { data: perfiles } = await supabase.from('perfiles').select('id, nombre')
  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, icono, orden, naturaleza')
    .eq('activa', true)

  const todas = (categorias ?? []) as Categoria[]
  const conHijas = new Set(todas.map((c) => c.padre_id).filter(Boolean))
  const hojas = todas.filter((c) => !conHijas.has(c.id))

  /* Al modelo se le daban SOLO las carpetas finales. Por eso no sabía
     qué era "la finca": Finca es una carpeta madre, y no estaba en su
     lista. Ahora ve el árbol entero — las madres le sirven para
     buscar, las finales para apuntar gastos. */
  const conocidas = todas
  const rutaDe = (c: Categoria) => cadena(todas, c.id).map((x) => x.nombre).join(' → ')

  const ahora = new Date()
  /* El día de hoy DONDE VIVEN ELLOS. Con la hora del servidor —que va
     en hora de Londres—, dictar "mañana a las diez" de madrugada
     apuntaba la tarea para HOY. El porqué, en `lib/tablon.ts`. */
  const hoy = hoyAqui()

  try {
    /* Las pistas son los botones de "¿qué quieres que haga con esto?".
       Faltaban las tres últimas: al pulsarlas, la pista se descartaba
       aquí y volvía a adivinar lo mismo que ya había fallado. */
    const PISTAS = [
      'recordatorio', 'gasto', 'ingreso', 'buscar',
      'consulta', 'compra', 'cambiar', 'borrar',
    ] as const
    type Pista = (typeof PISTAS)[number]

    const laPista = PISTAS.includes(pista as Pista) ? (pista as Pista) : undefined

    /*
      Gemini primero; si no, HUBI se apaña.

      Mientras Gemini responda se usa Gemini: entiende mejor y aguanta
      frases enrevesadas. Cuando no responde —se acabó el cupo del día,
      se cayó, tarda demasiado— entra el intérprete de casa.

      La clave está en que las palabras YA ESTÁN: el teléfono las ha
      transcrito y se ven en la pantalla. Perderlas porque un servidor
      está ocupado, delante de alguien que acaba de hablar treinta
      segundos, es lo que consigue que deje de usar la voz. Que HUBI
      acierte un poco menos es un incordio; hacerle repetir la frase
      entera, no.

      Solo funciona si hay texto. Con audio no hay nada que interpretar
      aquí: transcribir es justo lo que hacía Gemini.
    */
    let oido
    try {
      oido = await escuchar({
        texto,
        audio: audio ? await audio.arrayBuffer() : undefined,
        tipoMime: audio?.type || 'audio/wav',
        pista: laPista,
        personas: perfiles ?? [],
        categorias: conocidas,
        rutaDe,
        hoy,
        diaSemana: DIAS[ahora.getDay()],
      })
    } catch (fallo) {
      if (!texto) throw fallo

      console.warn(
        '[HUBI] Gemini no ha podido; interpretando aquí:',
        fallo instanceof Error ? fallo.message : fallo
      )

      oido = entenderFrase({
        frase: texto,
        pista: laPista,
        personas: perfiles ?? [],
        categorias: conocidas,
        hoy,
      })
    }

    // ── A quién se refiere ──────────────────────────────────
    // Se compara sin tildes y en los dos sentidos: puede decir "Conchita",
    // "a Conchi" o el nombre completo, y el perfil puede tener uno o dos
    // nombres.
    function aQuien(dichoBruto: string | null): string | null | undefined {
      if (!dichoBruto) return undefined
      const dicho = sinTildes(dichoBruto)

      if (/\blos dos\b|\bambos\b|\bambas\b/.test(dicho)) return null

      const encontrada = (perfiles ?? []).find((p) => {
        const nombre = sinTildes(p.nombre)
        const pila = nombre.split(' ')[0]
        return dicho.includes(pila) || nombre.includes(dicho) || dicho.includes(nombre)
      })
      return encontrada?.id
    }

    const paraId = aQuien(oido.para)

    const categoria = todas.find((c) => c.id === oido.categoria_id) ?? null

    /*
      ── Cambiar o borrar algo ya apuntado ───────────────────

      Aquí NO se cambia ni se borra nada. Se busca de qué tarea se
      habla y se devuelve para que la persona lo vea y lo confirme.

      Es la misma regla que con los documentos y las tareas nuevas, y
      aquí importa más que en ningún otro sitio: crear algo de más se
      arregla borrándolo; borrar lo que no era no se arregla. Una voz
      mal oída no puede tener permiso para quitar la cita del médico.

      Solo se buscan las PENDIENTES: nadie dice "borra lo de la
      farmacia" refiriéndose a algo que ya hizo el mes pasado.
    */
    if (oido.accion === 'cambiar' || oido.accion === 'borrar') {
      const palabras = (oido.cual ?? oido.titulo ?? '')
        .split(/\s+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 2)

      if (palabras.length === 0) {
        return NextResponse.json({
          ...oido,
          candidatas: [],
          respuesta: '¿Cuál quieres que cambie? Dime alguna palabra de la tarea.',
        })
      }

      const { data: pendientes } = await supabase
        .from('recordatorios')
        .select('id, titulo, fecha, hora, nota, asignado_a, estado')
        .eq('estado', 'pendiente')
        .order('fecha', { ascending: true, nullsFirst: false })
        .limit(300)

      /* Cuantas más palabras coincidan, mejor. Se mira el título y la
         nota: "lo de Silvia" puede estar solo en la nota. */
      const puntuadas = (pendientes ?? [])
        .map((r) => {
          const donde = sinTildes(`${r.titulo} ${r.nota ?? ''}`)
          const aciertos = palabras.filter((p) => donde.includes(sinTildes(p))).length
          return { r, aciertos }
        })
        .filter((x) => x.aciertos > 0)
        .sort((a, b) => b.aciertos - a.aciertos)

      /* Si una gana claramente, va sola. Si empatan, se enseñan las
         que empatan para que elija — nunca se elige por ella. */
      const mejor = puntuadas[0]?.aciertos ?? 0
      const candidatas = puntuadas
        .filter((x) => x.aciertos === mejor)
        .slice(0, 6)
        .map(({ r }) => ({
          id: r.id,
          titulo: r.titulo,
          fecha: r.fecha,
          hora: r.hora,
          para_nombre:
            r.asignado_a === null
              ? 'Los dos'
              : ((perfiles ?? []).find((p) => p.id === r.asignado_a)?.nombre ?? 'Los dos'),
        }))

      return NextResponse.json({
        ...oido,
        candidatas,
        /* Lo que se cambiaría, ya resuelto. Vacío en un borrado. */
        cambios:
          oido.accion === 'cambiar'
            ? limpiarVacios({
                fecha: oido.fecha,
                hora: oido.hora,
                asignado_a: paraId === undefined ? undefined : paraId,
                repite: oido.repite,
                repite_hasta: oido.repite_hasta,
              })
            : null,
        respuesta:
          candidatas.length === 0
            ? 'No encuentro ninguna tarea que diga eso.'
            : undefined,
      })
    }

    /* La compra no necesita resolver nada aquí: no hay persona a la
       que asignarla ni categoría que buscar. Va tal cual a confirmar. */
    if (oido.accion === 'compra') {
      /* La sección que se haya dicho, comprobada contra las que esta
         familia tiene de verdad: el modelo puede devolver cualquier
         cosa, y un identificador inventado guardaría la compra en
         ningún sitio. */
      const seccion = todas.find(
        (c) => c.id === oido.compra_seccion && !c.padre_id
      )
      return NextResponse.json({
        ...oido,
        compra_seccion: seccion?.id ?? null,
        compra_seccion_nombre: seccion?.nombre ?? null,
        para_id: null,
      })
    }

    /*
      ── Una pregunta por un papel ────────────────────────────

      "Dime la última factura que he subido". Antes esto no tenía a
      dónde ir: se colaba por la rama de las cuentas y contestaba una
      cifra de gastos que no era lo que se había preguntado.

      Se contesta EN VOZ ALTA porque es el momento en que uno tiene las
      manos ocupadas —si quisiera verla, habría dicho "búscame"—, y se
      devuelve además el identificador para poder poner un "Ver el
      papel" debajo, por si después sí quiere mirarlo.
    */
    if (oido.accion === 'consulta' && oido.tipo_consulta === 'papel') {
      let cuales = supabase
        .from('documentos')
        .select('id, titulo, proveedor, fecha_documento, importe, categoria_id')
        .order('fecha_documento', { ascending: false })
        .limit(1)

      if (categoria) {
        const dentro = [...ramaDe(todas, categoria.id)]
        cuales = cuales.in('categoria_id', dentro)
      } else if (oido.busqueda) {
        cuales = cuales.textSearch('busqueda', oido.busqueda, { config: 'spanish' })
      }

      const { data: papeles } = await cuales
      const papel = papeles?.[0]

      const donde = categoria ? ` de ${categoria.nombre.toLowerCase()}` : ''

      if (!papel) {
        return NextResponse.json({
          ...oido,
          respuesta: `No tengo ningún papel${donde} guardado.`,
          para_id: paraId ?? null,
        })
      }

      /* Se dice lo que de verdad identifica un papel: de quién es,
         cuándo y cuánto. El título técnico no le dice nada a nadie. */
      const partes = [
        papel.proveedor || papel.titulo,
        `del ${enPalabras(papel.fecha_documento as string)}`,
        papel.importe != null ? `de ${euros(Number(papel.importe))}` : null,
      ].filter(Boolean)

      return NextResponse.json({
        ...oido,
        respuesta: `El último papel${donde} es ${partes.join(', ')}.`,
        papel_id: papel.id,
        para_id: paraId ?? null,
      })
    }

    /*
      ── Qué hay en la lista de la compra ─────────────────────

      "Dime la lista de la compra". Se contesta en voz alta porque es
      la pregunta que se hace CON EL CARRO EN LA MANO, o desde el coche
      antes de entrar al súper.

      Se dicen como mucho ocho y el resto se cuenta: nadie escucha una
      retahíla de veinte cosas seguidas y se acuerda de ninguna. Ocho y
      "y siete más" es información; veinte es ruido.
    */
    if (oido.accion === 'consulta' && oido.tipo_consulta === 'compra') {
      let cuales = supabase
        .from('compra')
        .select('que, cantidad, seccion_id')
        .is('archivado_en', null)
        .eq('comprado', false)
        .order('creado_en')

      /* La sección se reconoce por su nombre —"de la casa", "de la
         finca"—; la casa no tiene sección, y eso es null. */
      const seccion = oido.compra_seccion
        ? todas.find((c) => c.id === oido.compra_seccion)
        : null
      if (seccion) cuales = cuales.eq('seccion_id', seccion.id)

      const { data: cosas } = await cuales
      const lista = cosas ?? []
      const donde = seccion ? ` de ${seccion.nombre.toLowerCase()}` : ''

      if (lista.length === 0) {
        return NextResponse.json({
          ...oido,
          respuesta: `No hay nada apuntado en la compra${donde}.`,
          ir_a: '/compra',
          para_id: paraId ?? null,
        })
      }

      const nombres = lista.map((c) => (c.cantidad ? `${c.cantidad} de ${c.que}` : c.que))
      const primeras = nombres.slice(0, 8)
      const restan = nombres.length - primeras.length

      const cuantas = `${lista.length} ${lista.length === 1 ? 'cosa' : 'cosas'}`
      const enumeradas = enumerar(primeras) + (restan > 0 ? `, y ${restan} más` : '')

      return NextResponse.json({
        ...oido,
        respuesta: `En la compra${donde} hay ${cuantas}: ${enumeradas}.`,
        ir_a: '/compra',
        para_id: paraId ?? null,
      })
    }

    /*
      ── Qué hay que hacer un día ─────────────────────────────

      "¿Qué tengo mañana?". Se juntan las tareas de HUBI y las citas
      del Google de quien pregunta, porque para quien lo dice son la
      misma cosa —el punto 18: todo es "cosas que tengo que recordar"—
      y separarlas al contestar sería devolverle una distinción que no
      le interesa.
    */
    if (oido.accion === 'consulta' && oido.tipo_consulta === 'agenda') {
      const dia = oido.fecha ?? oido.tareas?.[0]?.fecha ?? hoy

      const [{ data: tareas }, deGoogle] = await Promise.all([
        supabase
          .from('recordatorios')
          .select('titulo, hora, estado')
          .eq('fecha', dia)
          .eq('estado', 'pendiente')
          .order('hora', { ascending: true, nullsFirst: true }),
        citasDeLaFamilia(user.id, dia, dia),
      ])

      const todo = [
        ...(tareas ?? []).map((t) => ({
          hora: (t.hora as string | null)?.slice(0, 5) ?? null,
          que: t.titulo as string,
        })),
        ...deGoogle.map((c) => ({ hora: c.hora, que: c.titulo })),
      ].sort((a, b) => (a.hora ?? '99').localeCompare(b.hora ?? '99'))

      const cuando =
        dia === hoy ? 'hoy' : dia === sumarUnDia(hoy) ? 'mañana' : `el ${enPalabras(dia)}`

      if (todo.length === 0) {
        return NextResponse.json({
          ...oido,
          respuesta: `No hay nada apuntado para ${cuando}.`,
          ir_a: '/agenda',
          para_id: paraId ?? null,
        })
      }

      /* Con la hora delante cuando la tiene: "a las diez y media,
         médico" es lo que se necesita oír, en ese orden. */
      const dichas = todo
        .slice(0, 8)
        .map((x) => (x.hora ? `a las ${x.hora}, ${x.que}` : x.que))
      const restan = todo.length - dichas.length

      return NextResponse.json({
        ...oido,
        respuesta:
          `Para ${cuando} tienes ${todo.length} ${todo.length === 1 ? 'cosa' : 'cosas'}: ` +
          enumerar(dichas) +
          (restan > 0 ? `, y ${restan} más` : '') +
          '.',
        ir_a: '/agenda',
        para_id: paraId ?? null,
      })
    }

    // ── Una consulta de cuentas se responde aquí mismo ──────
    if (oido.accion === 'consulta') {
      const periodo = calcular(oido.periodo ?? 'trimestre', hoy)

      let consulta = supabase
        .from('movimientos')
        .select('tipo, importe, categoria_id, apartamento')
        .gte('fecha', periodo.desde)
        .lte('fecha', periodo.hasta)

      /*
        LA CARPETA Y TODO LO QUE CUELGA DE ELLA.

        AQUÍ ESTABA EL FALLO DE "dime los ingresos de Los Helechos".

        Se pedía la coincidencia EXACTA con la carpeta nombrada. Pero
        el dinero no se apunta nunca en una carpeta madre: se apunta en
        la final —Los Helechos › Ingresos › Booking, La Finca › Gastos
        › Luz—. Así que preguntar por "Los Helechos" filtraba por una
        carpeta donde no hay ni un solo apunte y contestaba, tan
        tranquilo, que no había nada.

        Y era de las respuestas más dañinas que puede dar esto: no
        parece un fallo, parece un dato. Alguien puede creerse que no
        ha ingresado nada en todo el trimestre.

        Con `ramaDe` se cogen la carpeta Y todas sus hijas, que es lo
        que cualquiera entiende al decir "de Los Helechos".
      */
      if (categoria) {
        consulta = consulta.in('categoria_id', [...ramaDe(todas, categoria.id)])
      }

      /* "Los Helechos TRES" — el apartamento, si lo han dicho. Es la
         pregunta natural cuando se tienen tres: no "cuánto entra",
         sino "cuánto entra por cada uno". */
      const cual = elApartamento(oido.transcripcion ?? '')
      if (cual) consulta = consulta.eq('apartamento', cual)

      const { data: movimientos } = await consulta
      const lista = movimientos ?? []

      const gastos = suma(lista.filter((m) => m.tipo === 'gasto'))
      const ingresos = suma(lista.filter((m) => m.tipo === 'ingreso'))

      const que = oido.tipo_consulta ?? 'gasto'
      const cifra = que === 'ingreso' ? ingresos : que === 'balance' ? ingresos - gastos : gastos

      const nombre =
        (categoria ? ` en ${categoria.nombre.toLowerCase()}` : '') +
        (cual ? ` ${cual}` : '')
      const cuando = periodo.titulo.toLowerCase()

      const respuesta =
        que === 'balance'
          ? `En ${cuando} el balance es de ${euros(cifra, true)}. Ingresos ${euros(ingresos)}, gastos ${euros(gastos)}.`
          : lista.length === 0
            ? `No hay nada apuntado${nombre} en ${cuando}.`
            : `En ${cuando}${nombre}: ${euros(cifra)}.`

      return NextResponse.json({ ...oido, respuesta, para_id: paraId ?? null })
    }

    // Si no dijo para quién, es para quien habla.
    const paraFinal = paraId === undefined ? user.id : paraId

    // Red de seguridad: si el modelo no ha sacado nota pero se dijo bastante
    // más de lo que cabe en el título, se guarda la frase entera. Lo dicho
    // no se tira nunca.
    const nota =
      oido.nota?.trim() ||
      (oido.transcripcion && oido.titulo &&
      oido.transcripcion.trim().length > oido.titulo.trim().length + 15
        ? oido.transcripcion.trim()
        : null)

    const paraNombre =
      paraFinal === null
        ? 'Los dos'
        : ((perfiles ?? []).find((p) => p.id === paraFinal)?.nombre ?? 'Los dos')

    /*
      Cada tarea con su destinatario ya resuelto.

      Se hace aquí y no en el navegador porque aquí están los perfiles
      y el criterio de a quién se refiere "Conchi" o "los dos". El
      móvil solo tiene que pintar lo que le llega.

      Si no dijo para quién, es para quien habla. Nunca se queda una
      tarea sin dueño: una tarea de nadie no la hace nadie.
    */
    const nombreDe = (id: string | null) =>
      id === null
        ? 'Los dos'
        : ((perfiles ?? []).find((p) => p.id === id)?.nombre ?? 'Los dos')

    const tareas = oido.tareas.map((t) => {
      const suyo = aQuien(t.para)
      const destino = suyo === undefined ? user.id : suyo
      return {
        titulo: t.titulo,
        nota: t.nota,
        fecha: t.fecha,
        hora: t.hora,
        repite: t.repite,
        para_id: destino,
        para_nombre: nombreDe(destino),
        para_dicho: Boolean(t.para),
      }
    })

    return NextResponse.json({
      ...oido,
      tareas,
      nota,
      para_id: paraFinal,
      para_nombre: paraNombre,
      para_dicho: Boolean(oido.para),
      categoria_nombre: categoria?.nombre ?? null,
      categoria_ruta: categoria ? rutaDe(categoria) : null,
    })
  } catch (e) {
    const motivo = e instanceof Error ? e.message : ''
    console.error('[Family Hub] Fallo escuchando:', e)

    if (motivo === 'SIN_CLAVE_OCR') {
      return NextResponse.json({ error: 'La voz no está configurada todavía.' }, { status: 503 })
    }
    if (motivo === 'CUOTA_MINUTO') {
      return NextResponse.json(
        { error: 'Vas muy rápido. Espera medio minuto y vuelve a intentarlo.' },
        { status: 429 }
      )
    }
    if (motivo === 'CUOTA_DIA') {
      return NextResponse.json(
        { error: 'Se ha agotado el cupo de hoy. Mañana vuelve solo.' },
        { status: 429 }
      )
    }
    if (e instanceof Error && e.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Ha tardado demasiado. Inténtalo otra vez.' }, { status: 504 })
    }
    // El motivo técnico se devuelve aparte: no se enseña como mensaje
    // principal, pero permite saber qué ha pasado sin tener que adivinar.
    return NextResponse.json(
      {
        error: 'No se ha entendido. Prueba a repetirlo más despacio.',
        detalle: motivo.slice(0, 300),
      },
      { status: 502 }
    )
  }
}

function suma(lista: { importe: number }[]): number {
  return lista.reduce((t, m) => t + Number(m.importe), 0)
}

/*
  Quita lo que no se ha dicho.

  En un cambio solo puede viajar lo que se pidió cambiar. Si mandáramos
  `hora: null` porque no se dijo hora, borraríamos la hora que ya
  estaba puesta — y quien dijo "cámbialo al jueves" se encontraría con
  la cita del médico sin hora. Lo que no se dice, no se toca.
*/
function limpiarVacios(o: Record<string, unknown>): Record<string, unknown> {
  const limpio: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(o)) {
    if (valor !== null && valor !== undefined) limpio[clave] = valor
  }
  return limpio
}

function sinTildes(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** "14 de agosto" — como lo diría una persona, sin el año si es éste. */
function enPalabras(iso: string): string {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const [a, m, d] = iso.split('-')
  const esteAnio = String(new Date().getFullYear())
  return a === esteAnio
    ? `${Number(d)} de ${meses[Number(m) - 1]}`
    : `${Number(d)} de ${meses[Number(m) - 1]} de ${a}`
}

/*
  "leche, pan y huevos" — con la Y al final, como se dice hablando.

  Se lee en voz alta: una lista separada solo por comas suena a
  máquina, y en algo pensado para escucharse eso importa.
*/
function enumerar(cosas: string[]): string {
  if (cosas.length === 0) return ''
  if (cosas.length === 1) return cosas[0]
  return `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`
}

function sumarUnDia(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(a, m - 1, d)
  f.setDate(f.getDate() + 1)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

/*
  ¿De qué apartamento hablan?

  "Los Helechos tres", "el apartamento 2", "helechos uno". Devuelve el
  número o nada. Con nada se contesta por los tres juntos, que es lo
  correcto cuando no lo han precisado.
*/
function elApartamento(frase: string): number | null {
  const plano = frase
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const LETRAS: Record<string, number> = { uno: 1, una: 1, dos: 2, tres: 3 }

  const m = plano.match(
    /\b(?:helechos|apartamento|apto|casa|numero)\s*(?:numero\s*)?(1|2|3|uno|una|dos|tres)\b/
  )
  if (!m) return null

  const n = LETRAS[m[1]] ?? Number(m[1])
  return n >= 1 && n <= 3 ? n : null
}
