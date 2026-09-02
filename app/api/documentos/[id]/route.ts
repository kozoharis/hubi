import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { accesoDrive, idDeCarpeta, moverYRenombrar, aLaPapelera } from '@/lib/google/drive'
import {
  cadena,
  rutaDeCarpetas,
  nombreDeArchivo,
  extensionDe,
  type Categoria,
} from '@/lib/rutas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/*
  CORREGIR Y BORRAR UN PAPEL.

  Faltaba, y se notaba: una foto mal clasificada o con el importe mal
  leído se quedaba así para siempre. La única salida era volver a
  fotografiarla y quedarse con el papel duplicado en Drive.

  LA REGLA DE ESTE ARCHIVO: HUBI Y DRIVE NO PUEDEN CONTARSE COSAS
  DISTINTAS.

  Cambiar la carpeta aquí y no en Drive sería lo cómodo, y sería
  exactamente el prototipo falso que el punto 23 prohíbe: la pantalla
  enseñaría "Finca › Luz" y el archivo seguiría metido en "Casa". A los
  dos días nadie sabría cuál de los dos tiene razón, y el Drive es el
  que manda porque es el que sobrevive a esta aplicación.

  Así que un cambio de carpeta o de fecha MUEVE el archivo de verdad, y
  si Google no coopera no se guarda nada. Mejor no cambiar nada que
  cambiar la mitad.
*/

function fechaOnula(valor: unknown): string | null {
  const s = String(valor ?? '')
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

// ── CORREGIR ─────────────────────────────────────────────────
export async function PATCH(
  peticion: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = (await peticion.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const { data: antes } = await supabase
    .from('documentos')
    .select(
      'id, titulo, categoria_id, drive_file_id, drive_folder_id, nombre_archivo, tipo_mime, fecha_documento, importe, proveedor'
    )
    .eq('id', id)
    .maybeSingle()

  if (!antes) {
    return NextResponse.json({ error: 'Ese papel ya no está.' }, { status: 404 })
  }

  // ── Lo que se quiere dejar ──
  const titulo = String(cuerpo.titulo ?? antes.titulo).trim().slice(0, 160)
  const proveedor = String(cuerpo.proveedor ?? antes.proveedor ?? '').trim().slice(0, 120) || null
  const fecha = fechaOnula(cuerpo.fecha_documento) ?? antes.fecha_documento
  const categoriaId = String(cuerpo.categoria_id ?? antes.categoria_id)

  const importeBruto = String(cuerpo.importe ?? '').replace(',', '.')
  const importe =
    cuerpo.importe === null || importeBruto === ''
      ? null
      : Number.isNaN(Number(importeBruto))
        ? (antes.importe as number | null)
        : Number(importeBruto)

  if (titulo.length < 2) {
    return NextResponse.json({ error: 'El título no puede quedarse vacío.' }, { status: 400 })
  }

  /* Con la sesión: así la base de datos impide colocar un papel en la
     carpeta de otra familia pasando su identificador a mano. */
  const { data: cats } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, icono, orden, naturaleza')

  const camino = cadena((cats ?? []) as Categoria[], categoriaId)
  if (camino.length === 0) {
    return NextResponse.json({ error: 'Esa carpeta ya no existe.' }, { status: 400 })
  }

  const { data: miMiembro } = await supabase
    .from('miembros')
    .select('hogar_id')
    .eq('perfil_id', user.id)
    .maybeSingle()

  // ── Mover el archivo en Drive, ANTES de tocar la base de datos ──
  const cuando = new Date(fecha + 'T12:00:00')
  let carpetaId = antes.drive_folder_id
  let nombre = antes.nombre_archivo

  const cambiaSitio = categoriaId !== antes.categoria_id || fecha !== antes.fecha_documento
  const cambiaNombre =
    cambiaSitio ||
    titulo !== antes.titulo ||
    proveedor !== antes.proveedor ||
    Number(importe) !== Number(antes.importe)

  if (cambiaNombre) {
    try {
      const { acceso, raiz } = await accesoDrive()

      if (cambiaSitio) {
        carpetaId = await idDeCarpeta(
          acceso,
          raiz,
          rutaDeCarpetas(camino, cuando),
          miMiembro?.hogar_id ?? null
        )
      }

      nombre = nombreDeArchivo({
        fecha: cuando,
        camino,
        titulo: titulo || null,
        proveedor,
        importe,
        extension: extensionDe(antes.tipo_mime, antes.nombre_archivo),
      })

      await moverYRenombrar(acceso, antes.drive_file_id, nombre, carpetaId, antes.drive_folder_id)
    } catch (e) {
      console.error('[HUBI] No se ha podido mover el papel en Drive:', e)
      /* No se guarda NADA. Un cambio a medias —la base de datos dice
         una carpeta y Drive tiene otra— es peor que no haber cambiado. */
      return NextResponse.json(
        {
          error:
            'No se ha podido mover el archivo en Google Drive, así que no se ha cambiado nada. Inténtalo de nuevo.',
        },
        { status: 502 }
      )
    }
  }

  // ── Ahora sí, la base de datos ──
  const { data: guardado, error } = await supabase
    .from('documentos')
    .update({
      titulo,
      proveedor,
      importe,
      fecha_documento: fecha,
      categoria_id: categoriaId,
      drive_folder_id: carpetaId,
      nombre_archivo: nombre,
      ruta_texto: camino.map((c) => c.nombre).join(' '),
    })
    .eq('id', id)
    .select('id')

  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido guardar el cambio.', detalle: error.message },
      { status: 500 }
    )
  }

  /* Cero filas y ningún error: la base de datos no ha dejado. Es el
     fallo silencioso de siempre, y aquí sería grave — el archivo YA se
     ha movido en Drive. */
  if (!guardado || guardado.length === 0) {
    return NextResponse.json(
      {
        error:
          'El archivo se ha movido en Drive pero el cambio no se ha registrado. Avisa antes de repetirlo.',
      },
      { status: 409 }
    )
  }

  /*
    El apunte de dinero va detrás.

    Si el papel alimentó el balance, corregir el importe del papel sin
    corregir el apunte dejaría las cuentas mintiendo — y las cuentas
    son la mitad de para qué existe esto.
  */
  const hoja = camino[camino.length - 1]
  const esDinero = hoja.naturaleza === 'gasto' || hoja.naturaleza === 'ingreso'

  const { data: apunte } = await supabase
    .from('movimientos')
    .select('id')
    .eq('documento_id', id)
    .maybeSingle()

  if (apunte && importe != null && importe > 0 && esDinero) {
    await supabase
      .from('movimientos')
      .update({
        tipo: hoja.naturaleza,
        concepto: proveedor || titulo || hoja.nombre,
        importe,
        fecha,
        categoria_id: categoriaId,
      })
      .eq('id', apunte.id)
  } else if (apunte) {
    /* Ya no es dinero, o se le ha quitado el importe: el apunte deja de
       tener sentido y se quita del balance. */
    await supabase.from('movimientos').delete().eq('id', apunte.id)
  } else if (importe != null && importe > 0 && esDinero) {
    /*
      No tenía apunte y ahora le toca tener uno.

      Es el caso de "me equivoqué de carpeta": una factura de la luz
      que se archivó en Documentos importantes no contaba en ninguna
      cuenta. Al moverla a Finca › Gastos › Luz tiene que empezar a
      contar — si no, corregir la carpeta arregla el archivo y deja el
      balance igual de mal que estaba.
    */
    await supabase.from('movimientos').insert({
      tipo: hoja.naturaleza,
      concepto: proveedor || titulo || hoja.nombre,
      importe,
      fecha,
      categoria_id: categoriaId,
      documento_id: id,
      creado_por: user.id,
    })
  }

  return NextResponse.json({ bien: true, movido: cambiaSitio })
}

// ── BORRAR ───────────────────────────────────────────────────
/*
  El archivo NO se borra de Google Drive: se manda a su PAPELERA, donde
  Google lo guarda 30 días. Un dedo gordo en un móvil no puede hacer
  desaparecer para siempre la escritura de una casa.

  El orden importa, y es éste a propósito:

    1. se intenta borrar la ficha
    2. solo si la base de datos lo impide por tener cosas colgando, se
       sueltan esas cosas y se reintenta
    3. una vez ida la ficha, se quita el apunte de dinero
    4. y al final, la papelera de Drive

  Primero se comprueba que el papel se va a ir; después se toca lo que
  colgaba de él. Al revés —quitar el apunte y que luego el borrado
  falle— dejaría las cuentas mal por un borrado que no llegó a ocurrir.

  Y si algo falla al final, el fallo cae del lado seguro: puede quedar
  un archivo de más en Drive —que se ve y se borra a mano—, nunca una
  ficha apuntando a un archivo que ya no existe.
*/
export async function DELETE(
  _peticion: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const { data: papel } = await supabase
    .from('documentos')
    .select('id, drive_file_id, titulo')
    .eq('id', id)
    .maybeSingle()

  if (!papel) {
    return NextResponse.json({ error: 'Ese papel ya no está.' }, { status: 404 })
  }

  /* Qué cuelga de este papel. Se anota AHORA, pero no se toca nada
     todavía: hasta que no sepamos que el papel se puede borrar de
     verdad, quitarle el apunte de dinero sería dejar las cuentas mal
     por un borrado que a lo mejor no llega a ocurrir. */
  const { data: apunte } = await supabase
    .from('movimientos')
    .select('id')
    .eq('documento_id', id)
    .maybeSingle()

  // ── Se intenta borrar la ficha ──
  // Con `.select()`: sin él, un borrado que la base de datos no permite
  // devuelve "todo bien" habiendo borrado cero filas.
  let { data: borradas, error } = await supabase
    .from('documentos')
    .delete()
    .eq('id', id)
    .select('id')

  /*
    23503 es "hay otra fila apuntando a ésta".

    Solo ENTONCES se sueltan las amarras, y se vuelve a intentar. Así el
    orden es el correcto: primero se comprueba que el papel se va a ir,
    y después se toca lo que colgaba de él. Nunca al revés.
  */
  if (error?.code === '23503') {
    if (apunte) await supabase.from('movimientos').delete().eq('id', apunte.id)

    /* Los avisos NO se borran: se quedan sin padre.

       Un aviso de "el seguro vence el 12 de noviembre" es algo que hay
       que hacer, y sigue habiendo que hacerlo aunque se borre la foto
       de la póliza. Borrarle a alguien un aviso del calendario sin
       decírselo es de las cosas que hacen perder la confianza en una
       aplicación para siempre. */
    await supabase
      .from('recordatorios')
      .update({ documento_origen_id: null })
      .eq('documento_origen_id', id)

    ;({ data: borradas, error } = await supabase
      .from('documentos')
      .delete()
      .eq('id', id)
      .select('id'))
  }

  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido borrar.', detalle: error.message },
      { status: 500 }
    )
  }
  if (!borradas || borradas.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido borrar: la base de datos no ha dejado.' },
      { status: 409 }
    )
  }

  /* El papel ya no está. Si el apunte de dinero ha sobrevivido, se va
     ahora: un gasto sin papel que lo respalde es un número suelto en
     las cuentas que nadie puede comprobar. Si ya se fue solo, esto no
     borra nada y no pasa nada. */
  if (apunte) await supabase.from('movimientos').delete().eq('id', apunte.id)

  // Y el archivo, a la papelera de Drive.
  let enPapelera = false
  try {
    const { acceso } = await accesoDrive()
    enPapelera = await aLaPapelera(acceso, papel.drive_file_id)
  } catch (e) {
    console.error('[HUBI] No se ha podido enviar a la papelera de Drive:', e)
  }

  return NextResponse.json({ bien: true, enPapelera })
}
