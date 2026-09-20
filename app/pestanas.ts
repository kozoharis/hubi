import { type Icono } from './iconos'

/*
  ═══════════════════════════════════════════════════════════════
  LAS PESTAÑAS, EN UN SOLO SITIO
  ═══════════════════════════════════════════════════════════════

  Las mismas cinco navegan MAPPEL en las tres superficies:

    · en el móvil, la barra de abajo
    · en la tableta y el ordenador, el rail de la izquierda

  Escritas dos veces acabarían discrepando: alguien añade una pestaña
  a la barra y el ordenador se queda sin ella durante meses, porque
  nadie prueba las dos cosas a la vez. Aquí es imposible.

  Y de paso, la regla de quién ve qué es UNA, no dos.
*/

export type Pestana = { clave: string; texto: string; icono: Icono; href: string }

const INICIO:   Pestana = { clave: 'inicio',     texto: 'Inicio',  icono: 'casa',       href: '/' }
const PAPELES:  Pestana = { clave: 'documentos', texto: 'Papeles', icono: 'carpeta',    href: '/documentos' }
const AGENDA:   Pestana = { clave: 'agenda',     texto: 'Agenda',  icono: 'calendario', href: '/agenda' }
const CUENTAS:  Pestana = { clave: 'cuentas',    texto: 'Cuentas', icono: 'euro',       href: '/cuentas' }
/*
  «Día a día» y no «El día a día»: a 360 px la barra reparte 72 px por
  botón, y el rótulo va a 12 px. «El día a día» se parte en dos
  renglones y descuadra las otras cuatro. Dentro, la pantalla sí se
  llama por su nombre entero.
*/
const DIA_A_DIA: Pestana = { clave: 'dia', texto: 'Día a día', icono: 'taza', href: '/dia' }


/*
  ─────────────────────────────────────────────────────────────
  Y NO SON LAS MISMAS PARA TODOS

    Ayuda en casa   Inicio · Agenda · Día a día
    Asesor          Inicio · Papeles · Agenda · Cuentas
    Familia         las cinco

  A quien ayuda en casa se le quitan Papeles y Cuentas: la base de
  datos se los vacía —eso funciona— pero pasarse el día viendo dos
  pestañas que no llevan a nada no se lee como «esto no es para ti»,
  se lee como «esto está roto».

  Al asesor se le quita el Día a día por lo mismo: la compra y los
  recados de una familia que no es la suya no le corresponden. La
  agenda sí, porque desde que puede poner fechas es donde hace su
  trabajo.

  ESTO NO PROTEGE NADA, y conviene repetirlo. Quitar la pestaña de
  Papeles no impide abrir `/documentos` escribiéndolo — eso lo impiden
  las políticas de la base de datos. Aquí solo se decide qué se
  ofrece: no esconder, sino que cada uno encuentre lo suyo.
*/
export function pestanasDe(rol: string | null): Pestana[] {
  return rol === 'ayuda'
    ? [INICIO, AGENDA, DIA_A_DIA]
    : rol === 'asesor'
      ? [INICIO, PAPELES, AGENDA, CUENTAS]
      : [INICIO, PAPELES, AGENDA, CUENTAS, DIA_A_DIA]
}

/* La voz sirve para APUNTAR y para preguntar. A quien no puede
   escribir nada —el asesor, quien solo mira— le daría un botón grande
   que falla en cuanto lo use. */
export function puedeHablar(rol: string | null): boolean {
  return rol !== 'asesor' && rol !== 'mirar'
}


/*
  ═══════════════════════════════════════════════════════════════
  DE QUÉ PESTAÑA ES CADA DIRECCIÓN
  ═══════════════════════════════════════════════════════════════

  Esto vivía dentro de `rail.tsx`, que era el único que lo necesitaba:
  el rail vive en el armazón y no tiene a nadie que le diga dónde
  está, así que lo deduce de la dirección. La barra de abajo, en
  cambio, se lo hacía decir a cada pantalla — y ahí estaba el fallo
  que Haris vio en el móvil.

  Ahora las dos lo deducen igual, de aquí. Una regla, dos superficies:
  es la misma navegación en dos posturas.

  Se mira el camino de DENTRO —el que queda después del espacio—
  porque `/e/<casa>/documentos` es Papeles igual que `/documentos`.
*/
export function elCaminoDeDentro(ruta: string): string {
  return ruta.replace(/^\/e\/[0-9a-fA-F-]{36}/, '') || '/'
}

/*
  ⚠️  ESTA LISTA TENÍA CINCO HUECOS, Y SE VEÍAN SÓLO EN EL ORDENADOR

  Mientras esto era del rail y nada más, faltaban `/pagos`,
  `/notas`, `/helechos`, `/horas` y `/asesor`: en un ordenador esas
  cinco pantallas salían SIN ninguna pestaña encendida, y nadie lo
  llamó fallo porque no se ve — simplemente no hay nada marcado.

  En el móvil no pasaba porque cada pantalla decía la suya a mano. Al
  juntarlas, el hueco salió a la luz: la prueba de `pruebas/pestanas.ts`
  compara las dos y las cinco cantaron a la primera.

  Se arreglan aquí, y de paso se arregla el rail.
*/
export function cualEsta(ruta: string): string {
  const dentro = elCaminoDeDentro(ruta)
  if (dentro === '/') return 'inicio'
  if (dentro.startsWith('/documentos')) return 'documentos'
  if (dentro.startsWith('/agenda') || dentro.startsWith('/tablon')) return 'agenda'
  if (dentro.startsWith('/cuentas') || dentro.startsWith('/finca') ||
      dentro.startsWith('/seccion') || dentro.startsWith('/gastos') ||
      dentro.startsWith('/helechos') || dentro.startsWith('/pagos')) return 'cuentas'
  if (dentro.startsWith('/dia') || dentro.startsWith('/compra') ||
      dentro.startsWith('/menus') || dentro.startsWith('/lacasa') ||
      dentro.startsWith('/notas') || dentro.startsWith('/horas') ||
      dentro.startsWith('/asesor')) return 'dia'
  return ''
}

/*
  ═══════════════════════════════════════════════════════════════
  Y DÓNDE SALE LA BARRA DE ABAJO
  ═══════════════════════════════════════════════════════════════

  Ésta es la parte delicada del cambio, y merece explicarse entera.

  Hasta hoy la barra salía donde cada pantalla la pintaba, y el rail
  salía en casi todas. O sea que no coincidían: en `/guardar` el
  ordenador tenía navegación y el móvil no; en `/gastos`, igual.

  Al subir la barra al armazón había que elegir entre dos cosas:

  · IGUALARLA AL RAIL. Más coherente, y es la dirección buena. Pero
    le pone barra a doce pantallas que hoy no la tienen, y algunas no
    reservan sitio abajo para ella: la barra les taparía lo último.

  · DEJARLA DONDE ESTABA. Ni una pantalla cambia de aspecto. El
    arreglo —que no parpadee— se nota igual, y la coherencia se
    decide otro día, mirándola.

  Se ha hecho lo segundo, y a propósito: **este cambio es para que
  deje de parpadear, no para rediseñar dónde hay navegación.** Un
  cambio que arregla una cosa y de paso mueve doce pantallas es un
  cambio que no se puede probar.

  La lista de abajo es literalmente lo que había: las veintitrés
  pantallas que pintaban `<Barra>`. `pruebas/pestanas.ts` las
  comprueba una por una contra sus valores viejos.

  ── LAS DOS EXCEPCIONES DE DENTRO ──

  `/tablon/<id>` sí y `/tablon` y `/tablon/nuevo` no; `/finca` sí y
  `/finca/apuntar` no. No es capricho: las dos que se quedan fuera
  son pantallas donde se está HACIENDO algo —escribir una tarea,
  apuntar un gasto— y se sale por el botón de volver.
*/
const CON_BARRA = [
  '/documentos', '/agenda', '/tablon', '/cuentas', '/finca', '/helechos',
  '/seccion', '/pagos', '/dia', '/compra', '/menus', '/notas', '/lacasa',
  '/horas', '/asesor', '/ajustes', '/avisos',
]

const SIN_BARRA = ['/tablon/nuevo', '/finca/apuntar']

export function hayBarra(ruta: string): boolean {
  if (!hayNavegacion(ruta)) return false
  const dentro = elCaminoDeDentro(ruta)
  if (dentro === '/') return true
  if (dentro === '/tablon') return false
  if (SIN_BARRA.some((r) => dentro === r || dentro.startsWith(r + '/'))) return false
  return CON_BARRA.some((r) => dentro === r || dentro.startsWith(r + '/'))
}

/*
  ─────────────────────────────────────────────────────────────
  DONDE TODAVÍA NO HAY NADIE DENTRO, NO HAY NAVEGACIÓN

  Ni rail ni barra. Quien está escribiendo su correo para entrar no
  tiene por qué ver las cinco pestañas de una casa en la que todavía
  no está — y el aviso legal y los términos se leen sin haber entrado.

  Estaba en `rail.tsx` como `SIN_RAIL`. Al subir la barra al armazón
  pasa a valer para las dos, que es lo que siempre quiso decir.
*/
const SIN_NAVEGACION = ['/entrar', '/empezar', '/privacidad', '/terminos']

export function hayNavegacion(ruta: string): boolean {
  const dentro = elCaminoDeDentro(ruta)
  return !SIN_NAVEGACION.some((r) => dentro === r || dentro.startsWith(r + '/'))
}

/*
  ═══════════════════════════════════════════════════════════════
  Y DÓNDE SALE EL BOTÓN DE HABLAR
  ═══════════════════════════════════════════════════════════════

  Antes lo decía cada pantalla con un `voz={false}` suelto. Al subir
  la barra al armazón ya no hay quien lo diga, así que la regla se
  escribe aquí — y de paso se ve entera por primera vez, que es lo que
  permite comprobar si tiene sentido. Dos casos:

  ── DONDE NO SE APUNTA NADA ──

  Ajustes, el hilo del asesor, las horas de quien ayuda, el parte de
  la casa y los ajustes de una actividad. Son pantallas de configurar
  y de consultar; un botón grande de hablar encima invita a dictar
  algo que ahí no se puede guardar.

  ── Y EL INICIO, QUE YA TIENE EL SUYO ──

  Con Google conectado, el Inicio enseña HABLAR como elemento
  protagonista —es el punto 6 del planteamiento—. El flotante encima
  sería el mismo botón dos veces en la misma pantalla.

  Sin conectar no hay protagonista, así que el flotante se queda: es
  la única manera de hablar que hay ahí.
*/
const SIN_VOZ = ['/ajustes', '/asesor', '/horas', '/lacasa']

export function laVozAqui(ruta: string, conectado: boolean): boolean {
  const dentro = elCaminoDeDentro(ruta)
  if (SIN_VOZ.some((r) => dentro === r || dentro.startsWith(r + '/'))) return false
  /* Los ajustes de una actividad: `/seccion/<id>/ajustes`. La
     actividad en sí sí lleva voz — ahí se apuntan gastos. */
  if (/^\/seccion\/[^/]+\/ajustes/.test(dentro)) return false
  if (dentro === '/') return !conectado
  return true
}
