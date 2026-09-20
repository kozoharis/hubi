import { cualEsta, laVozAqui, hayNavegacion, hayBarra } from '../app/pestanas'

/* Lo que pintaba CADA pantalla antes del cambio, sacado de los
   `<Barra activa=... voz=...>` que había en los 26 sitios. */
const ANTES: { ruta: string; activa: string; voz: boolean }[] = [
  { ruta: '/',                      activa: 'inicio',     voz: true },   // voz={!conectado}, sin conectar
  { ruta: '/documentos',            activa: 'documentos', voz: true },
  { ruta: '/documentos/seccion/x',  activa: 'documentos', voz: true },
  { ruta: '/documentos/carpeta/x',  activa: 'documentos', voz: true },
  { ruta: '/documentos/x',          activa: 'documentos', voz: true },
  { ruta: '/documentos/x/editar',   activa: 'documentos', voz: true },
  { ruta: '/agenda',                activa: 'agenda',     voz: true },
  { ruta: '/tablon/x',              activa: 'agenda',     voz: true },
  { ruta: '/cuentas',               activa: 'cuentas',    voz: true },
  { ruta: '/finca',                 activa: 'cuentas',    voz: true },
  { ruta: '/helechos',              activa: 'cuentas',    voz: true },
  { ruta: '/seccion/x',             activa: 'cuentas',    voz: true },
  { ruta: '/seccion/x/ajustes',     activa: 'cuentas',    voz: false },
  { ruta: '/pagos',                 activa: 'cuentas',    voz: true },
  { ruta: '/dia',                   activa: 'dia',        voz: true },
  { ruta: '/compra',                activa: 'dia',        voz: true },
  { ruta: '/menus',                 activa: 'dia',        voz: true },
  { ruta: '/notas',                 activa: 'dia',        voz: true },
  { ruta: '/lacasa',                activa: 'dia',        voz: false },
  { ruta: '/horas/alguien',         activa: 'dia',        voz: false },
  { ruta: '/asesor',                activa: 'dia',        voz: false },
  { ruta: '/ajustes',               activa: '',           voz: false },
  { ruta: '/ajustes/google',        activa: '',           voz: false },
]

let fallos = 0
for (const c of ANTES) {
  const a = cualEsta(c.ruta)
  const v = laVozAqui(c.ruta, false)
  const bienA = a === c.activa
  const bienV = v === c.voz
  if (!bienA || !bienV) {
    fallos++
    console.log(`  ✗ ${c.ruta.padEnd(24)} pestaña: ${a || '—'} (esperada ${c.activa || '—'})   voz: ${v} (esperada ${c.voz})`)
  }
}

/* Y el Inicio con Google conectado: el flotante se va porque HABLAR
   ya está en grande dentro de la pantalla. */
if (laVozAqui('/', true) !== false) { fallos++; console.log('  ✗ / con Google conectado deberia ir SIN voz flotante') }

/* Donde no se ha entrado, no hay navegación. */
for (const r of ['/entrar', '/empezar', '/privacidad', '/terminos']) {
  if (hayNavegacion(r)) { fallos++; console.log('  ✗', r, 'no deberia llevar navegacion') }
}
for (const r of ['/', '/agenda', '/documentos', '/guardar']) {
  if (!hayNavegacion(r)) { fallos++; console.log('  ✗', r, 'si deberia llevar navegacion') }
}

/* Y con el espacio delante, lo mismo: /e/<uuid>/agenda es la Agenda. */
const conEspacio = '/e/3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d/agenda'
if (cualEsta(conEspacio) !== 'agenda') { fallos++; console.log('  ✗ con espacio delante no reconoce la Agenda') }

/*
  Y DÓNDE SALE LA BARRA · las que la pintaban y las que no.

  Esto es lo que de verdad protege el cambio: que ninguna pantalla
  gane ni pierda barra al subirla al armazón.
*/
const LA_TENIAN = [
  '/', '/documentos', '/documentos/x', '/documentos/carpeta/x', '/documentos/x/editar',
  '/agenda', '/tablon/x', '/cuentas', '/finca', '/helechos', '/seccion/x',
  '/seccion/x/ajustes', '/pagos', '/dia', '/compra', '/menus', '/notas',
  '/lacasa', '/horas/alguien', '/asesor', '/ajustes', '/ajustes/google',
  '/ajustes/cocina', '/avisos',
]

const NO_LA_TENIAN = [
  '/guardar', '/hablar', '/escritorio', '/tablon', '/tablon/nuevo',
  '/finca/apuntar', '/gastos', '/actividades', '/calendario',
  '/como-se-hace', '/comprobacion', '/en-la-cocina',
  '/entrar', '/empezar', '/privacidad', '/terminos',
]

for (const r of LA_TENIAN) {
  if (!hayBarra(r)) { fallos++; console.log('  ✗', r, 'ha PERDIDO la barra') }
}
for (const r of NO_LA_TENIAN) {
  if (hayBarra(r)) { fallos++; console.log('  ✗', r, 'ha GANADO una barra que no tenia') }
}

/* Y con el espacio delante, lo mismo. */
if (!hayBarra('/e/3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d/agenda')) {
  fallos++; console.log('  ✗ con espacio delante, la Agenda se queda sin barra')
}

console.log(
  fallos === 0
    ? `✓ ${ANTES.length} pantallas con la misma pestaña y la misma voz que antes\n✓ ${LA_TENIAN.length} con barra y ${NO_LA_TENIAN.length} sin barra, igual que antes`
    : `✗ ${fallos} diferencias`
)
