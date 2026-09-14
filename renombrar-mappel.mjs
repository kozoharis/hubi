/*
  ═══════════════════════════════════════════════════════════════
  HUBI  →  MAPPEL
  ═══════════════════════════════════════════════════════════════

  Se ejecuta UNA vez, desde C:\Users\kozoh\family-hub:

      node renombrar-mappel.mjs

  Y después se comprueba con `git diff --stat` y `git status`.

  ─────────────────────────────────────────────────────────────
  POR QUÉ VA UN GUION Y NO 242 ARCHIVOS

  El cambio toca 242 archivos. Mandarlos uno a uno tiene un riesgo
  concreto: mi copia del repositorio y la de Haris no van al mismo
  paso, y pisar 242 archivos con los míos podría deshacer algo suyo
  sin que se note.

  Un guion no tiene ese problema: transforma SU árbol, que es el
  bueno. Lo que él tiene sigue siendo lo que él tiene, solo que con
  otro nombre.

  ─────────────────────────────────────────────────────────────
  LA TRAMPA QUE HAY QUE SORTEAR

  `hubi` es también el principio del verbo haber en castellano:
  «hubiera», «hubiese». Hay 33 en los comentarios del proyecto.

  Un reemplazo ciego los convertiría en «mappelera» y «mappelese».
  De ahí los `(?!e)` de las tres reglas de abajo.
*/

import { promises as fs } from 'node:fs'
import path from 'node:path'

const RAIZ = process.cwd()

const SALTAR = new Set(['node_modules', '.next', '.git', '.vercel', 'Claude outputs'])

const EXTENSIONES = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.json', '.sql',
  '.css', '.md', '.webmanifest', '.txt', '.html',
])

/* Archivos sin extensión que también llevan texto. */
const SUELTOS = new Set(['manifest.webmanifest', '.gitignore'])

const REGLAS = [
  [/HUBI(?!E)/g, 'MAPPEL'],
  [/Hubi(?!e)/g, 'Mappel'],
  [/hubi(?!e)/g, 'mappel'],
]

/* Los archivos que cambian de nombre. Las referencias a ellos ya las
   arregla el reemplazo de texto de arriba. */
const RENOMBRAR = [
  ['app/hubi-caja.tsx', 'app/mappel-caja.tsx'],
  ['app/hubi-input.tsx', 'app/mappel-input.tsx'],
  ['lib/voz-hubi.ts', 'lib/voz-mappel.ts'],
  ...[
    'agenda', 'avisa', 'buscar', 'compra', 'cuentas', 'entrar',
    'guardar', 'hablar', 'invitar', 'queve', 'todo',
  ].map((c) => [`public/guia/hubi-${c}.mp4`, `public/guia/mappel-${c}.mp4`]),
]

/* Los dos logos NO se renombran: llegan ya volteados con el nombre
   nuevo, así que los viejos solo hay que quitarlos. */
const BORRAR = ['public/logo-hubi.png', 'public/logo-hubi-oscuro.png']

let tocados = 0
let cambios = 0

async function recorrer(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (SALTAR.has(e.name)) continue
    const p = path.join(dir, e.name)

    if (e.isDirectory()) {
      await recorrer(p)
      continue
    }

    /* El propio guion no se toca a sí mismo. */
    if (e.name === 'renombrar-mappel.mjs') continue

    const ext = path.extname(e.name)
    if (!EXTENSIONES.has(ext) && !SUELTOS.has(e.name)) continue

    const antes = await fs.readFile(p, 'utf8')
    let despues = antes
    for (const [de, a] of REGLAS) despues = despues.replace(de, a)

    if (despues !== antes) {
      const n = (antes.match(/HUBI(?!E)|Hubi(?!e)|hubi(?!e)/g) || []).length
      await fs.writeFile(p, despues)
      tocados += 1
      cambios += n
    }
  }
}

await recorrer(RAIZ)

for (const [de, a] of RENOMBRAR) {
  try {
    await fs.rename(path.join(RAIZ, de), path.join(RAIZ, a))
    console.log('renombrado  ' + de + '  →  ' + a)
  } catch (err) {
    if (err.code === 'ENOENT') console.log('ya estaba    ' + a)
    else throw err
  }
}

for (const f of BORRAR) {
  try {
    await fs.unlink(path.join(RAIZ, f))
    console.log('quitado     ' + f)
  } catch (err) {
    if (err.code === 'ENOENT') console.log('ya no está  ' + f)
    else throw err
  }
}

console.log('')
console.log(cambios + ' apariciones cambiadas en ' + tocados + ' archivos')
