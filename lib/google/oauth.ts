/**
 * Conexión con Google — solo el permiso imprescindible.
 *
 * drive.file  →  HUBI únicamente puede ver y modificar los archivos
 *                que ella misma ha creado. No tiene acceso al resto del
 *                Drive de Juan Miguel: ni sus fotos, ni sus documentos
 *                anteriores, ni nada.
 *
 * userinfo.email → solo para poder mostrar "Conectado como…".
 */

const AUTORIZAR = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'

export const CALENDARIO = 'https://www.googleapis.com/auth/calendar.app.created'

export const ALCANCES = [
  'https://www.googleapis.com/auth/drive.file',
  CALENDARIO,
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

/** ¿El permiso guardado incluye ya el del calendario? */
export function tieneCalendario(alcances: string | null | undefined): boolean {
  return (alcances ?? '').includes(CALENDARIO)
}

function configuracion() {
  const id = process.env.GOOGLE_CLIENT_ID
  const secreto = process.env.GOOGLE_CLIENT_SECRET
  const retorno = process.env.GOOGLE_REDIRECT_URI

  if (!id || !secreto || !retorno) {
    throw new Error(
      'Faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REDIRECT_URI'
    )
  }
  return { id, secreto, retorno }
}

/** A dónde mandamos a Juan Miguel para que dé permiso. */
export function urlDeConsentimiento(estado: string): string {
  const { id, retorno } = configuracion()

  const parametros = new URLSearchParams({
    client_id: id,
    redirect_uri: retorno,
    response_type: 'code',
    scope: ALCANCES,
    access_type: 'offline', // para recibir un permiso de larga duración
    prompt: 'consent', // fuerza a que Google nos devuelva el refresh_token
    state: estado,
  })

  return `${AUTORIZAR}?${parametros.toString()}`
}

type RespuestaToken = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
}

/** Canjea el código de un solo uso por el permiso de larga duración. */
export async function canjearCodigo(codigo: string): Promise<RespuestaToken> {
  const { id, secreto, retorno } = configuracion()

  const respuesta = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: codigo,
      client_id: id,
      client_secret: secreto,
      redirect_uri: retorno,
      grant_type: 'authorization_code',
    }),
  })

  if (!respuesta.ok) {
    throw new Error(`Google rechazó el código: ${await respuesta.text()}`)
  }
  return respuesta.json()
}

/** Convierte el permiso de larga duración en un acceso temporal (1 hora). */
export async function accesoDesdePermiso(permiso: string): Promise<string> {
  const { id, secreto } = configuracion()

  const respuesta = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: permiso,
      client_id: id,
      client_secret: secreto,
      grant_type: 'refresh_token',
    }),
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text()
    if (detalle.includes('invalid_grant')) {
      throw new Error('PERMISO_CADUCADO')
    }
    throw new Error(`Google no ha devuelto acceso: ${detalle}`)
  }

  const datos = (await respuesta.json()) as RespuestaToken
  return datos.access_token
}

/** Qué cuenta de Google ha dado el permiso. */
export async function correoDeLaCuenta(acceso: string): Promise<string | null> {
  const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${acceso}` },
  })
  if (!r.ok) return null
  const datos = (await r.json()) as { email?: string }
  return datos.email ?? null
}
