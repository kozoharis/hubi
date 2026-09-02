import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { calcular, euros, eurosRedondo, type Vista } from '@/lib/periodos'
import { fechaBreve } from '@/lib/carpetas'
import { nombreApartamento } from '@/lib/reservas'
import { unidadesDe, comoEsLaSeccion } from '@/lib/unidades'
import Barra from './barra'
import Cabecera from './cabecera'
import { Ico, Pastilla, type Icono } from './iconos'
import { hoyAqui } from '@/lib/tablon'

/*
  Las cuentas de una sección.

  Nació como la pantalla de la Finca, con "FINCA" escrito a fuego. Al
  aparecer Los Helechos —la casa de Los Realejos, con sus propios
  gastos e ingresos— se vio que todo lo demás ya era genérico: filtra
  lo que cuelga de una categoría raíz, suma, y lo pinta.

  Así que en vez de copiar la pantalla, se le quitó la constante. Dos
  copias de esto habrían sido dos sitios donde arreglar el mismo fallo
  —y donde uno de los dos se queda sin arreglar.
*/

export type Cuenta = {
  /** El `segmento_drive` de la categoría raíz: FINCA, HELECHOS… */
  raiz: string
  nombre: string
  icono: Icono
  color: string
  fondo: string
  /** Dónde vive esta pantalla, para los enlaces de periodo. */
  ruta: string
  /* Cuál de las pestañas de abajo se marca. Ya no es una lista
     cerrada de dos: es el identificador de la actividad, porque cada
     casa tiene las suyas y no las conocemos de antemano. */
  pestana: string
  /**
   * Los Helechos se reparte en apartamentos. La Finca, no.
   *
   * OJO: esto ya NO decide nada — lo decide la base de datos
   * (`categorias.usa_unidades`). Se queda como red por si el SQL de
   * las unidades todavía no se ha ejecutado: sin él, esta pantalla
   * seguiría enseñando los tres apartamentos como siempre en vez de
   * quedarse en blanco.
   */
  apartamentos?: boolean
  /**
   * Cómo se llaman aquí las unidades, en el idioma de la casa.
   *
   * «Cada apartamento» en Los Helechos, «Cada obra» en un reformista.
   * Nadie quiere leer «Detalle por unidad» en su propia pantalla:
   * «unidad» es una palabra nuestra, de la fontanería, y no tiene por
   * qué salir a la superficie.
   */
  etiquetaUnidades?: string
}

type Movimiento = {
  id: string
  tipo: 'gasto' | 'ingreso'
  concepto: string
  importe: number
  fecha: string
  categoria_id: string | null
  documento_id: string | null
  apartamento: number | null
  unidad_id: string | null
  personas: number | null
  noches: number | null
  huesped: string | null
}

export default async function Cuentas({
  seccion,
  searchParams,
}: {
  seccion: Cuenta
  searchParams: Promise<{ vista?: string; ancla?: string }>
}) {
  const p = await searchParams
  const vista: Vista = p.vista === 'mes' || p.vista === 'anio' ? p.vista : 'trimestre'
  const periodo = calcular(vista, p.ancla ?? hoyAqui())

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive')

  const todas = categorias ?? []
  const porId = new Map(todas.map((c) => [c.id, c]))

  // Solo cuenta lo que cuelga de esta sección: el seguro del coche es
  // un gasto de la casa, no de la finca ni de Los Helechos.
  const raiz = todas.find((c) => c.segmento_drive === seccion.raiz && !c.padre_id)
  const deFinca = new Set<string>()
  for (const c of todas) {
    let actual: (typeof todas)[number] | undefined = c
    while (actual) {
      if (actual.id === raiz?.id) {
        deFinca.add(c.id)
        break
      }
      actual = actual.padre_id ? porId.get(actual.padre_id) : undefined
    }
  }

  /*
    DOS INTENTOS, Y NO ES DESCONFIANZA: ES EXPERIENCIA.

    `unidad_id` es una columna nueva. Si el SQL todavía no se ha
    ejecutado, meterla en el SELECT no hace fallar esa columna: hace
    que Postgres rechace LA CONSULTA ENTERA. Y esta pantalla, como
    todas, no mira el error — enseñaría «no hay nada apuntado» con
    las cuentas del trimestre intactas debajo.

    Ya ha pasado tres veces en este proyecto. Así que se pide con la
    columna, y si no puede ser, se pide sin ella y se sigue como
    antes.
  */
  const columnas =
    'id, tipo, concepto, importe, fecha, categoria_id, documento_id, apartamento, personas, noches, huesped'

  let data: unknown[] | null = null
  const conUnidad = await supabase
    .from('movimientos')
    .select(`${columnas}, unidad_id`)
    .gte('fecha', periodo.desde)
    .lte('fecha', periodo.hasta)
    .order('fecha', { ascending: false })

  if (conUnidad.error) {
    const sinUnidad = await supabase
      .from('movimientos')
      .select(columnas)
      .gte('fecha', periodo.desde)
      .lte('fecha', periodo.hasta)
      .order('fecha', { ascending: false })
    data = sinUnidad.data
  } else {
    data = conUnidad.data
  }

  const movimientos = ((data ?? []) as Movimiento[]).filter(
    (m) => m.categoria_id && deFinca.has(m.categoria_id)
  )

  /*
    Las unidades de esta sección, y si reparte lo común.

    Antes esto estaba escrito en el código: tres apartamentos,
    divididos entre tres. Ahora sale de la base de datos, y por eso
    esta misma pantalla vale para Los Helechos, para el piso de la
    abuela y para las ocho obras de un reformista sin tocar una línea.
  */
  const unidades = raiz ? await unidadesDe(supabase, raiz.id) : []
  const comoEs = raiz
    ? await comoEsLaSeccion(supabase, raiz.id)
    : { usaUnidades: false, reparteComunes: false }

  const ingresos = suma(movimientos.filter((m) => m.tipo === 'ingreso'))
  const gastos = suma(movimientos.filter((m) => m.tipo === 'gasto'))
  const balance = ingresos - gastos

  const desglose = agrupar(movimientos.filter((m) => m.tipo === 'gasto'), porId)
  const mayor = desglose[0]?.total ?? 0

  /*
    Manda la base de datos; el ajuste del código es la red.

    Si las unidades están puestas, se usan. Si no —porque el SQL no se
    ha ejecutado todavía—, Los Helechos siguen enseñando sus tres
    apartamentos como siempre. Nadie se queda mirando una sección que
    ha perdido la mitad de lo que enseñaba.
  */
  const porUnidades = comoEs.usaUnidades && unidades.length > 0
  const casas = porUnidades
    ? repartir(movimientos, unidades, comoEs.reparteComunes)
    : seccion.apartamentos
      ? repartir(movimientos, APARTAMENTOS_DE_SIEMPRE, true)
      : null

  const nombreDeUnidad = new Map(unidades.map((u) => [u.id, u.nombre]))

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <div className="flex h-14 items-center gap-3">
          <Pastilla
            nombre={seccion.icono}
            color={seccion.color}
            fondo={seccion.fondo}
            tam={44}
            icono={23}
          />
          <h1 className="text-[27px] font-extrabold tracking-tight">{seccion.nombre}</h1>
        </div>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-1">

        {/* ── Qué periodo ── */}
        <div className="flex gap-2" role="group" aria-label="Periodo">
          {(['mes', 'trimestre', 'anio'] as const).map((v) => (
            <Link
              key={v}
              href={`${seccion.ruta}?vista=${v}&ancla=${periodo.desde}`}
              className="flex h-11 flex-1 items-center justify-center rounded-full text-[15px] font-extrabold"
              style={
                v === vista
                  ? { background: seccion.color, color: '#0F172A' }
                  : { background: 'var(--t-superficie)', color: 'var(--t-tinta-suave)', border: '1px solid var(--t-borde)' }
              }
            >
              {v === 'mes' ? 'Mes' : v === 'trimestre' ? 'Trimestre' : 'Año'}
            </Link>
          ))}
        </div>

        {/* ── Cuál ── */}
        <div className="mt-3 flex items-center justify-between">
          <Link
            href={`${seccion.ruta}?vista=${vista}&ancla=${periodo.anterior}`}
            aria-label="Periodo anterior"
            className="flex h-11 w-11 items-center justify-center text-tenue"
          >
            <Ico nombre="atras" tam={21} grosor={2.4} />
          </Link>
          <p className="text-[18px] font-extrabold">{periodo.titulo}</p>
          {periodo.siguiente ? (
            <Link
              href={`${seccion.ruta}?vista=${vista}&ancla=${periodo.siguiente}`}
              aria-label="Periodo siguiente"
              className="flex h-11 w-11 items-center justify-center text-tenue"
            >
              <Ico nombre="flecha" tam={21} grosor={2.4} />
            </Link>
          ) : (
            <span className="flex h-11 w-11 items-center justify-center text-borde">
              <Ico nombre="flecha" tam={21} grosor={2.4} />
            </span>
          )}
        </div>

        {/* ── Los tres números ── */}
        <div className="mt-3 flex gap-2.5">
          <Cifra etiqueta="INGRESOS" valor={eurosRedondo(ingresos)} punto="#14B8A6" />
          <Cifra etiqueta="GASTOS" valor={eurosRedondo(gastos)} punto="#FF6B6B" />
        </div>

        <div
          className="mt-2.5 rounded-[20px] px-4 py-4 text-white"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C4DEC)' }}
        >
          <p className="text-[13px] font-extrabold tracking-widest opacity-85">BALANCE</p>
          <p className="mt-0.5 text-[38px] font-extrabold leading-none tracking-tight">
            {eurosRedondo(balance, true)}
          </p>
        </div>

        {/* ── Cada unidad ── */}
        {casas && casas.casas.length > 0 && (
          <section className="mt-5">
            <h2 className="rotulo">{seccion.etiquetaUnidades ?? 'Cada una'}</h2>

            <ul className="mt-3 space-y-2.5">
              {casas.casas.map((c) => (
                <li
                  key={c.id}
                  className="rounded-[20px] border border-borde bg-superficie px-4 py-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[18px] font-extrabold tracking-tight">
                      {c.nombre}
                    </p>
                    <p
                      className="text-[21px] font-extrabold tabular-nums"
                      style={{ color: c.balance >= 0 ? '#14B8A6' : '#FF6B6B' }}
                    >
                      {eurosRedondo(c.balance, true)}
                    </p>
                  </div>

                  <p className="mt-1 text-[14.5px] font-semibold text-tenue">
                    {eurosRedondo(c.ingresos)} entra · {eurosRedondo(c.gastos)} sale
                  </p>

                  <div
                    className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-borde"
                    role="img"
                    aria-label={`${c.nombre}: ${euros(c.ingresos)} de ingresos y ${euros(c.gastos)} de gastos`}
                  >
                    <div
                      className="h-2.5"
                      style={{
                        width: `${casas.tope > 0 ? (c.ingresos / casas.tope) * 100 : 0}%`,
                        background: '#14B8A6',
                      }}
                    />
                    <div
                      className="h-2.5"
                      style={{
                        width: `${casas.tope > 0 ? (c.gastos / casas.tope) * 100 : 0}%`,
                        background: '#FF6B6B',
                      }}
                    />
                  </div>

                  <p className="mt-2.5 text-[15px] font-bold text-tinta-suave">
                    {c.reservas === 0
                      ? 'Sin reservas'
                      : `${c.reservas} ${c.reservas === 1 ? 'reserva' : 'reservas'} · ${c.noches} ${c.noches === 1 ? 'noche' : 'noches'} · ${c.personas} ${c.personas === 1 ? 'persona' : 'personas'}`}
                  </p>
                </li>
              ))}
            </ul>

            {/*
              Decir SIEMPRE qué se ha hecho con lo común, y las dos
              cosas son noticia: que se reparte, y que no se reparte.
              Si no se dice, alguien suma las partes, no le cuadra con
              el balance de arriba, y deja de fiarse de la pantalla
              entera.
            */}
            {casas.comunes > 0 &&
              (casas.reparte ? (
                <p className="mt-3 text-[15px] font-semibold leading-snug text-tenue">
                  Incluye {euros(casas.comunes)} de gastos comunes —luz, seguro,
                  gestoría— repartidos a partes iguales entre{' '}
                  {casas.cuantas === 2 ? 'las dos' : `las ${casas.cuantas}`}.
                </p>
              ) : (
                <p className="mt-3 text-[15px] font-semibold leading-snug text-tenue">
                  Aparte hay {euros(casas.comunes)} de gastos comunes que no son de
                  ninguna en concreto. No se reparten: sí cuentan en el balance de
                  arriba.
                </p>
              ))}
          </section>
        )}

        {/* ── En qué se ha ido ── */}
        {desglose.length > 0 && (
          <section className="mt-5">
            <h2 className="rotulo">En qué se ha gastado</h2>
            <ul className="mt-3">
              {desglose.map((d) => (
                <li key={d.nombre} className="mb-3.5">
                  <div className="flex items-baseline justify-between gap-4 text-[16px] font-bold">
                    <span>{d.nombre}</span>
                    <span className="shrink-0 tabular-nums">{euros(d.total)}</span>
                  </div>
                  <div
                    className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-borde"
                    role="img"
                    aria-label={`${d.nombre}: ${euros(d.total)}`}
                  >
                    <div
                      className="h-2 rounded-full bg-coral"
                      style={{ width: `${mayor > 0 ? Math.max(4, (d.total / mayor) * 100) : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── El detalle ── */}
        <section className="mt-5">
          <h2 className="rotulo">Movimientos</h2>

          {movimientos.length === 0 ? (
            <p className="mt-3 rounded-[20px] bg-superficie px-6 py-8 text-center text-[17px] font-medium text-tinta-suave">
              No hay nada apuntado en {periodo.titulo.toLowerCase()}.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {movimientos.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-[18px] border border-borde bg-superficie px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-bold">{m.concepto}</p>
                    <p className="text-[14.5px] font-semibold text-tenue">
                      {fechaBreve(m.fecha)}
                      {m.categoria_id && porId.get(m.categoria_id)
                        ? ` · ${porId.get(m.categoria_id)!.nombre}`
                        : ''}
                      {casas
                        ? ` · ${m.unidad_id
                            ? (nombreDeUnidad.get(m.unidad_id) ?? 'Toda la casa')
                            : nombreApartamento(m.apartamento)}`
                        : ''}
                    </p>
                    {m.noches != null && (
                      <p className="text-[14.5px] font-semibold text-tenue">
                        {m.noches} {m.noches === 1 ? 'noche' : 'noches'}
                        {m.personas != null
                          ? ` · ${m.personas} ${m.personas === 1 ? 'persona' : 'personas'}`
                          : ''}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className="text-[17px] font-extrabold tabular-nums"
                      style={{ color: m.tipo === 'ingreso' ? '#14B8A6' : '#FF6B6B' }}
                    >
                      {m.tipo === 'ingreso' ? '+' : '−'}
                      {euros(m.importe)}
                    </p>
                    {m.documento_id && (
                      <Link
                        href={`/documentos/${m.documento_id}`}
                        className="text-[14.5px] font-bold text-tenue"
                      >
                        Ver papel
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          href={`/finca/apuntar?seccion=${seccion.raiz}`}
          className="mt-5 flex h-[60px] items-center justify-center gap-2.5 rounded-[18px] bg-boton text-[18px] font-extrabold text-boton-texto"
        >
          <Ico nombre="mas" tam={22} grosor={2.3} />
          Apuntar un gasto
        </Link>

        {/* Sin `pr-24`: ese hueco a la derecha estaba para esquivar el
            botón de voz, que ahora va pegado a la barra de abajo y ya
            no pasa por aquí. Descentraba la frase sin motivo. */}
        <p className="mt-3 text-center text-[14.5px] font-semibold leading-snug text-tenue">
          Las facturas con importe entran aquí solas.
        </p>
      </div>

      <Barra activa={seccion.pestana} />
    </main>
  )
}

function Cifra({ etiqueta, valor, punto }: { etiqueta: string; valor: string; punto: string }) {
  return (
    <div className="flex-1 rounded-[18px] border border-borde bg-superficie px-4 py-3">
      <p className="flex items-center gap-2 text-[13px] font-extrabold tracking-widest text-tenue">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: punto }} />
        {etiqueta}
      </p>
      <p className="mt-1.5 text-[23px] font-extrabold tracking-tight">{valor}</p>
    </div>
  )
}

function suma(lista: { importe: number }[]): number {
  return lista.reduce((t, m) => t + Number(m.importe), 0)
}

/*
  Los tres apartamentos, escritos a mano.

  Es la red de seguridad, y solo se usa si las unidades todavía no
  están en la base de datos. En cuanto lo estén, esto no lo mira
  nadie — y desaparecerá cuando ya no haya forma de volver atrás.
*/
const APARTAMENTOS_DE_SIEMPRE = [
  { id: 'a1', nombre: 'Helechos 1', orden: 1 },
  { id: 'a2', nombre: 'Helechos 2', orden: 2 },
  { id: 'a3', nombre: 'Helechos 3', orden: 3 },
]

/*
  Las cuentas de cada unidad.

  ─────────────────────────────────────────────────────────────
  LO COMÚN SE REPARTE… CUANDO REPARTIRLO DICE ALGO.

  Un gasto que no es de ninguna unidad —la luz, el seguro, la
  gestoría— es de todas a la vez. Dejarlo fuera haría que todas
  parecieran más rentables de lo que son, y la suma de las partes no
  cuadraría con el balance de arriba.

  En Los Helechos se divide a partes iguales, que es lo honesto
  cuando los tres apartamentos se alquilan igual.

  PERO EN UNAS OBRAS ESO SERÍA MENTIR. Partir la gasolina del mes
  entre una reforma de 40.000 € y un baño de 3.000 no dice nada de
  ninguna de las dos. Por eso repartir es una decisión de cada
  sección y no una regla del programa — y por defecto, no se reparte.

  Se avisa siempre en pantalla, debajo. Un número repartido sin
  decirlo es un número que engaña.

  ─────────────────────────────────────────────────────────────
  POR QUÉ UN APUNTE PUEDE ENCONTRARSE POR DOS CAMINOS

  Lo normal es `unidad_id`. Pero las pantallas de apuntar todavía
  guardan el número de apartamento, así que un movimiento nuevo llega
  sin unidad. Si solo se mirara `unidad_id`, esos apuntes recién
  hechos desaparecerían del desglose sin dar ningún error — y el
  primero en notarlo sería Juan Miguel, no nosotros.

  Así que si no trae unidad, se busca por el número. Este segundo
  camino se quita cuando las pantallas de apuntar guarden la unidad.
*/
function repartir(
  movimientos: Movimiento[],
  unidades: { id: string; nombre: string; orden: number }[],
  reparte: boolean
) {
  const esSuyo = (m: Movimiento, u: { id: string; orden: number }) =>
    m.unidad_id ? m.unidad_id === u.id : m.apartamento === u.orden

  const deNadie = (m: Movimiento) => m.unidad_id == null && m.apartamento == null

  const comunes = suma(movimientos.filter((m) => m.tipo === 'gasto' && deNadie(m)))
  const cadaUno = reparte && unidades.length > 0 ? comunes / unidades.length : 0

  const casas = unidades.map((u) => {
    const suyos = movimientos.filter((m) => esSuyo(m, u))
    const reservas = suyos.filter((m) => m.tipo === 'ingreso')
    const ingresos = suma(reservas)
    const gastos = suma(suyos.filter((m) => m.tipo === 'gasto')) + cadaUno

    return {
      id: u.id,
      nombre: u.nombre,
      ingresos,
      gastos,
      balance: ingresos - gastos,
      reservas: reservas.length,
      noches: reservas.reduce((t, m) => t + (m.noches ?? 0), 0),
      personas: reservas.reduce((t, m) => t + (m.personas ?? 0), 0),
    }
  })

  // La barra más larga marca la escala: así se comparan entre sí.
  const tope = Math.max(...casas.map((c) => c.ingresos + c.gastos), 0)

  return { casas, comunes, tope, reparte, cuantas: unidades.length }
}

function agrupar(
  lista: Movimiento[],
  porId: Map<string, { nombre: string }>
): { nombre: string; total: number }[] {
  const mapa = new Map<string, number>()
  for (const m of lista) {
    const nombre = m.categoria_id ? (porId.get(m.categoria_id)?.nombre ?? 'Otros') : 'Otros'
    mapa.set(nombre, (mapa.get(nombre) ?? 0) + Number(m.importe))
  }
  return [...mapa.entries()]
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
}
