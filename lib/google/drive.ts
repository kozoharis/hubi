import { clienteServidor } from '@/lib/supabase/servidor'
import { descifrar } from '@/lib/cifrado'
import { accesoDesdePermiso } from '@/lib/google/oauth'

const API = 'https://www.googleapis.com/drive/v3'
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3'
const CARPETA = 'application/vnd.google-apps.folder'

export const NOMBRE_RAIZ = 'J+C · FAMILY HUB'

/**
 * Devuelve un acceso temporal a Drive usando el permiso de Juan Miguel.
 * Este permiso lo usan LOS DOS usuarios: Conchita sube documentos a
 * través de él sin tener que conectar nada.
 */
export async function accesoDrive(): Promise<{
  acceso: string
  raiz: string
}> {
  const supa = clienteServidor()

  const { data: conexion, error } = await supa
    .from('conexion_drive')
    .select('refresh_token_cifrado, carpeta_raiz_id, estado')
    .eq('id', 1)
    .single()

  if (error) throw new Error('No se ha podido leer la conexión con Drive')
  if (!conexion?.refresh_token_cifrado || conexion.estado !== 'activa') {
    throw new Error('DRIVE_SIN_CONECTAR')
  }

  try {
    const acceso = await accesoDesdePermiso(descifrar(conexion.refresh_token_cifrado))
    return { acceso, raiz: conexion.carpeta_raiz_id as string }
  } catch (e) {
    if (e instanceof Error && e.message === 'PERMISO_CADUCADO') {
      await supa.from('conexion_drive').update({ estado: 'caducada' }).eq('id', 1)
      throw new Error('DRIVE_CADUCADO')
    }
    throw e
  }
}

/** Escapa comillas para las consultas de Drive. */
function seguro(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function buscarCarpeta(
  acceso: string,
  nombre: string,
  padre: string
): Promise<string | null> {
  const q = [
    `name = '${seguro(nombre)}'`,
    `'${padre}' in parents`,
    `mimeType = '${CARPETA}'`,
    'trashed = false',
  ].join(' and ')

  const r = await fetch(
    `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`,
    { headers: { Authorization: `Bearer ${acceso}` } }
  )
  if (!r.ok) throw new Error(`Drive no responde a la búsqueda: ${await r.text()}`)

  const datos = (await r.json()) as { files?: { id: string }[] }
  return datos.files?.[0]?.id ?? null
}

async function crearCarpeta(
  acceso: string,
  nombre: string,
  padre: string | null
): Promise<string> {
  const cuerpo: Record<string, unknown> = { name: nombre, mimeType: CARPETA }
  if (padre) cuerpo.parents = [padre]

  const r = await fetch(`${API}/files?fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${acceso}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cuerpo),
  })
  if (!r.ok) throw new Error(`Drive no ha creado la carpeta: ${await r.text()}`)

  const datos = (await r.json()) as { id: string }
  return datos.id
}

/** Crea la carpeta raíz de Family Hub, o encuentra la que ya existe. */
export async function asegurarRaiz(acceso: string): Promise<string> {
  const q = [
    `name = '${seguro(NOMBRE_RAIZ)}'`,
    `mimeType = '${CARPETA}'`,
    'trashed = false',
  ].join(' and ')

  const r = await fetch(
    `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`,
    { headers: { Authorization: `Bearer ${acceso}` } }
  )
  if (r.ok) {
    const datos = (await r.json()) as { files?: { id: string }[] }
    if (datos.files?.[0]) return datos.files[0].id
  }

  return crearCarpeta(acceso, NOMBRE_RAIZ, null)
}

/**
 * Resuelve una ruta como FINCA/GASTOS/2026/T3/LUZ y devuelve el ID de la
 * última carpeta, creando por el camino las que falten.
 *
 * La tabla carpetas_drive hace de memoria: si la ruta ya se resolvió antes,
 * no se vuelve a preguntar a Google. Y como esa tabla tiene la ruta como
 * clave única, nunca acaban existiendo dos carpetas "LUZ" hermanas.
 */
export async function idDeCarpeta(
  acceso: string,
  raiz: string,
  segmentos: string[],
  /*
    DE QUÉ HOGAR ES ESTA CARPETA.

    Sin esto, la memoria de carpetas se escribía con la clave de
    servidor —que no tiene sesión— y la fila nacía SIN HOGAR: invisible
    para todos, y además dejando en rojo para siempre la pantalla de
    comprobación en cuanto se guardara el primer documento.

    Y hay algo peor detrás, que es la bomba nº 1 del plan: la clave de
    esta tabla es la RUTA a secas, así que "FINCA/GASTOS/2026/T3/LUZ"
    es UNA fila para todo el mundo. Buscando por (hogar, ruta) —aunque
    la clave siga siendo solo la ruta hasta la fase 2— dos familias
    dejan de leerse la carpeta la una a la otra.
  */
  hogarId: string | null
): Promise<string> {
  const supa = clienteServidor()

  let padre = raiz
  let ruta = ''

  for (const segmento of segmentos) {
    ruta = ruta ? `${ruta}/${segmento}` : segmento

    const { data: memoria } = await supa
      .from('carpetas_drive')
      .select('drive_folder_id')
      .eq('ruta', ruta)
      .eq('hogar_id', hogarId ?? '')
      .maybeSingle()

    if (memoria?.drive_folder_id) {
      padre = memoria.drive_folder_id
      continue
    }

    const existente = await buscarCarpeta(acceso, segmento, padre)
    const id = existente ?? (await crearCarpeta(acceso, segmento, padre))

    const { error: fallo } = await supa
      .from('carpetas_drive')
      .upsert({ ruta, drive_folder_id: id, hogar_id: hogarId }, { onConflict: 'ruta' })

    /* Si la memoria no se guarda, el documento se sube igual: lo único
       que pasa es que la próxima vez habrá que volver a buscar la
       carpeta en Drive. Pero que quede dicho en el registro, porque
       una memoria que nunca guarda nada se nota solo en la lentitud. */
    if (fallo) console.error('[HUBI] Carpeta creada pero no recordada:', fallo)

    padre = id
  }

  return padre
}

/** Sube un archivo y devuelve su identificador en Drive. */
export async function subirArchivo(
  acceso: string,
  carpeta: string,
  nombre: string,
  tipo: string,
  contenido: ArrayBuffer
): Promise<string> {
  const limite = 'familyhub' + Math.random().toString(36).slice(2)

  const cabecera =
    `--${limite}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify({ name: nombre, parents: [carpeta] }) +
    `\r\n--${limite}\r\n` +
    `Content-Type: ${tipo}\r\n\r\n`

  const cuerpo = Buffer.concat([
    Buffer.from(cabecera, 'utf8'),
    Buffer.from(contenido),
    Buffer.from(`\r\n--${limite}--\r\n`, 'utf8'),
  ])

  const r = await fetch(`${SUBIDA}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${acceso}`,
      'Content-Type': `multipart/related; boundary=${limite}`,
    },
    body: new Uint8Array(cuerpo),
  })

  if (!r.ok) throw new Error(`Drive no ha aceptado el archivo: ${await r.text()}`)

  const datos = (await r.json()) as { id: string }
  return datos.id
}

/** Descarga un archivo para servirlo desde nuestro servidor, sin URLs públicas. */
export async function descargarArchivo(
  acceso: string,
  fileId: string
): Promise<Response> {
  return fetch(`${API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${acceso}` },
  })
}

/*
  Mover un archivo de carpeta y ponerle otro nombre.

  Hace falta para corregir un documento mal archivado. Y es la parte
  que de verdad importa: si solo se cambiara la carpeta en NUESTRA base
  de datos, HUBI diría una cosa y el Drive de la familia tendría otra.
  A los dos días nadie sabría cuál de los dos tiene razón.

  Google lo hace en una sola llamada: `addParents` mete el archivo en
  la carpeta nueva y `removeParents` lo saca de la vieja. No se copia
  nada — es el MISMO archivo, así que conserva su identificador y todo
  lo que apunte a él sigue funcionando.

  El nombre se recalcula porque lleva dentro la fecha, el proveedor y
  el importe: si se corrige el importe, el archivo tiene que dejar de
  llamarse como el importe equivocado.
*/
export async function moverYRenombrar(
  acceso: string,
  fileId: string,
  nombre: string,
  carpetaNueva: string,
  carpetaVieja: string
): Promise<void> {
  const parametros = new URLSearchParams({ fields: 'id, name, parents' })

  /* Solo se tocan los padres si de verdad cambia la carpeta. Mandar
     `removeParents` con la misma carpeta que se añade deja el archivo
     sin ningún padre —o sea, perdido en Drive. */
  if (carpetaNueva !== carpetaVieja) {
    parametros.set('addParents', carpetaNueva)
    parametros.set('removeParents', carpetaVieja)
  }

  const respuesta = await fetch(`${API}/files/${fileId}?${parametros}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${acceso}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: nombre }),
  })

  if (!respuesta.ok) {
    throw new Error(`DRIVE_MOVER_${respuesta.status}`)
  }
}

/*
  A la papelera de Google Drive. NO se borra de verdad.

  Es deliberado, y es lo que el punto 5 del planteamiento pide: "las
  acciones importantes deben ser fácilmente reversibles". Un documento
  borrado por error desde el móvil, con el dedo gordo, se recupera
  entrando en la papelera del Drive. Google la guarda 30 días.

  Devuelve si Google ha colaborado. Quien llama decide qué contar: lo
  que NO puede pasar nunca es dar por borrado un archivo que sigue ahí,
  ni al revés.
*/
export async function aLaPapelera(acceso: string, fileId: string): Promise<boolean> {
  const respuesta = await fetch(`${API}/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${acceso}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: true }),
  })
  return respuesta.ok
}
