import { elTrozoDelEspacio, api } from '../lib/api'

/*
  ═══════════════════════════════════════════════════════════════
  LA REGLA DE LA DIRECCIÓN
  ═══════════════════════════════════════════════════════════════

  Una expresión regular decide en qué espacio está cada petición. La
  usan las dos puntas:

    · `proxy.ts`, para poner la cabecera y reescribir por dentro.
    · `api()`, para que el botón de guardar apunte al mismo sitio que
      la pantalla que se está mirando.

  Si se equivoca de más, un camino normal —`/entrar`, `/escritorio`—
  acabaría tratado como un espacio. Si se equivoca de menos, la
  pantalla enseña un espacio y el guardado va a otro.

  Ninguna de las dos cosas da error. Por eso se prueba.

      npm run probar-ruta
*/

const CASOS: [string, string | null][] = [
  /* Lo que tiene que reconocer. */
  ['/e/2f1c8a3e-9d47-4b21-a8e5-6c0f7b3d1e94', '/e/2f1c8a3e-9d47-4b21-a8e5-6c0f7b3d1e94'],
  ['/e/2f1c8a3e-9d47-4b21-a8e5-6c0f7b3d1e94/', '/e/2f1c8a3e-9d47-4b21-a8e5-6c0f7b3d1e94'],
  ['/e/2f1c8a3e-9d47-4b21-a8e5-6c0f7b3d1e94/papeles', '/e/2f1c8a3e-9d47-4b21-a8e5-6c0f7b3d1e94'],
  ['/e/2f1c8a3e-9d47-4b21-a8e5-6c0f7b3d1e94/api/documentos', '/e/2f1c8a3e-9d47-4b21-a8e5-6c0f7b3d1e94'],
  /* En mayúsculas también: un identificador es el mismo se escriba
     como se escriba, y quien copie una dirección de un correo no tiene
     por qué saberlo. */
  ['/e/2F1C8A3E-9D47-4B21-A8E5-6C0F7B3D1E94/papeles', '/e/2F1C8A3E-9D47-4B21-A8E5-6C0F7B3D1E94'],

  /* Lo que NO. */
  ['/', null],
  ['/papeles', null],
  ['/entrar', null],
  ['/escritorio', null],
  ['/api/documentos', null],
  /* Una pantalla que empezara por «e» no es un espacio. */
  ['/empezar', null],
  ['/e', null],
  ['/e/', null],
  /* Ni un trozo con la pinta pero de otro tamaño: eso es basura, y la
     basura se trata como camino normal, no como espacio. */
  ['/e/2f1c8a3e/papeles', null],
  ['/e/2f1c8a3e-9d47-4b21-a8e5-6c0f7b3d1e94ff/papeles', null],
  /* Y pegado a otra cosa, tampoco. */
  ['/x/e/2f1c8a3e-9d47-4b21-a8e5-6c0f7b3d1e94', null],
]

let mal = 0

for (const [camino, esperado] of CASOS) {
  const salio = elTrozoDelEspacio(camino)
  const bien = salio === esperado
  if (!bien) mal++
  console.log(
    `  ${bien ? 'ok ' : '⚠ MAL'}  ${camino.padEnd(56)} → ${salio ?? '(ninguno)'}`
  )
}

/*
  Y el otro lado: sin ventana —o sea, en el servidor— `api()` devuelve
  el camino tal cual. Si devolviera otra cosa, el servidor construiría
  direcciones con el espacio de nadie.
*/
const enElServidor = api('/api/documentos')
if (enElServidor !== '/api/documentos') {
  console.log(`  ⚠ MAL  api() en el servidor devolvió ${enElServidor}`)
  mal++
} else {
  console.log('  ok   api() en el servidor deja el camino como está')
}

console.log(
  mal === 0
    ? `\n${CASOS.length + 1} casos, todos bien.\n`
    : `\n${mal} mal.\n`
)

if (mal > 0) process.exitCode = 1
