import crypto from 'crypto'

/**
 * Cifrado del permiso de Google Drive antes de guardarlo.
 *
 * Aunque alguien consiguiera leer la base de datos, sin la clave
 * ENCRYPTION_KEY —que vive solo en las variables de entorno— el
 * permiso de Drive es un montón de letras sin valor.
 *
 * AES-256-GCM: además de cifrar, detecta si alguien ha manipulado
 * el contenido.
 */

function clave(): Buffer {
  const bruta = process.env.ENCRYPTION_KEY
  if (!bruta) {
    throw new Error('Falta ENCRYPTION_KEY en las variables de entorno')
  }
  const buf = Buffer.from(bruta, 'base64')
  if (buf.length !== 32) {
    throw new Error(
      'ENCRYPTION_KEY debe ser de 32 bytes en base64. Genérala con: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    )
  }
  return buf
}

export function cifrar(texto: string): string {
  const iv = crypto.randomBytes(12)
  const cifrador = crypto.createCipheriv('aes-256-gcm', clave(), iv)
  const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()])
  const etiqueta = cifrador.getAuthTag()

  return [
    iv.toString('base64'),
    etiqueta.toString('base64'),
    datos.toString('base64'),
  ].join('.')
}

export function descifrar(paquete: string): string {
  const partes = paquete.split('.')
  if (partes.length !== 3) {
    throw new Error('El permiso guardado tiene un formato que no reconozco')
  }
  const [iv, etiqueta, datos] = partes

  const descifrador = crypto.createDecipheriv(
    'aes-256-gcm',
    clave(),
    Buffer.from(iv, 'base64')
  )
  descifrador.setAuthTag(Buffer.from(etiqueta, 'base64'))

  return Buffer.concat([
    descifrador.update(Buffer.from(datos, 'base64')),
    descifrador.final(),
  ]).toString('utf8')
}
