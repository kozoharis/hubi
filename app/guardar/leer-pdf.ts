'use client'

/*
  Leer un PDF, también dentro del teléfono.

  Un PDF viene de dos formas, y hay que tratarlas distinto:

  EL DIGITAL — la factura que manda la compañía por correo. Lleva el
  texto DENTRO, escrito, no dibujado. Sacarlo es leerlo literalmente:
  ni reconocimiento, ni errores, ni esperas. Sale perfecto siempre.
  Es la mayoría de los PDF que van a llegar.

  EL ESCANEADO — alguien pasó un papel por un escáner y lo guardó como
  PDF. Por dentro no hay letras: hay una foto. Ahí no queda otra que
  dibujar la página y leerla como se lee una fotografía, con lo mismo
  que usa la cámara.

  Se prueba primero lo barato. Si sale texto de verdad, listo. Si sale
  vacío o cuatro caracteres sueltos, entonces se dibuja y se reconoce.

  Todo aquí, en el móvil. Un PDF de un informe médico no sale del
  teléfono ni para leerse — igual que una foto.
*/

import { leerImagen } from './leer-aqui'

/* Por debajo de esto, lo que ha salido no es el texto del documento:
   son restos. Una factura, por corta que sea, pasa de 120 caracteres
   entre el emisor, las fechas y los importes. */
const HAY_TEXTO = 120

/* Cinco páginas. Un papel doméstico no lleva el dato importante en la
   sexta, y dibujar y reconocer cada página cuesta segundos. */
const PAGINAS = 5

/*
  El ayudante del lector, por una dirección normal.

  Antes se pedía con `new URL('...', import.meta.url)`, que es la forma
  elegante de decirle al empaquetador "búscamelo tú". Funciona al
  desarrollar y NO en la compilación de producción: el archivo se queda
  sin resolver, el lector no arranca, y cualquier PDF falla con un
  error que no explica nada. Por eso "no podía leerlos" — no llegaba
  ni a abrirlos.

  Ahora vive en `public/` y se pide como se pide una imagen. Lo copia
  ahí `scripts/copiar-worker.mjs` después de cada `npm install`, para
  que la copia y la librería nunca queden en versiones distintas: si
  no coinciden, el lector se niega a arrancar.
*/
async function pdfjs() {
  const lib = await import('pdfjs-dist')
  lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  return lib
}

/*
  Devuelve además SI EL TEXTO VENÍA ESCRITO DENTRO.

  No es un detalle: de eso depende quién lee el papel. Un PDF digital
  ya está perfecto y no hay que enseñárselo a nadie más. Uno escaneado
  es una foto disfrazada de PDF, y esas van al modelo como cualquier
  otra foto.

  Antes se adivinaba por la longitud del texto —"si son más de 400
  caracteres, será digital"—, y un escaneado que se leyera bien pasaba
  por digital y se quedaba sin la segunda lectura.
*/
export async function leerPdf(
  archivo: File,
  alAvanzar: (parte: number) => void
): Promise<{ texto: string; digital: boolean }> {
  const lib = await pdfjs()
  const datos = new Uint8Array(await archivo.arrayBuffer())

  /* Si algo falla aquí, que se sepa QUÉ. Un "no se ha podido leer" a
     secas costó dos rondas de arreglar lo que no era. */
  let doc
  try {
    doc = await lib.getDocument({ data: datos }).promise
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e)
    throw new Error(`No se ha podido abrir el PDF · ${motivo.slice(0, 160)}`)
  }

  const cuantas = Math.min(doc.numPages, PAGINAS)

  // ── 1 · El texto que ya lleva dentro ──────────────────────
  let escrito = ''
  for (let n = 1; n <= cuantas; n++) {
    const pagina = await doc.getPage(n)
    const contenido = await pagina.getTextContent()
    escrito += enLineas(contenido.items) + '\n'
  }

  if (escrito.trim().length >= HAY_TEXTO) {
    alAvanzar(1)
    return { texto: escrito.trim(), digital: true }
  }

  // ── 2 · Estaba escaneado: hay que dibujarlo y leerlo ──────
  let reconocido = ''

  for (let n = 1; n <= cuantas; n++) {
    const pagina = await doc.getPage(n)

    /* Escala 2: el PDF trae la página en puntos de imprenta, que en
       píxeles se queda pequeño para leer letra de cuerpo 8. */
    const vista = pagina.getViewport({ scale: 2 })

    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(vista.width)
    lienzo.height = Math.round(vista.height)

    await pagina.render({
      canvas: lienzo,
      canvasContext: lienzo.getContext('2d')!,
      viewport: vista,
    }).promise

    const trozo = await new Promise<Blob>((listo) =>
      lienzo.toBlob((b) => listo(b!), 'image/png')
    )

    // El avance reparte el total entre las páginas que haya.
    reconocido +=
      (await leerImagen(trozo, (p) => alAvanzar((n - 1 + p) / cuantas))) + '\n'
  }

  return { texto: reconocido.trim(), digital: false }
}

/*
  Reconstruir las líneas de la página.

  AQUÍ ESTABA EL FALLO. Antes se juntaban todos los trozos con un
  espacio, y la página entera acababa en UN SOLO RENGLÓN:

    "PIENSOS AGUAMANSA, S.L. EL VELO, 78 38300 - LA OROTAVA CIF:
     B72792245 FECHA 4/08/26 FACTURA 10110653 JUAN MIGUEL..."

  Legible para una persona, inservible para `entender.ts`, que está
  hecho para texto con líneas de verdad:

  - Busca el proveedor en las PRIMERAS LÍNEAS, descartando las largas.
    Con una sola línea de mil caracteres, no encuentra ninguna.
  - Decide la fecha por lo que hay JUSTO DELANTE, en 46 caracteres.
    Todo pegado, la etiqueta de una columna se cuela en el dato de la
    de al lado — y la fecha del periodo de consumo gana a la de
    emisión. Exactamente el fallo que ya cazamos con las fotos.

  Un PDF no guarda líneas: guarda trozos de texto con su posición en
  la hoja. Así que se reconstruyen — se agrupan los que están a la
  misma altura y se ordenan de izquierda a derecha. Con eso el PDF
  vuelve a parecerse a lo que ve un ojo, que es lo que el lector
  espera.
*/
type Trozo = { str?: string; transform?: number[] }

function enLineas(items: unknown[]): string {
  const filas = new Map<number, { x: number; t: string }[]>()

  for (const bruto of items) {
    const i = bruto as Trozo
    if (!i?.str?.trim() || !i.transform) continue

    const y = Math.round(i.transform[5])
    const x = i.transform[4]

    /* Tres puntos de margen: dos textos de la misma línea rara vez
       comparten la línea base al milímetro, sobre todo si uno va en
       negrita y más grande. */
    let clave = [...filas.keys()].find((k) => Math.abs(k - y) <= 3)
    if (clave === undefined) {
      clave = y
      filas.set(clave, [])
    }
    filas.get(clave)!.push({ x, t: i.str })
  }

  return [...filas.entries()]
    // De arriba abajo: en un PDF el origen está en la esquina de
    // abajo, así que la Y más alta es la línea de más arriba.
    .sort((a, b) => b[0] - a[0])
    .map(([, trozos]) =>
      trozos
        .sort((a, b) => a.x - b.x)
        .map((t) => t.t)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('\n')
}
