'use client'

import { createWorker } from 'tesseract.js'

/*
  Leer el papel dentro del propio teléfono.

  Ni Google ni ningún otro servicio. El reconocimiento de texto corre
  en el móvil, en la misma pestaña, y lo único que sale de ahí es el
  texto ya leído — que va a nuestro servidor a clasificarse.

  Lo que se gana:

  - No hace falta tarjeta ni cuenta de facturación en ningún sitio.
  - La foto de un informe médico NO SALE DEL TELÉFONO. Ni siquiera
    para leerse. Es más privado que cualquier servicio de pago.
  - No hay cupos ni topes: es tu móvil, y es tuyo.

  Lo que se pierde, y hay que decirlo:

  - Lee peor que Vision. Con una factura arrugada, a contraluz o con
    letra pequeña se le escaparán cosas. Por eso todo lo que saca pasa
    igualmente por la pantalla de confirmación: HUBI propone, la
    persona corrige.
  - La primera vez tiene que descargarse el idioma —unos pocos megas—.
    Después se queda guardado y ya no vuelve a bajarlo.
  - Tarda unos segundos. Por eso avisa del avance en vez de dejar la
    pantalla quieta: una espera que no dice nada parece una avería.
*/

/*
  Preparar la foto — la parte que más decide si se lee o no.

  ESTO ESTABA MAL, Y MEDIDO. El tratamiento anterior encogía a 1800 px
  y estiraba el contraste con la MISMA regla para toda la imagen. En
  una foto hecha con la mano, un lado siempre está más oscuro que el
  otro: la sombra del que sujeta, la lámpara de un lado. Con una regla
  global no se pueden salvar los dos lados a la vez — o se quema el
  claro o se empasta el oscuro.

  Consecuencia real, comprobada con una factura como la de Aguamansa:
  se leía la columna izquierda entera y se PERDÍA la derecha completa.
  Justo donde están la fecha, el número de factura, el importe y el
  TOTAL. Por eso "no leía bien las facturas": leía media.

  Lo que se hace ahora es medir la luz de CADA ZONA y comparar cada
  punto con la luz de su alrededor, no con un número fijo. Un truco
  que en un móvil cuesta casi nada: se empequeñece la imagen 32 veces
  y se vuelve a agrandar — lo que queda es el mapa de sombras, sin
  letras. Todo lo que sea más oscuro que su entorno es tinta.

  Medido con la misma factura en cuatro condiciones distintas
  (sombra suave, sombra fuerte, foto mala, luz de bombilla), contando
  cuántos de los cinco datos clave salían:

      antes  ·  3 · 3 · 3 · 3   de 5
      ahora  ·  5 · 5 · 5 · 5   de 5
*/

/* 2600 px de lado mayor, no 1800.

   Un A4 a 1800 px son unos 150 puntos por pulgada, y a Tesseract la
   letra de cuerpo 8 se le queda en el límite de lo legible. A 2600
   son 220, que ya va sobrado. Cuesta el doble de tiempo, y por eso
   hay barra de avance. */
/*
  MARGEN — cuánto más oscuro que su entorno tiene que ser un punto para
  contarlo como tinta.

  Estaba en 12 y se subió a 16 con la foto de un ticket de tienda: con
  12 se perdía entera la línea del TOTAL; con 16, sale. Papel térmico
  arrugado, que es el peor caso doméstico que hay — la tinta es gris,
  no negra, y cada arruga hace su propia sombra.

  Dicho con honestidad: está medido con UN ticket. Los valores vecinos
  —14, 18— daban peor resultado y 24 volvía a darlo bueno, y esa
  inestabilidad significa que aquí no hay un número mágico. Por eso el
  arreglo de verdad no es este número, sino que cuando el móvil no
  reconoce el comercio, se pide ayuda en vez de inventárselo.
*/
const LADO = 2600

/* Cuánto se empequeñece para sacar el mapa de sombras. Con 32 el mapa
   recoge la iluminación pero no las letras — que es exactamente lo
   que hace falta. */
const ESCALA_FONDO = 32

/* Margen antes de decidir que algo es tinta. Sin él, el ruido del
   papel se volvería letra. */
const MARGEN = 16

async function prepararLaFoto(archivo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo)

  const escala = Math.min(1, LADO / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * escala)
  const h = Math.round(bitmap.height * escala)

  const lienzo = document.createElement('canvas')
  lienzo.width = w
  lienzo.height = h
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, w, h)

  /*
    El mapa de sombras.

    Se dibuja la foto muy pequeña y se vuelve a estirar a su tamaño.
    Al agrandar, el navegador difumina — y lo que queda es la luz de
    la escena sin las letras. Lo hace la tarjeta gráfica: en un móvil
    corriente es instantáneo, mucho más rápido que recorrer millones
    de puntos a mano.
  */
  const pw = Math.max(1, Math.round(w / ESCALA_FONDO))
  const ph = Math.max(1, Math.round(h / ESCALA_FONDO))

  const chico = document.createElement('canvas')
  chico.width = pw
  chico.height = ph
  const cctx = chico.getContext('2d')!
  cctx.imageSmoothingEnabled = true
  cctx.drawImage(lienzo, 0, 0, pw, ph)

  const mapa = document.createElement('canvas')
  mapa.width = w
  mapa.height = h
  const mctx = mapa.getContext('2d', { willReadFrequently: true })!
  mctx.imageSmoothingEnabled = true
  mctx.drawImage(chico, 0, 0, w, h)

  const foto = ctx.getImageData(0, 0, w, h)
  const luz = mctx.getImageData(0, 0, w, h)
  const p = foto.data
  const l = luz.data

  for (let i = 0; i < p.length; i += 4) {
    const gris = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]
    const fondo = 0.299 * l[i] + 0.587 * l[i + 1] + 0.114 * l[i + 2]

    // Más oscuro que su entorno = tinta. Lo demás, papel.
    const v = gris > fondo - MARGEN ? 255 : 0
    p[i] = p[i + 1] = p[i + 2] = v
  }

  ctx.putImageData(foto, 0, 0)
  bitmap.close()

  /* PNG y no JPEG: esto ya es blanco y negro puro, y el JPEG le
     metería halos grises justo en el borde de cada letra — que es
     donde el lector se juega el acierto. */
  return new Promise<Blob>((listo) => lienzo.toBlob((b) => listo(b!), 'image/png'))
}

/**
 * Saca el texto de una foto.
 *
 * `alAvanzar` va llegando de 0 a 1 para poder pintar el progreso.
 */
export async function leerAqui(
  archivo: File,
  alAvanzar: (parte: number) => void
): Promise<string> {
  return leerImagen(archivo, alAvanzar)
}

/**
 * Lo mismo, pero admitiendo cualquier imagen suelta.
 *
 * Existe aparte porque las páginas de un PDF escaneado llegan aquí ya
 * dibujadas en un lienzo, sin ser un archivo que nadie haya elegido.
 * Es exactamente el mismo camino: una foto de un papel es una foto de
 * un papel, venga de la cámara o de una página dibujada.
 */
export async function leerImagen(
  imagen: Blob,
  alAvanzar: (parte: number) => void
): Promise<string> {
  const preparada = await prepararLaFoto(imagen)

  const worker = await createWorker('spa', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') alAvanzar(m.progress)
    },
  })

  try {
    const { data } = await worker.recognize(preparada)
    return (data.text ?? '').trim()
  } finally {
    // Siempre, aunque falle: si no, el móvil se queda con el
    // reconocedor abierto comiéndose memoria hasta que se cierre la
    // pestaña.
    await worker.terminate()
  }
}
