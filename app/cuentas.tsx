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
  /**
   * El `segmento_drive` de la categoría raíz: FINCA, HELECHOS…
   *
   * O `null`, que significa **todo lo que no es una actividad**: la
   * Casa, los Vehículos, los Seguros, lo Personal. Ésas no tienen una
   * raíz propia que sumar —son varias— y hasta hoy no tenían cuentas
   * de ninguna clase, aunque llevaran meses apuntando gastos.
   */
  raiz: string | null
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

  /*
    `lleva_cuentas` es del SQL 27 y hace falta para saber cuáles son
    las actividades. Como siempre: si la columna no está, Postgres no
    dice «esa columna no existe», rechaza la consulta ENTERA — y esta
    pantalla enseñaría cero euros con las cuentas del trimestre
    intactas debajo. Se pide con ella, y si no puede ser, sin ella.
  */
  const campos = 'id, padre_id, nombre, segmento_drive, activa, naturaleza'
  type Cat = {
    id: string
    padre_id: string | null
    nombre: string
    segmento_drive: string
    activa?: boolean | null
    naturaleza?: string | null
    lleva_cuentas?: boolean
  }

  let todas: Cat[] = []
  const conCuentas = await supabase.from('categorias').select(`${campos}, lleva_cuentas`)
  if (conCuentas.error) {
    const basico = await supabase.from('categorias').select(campos)
    todas = (basico.data ?? []) as Cat[]
  } else {
    todas = (conCuentas.data ?? []) as Cat[]
  }

  const porId = new Map(todas.map((c) => [c.id, c]))

  /** La raíz de la que cuelga una categoría. */
  function raizDe(c: Cat): Cat {
    let actual = c
    while (actual.padre_id) {
      const padre = porId.get(actual.padre_id)
      if (!padre) break
      actual = padre
    }
    return actual
  }

  // Solo cuenta lo que cuelga de esta sección: el seguro del coche es
  // un gasto de la casa, no de la finca ni de Los Helechos.
  const raiz = seccion.raiz
    ? (todas.find((c) => c.segmento_drive === seccion.raiz && !c.padre_id) ?? null)
    : null

  const deFinca = new Set<string>()
  for (const c of todas) {
    const suRaiz = raizDe(c)
    if (seccion.raiz ? suRaiz.id === raiz?.id : suRaiz.lleva_cuentas !== true) {
      deFinca.add(c.id)
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

  /*
    ── A QUÉ ALTURA SE DESGLOSA ──

    Dentro de una actividad, por la carpeta final: Agua, Luz,
    Productos. Son siete y se leen de un vistazo.

    En las cuentas de casa no vale lo mismo. Ahí cuelgan cinco raíces
    con sus hojas —Alimentación, Menaje, Limpieza, ITV, Impuestos,
    Personales…— y saldrían treinta renglones de dos euros cada uno.
    Lo que se quiere saber es en QUÉ se va: la compra, las
    reparaciones, el restaurante, el coche. Eso es el segundo nivel.

    Cuando dos coinciden de nombre —«Casa» es a la vez una raíz y un
    seguro— se les pone delante de dónde vienen. Solo a ésos: poner
    «Casa · Compras» en todas las líneas sería ruido en las diez que
    no lo necesitan.
  */
  const desglose = seccion.raiz
    ? agrupar(movimientos.filter((m) => m.tipo === 'gasto'), porId)
    : porGrupo(movimientos.filter((m) => m.tipo === 'gasto'), porId)

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

  /*
    ═══════════════════════════════════════════════════════════
    LOS PAPELES DE LA ACTIVIDAD
    ═══════════════════════════════════════════════════════════

    El contrato de alquiler. La póliza del seguro de la finca. La
    licencia de obra. La escritura.

    Hasta ahora una actividad solo tenía dos cosas dentro —Gastos e
    Ingresos— y las dos son dinero, así que estos papeles no tenían
    dónde ir. El que los metía en Gastos para tener un sitio le sumaba
    al balance un dinero que nunca salió.

    Van en su propia carpeta, de naturaleza 'neutro', y por eso NO
    tocan ninguno de los números de arriba: al guardar un papel con
    importe solo se apunta un movimiento si la carpeta es de gasto o
    de ingreso. Un contrato de 9.000 € se guarda entero y el balance
    ni se entera.

    ─────────────────────────────────────────────────────────
    Y NO SE FILTRAN POR TRIMESTRE

    Todo lo de arriba es del periodo elegido, porque el dinero es de
    un mes. Un contrato no. El contrato firmado en 2019 sigue siendo
    EL contrato en 2026, y esconderlo por estar mirando este trimestre
    sería esconder justo lo que se venía a buscar.
  */
  const carpetaPapeles = raiz
    ? (todas.find(
        (c) =>
          c.padre_id === raiz.id && c.segmento_drive === 'DOCUMENTOS' && c.activa !== false
      ) ?? null)
    : null

  let cuantosPapeles = 0
  if (carpetaPapeles) {
    const dentro = [carpetaPapeles.id]
    for (const c of todas) {
      if (c.padre_id === carpetaPapeles.id && c.activa !== false) dentro.push(c.id)
    }

    const { count } = await supabase
      .from('documentos')
      .select('id', { count: 'exact', head: true })
      .in('categoria_id', dentro)
      .is('eliminado_en', null)

    cuantosPapeles = count ?? 0
  }

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

          {/*
            Cómo se lleva esta actividad: si va por partes, cómo se
            llama cada una, y sus partidas. Va aquí, al lado de su
            nombre, y no escondido en los Ajustes de la aplicación:
            esto es de ESTA finca, no de HUBI.

            Solo sale en las que tienen ficha propia —las que vienen
            de la base de datos—, no en el respaldo antiguo.
          */}
          {raiz && (
            <Link
              href={`/seccion/${raiz.id}/ajustes`}
              aria-label={`Cómo llevas ${seccion.nombre}`}
              className="ml-auto flex h-12 w-12 items-center justify-center rounded-[14px] text-tenue"
            >
              <Ico nombre="lapiz" tam={20} grosor={2.2} />
            </Link>
          )}
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

        {/*
          ── LOS PAPELES ──

          Va aquí, justo debajo del balance y por encima de todo lo
          demás, porque es el TERCER pilar de la actividad y no una
          nota al pie: Gastos, Ingresos y los papeles que la actividad
          tiene por ser lo que es.

          Y no es una cifra más. Es una fila entera, con su icono y su
          flecha, para que se lea como una puerta y no como un dato:
          aquí no hay nada que sumar, hay algo que abrir.
        */}
        {carpetaPapeles && (
          <Link
            href={`/documentos/carpeta/${carpetaPapeles.id}`}
            className="mt-2.5 flex items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-4 py-3.5"
          >
            <Pastilla nombre="papel" color={seccion.color} fondo={seccion.fondo} tam={44} icono={22} />
            <span className="min-w-0 flex-1">
              <span className="block text-[18px] font-extrabold tracking-tight">Documentos</span>
              <span className="block text-[14.5px] font-semibold text-tenue">
                {cuantosPapeles === 0
                  ? 'Contratos, seguros, licencias…'
                  : `${cuantosPapeles} ${cuantosPapeles === 1 ? 'papel guardado' : 'papeles guardados'} · todos los años`}
              </span>
            </span>
            <Ico nombre="flecha" tam={20} grosor={2.4} />
          </Link>
        )}

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

        {/*
          «UN MOVIMIENTO», NO «UN GASTO».

          El botón decía «Apuntar un gasto» y la primera pregunta de la
          pantalla siguiente es «¿un gasto o un ingreso?». O sea: el
          botón daba por decidido algo que se decide justo después.

          Quien viene a apuntar el alquiler de un piso —un ingreso—
          leía «Apuntar un gasto» y no tocaba, porque no es lo que
          quiere hacer. Y encima el rótulo de arriba de la lista ya
          dice MOVIMIENTOS: son la misma cosa llamada de dos maneras
          en la misma pantalla.
        */}
        <Link
          href={`/finca/apuntar?seccion=${seccion.raiz ?? 'resto'}`}
          className="mt-5 flex h-[60px] items-center justify-center gap-2.5 rounded-[18px] bg-boton text-[18px] font-extrabold text-boton-texto"
        >
          <Ico nombre="mas" tam={22} grosor={2.3} />
          Apuntar un movimiento
        </Link>

        {/* Sin `pr-24`: ese hueco a la derecha estaba para esquivar el
            botón de voz, que ahora va pegado a la barra de abajo y ya
            no pasa por aquí. Descentraba la frase sin motivo. */}
        {/* El hueco a la derecha SÍ hace falta: el botón de voz flota
            justo encima de la barra y se comía el final de la frase —
            «entran aquí solas» quedaba tapado por él. */}
        <p className="mt-3 px-14 text-center text-[14.5px] font-semibold leading-snug text-tenue">
          Un gasto o un ingreso. Las facturas con importe entran solas.
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

/*
  El desglose de las cuentas de casa, por el segundo nivel.

  Se sube desde la carpeta donde está el gasto hasta encontrar la que
  cuelga directamente de una raíz. Un ticket en «Casa → Compras →
  Alimentación» cuenta como **Compras**; la ITV cuenta como **ITV**,
  porque ya está en el segundo nivel.

  Y al final se desempata: dos grupos que se llamen igual llevan
  delante su raíz. Solo ésos.
*/
function porGrupo(
  lista: Movimiento[],
  porId: Map<string, { id: string; padre_id: string | null; nombre: string }>
): { nombre: string; total: number }[] {
  const totales = new Map<string, { nombre: string; raiz: string; total: number }>()

  for (const m of lista) {
    let actual = m.categoria_id ? porId.get(m.categoria_id) : undefined
    let raizNombre = actual?.nombre ?? 'Otros'

    /* Subir hasta que el padre sea una raíz. Si el gasto está en la
       propia raíz —cosa rara pero posible— se queda en ella. */
    while (actual?.padre_id) {
      const padre = porId.get(actual.padre_id)
      if (!padre) break
      raizNombre = padre.nombre
      if (!padre.padre_id) break
      actual = padre
    }

    const clave = actual?.id ?? 'otros'
    const antes = totales.get(clave)
    totales.set(clave, {
      nombre: actual?.nombre ?? 'Otros',
      raiz: raizNombre,
      total: (antes?.total ?? 0) + Number(m.importe),
    })
  }

  const filas = [...totales.values()]
  const cuantos = new Map<string, number>()
  for (const f of filas) cuantos.set(f.nombre, (cuantos.get(f.nombre) ?? 0) + 1)

  return filas
    .map((f) => ({
      nombre: (cuantos.get(f.nombre) ?? 0) > 1 ? `${f.raiz} · ${f.nombre}` : f.nombre,
      total: f.total,
    }))
    .sort((a, b) => b.total - a.total)
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
