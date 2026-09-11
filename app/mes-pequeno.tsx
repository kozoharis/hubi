import Link from '@/app/enlace'

/*
  ═══════════════════════════════════════════════════════════════
  EL MES, DE UN VISTAZO
  ═══════════════════════════════════════════════════════════════

  Un calendario chico para la columna de la derecha del Inicio, y solo
  en pantalla grande.

  ─────────────────────────────────────────────────────────────
  PARA QUÉ, SI YA ESTÁ «PRÓXIMAMENTE»

  Porque contestan cosas distintas. «Próximamente» dice QUÉ viene:
  tres líneas con nombre y plazo. Esto dice CÓMO VIENE EL MES — si la
  semana que entra está despejada o tiene cuatro cosas seguidas, si
  queda algo antes del día 20, si el hueco para la finca está a
  principios o a finales.

  Eso no se lee en una lista de tres. Se ve en una cuadrícula, de
  golpe, sin leer nada.

  ─────────────────────────────────────────────────────────────
  LO QUE NO ES

  No es la Agenda en pequeño. No lleva nombres, ni horas, ni colores
  por ámbito, ni se puede cambiar de mes. Un punto debajo del número:
  ese día hay algo. Nada más.

  Meterle más sería hacer una segunda agenda peor que la de verdad,
  que está a un toque de aquí — cada día lleva a su día, y la cabecera
  al mes entero.

  ─────────────────────────────────────────────────────────────
  Y POR QUÉ SOLO EN GRANDE

  Porque en un móvil esta cuadrícula mide lo que media pantalla, y el
  Inicio del móvil tiene una sola obligación: decir qué pasa hoy sin
  deslizar. Aquí el sitio ya estaba, al lado y vacío.
*/

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export default function MesPequeno({
  hoyISO,
  ocupados,
}: {
  /** Hoy donde viven ellos, no donde está el servidor. */
  hoyISO: string
  /** Los días del mes que tienen algo apuntado: 1, 4, 17… */
  ocupados: Set<number>
}) {
  const [anio, mes, dia] = hoyISO.split('-').map(Number)

  /* Cuántos días tiene el mes, y en qué casilla empieza.
     `new Date(a, m, 0)` es el último día del mes anterior a `m`, o sea
     el último de éste: la manera de no escribir la lista de los 30 y
     31 ni acordarse de los años bisiestos. */
  const cuantos = new Date(anio, mes, 0).getDate()

  /* La semana empieza en lunes, como en España. `getDay()` cuenta
     desde el domingo, así que el domingo (0) pasa a ser la séptima
     casilla y no la primera. */
  const primero = new Date(anio, mes - 1, 1).getDay()
  const hueco = (primero + 6) % 7

  const mesISO = `${anio}-${String(mes).padStart(2, '0')}`

  return (
    <section className="mt-6 hidden lg:block">
      <div className="flex items-baseline justify-between">
        <h2 className="t-seccion">{MESES[mes - 1]}</h2>
        <Link href={`/agenda?vista=mes&mes=${mesISO}`} className="t-apoyo font-bold">
          Ver la agenda
        </Link>
      </div>

      <div className="mt-2.5 rounded-[20px] border border-borde bg-superficie px-3 py-3">
        {/* Las iniciales. `aria-hidden` no: quien navega con lector
            también quiere saber que la primera columna es lunes. */}
        <div className="grid grid-cols-7 gap-y-1">
          {DIAS.map((d, i) => (
            <span
              key={i}
              className="text-center text-[12.5px] font-extrabold uppercase tracking-wide text-tenue"
            >
              {d}
            </span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-y-0.5">
          {/* Los huecos de antes del día 1. */}
          {Array.from({ length: hueco }, (_, i) => <span key={`h${i}`} />)}

          {Array.from({ length: cuantos }, (_, i) => {
            const n = i + 1
            const esHoy = n === dia
            const tiene = ocupados.has(n)
            const fecha = `${mesISO}-${String(n).padStart(2, '0')}`

            return (
              <Link
                key={n}
                href={`/agenda?vista=dia&dia=${fecha}`}
                aria-label={
                  `${n} de ${MESES[mes - 1]}` +
                  (esHoy ? ', hoy' : '') +
                  (tiene ? ', hay algo apuntado' : '')
                }
                aria-current={esHoy ? 'date' : undefined}
                className="flex flex-col items-center justify-center rounded-[11px] py-1"
              >
                <span
                  className={
                    'flex h-[28px] w-[28px] items-center justify-center rounded-full text-[14.5px] tabular-nums ' +
                    /* Hoy se marca con el mismo velo que la pestaña
                       activa del rail, no con un color inventado: en
                       toda la casa «aquí estás» se dice igual. */
                    (esHoy
                      ? 'velo-chip font-extrabold text-tinta'
                      : tiene
                        ? 'font-extrabold text-tinta'
                        : 'font-semibold text-tenue')
                  }
                >
                  {n}
                </span>
                {/* El punto SIEMPRE ocupa su sitio, tenga algo o no.
                    Si solo existiera en los días ocupados, las filas
                    con algo serían más altas que las demás y la
                    cuadrícula bailaría de semana en semana. */}
                <span
                  className={
                    'mt-[3px] h-[5px] w-[5px] rounded-full ' +
                    (tiene ? 'bg-verde' : 'bg-transparent')
                  }
                />
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
