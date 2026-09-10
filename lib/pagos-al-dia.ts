import {
  periodosLlegados,
  elDiaDe,
  comoSeLlamaElPeriodo,
  faltaElPapel,
  type Cada,
} from '@/lib/pagos-fijos'
import { desglose } from '@/lib/impuesto'

/*
  ═══════════════════════════════════════════════════════════════
  PONER AL DÍA LOS PAGOS FIJOS
  ═══════════════════════════════════════════════════════════════

  Mira cada pago programado, calcula qué periodos ya han llegado y crea
  los que falten. Se puede llamar mil veces seguidas: el índice único
  de (pago, periodo) hace que el segundo intento no escriba nada.

  ─────────────────────────────────────────────────────────────
  DÓNDE SE LLAMA, Y POR QUÉ EN DOS SITIOS

  · En la cita diaria de Vercel. Es el sitio natural: una vez al día,
    para todas las casas, sin que nadie tenga que abrir nada.

  · Y al abrir la pantalla de los pagos fijos. Sin esto, alguien que
    programa un pago hoy no vería nada hasta mañana por la mañana —y
    con toda la razón pensaría que no funciona. Como es idempotente, no
    hay ningún riesgo en llamarlo de más.

  ─────────────────────────────────────────────────────────────
  NADA SE APUNTA EN SILENCIO

  Todo lo que crea esto nace con `previsto = true`. Cuenta en el
  balance —si no, las cuentas seguirían incompletas, que es lo que
  veníamos a arreglar— pero sale marcado y se confirma con un toque o
  subiendo la factura.
*/

type Fila = {
  id: string
  hogar_id: string
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
}

export type Puesto = {
  pago: string
  periodo: string
  como: string
}

export async function pagosAlDia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supa: any,
  hoy: string,
  /** Solo los de una casa. Sin esto, todas: es lo que hace la cita diaria. */
  soloHogar?: string
): Promise<{ puestos: Puesto[]; fallos: string[] }> {
  const puestos: Puesto[] = []
  const fallos: string[] = []

  let consulta = supa.from('pagos_fijos').select(
    'id, hogar_id, que, proveedor, categoria_id, importe, impuesto_tipo, cada, dia, desde, hasta, espera_papel'
  ).eq('activo', true)

  if (soloHogar) consulta = consulta.eq('hogar_id', soloHogar)

  const { data, error } = await consulta
  if (error || !data) {
    /* Sin la tabla todavía —el sql/47 sin ejecutar— esto no es un fallo
       que haya que gritar: simplemente no hay pagos fijos. */
    return { puestos, fallos }
  }

  for (const pago of data as Fila[]) {
    const periodos = periodosLlegados(pago, hoy)
    if (periodos.length === 0) continue

    /* Qué periodos ya están puestos. En UNA consulta por pago, no una
       por periodo: veinte pagos fijos con doce meses cada uno serían
       240 viajes a la base de datos en la cita diaria. */
    const { data: yaEstan } = await supa
      .from('movimientos')
      .select('periodo')
      .eq('pago_fijo_id', pago.id)

    const puestosYa = new Set(
      ((yaEstan ?? []) as { periodo: string | null }[])
        .map((m) => m.periodo)
        .filter(Boolean) as string[]
    )

    const quedan = periodos.filter((p) => !puestosYa.has(p))
    if (quedan.length === 0) continue

    /* La naturaleza de la partida decide si es gasto o ingreso. No se
       pregunta al crear el pago fijo: ya está dicho al elegir dónde
       cuenta, y preguntarlo dos veces es una forma de que un día no
       coincidan. */
    const { data: cat } = await supa
      .from('categorias')
      .select('naturaleza, nombre, impuesto_tipo')
      .eq('id', pago.categoria_id)
      .maybeSingle()

    const naturaleza = cat?.naturaleza === 'ingreso' ? 'ingreso' : 'gasto'
    if (cat?.naturaleza === 'neutro') continue

    const tipo =
      pago.impuesto_tipo ??
      (cat?.impuesto_tipo != null ? Number(cat.impuesto_tipo) : null)

    const filas = quedan.map((periodo) => {
      const fila: Record<string, unknown> = {
        hogar_id: pago.hogar_id,
        tipo: naturaleza,
        concepto: pago.que,
        importe: pago.importe,
        fecha: elDiaDe(periodo, pago.dia),
        categoria_id: pago.categoria_id,
        pago_fijo_id: pago.id,
        periodo,
        previsto: true,
        nota: `Apuntado solo: ${comoSeLlamaElPeriodo(periodo, pago.cada)}`,
      }
      if (tipo != null) {
        fila.impuesto_tipo = tipo
        fila.impuesto_cuota = desglose(Number(pago.importe), tipo).cuota
      }
      return fila
    })

    /*
      De uno en uno, y por lo mismo que los avisos de vencimiento: si
      una fila choca —el índice único, una carrera con la cita diaria—
      no puede llevarse por delante los otros once meses.
    */
    for (const fila of filas) {
      const { error: falloAlPoner } = await supa.from('movimientos').insert(fila)
      if (falloAlPoner) {
        /* 23505 es «ya estaba»: dos visitas a la vez. No es un fallo. */
        if (falloAlPoner.code !== '23505') {
          fallos.push(`${pago.que} ${fila.periodo}: ${falloAlPoner.message}`)
        }
        continue
      }
      puestos.push({
        pago: pago.que,
        periodo: String(fila.periodo),
        como: comoSeLlamaElPeriodo(String(fila.periodo), pago.cada),
      })
    }
  }

  return { puestos, fallos }
}

/*
  ─────────────────────────────────────────────────────────────
  Y QUÉ PAPELES FALTAN

  Se pregunta por los pagos que esperan papel y se compara con lo
  guardado. Devuelve una lista para enseñar, no para actuar: HUBI no
  borra ni deshace nada por esto, solo lo dice.
*/
export type Falta = {
  pago_id: string
  que: string
  periodo: string
  como: string
  categoria_id: string
}

export async function papelesQueFaltan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supa: any,
  hoy: string,
  soloHogar?: string
): Promise<Falta[]> {
  const faltan: Falta[] = []

  let consulta = supa
    .from('pagos_fijos')
    .select('id, hogar_id, que, proveedor, categoria_id, cada, dia, desde, hasta')
    .eq('activo', true)
    .eq('espera_papel', true)

  if (soloHogar) consulta = consulta.eq('hogar_id', soloHogar)

  const { data, error } = await consulta
  if (error || !data) return faltan

  for (const pago of data as Fila[]) {
    const periodos = periodosLlegados(pago, hoy)
    if (periodos.length === 0) continue

    /*
      Solo se miran los DOS últimos periodos.

      Reclamar la factura de hace ocho meses no sirve para nada: o se
      subió, o ya no aparecerá. Y una lista de treinta papeles que
      faltan se deja de mirar el primer día, con lo que el aviso útil
      —el de este mes— se pierde entre el ruido.
    */
    const ultimos = periodos.slice(-2)

    let papeles: { proveedor: string | null; categoria_id: string | null; fecha_documento: string }[] = []
    const { data: docs } = await supa
      .from('documentos')
      .select('proveedor, categoria_id, fecha_documento')
      .gte('fecha_documento', menosUnMes(ultimos[0]))
      .limit(500)
    papeles = docs ?? []

    for (const periodo of ultimos) {
      if (faltaElPapel(periodo, pago.cada, pago.proveedor, pago.categoria_id, papeles)) {
        faltan.push({
          pago_id: pago.id,
          que: pago.que,
          periodo,
          como: comoSeLlamaElPeriodo(periodo, pago.cada),
          categoria_id: pago.categoria_id,
        })
      }
    }
  }

  return faltan
}

function menosUnMes(fecha: string): string {
  const [a, m] = fecha.split('-').map(Number)
  const mes = m === 1 ? 12 : m - 1
  const año = m === 1 ? a - 1 : a
  return `${año}-${String(mes).padStart(2, '0')}-01`
}
