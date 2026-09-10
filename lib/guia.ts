import type { Icono } from '@/app/iconos'
import type { Ambito } from '@/lib/ambitos'

/*
  ═══════════════════════════════════════════════════════════════
  LA GUÍA · qué se enseña, a quién, y con qué vídeo
  ═══════════════════════════════════════════════════════════════

  Una sola lista, y de ella salen las dos pantallas: la tarjeta de
  «Primeros pasos» del Inicio y la de «Cómo se usa HUBI» de Ajustes.
  Estaban destinadas a divergir en la segunda semana si cada una
  tenía la suya.

  ─────────────────────────────────────────────────────────────
  CADA UNO VE LO SUYO, IGUAL QUE LA BARRA

  Enseñarle a alguien cómo invitar a un asesor cuando no puede
  invitar a nadie no informa: confunde, y encima le hace pensar que
  se lo han quitado.

  Es la misma regla que ya usa la barra de abajo, aplicada al mismo
  sitio del que salió.
*/

export type Papel = 'familia' | 'ayuda' | 'asesor' | 'mirar'

export type Accion = {
  clave: string
  titulo: string
  /** Una línea. Lo que se lee debajo del vídeo. */
  linea: string
  icono: Icono
  ambito: Ambito
  /** A dónde lleva «Hacerlo ahora». Sin esto el vídeo es decorativo. */
  href: string
  /** Quién lo ve. Vacío = todo el mundo menos quien solo mira. */
  para?: Papel[]
  /*
    Los que salen en la tarjeta del Inicio, en este orden. Los demás
    están en «Cómo se usa HUBI» desde el primer día, pero no se ponen
    delante de nadie: cuatro cosas por hacer se leen, nueve se
    ignoran.
  */
  primerPaso?: 1 | 2 | 3 | 4
}

export const ACCIONES: Accion[] = [
  {
    clave: 'guardar',
    titulo: 'Guardar un papel',
    linea: 'Haz una foto y HUBI la lee, la guarda en su carpeta y la suma a las cuentas.',
    icono: 'foto',
    ambito: 'verde',
    href: '/guardar',
    para: ['familia', 'ayuda'],
    primerPaso: 1,
  },
  {
    clave: 'hablar',
    titulo: 'Hablarle a HUBI',
    linea: 'Dile lo que necesitas como se lo dirías a una persona. Te enseña lo que ha entendido antes de guardar.',
    icono: 'micro',
    ambito: 'azul',
    href: '/hablar',
    para: ['familia', 'ayuda'],
    primerPaso: 2,
  },
  {
    clave: 'agenda',
    titulo: 'Apuntar algo en la agenda',
    linea: 'Citas, recados y vencimientos en el mismo sitio. Pendiente o hecho, y nada más.',
    icono: 'calendario',
    ambito: 'rosa',
    href: '/agenda',
    primerPaso: 3,
  },
  {
    clave: 'nota',
    titulo: 'Dejar una nota',
    linea: 'El papel de la nevera: lo que hay que saber y no es una tarea.',
    icono: 'chincheta',
    ambito: 'ciruela',
    href: '/notas',
    /* Comparte vídeo con el corcho: la nota se deja desde el Día a
       día, y el clip que existe es el de la compra. Hasta que haya uno
       propio, este paso se explica con texto y sin vídeo. */
    primerPaso: 4,
  },
  {
    clave: 'buscar',
    titulo: 'Encontrar un papel',
    linea: 'Escribe media palabra. Sin bajar por carpetas y sin acordarte de dónde lo pusiste.',
    icono: 'lupa',
    ambito: 'pizarra',
    href: '/documentos',
    para: ['familia', 'asesor'],
  },
  {
    clave: 'avisa',
    titulo: 'Que un papel te avise',
    linea: 'Si el seguro vence en noviembre, HUBI te lo recuerda en octubre. Tú eliges cuándo.',
    icono: 'campana',
    ambito: 'violeta',
    href: '/agenda',
    para: ['familia'],
  },
  {
    clave: 'cuentas',
    titulo: 'Mirar las cuentas',
    linea: 'Cada factura que fotografías entra sola en el balance de lo suyo.',
    icono: 'euro',
    ambito: 'arena',
    href: '/cuentas',
    para: ['familia', 'asesor'],
  },
  {
    clave: 'compra',
    titulo: 'La lista de la compra',
    linea: 'Uno apunta, otro tacha, y los dos lo ven al momento.',
    icono: 'bolsa',
    ambito: 'oliva',
    href: '/compra',
    para: ['familia', 'ayuda'],
  },
  {
    clave: 'invitar',
    titulo: 'Invitar a alguien',
    linea: 'Familia, quien ayuda en casa, el asesor de la gestoría, o solo mirar.',
    icono: 'gente',
    ambito: 'azul',
    href: '/ajustes?ver=casa',
    para: ['familia'],
  },
  {
    clave: 'queve',
    titulo: 'Decidir qué ve cada uno',
    linea: 'Carpeta por carpeta. La medicación sí, los informes del médico no.',
    icono: 'candado',
    ambito: 'pizarra',
    href: '/ajustes?ver=casa',
    para: ['familia'],
  },
  {
    clave: 'entrar',
    titulo: 'Entrar desde otro móvil',
    linea: 'Tu correo y un número de seis cifras. No hay contraseña que recordar.',
    icono: 'llave',
    ambito: 'pizarra',
    href: '/ajustes',
  },
]

/** El vídeo de una acción, si lo tiene. */
export function videoDe(clave: string): string | null {
  return CON_VIDEO.has(clave) ? `/guia/hubi-${clave}.mp4` : null
}

/*
  Las que tienen vídeo grabado. Se declara en vez de suponerse: pedir
  un `.mp4` que no existe deja un hueco negro en la pantalla, y un
  hueco negro en una guía es peor que no tener guía.
*/
const CON_VIDEO = new Set([
  'guardar', 'hablar', 'agenda', 'buscar', 'avisa',
  'cuentas', 'compra', 'invitar', 'queve', 'entrar',
])

/** Lo que le corresponde ver a este papel. */
export function accionesDe(papel: Papel): Accion[] {
  if (papel === 'mirar') return ACCIONES.filter((a) => a.clave === 'buscar' || a.clave === 'entrar')
  return ACCIONES.filter((a) => !a.para || a.para.includes(papel))
}

/** Los cuatro del Inicio, ya ordenados y filtrados por papel. */
export function primerosPasos(papel: Papel): Accion[] {
  return accionesDe(papel)
    .filter((a) => a.primerPaso)
    .sort((a, b) => (a.primerPaso ?? 9) - (b.primerPaso ?? 9))
}
