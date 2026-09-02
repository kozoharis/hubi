import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { accesoDrive, idDeCarpeta, subirArchivo } from '@/lib/google/drive'
import {
  cadena,
  rutaDeCarpetas,
  nombreDeArchivo,
  extensionDe,
  type Categoria,
} from '@/lib/rutas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TIPOS = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
const MAXIMO = 4 * 1024 * 1024

function fechaOnula(valor: string | null): string | null {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null
}

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()

  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let formulario: FormData
  try {
    formulario = await peticion.formData()
  } catch {
    return NextResponse.json(
      { error: 'El archivo es demasiado grande. Prueba con una foto más pequeña.' },
      { status: 413 }
    )
  }

  const archivo = formulario.get('archivo')
  const categoriaId = String(formulario.get('categoria_id') ?? '')
  const titulo = String(formulario.get('titulo') ?? '').trim()
  const proveedor = String(formulario.get('proveedor') ?? '').trim() || null
  const textoOcr = String(formulario.get('texto_ocr') ?? '').trim() || null
  const confianza = String(formulario.get('confianza') ?? '') || null

  const fechaDocumento =
    fechaOnula(String(formulario.get('fecha_documento') ?? '')) ??
    new Date().toISOString().slice(0, 10)

  const vencimiento = fechaOnula(String(formulario.get('vencimiento') ?? ''))

  const importeBruto = String(formulario.get('importe') ?? '').replace(',', '.')
  const importe =
    importeBruto && !Number.isNaN(Number(importeBruto)) ? Number(importeBruto) : null

  /* Los Helechos. Solo llegan si el documento va a esa sección: en una
     factura de la luz de la finca estos campos ni se enseñan. */
  const apartamento = entero(formulario.get('apartamento'), 1, 3)
  const personas = entero(formulario.get('personas'), 1, 20)
  const noches = entero(formulario.get('noches'), 1, 365)
  const huesped = String(formulario.get('huesped') ?? '').trim().slice(0, 120) || null
  const referencia = String(formulario.get('referencia') ?? '').trim().slice(0, 40) || null

  if (!(archivo instanceof File) || archivo.size === 0) {
    return NextResponse.json({ error: 'No has elegido ningún archivo.' }, { status: 400 })
  }
  if (!TIPOS.includes(archivo.type)) {
    return NextResponse.json(
      { error: 'Solo se pueden guardar fotos (JPG, PNG) o documentos PDF.' },
      { status: 400 }
    )
  }
  if (archivo.size > MAXIMO) {
    return NextResponse.json(
      { error: 'El archivo pesa demasiado. El máximo son 4 MB.' },
      { status: 413 }
    )
  }
  if (!categoriaId) {
    return NextResponse.json({ error: 'Falta elegir dónde guardarlo.' }, { status: 400 })
  }

  /* Con la sesión, no con la clave de servidor: así la base de datos
     impide que alguien archive un documento en la carpeta de otra
     familia pasando su identificador a mano. */
  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, icono, orden, naturaleza')

  /* De qué hogar es quien guarda. Hace falta para que la memoria de
     carpetas de Drive no nazca huérfana. */
  const { data: miMiembro } = await supabase
    .from('miembros')
    .select('hogar_id')
    .eq('perfil_id', user.id)
    .maybeSingle()
  const hogarId = miMiembro?.hogar_id ?? null

  const camino = cadena((categorias ?? []) as Categoria[], categoriaId)
  if (camino.length === 0) {
    return NextResponse.json({ error: 'Esa categoría ya no existe.' }, { status: 400 })
  }

  // La fecha del documento manda sobre la de subida: una factura de agosto
  // guardada en septiembre debe archivarse en el trimestre que le toca.
  const fecha = new Date(fechaDocumento + 'T12:00:00')

  let driveFileId: string
  let carpetaId: string
  let nombre: string

  try {
    const { acceso, raiz } = await accesoDrive()

    carpetaId = await idDeCarpeta(acceso, raiz, rutaDeCarpetas(camino, fecha), hogarId)

    nombre = nombreDeArchivo({
      fecha,
      camino,
      titulo: titulo || null,
      proveedor,
      importe,
      extension: extensionDe(archivo.type, archivo.name),
    })

    driveFileId = await subirArchivo(
      acceso,
      carpetaId,
      nombre,
      archivo.type,
      await archivo.arrayBuffer()
    )
  } catch (e) {
    const motivo = e instanceof Error ? e.message : ''
    console.error('[Family Hub] Fallo subiendo a Drive:', e)

    if (motivo === 'DRIVE_SIN_CONECTAR') {
      return NextResponse.json(
        { error: 'Google Drive todavía no está conectado. Juan Miguel debe conectarlo.' },
        { status: 409 }
      )
    }
    if (motivo === 'DRIVE_CADUCADO') {
      return NextResponse.json(
        {
          error:
            'El permiso de Google Drive ha caducado. Juan Miguel tiene que volver a conectarlo.',
        },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'No se ha podido guardar en Drive. Inténtalo de nuevo.' },
      { status: 502 }
    )
  }

  const { data: documento, error } = await supabase
    .from('documentos')
    .insert({
      titulo: titulo || camino[camino.length - 1].nombre,
      categoria_id: categoriaId,
      /* La ruta escrita: "Finca Gastos Luz".
         El buscador la mete en su índice junto al título y al texto
         del papel, para que buscar por el nombre de la carpeta
         encuentre lo que hay dentro. Sin esto, "facturas de la finca"
         no daba nada: "finca" es una carpeta, no una palabra escrita
         en la factura. */
      ruta_texto: camino.map((c) => c.nombre).join(' '),
      drive_file_id: driveFileId,
      drive_folder_id: carpetaId,
      nombre_archivo: nombre,
      tipo_mime: archivo.type,
      tamano_bytes: archivo.size,
      fecha_documento: fechaDocumento,
      fecha_vencimiento: vencimiento,
      importe,
      proveedor,
      /*
        EL TEXTO LEÍDO NO SE GUARDA EN SALUD NI EN PERSONAL.

        Los archivos nunca están en HUBI: están en el Drive de la
        familia. Pero el TEXTO leído sí se guardaba aquí —1.200
        caracteres, para poder buscar—. Y en un informe médico, ese
        texto ES el dato de salud. Era el único sitio donde información
        especialmente protegida aterrizaba en nuestra base de datos.

        Se pierde poder buscar por lo que pone DENTRO de un informe: se
        sigue archivando, viendo y abriendo igual, y se encuentra por
        su título, su fecha y su carpeta. A cambio, HUBI se queda fuera
        del artículo 9 del RGPD por construcción y no por promesa — que
        con familias de fuera deja de ser un detalle.

        Se decide por la RAÍZ del camino y no por una lista de nombres:
        cualquier carpeta que alguien cree mañana dentro de Salud queda
        protegida sola.
      */
      texto_ocr: esReservado(camino) ? null : textoOcr,
      confianza_ocr: ['alta', 'media', 'baja'].includes(confianza ?? '')
        ? confianza
        : null,
      subido_por: user.id,
      visibilidad: 'compartido',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[Family Hub] Subido a Drive pero no registrado:', error)
    return NextResponse.json(
      {
        error:
          'El archivo se ha guardado en Drive pero no se ha registrado. Avisa antes de repetir.',
      },
      { status: 500 }
    )
  }

  // ── El documento alimenta el balance ───────────────────────
  // Si lo archivado es dinero y trae importe, se apunta solo en las
  // cuentas de la Finca. Si esto fallara, el documento ya está a salvo:
  // no se rompe el guardado por un apunte.
  const hoja = camino[camino.length - 1]
  let repetida: string | null = null

  if (importe && importe > 0 && (hoja.naturaleza === 'gasto' || hoja.naturaleza === 'ingreso')) {
    const { error: fallo } = await supabase.from('movimientos').insert({
      tipo: hoja.naturaleza,
      /* En una reserva el nombre de quien viene identifica mucho mejor
         que "Airbnb", que se repite en todas. */
      concepto: huesped || proveedor || titulo || hoja.nombre,
      importe,
      fecha: fechaDocumento,
      categoria_id: categoriaId,
      documento_id: documento.id,
      creado_por: user.id,
      apartamento,
      personas: hoja.naturaleza === 'ingreso' ? personas : null,
      noches: hoja.naturaleza === 'ingreso' ? noches : null,
      huesped: hoja.naturaleza === 'ingreso' ? huesped : null,
      referencia: hoja.naturaleza === 'ingreso' ? referencia : null,
    })
    /* El documento ya está a salvo en Drive: un apunte que falla no
       puede tumbar el guardado. Pero si falla por reserva repetida,
       eso hay que DECIRLO — es la diferencia entre "ya lo tenías" y
       un ingreso que se pierde en silencio. */
    if (fallo) {
      console.error('[Family Hub] Documento guardado sin apunte:', fallo)
      if (fallo.code === '23505' && referencia) repetida = referencia
    }
  }

  return NextResponse.json({
    id: documento.id,
    nombre,
    ruta: rutaDeCarpetas(camino, fecha).join(' / '),
    // Si el documento caduca, la pantalla siguiente preguntará si quieren
    // que se les avise. Nunca se crea un aviso sin preguntar.
    vencimiento,
    titulo: titulo || camino[camino.length - 1].nombre,
    /* El papel está guardado, pero esa reserva ya estaba apuntada, así
       que el ingreso NO se ha vuelto a sumar. Se dice. */
    repetida,
  })
}

/*
  ¿Este documento va a una sección reservada?

  Salud y Personal. De lo que cuelgue de ellas no se guarda el texto
  leído. Se mira la raíz del camino, así que una carpeta nueva dentro
  de Salud nace protegida sin que nadie tenga que acordarse.
*/
const RESERVADAS = ['SALUD', 'PERSONAL']

function esReservado(camino: { segmento_drive: string }[]): boolean {
  return RESERVADAS.includes((camino[0]?.segmento_drive ?? '').toUpperCase())
}

/** Un número entero dentro de rango, o nada. Nunca a medias. */
function entero(valor: FormDataEntryValue | null, min: number, max: number): number | null {
  const n = Number(String(valor ?? ''))
  if (!Number.isInteger(n) || n < min || n > max) return null
  return n
}
