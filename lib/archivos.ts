/*
  ═══════════════════════════════════════════════════════════════
  QUÉ CLASE DE ARCHIVO ES ESTO
  ═══════════════════════════════════════════════════════════════

  Parece una tontería y era el fallo: **un PDF no siempre llega
  diciendo que es un PDF.**

  Todo HUBI preguntaba `archivo.type === 'application/pdf'`. Ese dato
  no lo pone el archivo: lo pone el navegador al elegirlo, deduciéndolo
  del sistema. Y hay unos cuantos sitios donde llega vacío o mal:

  · El selector de archivos de Android, sobre todo desde Google Drive
    o Descargas — que es JUSTO por donde llega una factura que te han
    mandado por correo.
  · Windows cuando la extensión no está registrada.
  · Compartir desde otra aplicación.
  · Archivos venidos de un ZIP o de una nube.

  Cuando eso pasaba, HUBI no decía «esto no lo entiendo». Hacía algo
  peor: trataba el PDF como si fuera una FOTO. Lo metía en la lista de
  páginas, intentaba encogerlo en un lienzo —donde no cabe— y al
  cerrar el documento lo pegaba dentro de otro PDF con jsPDF. El
  resultado era un papel ilegible o un error sin explicación.

  Con una foto no pasaba nunca, porque `image/jpeg` sí lo pone
  cualquiera. De ahí que «con foto vaya de lujo y con PDF no».

  ─────────────────────────────────────────────────────────────
  LA REGLA

  El tipo que dice el navegador es una PISTA, no la verdad. Cuando no
  la hay o no cuadra, se mira el nombre — que sí lo escribió quien creó
  el archivo.
*/

export const TIPOS_BUENOS = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']

/** ¿Es un PDF? Por lo que dice, o por cómo se llama. */
export function esPdf(archivo: { type?: string; name?: string }): boolean {
  if ((archivo.type ?? '').toLowerCase() === 'application/pdf') return true
  return /\.pdf$/i.test(archivo.name ?? '')
}

/**
 * El tipo de verdad de un archivo.
 *
 * Devuelve null cuando no es nada que HUBI sepa guardar. No adivina
 * más de la cuenta: solo rescata los casos en que el navegador se ha
 * callado o se ha equivocado, y la extensión lo dice claro.
 */
export function tipoDe(archivo: { type?: string; name?: string }): string | null {
  const dicho = (archivo.type ?? '').toLowerCase()
  if (TIPOS_BUENOS.includes(dicho)) return dicho === 'image/jpg' ? 'image/jpeg' : dicho

  const nombre = (archivo.name ?? '').toLowerCase()
  if (/\.pdf$/.test(nombre)) return 'application/pdf'
  if (/\.(jpe?g)$/.test(nombre)) return 'image/jpeg'
  if (/\.png$/.test(nombre)) return 'image/png'

  /*
    Y una red más: un tipo de imagen que no está en la lista —HEIC del
    iPhone, WEBP, AVIF— es válido en el navegador, porque antes de
    subirse pasa por `comprimir()`, que lo redibuja y lo devuelve
    convertido en JPEG. Se deja pasar aquí y se convierte allí.
  */
  if (dicho.startsWith('image/')) return dicho

  return null
}

/**
 * El mismo archivo, pero diciendo lo que es.
 *
 * `File` no deja cambiarle el tipo, así que se envuelve en uno nuevo
 * con el mismo contenido. Es barato —no copia los bytes, los
 * referencia— y a partir de ahí todo lo demás funciona sin enterarse
 * de que hubo un problema.
 */
export function conSuTipo(archivo: File): File {
  const bueno = tipoDe(archivo)
  if (!bueno || archivo.type === bueno) return archivo

  return new File([archivo], archivo.name || 'documento', {
    type: bueno,
    lastModified: archivo.lastModified,
  })
}
