/*
  Comprueba qué SQL está ejecutado de verdad.

  Se ejecuta EN LA MÁQUINA DE HARIS y lee su .env.local allí. La clave
  secreta no sale de su ordenador: de aquí solo salen síes y noes.
*/
import { readFileSync } from 'node:fs'

const env = {}
for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
  const i = linea.indexOf('=')
  if (i > 0 && !linea.trim().startsWith('#')) {
    env[linea.slice(0, i).trim()] = linea.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SECRET_KEY
if (!URL || !KEY) { console.log('FALTAN VARIABLES en .env.local'); process.exit(1) }

const cab = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function tabla(nombre, select = '*') {
  try {
    const r = await fetch(`${URL}/rest/v1/${nombre}?select=${select}&limit=1`, { headers: cab })
    return { ok: r.ok, estado: r.status, texto: r.ok ? '' : (await r.text()).slice(0, 90) }
  } catch (e) { return { ok: false, estado: 0, texto: String(e).slice(0, 90) } }
}

async function funcion(nombre, args = {}) {
  try {
    const r = await fetch(`${URL}/rest/v1/rpc/${nombre}`, {
      method: 'POST', headers: cab, body: JSON.stringify(args),
    })
    return { ok: r.ok, estado: r.status, texto: r.ok ? (await r.text()).slice(0, 40) : (await r.text()).slice(0, 90) }
  } catch (e) { return { ok: false, estado: 0, texto: String(e).slice(0, 90) } }
}

const pruebas = [
  ['28 · carpetas_drive con hogar',   () => tabla('carpetas_drive', 'hogar_id,ruta'), true],
  ['29 · conexion_drive por hogar',   () => tabla('conexion_drive', 'hogar_id'),      true],
  ['29 · y SIN la columna id',        () => tabla('conexion_drive', 'id'),            false],
  ['30 · función crear_mi_casa',      () => funcion('crear_mi_casa', { nombre_casa: '' }), null],
  ['31 · función puedo_escribir',     () => funcion('puedo_escribir'),                true],
  ['31 · papel lector permitido',     () => tabla('miembros', 'papel'),               true],
  ['32 · hogares.usa_compra',         () => tabla('hogares', 'usa_compra'),           true],
  ['33 · miembros.ve_todo',           () => tabla('miembros', 've_todo,escribe_todo'), true],
  ['33 · tabla permisos_carpeta',     () => tabla('permisos_carpeta', 'perfil_id,ver,escribir'), true],
  ['33 · función puedo_ver_carpeta',  () => funcion('puedo_ver_carpeta', { cat: null }), true],
  ['33 · función puedo_guardar_en',   () => funcion('puedo_guardar_en', { cat: null }),  true],
  ['33 · función raiz_de',            () => funcion('raiz_de', { cat: null }),           true],
]

let mal = 0
console.log('')
for (const [que, hacer, esperado] of pruebas) {
  const r = await hacer()
  if (esperado === null) {
    // crear_mi_casa: existe si el error NO es «función no encontrada»
    const existe = r.estado !== 404
    console.log(`${existe ? 'OK   ' : 'FALTA'} ${que}`)
    if (!existe) mal++
    continue
  }
  const bien = r.ok === esperado
  if (!bien) mal++
  console.log(`${bien ? 'OK   ' : 'FALTA'} ${que}${bien ? '' : `  → ${r.estado} ${r.texto}`}`)
}

console.log(mal === 0 ? '\nTODO EJECUTADO' : `\n${mal} COSAS SIN EJECUTAR`)
