/*
  ═══════════════════════════════════════════════════════════════
  QUIÉN ES CADA UNO EN LA CASA
  ═══════════════════════════════════════════════════════════════

  Antes había dos opciones al invitar: «todo, como tú» o «solo mirar».
  Y eso deja fuera a casi todo el mundo real — quien ayuda en casa no
  necesita las facturas del seguro, y un asesor necesita justo eso y
  nada más.

  ─────────────────────────────────────────────────────────────
  EL ROL NO DECIDE NADA POR SÍ SOLO

  Conviene que esto no se pierda. Los permisos que mandan son los de
  siempre: el papel en la casa, `ve_todo`, y los permisos carpeta a
  carpeta. El rol solo los RELLENA de golpe al elegirlo, y queda
  guardado para que la pantalla sepa a quién le habla.

  Si el rol decidiera permisos por su cuenta habría dos fuentes de
  verdad, y ahí es donde se filtran las cosas.

  ─────────────────────────────────────────────────────────────
  Y LO QUE MÁS CAMBIA NO ES LO QUE VE: ES LO QUE SE ENCUENTRA

  A quien ayuda en casa, HUBI no le abre en «Cuentas de casa» y
  «Papeles». Le abre en lo de hoy y la compra. El permiso evita que
  vea algo; la pantalla hace que encuentre lo suyo en un segundo, que
  es lo que de verdad se agradece.
*/

export type Rol = 'familia' | 'ayuda' | 'asesor' | 'mirar'

export const ROLES: {
  valor: Rol
  nombre: string
  pie: string
  /** Lo que se le dice a quien invita, sin adornos. */
  detalle: string
}[] = [
  {
    valor: 'familia',
    nombre: 'Familia',
    pie: 'Lo ve todo y puede con todo, igual que tú.',
    detalle:
      'Los papeles, las cuentas, la agenda y la salud. Para quien vive contigo o lleva la casa contigo.',
  },
  {
    valor: 'ayuda',
    nombre: 'Ayuda en casa',
    pie: 'Sus tareas, la compra y los tickets. Nada más.',
    detalle:
      'Ve lo que le encargas y la lista de la compra, y puede subir el ticket del súper. No ve los papeles, ni las cuentas, ni Salud. Si necesita ver la medicación, se le abre esa carpeta a mano.',
  },
  {
    valor: 'asesor',
    nombre: 'Asesor o gestor',
    pie: 'Las cuentas de tus actividades. No toca nada.',
    detalle:
      'Entra, mira y se descarga lo que necesite de la finca, las obras o los pisos. No puede subir papeles, ni apuntar gastos, ni tocar las cuentas. Sí puede dejarte avisos y ponerte tareas, y VE VUESTRA AGENDA ENTERA —también las citas del médico—: es lo que hace falta para que os pongáis de acuerdo en las fechas.',
  },
  {
    valor: 'mirar',
    nombre: 'Solo mirar',
    pie: 'Lo ve todo pero no cambia nada.',
    detalle:
      'Como Familia, pero sin poder tocar. Para quien quieres que esté al tanto y nada más.',
  },
]

export function nombreDelRol(rol: string | null | undefined): string {
  return ROLES.find((r) => r.valor === rol)?.nombre ?? 'Familia'
}

export function esRol(x: unknown): x is Rol {
  return x === 'familia' || x === 'ayuda' || x === 'asesor' || x === 'mirar'
}

/*
  ─────────────────────────────────────────────────────────────
  QUÉ ENSEÑA EL INICIO A CADA UNO

  Se decide aquí y no en la pantalla para que haya UN sitio donde
  mirarlo. Repartido por el JSX, dentro de seis condiciones, es donde
  un día alguien enseña de más sin enterarse.

  Y no sustituye a ningún permiso: es lo que se le OFRECE. Lo que no
  puede ver sigue sin poder verlo aunque escriba la dirección a mano —
  de eso se encargan las políticas.
*/
export type Inicio = {
  guardarDocumento: boolean
  compra: boolean
  notas: boolean
  cuentasCasa: boolean
  /** Lo de hoy y lo que viene. */
  agenda: boolean
}

export function queVeEnInicio(rol: string | null | undefined): Inicio {
  switch (rol) {
    case 'ayuda':
      /* Lo de hoy y la compra. Los tickets se suben desde la propia
         compra, que es donde tiene sentido: con el papel en la mano al
         salir del súper. «Guardar documento» a secas la mandaría a
         elegir carpeta entre veinte que no puede ver. */
      return {
        guardarDocumento: false,
        compra: true,
        notas: true,
        cuentasCasa: false,
        agenda: true,
      }

    case 'asesor':
      /*
        Viene a las cuentas, pero no solo a mirarlas.

        Antes tenía la agenda y el corcho apagados, y con eso su Inicio
        se quedaba SIN UNA SOLA TARJETA: una pantalla con el saludo y
        nada debajo, que no se lee como «lo tuyo está abajo» sino como
        «esto está roto».

        Y sobre todo, faltaba la mitad de la relación. Un gestor no
        solo mira: te dice que falta la factura de septiembre, que el
        día 20 hay un pago, que lo que subiste no vale. Sin sitio donde
        dejarlo, eso acaba en un WhatsApp que se pierde.

        La compra no: la lista del súper de una familia que no es la
        suya no pinta nada.
      */
      return {
        guardarDocumento: false,
        compra: false,
        notas: true,
        cuentasCasa: false,
        agenda: true,
      }

    case 'mirar':
      return {
        guardarDocumento: false,
        compra: true,
        notas: true,
        cuentasCasa: true,
        agenda: true,
      }

    default:
      return {
        guardarDocumento: true,
        compra: true,
        notas: true,
        cuentasCasa: true,
        agenda: true,
      }
  }
}
