import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/*
  ═══════════════════════════════════════════════════════════════
  EL GUARDIÁN DEL ESPACIO
  ═══════════════════════════════════════════════════════════════

  Recorre el código y encuentra las consultas que leen una tabla de un
  espacio SIN decir de qué espacio.

  ─────────────────────────────────────────────────────────────
  POR QUÉ HACE FALTA UN GUARDIÁN Y NO UN REPASO

  Hoy funciona sin el filtro: las políticas de la base de datos dicen
  `hogar_id = mi_hogar()` y contestan solo por el espacio activo. El
  filtro sobra.

  Cuando esas políticas pasen a decir `soy_de(hogar_id)` —«¿eres
  miembro de ESE espacio?»— dejarán de decidir CUÁL. Y entonces una
  consulta sin filtro devuelve las filas de TODOS tus espacios
  mezcladas.

  Para una familia con un espacio eso es idéntico a hoy. Para un gestor
  con quince es una lista con clientes revueltos.

  ─────────────────────────────────────────────────────────────
  Y POR QUÉ SE QUEDA PARA SIEMPRE

  Un repaso arregla las de hoy. Dentro de tres meses alguien escribe
  una pantalla nueva, se olvida del filtro, y no lo nota nadie porque
  con un solo espacio no se nota.

  Esto se ejecuta y falla. Es la diferencia entre haberlo arreglado y
  que siga arreglado.

      npm run probar-espacio

  ─────────────────────────────────────────────────────────────
  Y POR QUÉ ES .mjs Y NO .ts

  Porque un guardián que necesita que instales algo antes de poder
  ejecutarlo es un guardián que no se ejecuta.

  Esto empezó siendo TypeScript y hacía falta `tsx` para correrlo. En
  una máquina lo tenía y en otra no, así que en la otra no se ejecutó
  nunca. Los tipos aquí no sujetaban nada —cuatro anotaciones en un
  script que solo lee archivos y escribe renglones— y a cambio metían
  una herramienta entre el guardián y quien quiere usarlo.

  Ahora arranca con el `node` que ya tienes, aquí y en cualquier sitio
  donde esto se ejecute solo el día de mañana.
*/

/* Las tablas que pertenecen a un espacio. `miembros`, `hogares`,
   `perfiles`, `permisos_carpeta` y `pasos_dados` NO están: sus
   consultas cruzan espacios a propósito —son las que averiguan a
   cuáles perteneces— y filtrarlas rompería el selector. */
const DEL_ESPACIO = [
  'documentos', 'categorias', 'movimientos', 'recordatorios', 'notas',
  'compra', 'listas_compra', 'unidades', 'rutinas', 'rutinas_hechas',
  'menus', 'recetas', 'pagos_fijos', 'dias_en_casa',
]

function archivos(dir, sacos = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) archivos(p, sacos)
    else if (/\.tsx?$/.test(e)) sacos.push(p)
  }
  return sacos
}

/*
  El archivo SIN comentarios, renglón por renglón.

  Los comentarios se sustituyen por espacios en vez de quitarse, para
  que los números de renglón sigan siendo los del archivo: un aviso que
  señala el renglón 58 tiene que poder abrirse en el 58.

  Hace falta porque en HUBI los `.select()` largos llevan escrito al
  lado por qué piden lo que piden, y un comentario de cuatro renglones
  en medio de una consulta hacía que el rastreador la diera por
  terminada antes de tiempo. El aviso salía en una consulta que SÍ
  filtraba — y un guardián que grita sin motivo se acaba mirando por
  encima.
*/
function sinComentarios(texto) {
  let fuera = ''
  let enBloque = false
  let enTexto = null

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    const dos = texto.slice(i, i + 2)

    if (enBloque) {
      if (dos === '*/') { fuera += '  '; i++; enBloque = false }
      else fuera += c === '\n' ? '\n' : ' '
      continue
    }
    if (enTexto) {
      fuera += c
      if (c === '\\') { fuera += texto[i + 1] ?? ''; i++ }
      else if (c === enTexto) enTexto = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { enTexto = c; fuera += c; continue }
    if (dos === '/*') { fuera += '  '; i++; enBloque = true; continue }
    if (dos === '//') {
      while (i < texto.length && texto[i] !== '\n') { fuera += ' '; i++ }
      fuera += '\n'
      continue
    }
    fuera += c
  }
  return fuera.split('\n')
}

/*
  Dónde acaba una consulta.

  Se empieza en el `.from('x')` y se van juntando los renglones
  siguientes mientras sigan encadenando —empiezan por `.`— o sean el
  cierre de un argumento. Es una heurística, no un analizador: se
  equivoca por exceso, nunca por defecto, y eso es lo que hace falta en
  un guardián. Un falso aviso se mira; una consulta que se escapa, no.
*/
function laConsulta(lineas, desde) {
  let texto = lineas[desde]
  for (let i = desde + 1; i < Math.min(desde + 18, lineas.length); i++) {
    const l = lineas[i].trim()
    const sigue =
      l.startsWith('.') || l.startsWith(')') || l.startsWith('}') ||
      l.startsWith("'") || l.startsWith('`') || l.startsWith('{') ||
      /^[\w'"]+:/.test(l) || l === '' ||
      /* Un comentario dentro del argumento tampoco corta la consulta.
         En HUBI eso pasa a menudo: la mitad de los `.select()` largos
         llevan escrito al lado por qué piden lo que piden. */
      l.startsWith('/*') || l.startsWith('*') || l.startsWith('//')

    if (!sigue) break
    texto += '\n' + lineas[i]

    /*
      El paréntesis que cierra un argumento NO cierra la consulta.

          .select(
            'id, titulo, …'
          )                       ← aquí se paraba
          .eq('hogar_id', …)      ← y esto no lo veía

      Cortar ahí daba por «sin espacio» consultas que sí lo decían: un
      falso aviso. Un falso aviso se mira y se descarta —cuesta un
      minuto—, pero si son muchos se acaba mirando la lista por encima,
      y ése es el día en que se pasa por alto uno de verdad.

      Así que al ver un `)` se mira el siguiente renglón con algo
      escrito: si sigue encadenando, la consulta sigue.
    */
    if (l.startsWith(')') && !l.startsWith(').')) {
      let j = i + 1
      while (j < lineas.length && lineas[j].trim() === '') j++
      if (!lineas[j]?.trim().startsWith('.')) break
    }
  }
  return texto
}

const avisos = []
let miradas = 0
let permitidas = 0

for (const archivo of [...archivos('app'), ...archivos('lib')]) {
  const crudo = readFileSync(archivo, 'utf8')
  const conComentarios = crudo.split('\n')
  const lineas = sinComentarios(crudo)
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/\.from\('(\w+)'\)/)
    if (!m || !DEL_ESPACIO.includes(m[1])) continue
    miradas++
    const consulta = laConsulta(lineas, i)

    /* Una inserción lleva el espacio DENTRO de la fila, no en un
       `.eq`. Y ya lo llevan las diecisiete que hay. */
    const esInsercion = /\.(insert|upsert)\(/.test(consulta)
    const dice = /hogar_id/.test(consulta)

    /*
      LAS QUE CRUZAN A PROPÓSITO.

      Hay tres o cuatro sitios que miran TODAS las casas porque ése es
      su trabajo: la cita diaria que manda los avisos, y la consulta
      anónima que comprueba que la base de datos le cierra la puerta a
      quien no ha entrado.

      Se dicen escribiéndolo justo encima:

          espacio: a propósito — <por qué>

      Y hay que escribirlo AHÍ, en el sitio. Una lista de excepciones
      en este archivo se convierte, en un año, en una lista que nadie
      revisa y donde cabe cualquier cosa. Junto a la consulta, en
      cambio, el que la lea ve por qué no filtra.
    */
    const encima = conComentarios.slice(Math.max(0, i - 6), i).join('\n')
    const aProposito = /espacio: a propósito/.test(encima)
    if (aProposito) { permitidas++; continue }

    if (!dice && !esInsercion) {
      avisos.push({
        archivo, linea: i + 1, tabla: m[1],
        consulta: consulta.split('\n').slice(0, 3).map((x) => x.trim()).join(' '),
      })
    }
  }
}

/*
  ─────────────────────────────────────────────────────────────
  Y LA SEGUNDA MITAD: UNA SOLA PUERTA

  De poco sirve que las 239 consultas digan de qué espacio son si cada
  archivo lo averigua por su cuenta. El día que el espacio venga de la
  ruta hay que cambiar UN sitio, no cincuenta y cinco.

  Ese sitio es `elEspacio()`. `miHogar()` sigue existiendo —es quien
  contesta hoy— pero se llama desde ahí y desde ningún otro lado.
*/
const sueltos = []
for (const archivo of [...archivos('app'), ...archivos('lib')]) {
  if (archivo === 'lib/hogar.ts' || archivo === 'lib/espacio.ts') continue
  const lineas = sinComentarios(readFileSync(archivo, 'utf8'))
  lineas.forEach((l, i) => {
    if (/\bmiHogar\(/.test(l)) sueltos.push(`${archivo}:${i + 1}`)
  })
}

console.log(
  `\n${miradas} consultas a tablas de un espacio · ${avisos.length} sin decir de cuál` +
  `${permitidas > 0 ? ` · ${permitidas} cruzan a propósito` : ''}\n`
)

const porArchivo = new Map()
for (const a of avisos) porArchivo.set(a.archivo, [...(porArchivo.get(a.archivo) ?? []), a])

for (const [archivo, lista] of [...porArchivo].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${archivo}  (${lista.length})`)
  for (const a of lista) console.log(`      ${String(a.linea).padStart(4)}  ${a.tabla.padEnd(14)} ${a.consulta.slice(0, 78)}`)
}

if (avisos.length > 0) {
  console.log(
    `\n${avisos.length} consultas leen una tabla de un espacio sin decir de cuál.\n` +
    `Hoy funcionan porque la política lo decide por ellas. Cuando la política\n` +
    `pase a comprobar solo la pertenencia, devolverán filas de todos tus\n` +
    `espacios mezcladas.\n`
  )
  /*
    `process.exitCode`, NO `process.exit()`.

    `process.exit()` termina sin esperar a que se vacíe la salida, y
    cuando la salida va por una tubería —`| head`, o leída por otro
    programa— eso la corta por donde le pilla. Aquí costó una tarde:
    la herramienta que leía esta lista recibía a veces 193 renglones y
    a veces 91, y arreglaba los que le habían llegado.

    Una lista de seguridad que a veces viene a medias es peor que no
    tenerla: da por bueno lo que no ha mirado.
  */
  process.exitCode = 1
}

if (sueltos.length > 0) {
  console.log(
    `\n${sueltos.length} sitios preguntan el espacio por su cuenta, con \`miHogar()\`:\n` +
    sueltos.map((s) => '  ' + s).join('\n') +
    `\n\nTiene que salir de \`elEspacio()\`. Es el único sitio que sabrá leer la\n` +
    `ruta cuando el espacio esté en la dirección.\n`
  )
  process.exitCode = 1
}

if (avisos.length === 0 && sueltos.length === 0) {
  console.log('Todas dicen de qué espacio son, y todas lo preguntan al mismo sitio.\n')
}
