import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/*
  Copia el ayudante del lector de PDF a `public/`.

  Por qué no se carga directamente desde la librería:

  El lector de PDF necesita un segundo archivo —un "worker"— que hace
  el trabajo pesado en paralelo para no congelar la pantalla. Se le
  tiene que decir DÓNDE está.

  La forma elegante es pedírselo al empaquetador con
  `new URL('...', import.meta.url)`. Funciona al desarrollar y en la
  compilación de producción se queda sin resolver: el archivo no
  aparece por ningún lado, el lector no arranca y CUALQUIER PDF falla
  con un error que no dice nada. Es exactamente lo que estaba pasando.

  Así que se copia a `public/` y se pide por una dirección normal:
  `/pdf.worker.min.mjs`. Sin magia de empaquetador, sin nada que
  resolver — el archivo está ahí y se descarga como una imagen.

  Se ejecuta solo después de cada `npm install`, así que la copia
  nunca se queda en una versión distinta de la librería. Un desajuste
  entre las dos hace que el lector se niegue a arrancar.
*/

const origen = 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'
const destino = 'public/pdf.worker.min.mjs'

if (!existsSync(origen)) {
  console.warn('[HUBI] No se encuentra el ayudante del lector de PDF. ¿Falta npm install?')
  process.exit(0)
}

mkdirSync(dirname(destino), { recursive: true })
copyFileSync(origen, destino)
console.log('[HUBI] Ayudante del lector de PDF copiado a public/')
