import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { SIN_CASA } from '@/lib/hogar'
import { accesoDrive, idDeCarpeta, moverYRenombrar, aLaPapelera } from '@/lib/google/drive'
import {
  cadena,
  rutaDeCarpetas,
  nombreDeArchivo,
  extensionDe,
  type Categoria,
} from '@/lib/rutas'
import { rehacerAvisos, esAviso, type Vencimiento } from '@/lib/vencimientos'
import { desgloseQueToca } from '@/lib/impuesto'
import { hoyAqui } from '@/lib/tablon'
import { elEspacio, elEspacioO } from '@/lib/espacio'

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

/* El preaviso, en días. Fuera de rango se trata como «no hay»: es
   preferible un contrato sin preaviso —que avisa el día que vence— a
   uno con un aviso calculado a tres años vista, que sería ruido fijo en
   el calendario y acabaría enseñando a no mirarlo. */
function diasDePreaviso(valor: unknown): number | null {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 && n <= 365 ? n : null
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

  const BASE =
    'id, titulo, categoria_id, drive_file_id, drive_folder_id, nombre_archivo, tipo_mime, fecha_documento, importe, proveedor, fecha_vencimiento'

  /*
    DOS INTENTOS, POR LA TRAMPA DE SIEMPRE.

    `fecha_vencimiento` YA EXISTÍA —el guardado la escribe desde que hay
    OCR—; lo que es nuevo del SQL 43 es lo que la rodea: si se renueva,
    con cuánto hay que avisar y qué aviso quiere la familia.

    Y por eso van en el segundo intento. Si el SQL todavía no se ha
    ejecutado, pedirlas no falla solo por ellas: Postgres rechaza LA
    CONSULTA ENTERA, y entonces corregir cualquier papel —el título, el
    importe, la carpeta— empezaría a dar «ese papel ya no está» sobre
    papeles que están perfectamente.

    Una columna nueva nunca puede romper lo que ya funcionaba.
  */
  type Antes = {
    id: string
    titulo: string
    categoria_id: string
    drive_file_id: string
    drive_folder_id: string
    nombre_archivo: string
    tipo_mime: string
    fecha_documento: string
    importe: number | null
    proveedor: string | null
    fecha_vencimiento?: string | null
    se_renueva?: boolean | null
    preaviso_dias?: number | null
    avisar_con?: string | null
  }

  let antes: Antes | null = null
  let hayVencimientos = true

  {
    const r = await supabase
      .from('documentos')
      .select(`${BASE}, se_renueva, preaviso_dias, avisar_con`)
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('id', id)
      .maybeSingle()

    if (r.error) {
      hayVencimientos = false
      const r2 = await supabase
        .from('documentos')
        .select(BASE)
        .eq('hogar_id', await elEspacioO(supabase))
        .eq('id', id)
        .maybeSingle()
      antes = r2.data as Antes | null
    } else {
      antes = r.data as Antes | null
    }
  }

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

  /*
    ── EL VENCIMIENTO ──

    Solo se toca lo que venga en la petición: `undefined` significa «no
    me preguntes por esto», y `null` significa «quítalo». Es la
    distinción que hace falta para que la pantalla de corregir el
    importe no borre sin querer el aviso del seguro.
  */
  /* Dos cosas distintas, y confundirlas costaría un aviso perdido:
     `gobierna` es que ESTA pantalla manda sobre el vencimiento;
     `hayVencimientos` es que la base de datos ya sabe de renovaciones.
     La fecha se puede guardar sin lo segundo — existe desde antes. */
  const gobierna = 'fecha_vencimiento' in cuerpo
  const tocaVencimiento = hayVencimientos && gobierna

  const vence: Vencimiento = {
    fecha_vencimiento: gobierna
      ? fechaOnula(cuerpo.fecha_vencimiento)
      : (antes.fecha_vencimiento ?? null),
    se_renueva: tocaVencimiento
      ? cuerpo.se_renueva === true
      : Boolean(antes.se_renueva),
    preaviso_dias: tocaVencimiento
      ? diasDePreaviso(cuerpo.preaviso_dias)
      : (antes.preaviso_dias ?? null),
    avisar_con: tocaVencimiento
      ? (esAviso(cuerpo.avisar_con) ? cuerpo.avisar_con : 'sin_aviso')
      : (esAviso(antes.avisar_con) ? antes.avisar_con : 'sin_aviso'),
  }

  /* Sin fecha de vencimiento, lo demás no gobierna nada. Guardar «se
     renueva con un mes de preaviso» sobre un papel que no vence deja
     datos que no significan nada y que un día se leerán como si sí. */
  if (!vence.fecha_vencimiento) {
    vence.se_renueva = false
    vence.preaviso_dias = null
    vence.avisar_con = 'sin_aviso'
  }
  if (!vence.se_renueva) vence.preaviso_dias = null

  /* Con la sesión: así la base de datos impide colocar un papel en la
     carpeta de otra familia pasando su identificador a mano. */
  const { data: cats } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, icono, orden, naturaleza')
    .eq('hogar_id', await elEspacioO(supabase))

  const camino = cadena((cats ?? []) as Categoria[], categoriaId)
  if (camino.length === 0) {
    return NextResponse.json({ error: 'Esa carpeta ya no existe.' }, { status: 400 })
  }

  const hogarId = await elEspacio(supabase)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 403 })

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
      const { acceso, raiz } = await accesoDrive(hogarId)

      if (cambiaSitio) {
        carpetaId = await idDeCarpeta(acceso, raiz, rutaDeCarpetas(camino, cuando), hogarId)
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
  const cambios: Record<string, unknown> = {
    titulo,
    proveedor,
    importe,
    fecha_documento: fecha,
    categoria_id: categoriaId,
    drive_folder_id: carpetaId,
    nombre_archivo: nombre,
    ruta_texto: camino.map((c) => c.nombre).join(' '),
  }

  /* Las columnas del vencimiento solo se mandan si existen. Mandarlas
     sin el SQL 43 tumbaría el UPDATE entero y no se guardaría tampoco
     el título. */
  if (gobierna) cambios.fecha_vencimiento = vence.fecha_vencimiento
  if (hayVencimientos) {
    cambios.se_renueva = vence.se_renueva
    cambios.preaviso_dias = vence.preaviso_dias
    cambios.avisar_con = vence.avisar_con
  }

  const { data: guardado, error } = await supabase
    .from('documentos')
    .update(cambios)
    .eq('hogar_id', await elEspacioO(supabase))
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
    .eq('hogar_id', hogarId)
    .eq('documento_id', id)
    .maybeSingle()

  /*
    Y el impuesto se REHACE, no se conserva.

    Si se corrige el importe de la factura, la cuota vieja deja de tener
    nada que ver con ella; si se cambia de partida, puede que le toque
    otro tipo. Dejar la cuota anterior pegada a un importe nuevo es
    justo el descuadre que una gestoría encuentra en dos minutos y
    nosotros no encontraríamos nunca.
  */
  const impuestoAhora =
    importe != null && importe > 0 && esDinero
      ? await desgloseQueToca(supabase, { hogarId, categoriaId, total: importe })
      : { impuesto_tipo: null, impuesto_cuota: null }

  if (apunte && importe != null && importe > 0 && esDinero) {
    const cambioDelApunte: Record<string, unknown> = {
      tipo: hoja.naturaleza,
      concepto: proveedor || titulo || hoja.nombre,
      importe,
      fecha,
      categoria_id: categoriaId,
    }
    if (impuestoAhora.impuesto_tipo !== null) {
      cambioDelApunte.impuesto_tipo = impuestoAhora.impuesto_tipo
      cambioDelApunte.impuesto_cuota = impuestoAhora.impuesto_cuota
    }

    await supabase
      .from('movimientos')
      .update(cambioDelApunte)
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('id', apunte.id)
  } else if (apunte) {
    /* Ya no es dinero, o se le ha quitado el importe: el apunte deja de
       tener sentido y se quita del balance. */
    await supabase
      .from('movimientos')
      .delete()
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('id', apunte.id)
  } else if (importe != null && importe > 0 && esDinero) {
    /*
      No tenía apunte y ahora le toca tener uno.

      Es el caso de "me equivoqué de carpeta": una factura de la luz
      que se archivó en Documentos importantes no contaba en ninguna
      cuenta. Al moverla a Finca › Gastos › Luz tiene que empezar a
      contar — si no, corregir la carpeta arregla el archivo y deja el
      balance igual de mal que estaba.
    */
    const nuevoApunte: Record<string, unknown> = {
      tipo: hoja.naturaleza,
      concepto: proveedor || titulo || hoja.nombre,
      importe,
      fecha,
      categoria_id: categoriaId,
      documento_id: id,
      creado_por: user.id,
    }
    if (impuestoAhora.impuesto_tipo !== null) {
      nuevoApunte.impuesto_tipo = impuestoAhora.impuesto_tipo
      nuevoApunte.impuesto_cuota = impuestoAhora.impuesto_cuota
    }

    await supabase.from('movimientos').insert(nuevoApunte)
  }

  /*
    ── Y LOS AVISOS, AL FINAL ──

    Se rehacen enteros a partir de lo que dice el papel: los que había
    se borran y nacen otra vez con los datos de ahora. Es lo que impide
    que corregir la fecha del seguro deje el aviso viejo puesto —dos
    verdades sobre el mismo papel, y ninguna forma de saber cuál manda.

    Si esto falla, el papel YA está guardado y no se deshace: se dice.
    Callar aquí sería dejar a alguien creyendo que le vamos a avisar de
    la ITV.
  */
  let avisoDelAviso: string | null = null
  let porQue: string | null = null

  if (tocaVencimiento) {
    const { fallo, sinMarca, aMedias } = await rehacerAvisos(supabase, {
      documentoId: id,
      titulo,
      creadoPor: user.id,
      hoy: hoyAqui(),
      ...vence,
    })

    /* El aviso se creó, pero solo al segundo intento: falta ejecutar un
       SQL. No se le dice nada a quien está usando HUBI —su aviso está
       puesto— pero queda en el registro, que es donde hace falta. */
    if (sinMarca) {
      console.warn('[HUBI] Aviso creado sin `motivo`. ¿Falta el sql/43?:', sinMarca)
    }

    /* Entró uno de los dos. El papel está guardado y el aviso que
       importa existe, así que NO se para a nadie por esto — pero se
       dice, porque falta la mitad de lo que se prometió en pantalla. */
    if (aMedias) {
      console.error('[HUBI] Solo se ha creado parte de los avisos:', aMedias)
      avisoDelAviso =
        'Se ha guardado, pero solo he podido poner uno de los dos avisos en el calendario. Míralo en la Agenda.'
      porQue = aMedias
    }

    if (fallo) {
      console.error('[HUBI] No se han podido rehacer los avisos del papel:', fallo)
      avisoDelAviso =
        'El papel se ha guardado, pero no se ha podido poner el aviso en el calendario. Vuelve a entrar aquí e inténtalo otra vez.'
      /* Y el motivo exacto, aparte. A Juan Miguel no le dice nada y por
         eso va en su propia línea y en pequeño; pero mientras esto se
         está montando, tener delante lo que contesta la base de datos
         ahorra una tarde de probar a ciegas. Ya nos ha pasado. */
      porQue = fallo
    }
  }

  return NextResponse.json({
    bien: true,
    movido: cambiaSitio,
    aviso: avisoDelAviso,
    detalle: porQue,
  })
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
    .eq('hogar_id', await elEspacioO(supabase))
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
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('documento_id', id)
    .maybeSingle()

  // ── Se intenta borrar la ficha ──
  // Con `.select()`: sin él, un borrado que la base de datos no permite
  // devuelve "todo bien" habiendo borrado cero filas.
  let { data: borradas, error } = await supabase
    .from('documentos')
    .delete()
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('id', id)
    .select('id')

  /*
    23503 es "hay otra fila apuntando a ésta".

    Solo ENTONCES se sueltan las amarras, y se vuelve a intentar. Así el
    orden es el correcto: primero se comprueba que el papel se va a ir,
    y después se toca lo que colgaba de él. Nunca al revés.
  */
  if (error?.code === '23503') {
    if (apunte) await supabase
      .from('movimientos')
      .delete()
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('id', apunte.id)

    /* Los avisos NO se borran: se quedan sin padre.

       Un aviso de "el seguro vence el 12 de noviembre" es algo que hay
       que hacer, y sigue habiendo que hacerlo aunque se borre la foto
       de la póliza. Borrarle a alguien un aviso del calendario sin
       decírselo es de las cosas que hacen perder la confianza en una
       aplicación para siempre. */
    await supabase
      .from('recordatorios')
      .update({ documento_origen_id: null })
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('documento_origen_id', id)

    ;({ data: borradas, error } = await supabase
      .from('documentos')
      .delete()
      .eq('hogar_id', await elEspacioO(supabase))
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
  if (apunte) await supabase
      .from('movimientos')
      .delete()
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('id', apunte.id)

  // Y el archivo, a la papelera de Drive.
  let enPapelera = false
  try {
    /* Si no se sabe de qué casa es, no se toca ningún Drive: la ficha
       ya está borrada de HUBI y dejar un archivo huérfano en Drive es
       infinitamente mejor que mandar a la papelera el de otra
       familia. */
    const casa = await elEspacio(supabase)
    if (!casa) throw new Error('SIN_CASA')

    const { acceso } = await accesoDrive(casa)
    enPapelera = await aLaPapelera(acceso, papel.drive_file_id)
  } catch (e) {
    console.error('[HUBI] No se ha podido enviar a la papelera de Drive:', e)
  }

  return NextResponse.json({ bien: true, enPapelera })
}
