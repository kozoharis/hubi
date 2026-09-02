export type Vista = 'mes' | 'trimestre' | 'anio'

export type Periodo = {
  vista: Vista
  desde: string // AAAA-MM-DD
  hasta: string // AAAA-MM-DD, incluido
  titulo: string
  anterior: string // ancla del periodo anterior
  siguiente: string | null // null si sería futuro
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function iso(f: Date): string {
  return f.toISOString().slice(0, 10)
}

function mayus(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * Calcula el periodo a mostrar a partir de una fecha ancla.
 *
 * El ancla es cualquier día dentro del periodo; el cálculo lo expande
 * al mes, trimestre o año completo que lo contiene.
 */
export function calcular(vista: Vista, ancla: string): Periodo {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(ancla)
    ? new Date(ancla + 'T12:00:00Z')
    : new Date()

  const anio = base.getUTCFullYear()
  const mes = base.getUTCMonth()
  const hoy = new Date()

  let desde: Date
  let hasta: Date
  let titulo: string
  let anterior: Date
  let siguiente: Date

  if (vista === 'mes') {
    desde = new Date(Date.UTC(anio, mes, 1))
    hasta = new Date(Date.UTC(anio, mes + 1, 0))
    titulo = `${mayus(MESES[mes])} de ${anio}`
    anterior = new Date(Date.UTC(anio, mes - 1, 1))
    siguiente = new Date(Date.UTC(anio, mes + 1, 1))
  } else if (vista === 'trimestre') {
    const t = Math.floor(mes / 3)
    desde = new Date(Date.UTC(anio, t * 3, 1))
    hasta = new Date(Date.UTC(anio, t * 3 + 3, 0))
    titulo = `${t + 1}º trimestre de ${anio}`
    anterior = new Date(Date.UTC(anio, t * 3 - 3, 1))
    siguiente = new Date(Date.UTC(anio, t * 3 + 3, 1))
  } else {
    desde = new Date(Date.UTC(anio, 0, 1))
    hasta = new Date(Date.UTC(anio, 11, 31))
    titulo = `Año ${anio}`
    anterior = new Date(Date.UTC(anio - 1, 0, 1))
    siguiente = new Date(Date.UTC(anio + 1, 0, 1))
  }

  return {
    vista,
    desde: iso(desde),
    hasta: iso(hasta),
    titulo,
    anterior: iso(anterior),
    siguiente: siguiente > hoy ? null : iso(siguiente),
  }
}

/** 1.234,56 € — como se escribe en España. */
export function euros(valor: number, conSigno = false): string {
  const texto = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(valor))

  const signo = conSigno ? (valor < 0 ? '−' : '+') : valor < 0 ? '−' : ''
  return `${signo}${texto} €`
}

/** Sin decimales, para los números protagonistas. */
export function eurosRedondo(valor: number, conSigno = false): string {
  const texto = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 0,
  }).format(Math.abs(valor))

  const signo = conSigno ? (valor < 0 ? '−' : '+') : valor < 0 ? '−' : ''
  return `${signo}${texto} €`
}
