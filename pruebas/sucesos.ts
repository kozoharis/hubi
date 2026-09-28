import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

/*
  ═══════════════════════════════════════════════════════════════
  EL GUARDIÁN DE LOS SUCESOS
  ═══════════════════════════════════════════════════════════════

      npx tsx pruebas/sucesos.ts

  Comprueba tres cosas, y falla en el repositorio —antes de llegar a la
  base de datos— si alguna se rompe:

    1 · Que la lista de `lib/sucesos.ts` dice EXACTAMENTE lo mismo que
        el `check` de `sql/95`. Dos listas en dos idiomas se separan
        solas; si se separan, la app manda un tipo que Postgres
        rechaza y el suceso se pierde en silencio.

    2 · Que ninguna llamada a `apunta()` usa un tipo que no está en la
        lista.

    3 · Que ninguna llamada mete en `detalle` una clave o un valor que
        no esté contado.

  ─────────────────────────────────────────────────────────────
  POR QUÉ AQUÍ Y NO SÓLO EN LA BASE DE DATOS

  Porque el `check` de Postgres rechaza la fila DESPUÉS de desplegar,
  en silencio —`apunta()` se traga sus propios errores a propósito— y
  lo primero que se pierde son justo los sucesos del piloto, que es
  para lo que se hizo todo esto.

  Aquí falla antes de salir de casa.

  ─────────────────────────────────────────────────────────────
  Y POR QUÉ ES ESTÁTICO Y NO UN TEST DE VERDAD

  Porque lo que hay que vigilar no es que `apunta()` funcione —eso lo
  dice TypeScript— sino que nadie amplíe la superficie de privacidad
  sin enterarse. Eso se ve leyendo el código, no ejecutándolo.
*/

const LIB = 'lib/sucesos.ts'
const MIGRACION = 'sql/95-que-pasa-de-verdad.sql'

const fallos: string[] = []
const notas: string[] = []

// ── 1 · Las dos listas dicen lo mismo ──────────────────────

const lib = readFileSync(LIB, 'utf8')
const sql = readFileSync(MIGRACION, 'utf8')

/** Los textos entrecomillados de un trozo, en orden. */
function comillas(trozo: string): string[] {
  return [...trozo.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
}

function bloque(texto: string, desde: string, hasta: string, de: string): string {
  const i = texto.indexOf(desde)
  if (i === -1) {
    fallos.push(`No encuentro «${desde}» en ${de}.`)
    return ''
  }
  /* Desde DESPUÉS del marcador: si no, un marcador que ya lleva
     comillas dentro —`detalle->>'origen' in (`— se cuenta a sí mismo
     como uno de los valores. */
  const a = i + desde.length
  const j = texto.indexOf(hasta, a)
  if (j === -1) {
    fallos.push(`No encuentro el final de «${desde}» en ${de}.`)
    return ''
  }
  return texto.slice(a, j)
}

const TIPOS = comillas(bloque(lib, 'export const SUCESOS = [', ']', LIB))
const ORIGENES = comillas(bloque(lib, 'export const ORIGENES = [', ']', LIB))
const VIAS = comillas(bloque(lib, 'export const VIAS = [', ']', LIB))

const tiposSql = comillas(bloque(sql, 'tipo in (', ')', MIGRACION))
const origenesSql = comillas(bloque(sql, "detalle->>'origen' in (", ')', MIGRACION))
const viasSql = comillas(bloque(sql, "detalle->>'via'    in (", ')', MIGRACION))
const rolesSql = comillas(bloque(sql, "detalle->>'rol'    in (", ')', MIGRACION))

/* Los roles no se declaran en `lib/sucesos.ts`: salen de `lib/roles.ts`,
   que es donde viven. Se comparan contra allí. */
const ROLES = comillas(bloque(readFileSync('lib/roles.ts', 'utf8'), 'export type Rol =', '\n', 'lib/roles.ts'))

function iguales(que: string, aqui: string[], alla: string[]) {
  const sobran = aqui.filter((x) => !alla.includes(x))
  const faltan = alla.filter((x) => !aqui.includes(x))
  if (sobran.length === 0 && faltan.length === 0) {
    notas.push(`${que}: ${aqui.length} y las dos listas dicen lo mismo.`)
    return
  }
  if (sobran.length) fallos.push(`${que}: el código tiene ${sobran.join(', ')} y el SQL no.`)
  if (faltan.length) fallos.push(`${que}: el SQL tiene ${faltan.join(', ')} y el código no.`)
}

iguales('Tipos de suceso', TIPOS, tiposSql)
iguales('Valores de origen', ORIGENES, origenesSql)
iguales('Valores de via', VIAS, viasSql)
iguales('Valores de rol', ROLES, rolesSql)

// ── 2 y 3 · Cada llamada a apunta() ────────────────────────

const CLAVES = ['hogar', 'perfil', 'origen', 'via', 'rol']

function archivos(dir: string, sacos: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) archivos(p, sacos)
    else if (/\.tsx?$/.test(e)) sacos.push(p.split(sep).join('/'))
  }
  return sacos
}

/** Desde el `(` de una llamada hasta el `)` que la cierra. */
function hastaElCierre(texto: string, abre: number): string {
  let hondo = 0
  let comilla: string | null = null
  for (let i = abre; i < texto.length; i++) {
    const c = texto[i]
    if (comilla) {
      if (c === '\\') { i++; continue }
      if (c === comilla) comilla = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { comilla = c; continue }
    if (c === '(' || c === '{' || c === '[') hondo++
    if (c === ')' || c === '}' || c === ']') {
      hondo--
      if (hondo === 0) return texto.slice(abre, i + 1)
    }
  }
  return texto.slice(abre, abre + 400)
}

let llamadas = 0

for (const archivo of [...archivos('app'), ...archivos('lib')]) {
  if (archivo === LIB) continue
  const texto = readFileSync(archivo, 'utf8')

  for (const m of texto.matchAll(/\bapunta\(\s*'([a-z_]*)'/g)) {
    llamadas++
    const tipo = m[1]
    const renglon = texto.slice(0, m.index).split('\n').length
    /* Hasta el paréntesis que cierra la llamada, contando los que se
       abren por el camino. Con un `[\s\S]*?}\)` se quedaba fuera
       `apunta('x', { hogar: null })`, que cabe en un renglón. */
    const resto = hastaElCierre(texto, m.index! + m[0].indexOf('('))

    if (!TIPOS.includes(tipo)) {
      fallos.push(
        `${archivo}:${renglon} · apunta('${tipo}') — ese tipo no está en la lista de ${LIB}.`
      )
    }

    /* Las claves del objeto: `algo:` al principio de lo que quede,
       quitando lo que vaya dentro de un texto entrecomillado. */
    for (const c of resto.matchAll(/(?:^|[{,\s])([a-zA-ZáéíóúñÁÉÍÓÚÑ_]+)\s*:/g)) {
      const clave = c[1]
      if (!CLAVES.includes(clave)) {
        fallos.push(
          `${archivo}:${renglon} · apunta('${tipo}') lleva «${clave}», que no es una clave permitida.`
        )
      }
    }

    /* Y las claves ABREVIADAS —`{ texto }` en vez de `{ texto: texto }`—,
       que no llevan dos puntos y se colaban por el hueco de arriba.
       TypeScript también las rechaza, pero un `as` las taparía. */
    for (const c of resto.matchAll(/[{,]\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[,}]/g)) {
      const clave = c[1]
      if (!CLAVES.includes(clave)) {
        fallos.push(
          `${archivo}:${renglon} · apunta('${tipo}') lleva «${clave}» abreviado, que no es una clave permitida.`
        )
      }
    }

    /* Y los valores literales, cuando se escriben a mano. Una variable
       la comprueba TypeScript, que para eso están los tipos. */
    for (const [, clave, valor] of resto.matchAll(/(origen|via|rol)\s*:\s*'([^']*)'/g)) {
      const buenos = clave === 'origen' ? ORIGENES : clave === 'via' ? VIAS : ROLES
      if (!buenos.includes(valor)) {
        fallos.push(
          `${archivo}:${renglon} · apunta('${tipo}') pone ${clave}: '${valor}', que no está contado.`
        )
      }
    }
  }
}

notas.push(`Llamadas a apunta() revisadas: ${llamadas}.`)

// ── El veredicto ───────────────────────────────────────────

console.log('')
console.log('═══ GUARDIÁN DE LOS SUCESOS ═══')
console.log('')
for (const n of notas) console.log('  OK  ' + n)
if (fallos.length) {
  console.log('')
  for (const f of fallos) console.log('  MAL ' + f)
  console.log('')
  console.log(`  ${fallos.length} fallo(s).`)
  process.exit(1)
}
console.log('')
console.log('  Todo en su sitio.')
console.log('')
