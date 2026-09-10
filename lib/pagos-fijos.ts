/*
  ═══════════════════════════════════════════════════════════════
  LO QUE SE PAGA TODOS LOS MESES
  ═══════════════════════════════════════════════════════════════

  Dos ideas, y la segunda es la que de verdad vale:

   1. Lo que se sabe que se paga se apunta sin fotografiar nada.
   2. Y cuando llega el mes y NO está la factura, HUBI lo dice.

  Lo segundo solo puede hacerlo porque sabe lo que se programó. Es la
  diferencia entre un archivador —que guarda lo que le das— y algo que
  se acuerda por ti de lo que NO le has dado.

  ─────────────────────────────────────────────────────────────
  UN PAGO PROGRAMADO NACE «PREVISTO»

  Dar por pagado un gasto que quizá no ocurrió infla las cuentas, y no
  se nota en meses: un recibo devuelto, una baja, un mes que la
  compañía no pasó el cobro. Si HUBI lo apunta igual, el balance miente
  hacia el lado peor y no hay ningún papel que lo desmienta.

  Así que cuenta, sí, pero marcado. Se confirma con un toque o subiendo
  la factura. Nada se apunta en silencio.

  ─────────────────────────────────────────────────────────────
  Y TODO GIRA ALREDEDOR DEL «PERIODO»

  El periodo es el primer día de lo que cubre el recibo: el de
  septiembre es 2026-09-01, se cargue el día 1 o el 12. Con eso, «el de
  septiembre» es una cosa concreta —comparable, contable, imposible de
  duplicar— en vez de «el recibo de por ahí».
*/

export type Cada = 'mensual' | 'trimestral' | 'anual'

export type PagoFijo = {
  id: string
  que: string
  proveedor: string | null
  categoria_id: string
  importe: number
  impuesto_tipo: number | null
  cada: Cada
  dia: number
  desde: string
  hasta: string | null
  espera_papel: boolean
  activo: boolean
}

export const CADAS: { valor: Cada; texto: string; meses: number }[] = [
  { valor: 'mensual', texto: 'Todos los meses', meses: 1 },
  { valor: 'trimestral', texto: 'Cada tres meses', meses: 3 },
  { valor: 'anual', texto: 'Una vez al año', meses: 12 },
]

export function cadaCuantosMeses(cada: Cada): number {
  return CADAS.find((c) => c.valor === cada)?.meses ?? 1
}

export function comoSeDice(cada: Cada): string {
  return CADAS.find((c) => c.valor === cada)?.texto ?? 'Todos los meses'
}

/*
  ─────────────────────────────────────────────────────────────
  QUÉ PERIODOS YA HAN LLEGADO

  Devuelve los primeros días de cada periodo desde que empezó hasta hoy,
  ambos incluidos. Un pago mensual que empezó en junio da junio, julio,
  agosto y septiembre.

  TODO EN NÚMEROS, SIN `Date`. Y no es purismo: contar meses con fechas
  de JavaScript es un campo de minas —el 31 de enero más un mes da el 2
  ó 3 de marzo, según el año— y aquí un mes de más o de menos es un
  recibo de más o de menos en las cuentas de alguien. Con año y mes como
  enteros no hay nada que se desborde.

  Y hay un tope de cordura: si alguien pone «desde 2015» en un pago
  mensual, esto generaría 130 apuntes de golpe. Se cortan en 24 — dos
  años — porque lo que se quiere es empezar a llevar las cuentas desde
  ya, no reconstruir la historia inventada de una década.
*/
const TOPE = 24

export function periodosLlegados(
  pago: { cada: Cada; dia: number; desde: string; hasta: string | null },
  hoy: string
): string[] {
  const paso = cadaCuantosMeses(pago.cada)
  const [aDesde, mDesde] = pago.desde.split('-').map(Number)
  if (!aDesde || !mDesde) return []

  const periodos: string[] = []
  let año = aDesde
  let mes = mDesde

  for (let vueltas = 0; vueltas < 400; vueltas++) {
    const primero = `${año}-${dos(mes)}-01`
    /* El periodo cuenta cuando ha llegado SU DÍA, no cuando empieza el
       mes. Un recibo que se paga el 20 no se apunta el día 1: eso daría
       veinte días al mes en los que el balance dice que ya se ha pagado
       algo que todavía no se ha pagado. */
    const suDia = `${año}-${dos(mes)}-${dos(pago.dia)}`

    if (suDia > hoy) break
    if (pago.hasta && suDia > pago.hasta) break
    /* El primer periodo puede quedar por detrás de `desde` si `desde`
       cae después del día del pago dentro de ese mismo mes. */
    if (suDia >= pago.desde) periodos.push(primero)

    mes += paso
    while (mes > 12) {
      mes -= 12
      año++
    }
    if (periodos.length >= TOPE) break
  }

  return periodos
}

function dos(n: number): string {
  return String(n).padStart(2, '0')
}

/** El día concreto en que toca ese periodo. «2026-09-01» + día 12 → «2026-09-12». */
export function elDiaDe(periodo: string, dia: number): string {
  const [a, m] = periodo.split('-')
  return `${a}-${m}-${dos(dia)}`
}

/** «septiembre de 2026», para escribirlo en un aviso. */
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function comoSeLlamaElPeriodo(periodo: string, cada: Cada): string {
  const [a, m] = periodo.split('-').map(Number)
  if (cada === 'anual') return String(a)
  if (cada === 'trimestral') return `${Math.floor((m - 1) / 3) + 1}º trimestre de ${a}`
  return `${MESES[m - 1]} de ${a}`
}

/*
  ─────────────────────────────────────────────────────────────
  ¿ESTÁ EL PAPEL DE ESTE PERIODO?

  Se busca entre los documentos guardados uno que encaje: mismo
  proveedor —si el pago fijo dice de quién es— o al menos misma partida,
  con fecha dentro del periodo.

  DOS COSAS QUE NO HACE, A PROPÓSITO:

  · No exige que cuadre el importe. Una factura de la luz varía cada
    mes; exigir el importe exacto haría que «falta el papel» saliera
    para siempre con el papel delante.

  · No se fía solo de la partida cuando hay proveedor. En «Gastos →
    Luz» puede haber dos compañías; dar por buena cualquier factura de
    esa carpeta taparía justo la que falta.

  Y la ventana se estira UNA SEMANA hacia atrás, no un mes. Las
  facturas se emiten con unos días de adelanto —la del 28 de agosto es
  la de septiembre— pero estirar un mes entero fue peor el remedio: la
  factura de agosto entraba dentro de la ventana de septiembre y tapaba
  justo la que faltaba. Siete días cogen el adelanto real de una
  emisión y no llegan al recibo anterior.
*/
const GRACIA = 7
export function faltaElPapel(
  periodo: string,
  cada: Cada,
  proveedor: string | null,
  categoriaId: string,
  papeles: { proveedor: string | null; categoria_id: string | null; fecha_documento: string }[]
): boolean {
  const meses = cadaCuantosMeses(cada)
  const [a, m] = periodo.split('-').map(Number)

  const desde = menosDias(periodo, GRACIA)
  const hasta = correr(a, m, meses)

  const suyo = proveedor ? limpio(proveedor) : null

  return !papeles.some((p) => {
    const cuando = p.fecha_documento
    if (cuando < desde || cuando >= hasta) return false
    if (suyo) return p.proveedor != null && limpio(p.proveedor).includes(suyo)
    return p.categoria_id === categoriaId
  })
}

function correr(año: number, mes: number, meses: number): string {
  let a = año
  let m = mes + meses
  while (m > 12) { m -= 12; a++ }
  while (m < 1) { m += 12; a-- }
  return `${a}-${dos(m)}-01`
}

/* Restar días a mediodía, por lo de siempre: el servidor está en
   Londres y restar desde medianoche cae en el día anterior en verano. */
function menosDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00`)
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

function limpio(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}
