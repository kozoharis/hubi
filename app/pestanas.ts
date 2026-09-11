import { type Icono } from './iconos'

/*
  ═══════════════════════════════════════════════════════════════
  LAS PESTAÑAS, EN UN SOLO SITIO
  ═══════════════════════════════════════════════════════════════

  Las mismas cinco navegan HUBI en las tres superficies:

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
