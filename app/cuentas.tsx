import Link from '@/app/enlace'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { calcular, euros, eurosRedondo, type Vista } from '@/lib/periodos'
import { fechaBreve } from '@/lib/carpetas'
import { nombreApartamento } from '@/lib/reservas'
import { unidadesDe, comoEsLaSeccion } from '@/lib/unidades'
import Barra from './barra'
import Cabecera from './cabecera'
import Encabezado from './encabezado'
import { Ico, type Icono } from './iconos'
import {
  Aviso,
  BotonPrincipal,
  Fila,
  PastillaAmbito,
  Pildora,
  Vacio,
  type Ambito,
} from './piezas'
import { hoyAqui } from '@/lib/tablon'
import { elEspacio, elEspacioO } from '@/lib/espacio'
import {
  cuentaDelImpuesto,
  comoSeLlama,
  esImpuesto,
  type Impuesto,
} from '@/lib/impuesto'

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
  /*
    El color de ámbito, apagado. Antes venían `color` y `fondo` en
    hexadecimal —los cinco saturados del manual antiguo— y con ellos se
    pintaba la pastilla, las píldoras del periodo Y el relleno de los
    botones. Un mismo color haciendo de identidad y de acción a la vez
    es lo que hacía que ninguno de los dos se leyera.

    Ahora el color solo identifica, y va donde tiene que ir: la
    pastilla del icono y nada más.
  */
  ambito: Ambito
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
  /* Del SQL 46. Nulo = este apunte no está desglosado. */
  impuesto_cuota?: number | null
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
  const espacio = await elEspacioO(supabase)
  const conCuentas = await supabase
    .from('categorias')
    .select(`${campos}, lleva_cuentas`)
    .eq('hogar_id', espacio)
  if (conCuentas.error) {
    const basico = await supabase.from('categorias').select(campos).eq('hogar_id', espacio)
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

  /* En cascada, de más a menos: con impuesto y unidad, solo con unidad,
     y pelado. Cada columna nueva que se añade aquí es una forma más de
     que la pantalla entera se quede en blanco el día que falte un SQL,
     así que ninguna es obligatoria. */
  const conTodo = await supabase
    .from('movimientos')
    .select(`${columnas}, unidad_id, impuesto_cuota`)
    .eq('hogar_id', await elEspacioO(supabase))
    .gte('fecha', periodo.desde)
    .lte('fecha', periodo.hasta)
    .order('fecha', { ascending: false })

  if (!conTodo.error && conTodo.data) data = conTodo.data

  const conUnidad = data
    ? { error: null, data }
    : await supabase
    .from('movimientos')
    .select(`${columnas}, unidad_id`)
    .eq('hogar_id', await elEspacioO(supabase))
    .gte('fecha', periodo.desde)
    .lte('fecha', periodo.hasta)
    .order('fecha', { ascending: false })

  if (conUnidad.error) {
    const sinUnidad = await supabase
      .from('movimientos')
      .select(columnas)
      .eq('hogar_id', await elEspacioO(supabase))
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
    ── LO QUE NO ES NI GANANCIA NI GASTO ──

    El IGIC o el IVA que ha pasado por aquí. Va aparte del balance a
    propósito: no es dinero de la casa, es dinero de paso que hay que
    liquidar. Meterlo en el balance haría parecer más rico a quien
    factura mucho justo antes de tener que ingresarlo.

    Si la casa no lleva impuesto —lo normal— esto no sale ni se calcula.
  */
  let impuestoCasa: Impuesto = 'ninguno'
  try {
    const casa = await elEspacio(supabase)
    if (casa) {
      const { data: fila } = await supabase
        .from('hogares')
        .select('impuesto')
        .eq('id', casa)
        .maybeSingle()
      if (fila && esImpuesto(fila.impuesto)) impuestoCasa = fila.impuesto
    }
  } catch {
    /* Sin la columna todavía: como siempre, sin impuesto. */
  }

  const cuentaImpuesto =
    impuestoCasa === 'ninguno' ? null : cuentaDelImpuesto(movimientos)

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
      .eq('hogar_id', await elEspacioO(supabase))
      .in('categoria_id', dentro)
      .is('eliminado_en', null)

    cuantosPapeles = count ?? 0
  }

  /*
    ── LOS SEGMENTOS DEL PERIODO, ESCRITOS UNA VEZ ──

    En el móvil van en el cuerpo, encima de las cifras. En grande van
    en la banda de arriba, debajo del nombre. Es el mismo control y el
    mismo enlace: escribirlo dos veces sería tener dos sitios donde
    arreglar el mismo `ancla`.

    Eran de 44 px —por debajo del suelo de 48 del propio CSS— y se
    rellenaban del color de la sección. Ahora son las del sistema: la
    elegida se rellena de tinta, igual en todas las pantallas.
  */
  const segmentos = (
    <div className="flex gap-2" role="group" aria-label="Periodo">
      {(['mes', 'trimestre', 'anio'] as const).map((v) => (
        <Pildora
          key={v}
          href={`${seccion.ruta}?vista=${v}&ancla=${periodo.desde}`}
          puesta={v === vista}
          className="flex-1"
        >
          {v === 'mes' ? 'Mes' : v === 'trimestre' ? 'Trimestre' : 'Año'}
        </Pildora>
      ))}
    </div>
  )

  return (
    <main className="min-h-screen pb-40 lg:pb-16">
      <Cabecera ancho>
        <div className="lg:hidden">
        <div className="flex h-14 items-center gap-3">
          <PastillaAmbito icono={seccion.icono} ambito={seccion.ambito} tam={44} />
          <h1 className="t-titulo min-w-0 truncate">{seccion.nombre}</h1>

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
              className="ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-tenue"
            >
              <Ico nombre="lapiz" tam={20} grosor={2.2} />
            </Link>
          )}
        </div>
        </div>

        {/*
          En grande, la banda común de HUBI: el nombre de la actividad
          a la izquierda con su pastilla, los segmentos debajo y a su
          tamaño, y a la derecha lo único que se viene a HACER aquí —
          apuntar un movimiento— junto al lápiz de cómo se lleva.
        */}
        <Encabezado
          icono={seccion.icono}
          ambito={seccion.ambito}
          titulo={seccion.nombre}
          controles={segmentos}
          accion={{
            texto: 'Apuntar un movimiento',
            href: `/finca/apuntar?seccion=${seccion.raiz ?? 'resto'}`,
            icono: 'mas',
          }}
          extra={
            raiz ? (
              <Link
                href={`/seccion/${raiz.id}/ajustes`}
                aria-label={`Cómo llevas ${seccion.nombre}`}
                className="flex h-12 w-12 items-center justify-center rounded-[16px] text-tenue"
              >
                <Ico nombre="lapiz" tam={20} grosor={2.2} />
              </Link>
            ) : undefined
          }
        />
      </Cabecera>

      <div className="columna pt-1">

        {/* ── Qué periodo ── */}
        {/* Eran de 44 px —por debajo del suelo de 48 del propio CSS— y
            se rellenaban del color de la sección. Ahora son las del
            sistema: la elegida se rellena de tinta, igual en todas las
            pantallas. */}
        <div className="lg:hidden">{segmentos}</div>

        {/* ── Cuál ──
            Con techo en grande: una fila de tres elementos —flecha,
            título, flecha— repartida en mil cien píxeles deja el
            título solo en mitad del papel y las flechas en los
            bordes, a un palmo de distancia de lo que mueven. */}
        <div className="mt-3 flex items-center justify-between lg:mt-4 lg:max-w-[440px]">
          <Link
            href={`${seccion.ruta}?vista=${vista}&ancla=${periodo.anterior}`}
            aria-label="Periodo anterior"
            className="flex h-12 w-12 items-center justify-center text-tenue"
          >
            <Ico nombre="atras" tam={21} grosor={2.4} />
          </Link>
          <p className="t-tarjeta">{periodo.titulo}</p>
          {periodo.siguiente ? (
            <Link
              href={`${seccion.ruta}?vista=${vista}&ancla=${periodo.siguiente}`}
              aria-label="Periodo siguiente"
              className="flex h-12 w-12 items-center justify-center text-tenue"
            >
              <Ico nombre="flecha" tam={21} grosor={2.4} />
            </Link>
          ) : (
            <span className="flex h-12 w-12 items-center justify-center text-apagado">
              <Ico nombre="flecha" tam={21} grosor={2.4} />
            </span>
          )}
        </div>

        {/*
          ── LOS TRES NÚMEROS ──

          En el móvil: Ingresos y Gastos a mitad y mitad, y el Balance
          debajo a lo ancho, porque es el que se viene a mirar.

          En grande, LOS TRES IGUALES en una fila. Dos tarjetas de 550
          px y una de 1100 debajo no es jerarquía: es lo que queda al
          estirar una pantalla pensada para 360. Los tres son la misma
          clase de dato —el dinero del periodo— y se comparan mejor
          alineados. El Balance sigue destacando por donde tiene que
          destacar: su cifra es más grande y va en color.
        */}
        <div className="mt-3 lg:grid lg:grid-cols-3 lg:gap-4">
        <div className="flex gap-2.5 lg:contents">
          <Cifra etiqueta="Ingresos" valor={eurosRedondo(ingresos)} punto="bien" />
          <Cifra etiqueta="Gastos" valor={eurosRedondo(gastos)} punto="alerta" />
        </div>

        {/*
          ═══════════════════════════════════════════════════════
          EL BALANCE DEJA DE SER UNA TARJETA VIOLETA
          ═══════════════════════════════════════════════════════

          Iba con un degradado `#8B5CF6 → #7C4DEC` y texto blanco. Y
          exactamente el mismo degradado se usaba en la tarjeta de
          «horas de más» de quien ayuda en casa: mismo formato, mismo
          color, mismo tamaño de cifra — una es dinero y la otra es
          tiempo. Cuando dos cosas sin relación se pintan igual, el
          color ha dejado de informar.

          Ahora es papel con borde, como todo lo demás, y el color va
          donde sí dice algo: EL SIGNO. Verde si sobra, coral si falta.
          Eso es lo que se viene a mirar.
        */}
        <div className="mt-2.5 rounded-[20px] border border-borde bg-superficie px-4 py-4 lg:mt-0">
          <p className="rotulo">Balance</p>
          <p
            className="t-cifra mt-2"
            style={{ color: balance >= 0 ? 'var(--t-bien)' : 'var(--t-alerta)' }}
          >
            {eurosRedondo(balance, true)}
          </p>
        </div>
        </div>

        {/*
          ══════════════════════════════════════════════════════════
          EL CUERPO, EN DOS COLUMNAS DE VERDAD
          ══════════════════════════════════════════════════════════

          Dos columnas y no una rejilla de celdas sueltas: cada columna
          es un `div` que apila lo suyo. Con celdas, una fila valdría lo
          que midiera la más alta de las dos, y el IVA —que lleva
          cobrado, pagado y a veces un aviso— dejaría medio palmo de
          papel en blanco al lado del desglose.

          IZQUIERDA · EL DINERO. En qué se ha gastado y los
          movimientos, uno debajo del otro. Es la pregunta larga: la
          forma del gasto y los hechos que la componen, juntos, sin
          tener que subir y bajar para comparar.

          DERECHA · LO DEMÁS DE LA ACTIVIDAD. El impuesto, los pagos
          fijos, los papeles y cada unidad. Son cuatro puertas y un
          dato, no una lectura: viven en una banda estrecha y no
          estorban.

          En el móvil son dos `div` seguidos y el orden no cambia ni
          una línea.
        */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">

        <div className="lg:col-start-2 lg:row-start-1">

        {/*
          ── EL IGIC O EL IVA DEL PERIODO ──

          Debajo del balance y visiblemente aparte, con otro color y sin
          número gigante. La jerarquía dice lo que hay que entender: el
          balance es tu dinero, esto no. Es dinero que está de paso.

          Y los apuntes sin desglosar se cuentan a la vista en vez de
          repartirse a ojo. Decir «se deben 340 €» escondiendo que hay
          doce facturas sin tipo sería dar por buena una cuenta que no
          lo es — y esta pantalla la va a mirar una gestoría.
        */}
        {cuentaImpuesto && (
          <div className="mt-2.5 rounded-[20px] border border-borde bg-superficie px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="rotulo">{comoSeLlama(impuestoCasa)}</p>
              <p
                className="t-cifra-2"
                style={{
                  color: cuentaImpuesto.diferencia >= 0 ? 'var(--t-alerta)' : 'var(--t-bien)',
                }}
              >
                {eurosRedondo(Math.abs(cuentaImpuesto.diferencia))}
              </p>
            </div>

            <p className="t-apoyo mt-1 text-tinta-suave">
              {cuentaImpuesto.diferencia >= 0 ? 'A ingresar' : 'A devolver'}
            </p>

            <div className="mt-3 flex gap-2.5 border-t border-borde pt-3">
              <span className="min-w-0 flex-1">
                <span className="rotulo block">Cobrado</span>
                <span className="t-cuerpo mt-1 block font-extrabold tabular-nums">
                  {eurosRedondo(cuentaImpuesto.repercutido)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="rotulo block">Pagado</span>
                <span className="t-cuerpo mt-1 block font-extrabold tabular-nums">
                  {eurosRedondo(cuentaImpuesto.soportado)}
                </span>
              </span>
            </div>

            {/* Coral era el color de «esto está mal». Un apunte sin
                desglosar no está mal: está a medias, y eso es
                atención, no alerta. */}
            {cuentaImpuesto.sinDesglosar > 0 && (
              <div className="mt-3">
                <Aviso
                  tono="atencion"
                  titulo={
                    cuentaImpuesto.sinDesglosar === 1
                      ? 'Hay 1 apunte sin desglosar'
                      : `Hay ${cuentaImpuesto.sinDesglosar} apuntes sin desglosar`
                  }
                  explicacion="No están contados en esta cuenta. Al ponerles el tipo, entran solos."
                />
              </div>
            )}
          </div>
        )}

        {/*
          ── LO QUE SE PAGA SIEMPRE ──

          Junto al balance y no escondido en Ajustes, porque es dinero y
          se mira como se mira el balance. Aquí es donde alguien se
          pregunta «¿y el recibo de la luz de este mes?» — que es
          justamente la pregunta que contesta esa pantalla.
        */}
        <div className="mt-2.5">
          <Fila href="/pagos" alto="alta">
            <PastillaAmbito icono="reloj" ambito="violeta" tam={44} />
            <span className="min-w-0 flex-1">
              <span className="t-tarjeta block truncate">Pagos fijos</span>
              <span className="t-apoyo mt-0.5 block truncate">
                Lo que se paga todos los meses
              </span>
            </span>
            <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
          </Fila>
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
          <div className="mt-2.5">
            <Fila href={`/documentos/carpeta/${carpetaPapeles.id}`} alto="alta">
              <PastillaAmbito icono="papel" ambito={seccion.ambito} />
              <span className="min-w-0 flex-1">
                <span className="t-tarjeta block truncate">Papeles</span>
                <span className="t-apoyo block truncate">
                  {cuantosPapeles === 0
                    ? 'Contratos, seguros, licencias…'
                    : `${cuantosPapeles} ${cuantosPapeles === 1 ? 'papel guardado' : 'papeles guardados'} · todos los años`}
                </span>
              </span>
              <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
            </Fila>
          </div>
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
                    <p className="t-tarjeta min-w-0 truncate">{c.nombre}</p>
                    <p
                      className="t-cifra-2 shrink-0"
                      style={{ color: c.balance >= 0 ? 'var(--t-bien)' : 'var(--t-alerta)' }}
                    >
                      {eurosRedondo(c.balance, true)}
                    </p>
                  </div>

                  <p className="t-apoyo mt-1">
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
                        background: 'var(--t-bien)',
                      }}
                    />
                    <div
                      className="h-2.5"
                      style={{
                        width: `${casas.tope > 0 ? (c.gastos / casas.tope) * 100 : 0}%`,
                        background: 'var(--t-alerta)',
                      }}
                    />
                  </div>

                  <p className="t-apoyo mt-2.5 text-tinta-suave">
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
                <p className="t-apoyo mt-3">
                  Incluye {euros(casas.comunes)} de gastos comunes —luz, seguro,
                  gestoría— repartidos a partes iguales entre{' '}
                  {casas.cuantas === 2 ? 'las dos' : `las ${casas.cuantas}`}.
                </p>
              ) : (
                <p className="t-apoyo mt-3">
                  Aparte hay {euros(casas.comunes)} de gastos comunes que no son de
                  ninguna en concreto. No se reparten: sí cuentan en el balance de
                  arriba.
                </p>
              ))}
          </section>
        )}

        </div>

        <div className="lg:col-start-1 lg:row-start-1">

        {/* ── En qué se ha ido ── */}
        {desglose.length > 0 && (
          <section className="mt-5">
            <h2 className="rotulo">En qué se ha gastado</h2>
            <ul className="mt-3">
              {desglose.map((d) => (
                <li key={d.nombre} className="mb-3.5">
                  <div className="t-cuerpo flex items-baseline justify-between gap-4 font-extrabold">
                    <span className="min-w-0 truncate">{d.nombre}</span>
                    <span className="shrink-0 tabular-nums">{euros(d.total)}</span>
                  </div>
                  <div
                    className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-borde"
                    role="img"
                    aria-label={`${d.nombre}: ${euros(d.total)}`}
                  >
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${mayor > 0 ? Math.max(4, (d.total / mayor) * 100) : 0}%`,
                        background: 'var(--t-alerta)',
                      }}
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
            <div className="mt-3">
              <Vacio
                titulo={`No hay nada apuntado en ${periodo.titulo.toLowerCase()}`}
                explicacion="Las facturas con importe entran solas al guardarlas."
              />
            </div>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {movimientos.map((m) => (
                <li
                  key={m.id}
                  className="flex min-h-[64px] items-center justify-between gap-3 rounded-[20px] border border-borde bg-superficie px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="t-cuerpo truncate font-extrabold">{m.concepto}</p>
                    <p className="t-apoyo">
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
                      <p className="t-apoyo">
                        {m.noches} {m.noches === 1 ? 'noche' : 'noches'}
                        {m.personas != null
                          ? ` · ${m.personas} ${m.personas === 1 ? 'persona' : 'personas'}`
                          : ''}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {/* El signo LO DICE el color y también el símbolo:
                        quien no distinga verde de coral sigue viendo
                        el + y el −. Nunca solo el color. */}
                    <p
                      className="t-cuerpo font-extrabold tabular-nums"
                      style={{
                        color: m.tipo === 'ingreso' ? 'var(--t-bien)' : 'var(--t-alerta)',
                      }}
                    >
                      {m.tipo === 'ingreso' ? '+' : '−'}
                      {euros(m.importe)}
                    </p>
                    {m.documento_id && (
                      <Link href={`/documentos/${m.documento_id}`} className="t-apoyo font-extrabold">
                        Ver papel
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>

        </div>

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
        {/* SOLO EN EL MÓVIL. En grande esta acción vive arriba a la
            derecha, en la banda: aquí abajo, después de toda la lista
            de movimientos, quedaba flotando en mitad del papel a media
            pantalla de lo que se estaba leyendo. */}
        <div className="mt-5 lg:hidden">
          <BotonPrincipal
            href={`/finca/apuntar?seccion=${seccion.raiz ?? 'resto'}`}
            icono="mas"
          >
            Apuntar un movimiento
          </BotonPrincipal>
        </div>

        {/* Sin `pr-24`: ese hueco a la derecha estaba para esquivar el
            botón de voz, que ahora va pegado a la barra de abajo y ya
            no pasa por aquí. Descentraba la frase sin motivo. */}
        {/* El hueco a la derecha SÍ hace falta: el botón de voz flota
            justo encima de la barra y se comía el final de la frase —
            «entran aquí solas» quedaba tapado por él. */}
        <p className="t-apoyo mt-3 px-14 text-center">
          Un gasto o un ingreso. Las facturas con importe entran solas.
        </p>
      </div>

      {/* Las actividades viven ahora dentro de Cuentas: estando en la
          Finca, la pestaña que está encendida es Cuentas. */}
      <Barra activa="cuentas" />
    </main>
  )
}

/*
  Ingresos y gastos, uno al lado del otro.

  El punto de color es la leyenda de las barras de más abajo: verde lo
  que entra, coral lo que sale. La cifra en sí va en tinta — el color
  ya lo lleva el punto, y repetirlo en el número sería decir dos veces
  lo mismo y a costa de la legibilidad.
*/
function Cifra({
  etiqueta,
  valor,
  punto,
}: {
  etiqueta: string
  valor: string
  punto: 'bien' | 'alerta'
}) {
  return (
    <div className="flex-1 rounded-[20px] border border-borde bg-superficie px-4 py-3">
      <p className="rotulo flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: `var(--t-${punto})` }}
        />
        {etiqueta}
      </p>
      <p className="t-cifra-2 mt-2">{valor}</p>
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
