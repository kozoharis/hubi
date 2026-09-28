import { readdirSync, readFileSync } from 'node:fs'
import { esPdf, tipoDe, TIPOS_BUENOS } from '../lib/archivos'

/*
  ═══════════════════════════════════════════════════════════════
  QUIÉN LEE CADA PAPEL
  ═══════════════════════════════════════════════════════════════

      npx tsx pruebas/papeles.ts <carpeta con los papeles de prueba>

  No comprueba si el modelo acierta —eso depende de Gemini y de una
  clave que no está aquí—. Comprueba lo de antes, que es lo que se
  rompe: **por qué camino sale cada papel**.

  Son tres caminos y sólo dos de ellos terminan en el modelo:

      PDF con texto dentro  →  se saca el texto en el móvil
                               →  /api/analizar (JSON)  →  MODELO
      PDF escaneado         →  el PDF entero
                               →  /api/analizar (archivo) →  MODELO
      Foto                  →  la foto
                               →  /api/analizar (archivo) →  MODELO

  Si un papel se saliera de ahí, se leería con las reglas escritas a
  mano — que es exactamente el fallo de «a veces lee de miedo y otras
  veces no».

  ─────────────────────────────────────────────────────────────
  Y EL CASO DE ANDROID

  El selector de archivos de Android entrega muchas veces el PDF SIN
  etiqueta de tipo —sobre todo desde Drive o desde Descargas, que es
  justo por donde llega una factura del correo—. Se prueba también ese
  caso: el mismo archivo con `type` vacío tiene que salir por el mismo
  camino.
*/

const HAY_TEXTO = 120 // el mismo umbral que app/guardar/leer-pdf.ts
const PAGINAS = 5
const MAXIMO = 4 * 1024 * 1024

type Papel = { nombre: string; tipo: string; bytes: Buffer }

/** El texto que un PDF lleva escrito dentro, con el pdfjs de verdad. */
async function textoDeDentro(bytes: Buffer): Promise<string> {
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await lib.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  }).promise

  let escrito = ''
  for (let n = 1; n <= Math.min(doc.numPages, PAGINAS); n++) {
    const pagina = await doc.getPage(n)
    const contenido = await pagina.getTextContent()
    escrito +=
      contenido.items
        .map((i) => ('str' in i ? (i as { str: string }).str : ''))
        .join(' ') + '\n'
  }
  return escrito.trim()
}

/** El mismo reparto que hace `analizar()` en la pantalla de guardar. */
async function porDondeSale(p: Papel) {
  const archivo = { type: p.tipo, name: p.nombre }
  const reconocido = tipoDe(archivo)

  if (!reconocido || !TIPOS_BUENOS.includes(reconocido)) {
    return { camino: 'RECHAZADO', lee: 'nadie', nota: 'formato no admitido' }
  }
  if (p.bytes.length > MAXIMO) {
    return { camino: 'RECHAZADO', lee: 'nadie', nota: 'pesa más de 4 MB' }
  }

  if (esPdf(archivo)) {
    const dentro = await textoDeDentro(p.bytes)
    if (dentro.length >= HAY_TEXTO) {
      return {
        camino: 'texto → /api/analizar (JSON)',
        lee: 'MODELO',
        nota: `${dentro.length} letras sacadas en el móvil`,
      }
    }
    return {
      camino: 'PDF entero → /api/analizar (archivo)',
      lee: 'MODELO',
      nota: `escaneado · sólo ${dentro.length} letras dentro`,
    }
  }

  return {
    camino: 'foto → /api/analizar (archivo)',
    lee: 'MODELO',
    nota: `mime: ${reconocido}`,
  }
}

const carpeta = process.argv[2]
if (!carpeta) {
  console.error('Falta la carpeta con los papeles de prueba.')
  process.exit(1)
}

/*
  Cada papel de la carpeta se prueba DOS VECES: una con su etiqueta
  normal y otra sin ninguna, que es como llegan desde el selector de
  archivos de Android. Los dos tienen que salir por el mismo sitio.
*/
const MIMES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

const papeles: Papel[] = readdirSync(carpeta)
  .filter((n) => Object.keys(MIMES).some((e) => n.toLowerCase().endsWith(e)))
  .sort()
  .flatMap((nombre) => {
    const bytes = readFileSync(`${carpeta}/${nombre}`)
    const suyo = MIMES[nombre.slice(nombre.lastIndexOf('.')).toLowerCase()]
    return [
      { nombre, tipo: suyo, bytes },
      { nombre, tipo: '', bytes },
    ]
  })

if (papeles.length === 0) {
  console.error(`No hay ningun PDF, PNG ni JPG en ${carpeta}.`)
  process.exit(1)
}

async function main() {
  console.log('')
  console.log('═══ POR DÓNDE SALE CADA PAPEL ═══')
  console.log('')

  let mal = 0
  for (const p of papeles) {
    const r = await porDondeSale(p)
    const etiqueta = p.tipo || '(vacío · Android)'
    const bien = r.lee === 'MODELO'
    if (!bien) mal++
    console.log(`  ${bien ? 'OK ' : 'MAL'} ${p.nombre.padEnd(15)} ${etiqueta.padEnd(20)}`)
    console.log(`      ${r.camino}`)
    console.log(`      lo lee: ${r.lee} · ${r.nota}`)
    console.log('')
  }

  console.log(mal === 0 ? '  Todos acaban en el modelo.' : `  ${mal} papel(es) no llegan al modelo.`)
  console.log('')
  process.exit(mal === 0 ? 0 : 1)
}

main()
