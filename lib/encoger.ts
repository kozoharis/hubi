/*
  ═══════════════════════════════════════════════════════════════
  ENCOGER UNA FOTO ANTES DE MANDARLA
  ═══════════════════════════════════════════════════════════════

  Una foto de móvil de hoy son entre 3 y 8 MB. En una pared no se
  distingue de una de 300 KB, y sin embargo:

    · tarda diez veces más en subir, muchas veces desde el 4G de un
      móvil que está en la calle;
    · y llena el hueco de Supabase veinte veces más rápido.

  Así que se encoge **en el navegador**, antes de salir. En el
  servidor haría falta una librería de imagen, y este proyecto tiene una
  regla: no añadir tecnología por añadir tecnología.

  ─────────────────────────────────────────────────────────────
  1600 PX Y CALIDAD 0,82

  1600 es más de lo que necesita un monitor de 27 pulgadas para una foto
  que ocupa un tercio de la pantalla, y deja margen para el día que se
  cuelgue algo más grande. Por debajo de 0,8 el JPEG empieza a hacer
  cuadros en las caras, que es justo lo que se va a mirar.

  ─────────────────────────────────────────────────────────────
  Y SI ALGO FALLA, SE MANDA LA ORIGINAL

  Un navegador viejo, una imagen que el `canvas` no sabe leer, un HEIC
  raro de iPhone. En todos esos casos se devuelve el fichero tal cual:
  el servidor la aceptará igual si pesa menos de 8 MB, y si no, lo dirá
  con palabras. Fallar hacia «funciona más lento» y nunca hacia «no
  funciona».
*/

const LADO = 1600
const CALIDAD = 0.82

export async function encoger(original: File): Promise<File> {
  try {
    if (typeof document === 'undefined') return original

    const imagen = await leer(original)

    const escala = Math.min(1, LADO / Math.max(imagen.width, imagen.height))

    /* Ya es pequeña: no se toca. Volver a comprimir una foto que ya
       estaba comprimida solo le quita calidad. */
    if (escala === 1 && original.size <= 1_200_000) return original

    const ancho = Math.round(imagen.width * escala)
    const alto = Math.round(imagen.height * escala)

    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto

    const pincel = lienzo.getContext('2d')
    if (!pincel) return original

    pincel.drawImage(imagen, 0, 0, ancho, alto)

    const trozo = await new Promise<Blob | null>((listo) =>
      lienzo.toBlob(listo, 'image/jpeg', CALIDAD)
    )
    if (!trozo) return original

    /* Y si encoger la ha dejado MÁS grande —pasa con imágenes muy
       planas ya en PNG—, se manda la original. */
    if (trozo.size >= original.size) return original

    return new File([trozo], nombreJpg(original.name), { type: 'image/jpeg' })
  } catch {
    return original
  }
}

function leer(fichero: File): Promise<HTMLImageElement> {
  return new Promise((listo, fallo) => {
    const direccion = URL.createObjectURL(fichero)
    const imagen = new Image()
    imagen.onload = () => {
      URL.revokeObjectURL(direccion)
      listo(imagen)
    }
    imagen.onerror = () => {
      URL.revokeObjectURL(direccion)
      fallo(new Error('no se puede leer'))
    }
    imagen.src = direccion
  })
}

function nombreJpg(nombre: string): string {
  return nombre.replace(/\.[^.]+$/, '') + '.jpg'
}
