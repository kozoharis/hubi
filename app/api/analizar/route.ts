import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { leerDocumento } from '@/lib/ocr'
import { entenderPapel, type Conocido } from '@/lib/entender'
import { tipoDe, TIPOS_BUENOS } from '@/lib/archivos'
import { cadena, cuelgaDe, type Categoria } from '@/lib/rutas'
import { elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'
export const maxDuration = 60



/**
 * Lee un documento y devuelve lo que ha entendido.
 *
 * No guarda nada. La decisión de guardar siempre la toma la persona,
 * después de ver los datos y poder corregirlos.
 */
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  /*
    Dos formas de llegar, y la buena es la primera.

    TEXTO — el móvil ya ha leído el papel él solo. Entonces la foto no
    ha salido del teléfono: aquí solo llega el texto, y lo único que
    queda es entenderlo. Sin servicios externos, sin cuentas, sin
    cupos. Es lo que se usa desde que MAPPEL lee en el propio móvil.

    ARCHIVO — la foto entera, para los caminos que todavía la mandan
    (un PDF, o un móvil que no pueda leer por su cuenta).
  */
  const tipoPeticion = peticion.headers.get('content-type') ?? ''
  let textoDelMovil: string | null = null
  let archivo: File | null = null
  /*
    ── DE DÓNDE VIENE QUIEN ESTÁ GUARDANDO ──

    Si el papel se está guardando DESDE una actividad —desde Weaver,
    desde la Finca— viene su raíz. Y entonces al modelo solo se le
    ofrecen las carpetas de esa actividad.

    No es una preferencia: es la corrección de un fallo real. Antes se
    le ofrecían las carpetas de la casa ENTERA, así que una factura de
    Weaver leída desde Weaver acababa en «Casa → Facturas» porque al
    modelo le parecía una factura de casa. Y tenía razón: nadie le
    había dicho dónde estaba la persona.
  */
  let raizPedida: string | null = null

  if (tipoPeticion.includes('application/json')) {
    const cuerpo = (await peticion.json().catch(() => ({}))) as { texto?: string; raiz?: string }
    textoDelMovil = (cuerpo.texto ?? '').trim() || null
    raizPedida = (cuerpo.raiz ?? '').trim() || null

    if (!textoDelMovil) {
      return NextResponse.json(
        { error: 'No se ha leído texto en la foto. Prueba con más luz o clasifícalo a mano.' },
        { status: 422 }
      )
    }
  } else {
    let formulario: FormData
    try {
      formulario = await peticion.formData()
    } catch {
      return NextResponse.json({ error: 'El archivo es demasiado grande.' }, { status: 413 })
    }

    raizPedida = (String(formulario.get('raiz') ?? '')).trim() || null

    const subido = formulario.get('archivo')
    if (!(subido instanceof File) || subido.size === 0) {
      return NextResponse.json({ error: 'No hay archivo.' }, { status: 400 })
    }
    /* Por lo que ES: un PDF elegido desde el selector de archivos de
       Android llega muchas veces sin etiqueta. Ver lib/archivos.ts. */
    const suTipo = tipoDe(subido)
    if (!suTipo || !TIPOS_BUENOS.includes(suTipo)) {
      return NextResponse.json({ error: 'Formato no admitido.' }, { status: 400 })
    }
    /* Se guarda ya con su tipo bueno: quien lo lea más abajo no tiene
       que volver a preguntárselo. */
    archivo = new File([subido], subido.name || 'documento', { type: suTipo })
  }

  /*
    CON LA SESIÓN, NO CON LA CLAVE DE SERVIDOR.

    Aquí se leía con la clave de servidor, que se salta las políticas.
    Con una sola familia daba igual. Con dos, esta consulta habría
    ofrecido a una familia las carpetas de la otra — y la de abajo, sus
    proveedores.

    Leyendo con la sesión de quien pregunta, la frontera del hogar la
    pone la base de datos y no hay nada que recordar.
  */
  const { data } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, icono, orden, naturaleza')
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('activa', true)

  const categorias = (data ?? []) as Categoria[]

  // Al modelo solo se le ofrecen las categorías finales: las que no tienen
  // hijas. Son las únicas donde puede acabar un documento.
  const conHijas = new Set(categorias.map((c) => c.padre_id).filter(Boolean))
  let hojas = categorias.filter((c) => !conHijas.has(c.id))

  /*
    Y si se está guardando desde una actividad, solo las suyas.

    La raíz se comprueba contra la lista que acaba de traer la BASE con
    la sesión de quien pregunta: tiene que existir, ser de su casa y no
    tener padre. Un identificador escrito a mano en la petición no
    puede abrir las carpetas de otra familia — y si no cuadra, se
    ignora y se ofrecen todas, que es como estaba.
  */
  const laRaiz = raizPedida
    ? (categorias.find((c) => c.id === raizPedida && !c.padre_id) ?? null)
    : null

  if (laRaiz) {
    const suyas = hojas.filter((c) => cuelgaDe(categorias, c.id, laRaiz.id))
    /* Si la actividad todavía no tiene ni una carpeta final, se
       dejan todas: es mejor que el modelo proponga algo aunque haya
       que corregirlo, que dejarlo sin ninguna opción y que no proponga
       nada. El candado de verdad está en la pantalla. */
    if (suyas.length > 0) hojas = suyas
  }

  const rutaDe = (c: Categoria) =>
    cadena(categorias, c.id)
      .map((x) => x.nombre)
      .join(' → ')

  try {
    /*
      Dos maneras de leer un papel.

      LA BUENA — Cloud Vision saca el texto, y MAPPEL lo entiende aquí
      mismo, en su propio servidor. Mil documentos al mes gratis, y el
      contenido no se usa para entrenar nada. Es la que se usa si está
      configurada.

      LA DE ANTES — Gemini hace las dos cosas de una vez. Se queda como
      respaldo para no dejar la aplicación sin lectura mientras la otra
      no esté puesta. En su capa gratuita el contenido SÍ se usa para
      entrenar, y por eso deja de ser la principal.
    */
    let lectura
    /*
      CON QUÉ SE HA LEÍDO. Se devuelve, y no es un dato técnico: el
      modelo y las reglas leen con calidad muy distinta, y hasta ahora
      cuál de los dos había leído era invisible. Alguien veía datos
      pobres y no tenía forma de saber si el papel estaba mal
      fotografiado o si el lector bueno no había podido. Ahora se dice.
    */
    let comoSeLeyo: 'modelo' | 'reglas' = 'reglas'
    /*
      Y POR QUÉ NO PUDO EL MODELO.

      Esto se quedaba en el registro del servidor, que es donde no lo ve
      nadie. El teléfono enseñaba «he usado el lector de respaldo» sin
      poder decir la razón — y la razón es justo lo único que hace falta
      para arreglarlo: sin cupo, sin clave, demasiado lento, la foto
      rechazada. Cada una se arregla de una manera distinta.
    */
    let porQueReglas: string | null = null

    /*
      ── AQUÍ ESTABA EL FALLO QUE LO ROMPÍA TODO ──

      Esta línea decidía quién lee el papel, y decidía mal:

        const texto = textoDelMovil ?? (hayVision() && archivo ? … )

      Cuando llegaba una FOTO, como la clave de Cloud Vision sigue
      puesta en Vercel, la foto se desviaba a Vision — que devuelve 403
      porque nunca se activó la facturación. Y aunque hubiera
      funcionado, el texto habría acabado en `entenderPapel`, o sea en
      reglas escritas a mano.

      Resultado: AL MODELO NO LE LLEGABA NUNCA LA FOTO. Se cambió el
      móvil para que mandara la imagen, y aquí se desviaba antes de
      llegar. Tres rondas afinando el reconocedor mientras el camino
      bueno estaba cortado en el servidor.

      Ahora es simple, y por eso es difícil de romper:

        LLEGA TEXTO  → lo entienden las reglas, aquí mismo, gratis.
                       Es el PDF que ya traía el texto dentro y el
                       respaldo de cuando el modelo no puede.

        LLEGA UN ARCHIVO → lo lee el modelo. Sin desvíos.

      Cloud Vision se queda fuera: leía, pero no entendía, y para
      leer hacía falta una tarjeta.
    */
    const texto = textoDelMovil

    if (texto) {
      if (!texto.trim()) {
        return NextResponse.json(
          { error: 'No se ha leído texto en la foto. Prueba con más luz o clasifícalo a mano.' },
          { status: 422 }
        )
      }

      /*
        Lo que ya habéis archivado.

        De aquí sale el proveedor y su carpeta: si ENDESA lleva doce
        veces en Finca → Gastos → Luz, no hay nada que adivinar. Esta
        es la parte que hace que MAPPEL mejore usándolo, sin cambiar de
        modelo ni pagar más.
      */
      const { data: historia } = await supabase
        .from('documentos')
        .select('proveedor, categoria_id')
        .eq('hogar_id', await elEspacioO(supabase))
        .not('proveedor', 'is', null)
        .limit(2000)

      const cuenta = new Map<string, Conocido>()
      for (const d of historia ?? []) {
        const clave = `${(d.proveedor as string).toLowerCase()}|${d.categoria_id}`
        const antes = cuenta.get(clave)
        if (antes) antes.veces++
        else
          cuenta.set(clave, {
            proveedor: d.proveedor as string,
            categoria_id: d.categoria_id as string,
            veces: 1,
          })
      }

      /*
        ── QUIÉN ENTIENDE ESTE TEXTO ──

        Antes: siempre las reglas. Y de ahí salía lo de «a veces lee
        rapidísimo y no registra bien»: el papel con MEJOR texto de
        todos —un PDF que llega por correo— era el peor entendido,
        porque llegaba como texto y el texto no pasaba por el modelo.

        Ahora el modelo lo intenta también con texto, que además es más
        rápido y más barato que con una foto. Las reglas se quedan
        DEBAJO, de respaldo, que es para lo que se escribieron: sin
        cupo, sin conexión o sin clave, MAPPEL sigue leyendo.
      */
      const conocidos = [...cuenta.values()]

      if (process.env.GEMINI_API_KEY) {
        try {
          lectura = await leerDocumento({ texto, categorias: hojas, rutaDe })
          comoSeLeyo = 'modelo'
        } catch (e) {
          /* Traducido, SIEMPRE. Aquí se ponía `e.message` tal cual, y
             ese texto sale en la pantalla de guardar: así es como
             acabó un JSON de Google en inglés delante de Juan Miguel.
             Lo crudo va al registro; a la pantalla va una frase. */
          porQueReglas = enCristiano(e)
          console.warn('[MAPPEL] El modelo no ha podido con el texto, van las reglas:', e)
        }
      }

      if (!lectura) {
        lectura = entenderPapel(texto, conocidos)
        comoSeLeyo = 'reglas'
        if (!porQueReglas && !process.env.GEMINI_API_KEY) {
          porQueReglas = 'No hay clave del modelo configurada en el servidor.'
        }
      }
    } else if (archivo && process.env.GEMINI_API_KEY) {
      /*
        ══════════════════════════════════════════════════════════
        LA FOTO, AL MODELO — Y AHORA DICIENDO POR QUÉ CUANDO NO PUEDE
        ══════════════════════════════════════════════════════════

        Haris: *«desde la parte general va bien, pero si lo hago desde
        una de las cuentas o desde la compra, no lo lee»*. Y en la
        pantalla salía «No se ha podido leer el documento», que es la
        frase que se dice cuando **no se sabe** qué ha pasado.

        Aquí estaba el agujero, y es de los que se ven al mirar los dos
        caminos juntos:

            CON TEXTO  →  el modelo se intenta DENTRO de un `try`, y si
                          falla se traduce el motivo (`enCristiano`), se
                          lee con las reglas y se sigue.

            CON FOTO   →  el modelo se intentaba A PELO. Cualquier
                          tropiezo —el cupo del minuto, el modelo
                          ocupado, una respuesta rara— se iba al `catch`
                          de abajo y salía la frase genérica.

        O sea: el mismo tropiezo era un aviso explicado en un camino y
        un «no se ha podido» mudo en el otro. Y como la foto es EL
        camino de una pared y de un móvil, el mudo era el que se veía.

        Ahora también se traduce. Sin lectura no hay nada que salvar
        —no hay texto al que aplicarle las reglas—, así que se sigue
        contestando que no, pero **diciendo cuál de todas las cosas ha
        sido**, que es lo único que permite arreglarla.
      */
      try {
        lectura = await leerDocumento({
          contenido: await archivo.arrayBuffer(),
          tipoMime: archivo.type,
          categorias: hojas,
          rutaDe,
        })
        comoSeLeyo = 'modelo'
      } catch (e) {
        console.error('[MAPPEL] El modelo no ha podido con la foto:', e)
        return NextResponse.json(
          {
            error: enCristiano(e),
            detalle: e instanceof Error ? e.message.slice(0, 300) : undefined,
          },
          { status: 502 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Este documento no se ha podido leer solo. Clasifícalo a mano.' },
        { status: 422 }
      )
    }

    // Solo aceptamos una categoría si existe de verdad y es una hoja.
    const sugerida = hojas.find((c) => c.id === lectura.categoria_id) ?? null

    return NextResponse.json({
      ...lectura,
      como_se_leyo: comoSeLeyo,
      por_que_reglas: porQueReglas,
      categoria_id: sugerida?.id ?? null,
      categoria_ruta: sugerida ? rutaDe(sugerida) : null,
      categoria_nombre: sugerida?.nombre ?? null,
    })
  } catch (e) {
    const motivo = e instanceof Error ? e.message : ''
    console.error('[MAPPEL] Fallo leyendo el documento:', e)


    if (motivo === 'SIN_CLAVE_OCR') {
      return NextResponse.json(
        { error: 'La lectura automática no está configurada todavía.' },
        { status: 503 }
      )
    }
    if (motivo === 'DEMASIADO_LENTO') {
      return NextResponse.json(
        { error: 'La lectura está tardando demasiado. Clasifícalo a mano esta vez.' },
        { status: 504 }
      )
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
    if (motivo === 'MODELO_OCUPADO') {
      return NextResponse.json(
        {
          error:
            'La lectura automática está saturada ahora mismo. Espera un momento y vuelve a darle, o clasifícalo a mano.',
        },
        { status: 503 }
      )
    }
    if (motivo.startsWith('VISION_SIN_PERMISO')) {
      // El motivo técnico va aparte: no se le enseña a nadie como
      // mensaje, pero evita tener que adivinar qué ha pasado.
      return NextResponse.json(
        {
          error: 'El lector de documentos no está bien configurado todavía.',
          detalle: motivo.slice(0, 300),
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'No se ha podido leer el documento. Puedes clasificarlo a mano.' },
      { status: 502 }
    )
  }
}

/*
  ── DE SEÑA A FRASE ────────────────────────────────────────

  `lib/ocr.ts` no lanza mensajes: lanza señas de una palabra. Aquí se
  convierten en algo que se pueda leer en una cocina.

  Y el `default` es lo importante: cualquier cosa que no esté en esta
  lista se cuenta con una frase nuestra, no con la suya. Lo que no se
  conoce no se reenvía — de eso vino el JSON en inglés en pantalla.
*/
function enCristiano(e: unknown): string {
  const sena = e instanceof Error ? e.message : ''
  switch (sena) {
    case 'MODELO_OCUPADO':
      return 'La lectura automática estaba saturada. Lo he leído a mi manera.'
    case 'MODELO_NO_CONTESTA':
    case 'MODELO_SIN_RESPUESTA':
      return 'La lectura automática no ha contestado. Lo he leído a mi manera.'
    case 'CUOTA_MINUTO':
      return 'Se han leído muchos papeles seguidos. Espera medio minuto.'
    case 'CUOTA_DIA':
      return 'Se ha agotado el cupo de lectura de hoy. Mañana vuelve solo.'
    case 'DEMASIADO_LENTO':
      return 'La lectura ha tardado demasiado. Lo he leído a mi manera.'
    case 'SIN_CLAVE_OCR':
      return 'La lectura automática no está configurada todavía.'
    default:
      return 'La lectura automática no ha podido con este papel. Lo he leído a mi manera.'
  }
}
