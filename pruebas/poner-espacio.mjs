/*
  ═══════════════════════════════════════════════════════════════
  PONER EL ESPACIO · herramienta de un solo uso
  ═══════════════════════════════════════════════════════════════

  No es una prueba: es la pala. Recorre lo que señala el guardián y,
  donde la forma de la consulta es INEQUÍVOCA, mete el filtro.

  ─────────────────────────────────────────────────────────────
  QUÉ CUENTA COMO INEQUÍVOCO

  Solo esto:

      .from('tabla')
      .select( ... )          ← todo el argumento cabe en su renglón

  Ahí el filtro va justo detrás del `.select(...)`, y da igual el orden
  de lo que venga después: PostgREST aplica los filtros mirando la
  consulta entera, no el orden en que se escribieron.

  Todo lo demás lo deja en paz y lo dice al final:

    · `.update(...)` y `.delete()`, porque el filtro tiene que ir
      DESPUÉS de la acción y el argumento suele ocupar varios
      renglones.
    · Los `.select(` que se abren y cierran en renglones distintos.
    · Los clientes que no se llaman `supabase` —la clave de servidor,
      por ejemplo—, porque ahí no hay sesión de la que sacar el
      espacio y hay que pasárselo a mano.

  Una pala que se equivoca por defecto. Lo que no toca sigue saliendo
  en rojo cuando se ejecuta el guardián, así que nada se pierde: se
  queda en la lista de lo que hay que mirar con las manos.

      node pruebas/poner-espacio.mjs           ← enseña lo que haría
      node pruebas/poner-espacio.mjs --escribe ← lo hace
*/

import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ESCRIBE = process.argv.includes('--escribe')

/* Lo que señala el guardián, tal cual: archivo y renglón. Termina en
   error a propósito —para eso es un guardián—, así que se le añade un
   `|| true`: recogerlo por el `catch` devolvía a veces la salida a
   medias, y una lista a medias aquí significa consultas sin arreglar
   que nadie vuelve a mirar. */
const salida = execSync('node pruebas/espacio.mjs || true', {
  encoding: 'utf8',
  shell: '/bin/bash',
}).split('\n')

const porArchivo = new Map()
let archivo = null
for (const l of salida) {
  const cabecera = l.match(/^ {2}((?:app|lib)\/\S+)/)
  if (cabecera) { archivo = cabecera[1]; continue }
  const fila = l.match(/^ {6}\s*(\d+)\s+(\w+)/)
  if (fila && archivo) {
    porArchivo.set(archivo, [...(porArchivo.get(archivo) ?? []), Number(fila[1])])
  }
}

let puestos = 0
const dejados = []

for (const [ruta, renglones] of porArchivo) {
  const texto = readFileSync(ruta, 'utf8')
  const lineas = texto.split('\n')

  /* ¿De dónde sale el espacio en ESTE archivo?

     Si ya lo tiene averiguado en una variable, se usa esa: una
     consulta menos y, sobre todo, una sola verdad por archivo. Pero la
     variable solo vale DENTRO de la función donde se declaró, y un
     archivo de ruta tiene tres —GET, POST, PATCH— cada una con la
     suya. Usarla fuera no es un fallo sutil: no compila. */
  const declaraciones = []
  const fronteras = []
  lineas.forEach((l, i) => {
    if (/\bconst hogarId = await (miHogar|elEspacio)\(/.test(l)) declaraciones.push(i)
    if (/^(export )?(async )?function |^export default (async )?function /.test(l)) fronteras.push(i)
  })

  const enElAlcance = (i) => {
    const antes = declaraciones.filter((d) => d < i)
    if (antes.length === 0) return false
    const ultima = antes[antes.length - 1]
    /* Si entre la declaración y la consulta empieza otra función, la
       variable se quedó en la anterior. */
    if (fronteras.some((f) => f > ultima && f < i)) return false

    /*
      Y ADEMÁS: que no pueda ser nula.

      `hogarId` es `string | null`. Escribir `.eq('hogar_id', null)` no
      filtra por «ninguna casa»: manda la palabra `null` a una columna
      de identificadores y Postgres rechaza la consulta entera. Lo dice
      ya un comentario del propio `ajustes/page.tsx`, escrito el día
      que pasó.

      Solo vale la variable si justo detrás hay una puerta cerrada —un
      `redirect`, un `return`— para cuando no hay casa. Si no la hay,
      se usa `elEspacioO`, que devuelve un valor imposible en vez de un
      nulo y no rompe nada.
    */
    const puerta = lineas.slice(ultima + 1, ultima + 3).join('\n')
    return /if \(!hogarId\)[^\n]*(redirect|return|throw)/.test(puerta)
  }

  /* De atrás hacia delante: insertar cambia la numeración de todo lo
     que viene detrás, y hacerlo al revés la deja quieta. */
  const nuevas = [...lineas]
  for (const n of [...renglones].sort((a, b) => b - a)) {
    const i = n - 1
    const desde = nuevas[i]
    const siguiente = nuevas[i + 1] ?? ''

    /*
      QUIÉN HACE LA CONSULTA.

      Puede estar en el mismo renglón —`await supabase.from('x')`— o
      arriba, cuando la cadena se parte:

          const { data } = await supabase
            .from('x')

      Y hay que saberlo, porque no todos los clientes son la sesión.
      `clienteServidor()` usa la clave de servidor: se salta las
      políticas y sirve precisamente para mirar TODAS las casas —la
      cita diaria de los avisos, la pantalla de comprobación—. Ahí el
      espacio no sale de la sesión, sino de la fila que se está
      tratando, y eso hay que decidirlo mirando el código.
    */
    let cliente = (desde.match(/(\w+)\s*\.from\('/) ?? [])[1]
    if (!cliente) {
      for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        const arriba = nuevas[j].match(/(?:await|=)\s+(\w+)\s*$/)
        if (arriba) { cliente = arriba[1]; break }
        if (nuevas[j].trim() !== '') break
      }
    }
    const esSupabase = cliente === 'supabase'

    /* El `.select(...)` entero en su renglón, y nada raro pegado. */
    const limpio = /^\s*\.select\((?:'[^']*'|`[^`]*`)(?:,\s*\{[^{}]*\})?\)\s*$/.test(siguiente)

    if (!esSupabase || !limpio) {
      dejados.push(`${ruta}:${n}  ${desde.trim().slice(0, 62)}`)
      continue
    }

    const sangria = siguiente.match(/^\s*/)[0]
    const valor = enElAlcance(i) ? 'hogarId' : 'await elEspacioO(supabase)'
    nuevas.splice(i + 2, 0, `${sangria}.eq('hogar_id', ${valor})`)
    puestos++
  }

  if (ESCRIBE && nuevas.length !== lineas.length) {
    let fuera = nuevas.join('\n')

    /* El import, si hace falta y no está.

       Detrás del último import de UN SOLO RENGLÓN. Los que se abren en
       llaves y siguen abajo —`import {\n  Aviso,\n ...`— son también
       un `import` para una expresión regular ingenua, y meter algo
       justo detrás de su primer renglón parte el archivo en dos. Ya
       pasó. */
    const usaO = /await elEspacioO\(supabase\)/.test(fuera)
    if (usaO && !/from '@\/lib\/espacio'|from '\.\/espacio'/.test(fuera)) {
      const rel = ruta.startsWith('lib/') ? './espacio' : '@/lib/espacio'
      const imports = [...fuera.matchAll(/^import .+ from '[^']+'$/gm)]
      const ultimo = imports[imports.length - 1]
      if (ultimo) {
        const corte = ultimo.index + ultimo[0].length
        fuera = fuera.slice(0, corte) + `\nimport { elEspacioO } from '${rel}'` + fuera.slice(corte)
      } else {
        /* Ningún import de un solo renglón donde agarrarse. Antes que
           adivinar, se deja el archivo entero para las manos. */
        dejados.push(`${ruta}  ← sin sitio donde poner el import`)
        continue
      }
    }

    writeFileSync(ruta, fuera)
  }
}

console.log(`\n${puestos} consultas con el filtro puesto${ESCRIBE ? '' : ' (ensayo — nada escrito)'}`)
console.log(`${dejados.length} a mano:\n`)
for (const d of dejados) console.log('  ' + d)
