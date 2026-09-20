import Link from '@/app/enlace'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Anadir from "./anadir"
import Cabecera from '../cabecera'
import Encabezado from '../encabezado'
import { Ico } from '../iconos'
import { Fila, Vacio, Aviso, PastillaAmbito, seccionPintada } from '../piezas'
import MappelCaja from '../mappel-caja'
import { Tabla, Renglon, Punto, Nombre, Dato, Cifra } from '../tabla'
import ElPapel from '../papel-panel'
import { euros } from '@/lib/periodos'
import { elEspacioO } from '@/lib/espacio'
import { misMarcas, nuevosPorRaiz } from '@/lib/novedades'
import {
  contar,
  hijosDe,
  ramaDe,
  ultima,
  fechaBreve,
  type Categoria,
  type Documento,
} from '@/lib/carpetas'
import type { Ambito } from '@/lib/ambitos'

export const dynamic = 'force-dynamic'

type Resultado = {
  id: string
  titulo: string
  fecha_documento: string
  importe: number | null
  proveedor: string | null
  categoria_id: string
}

/* Sin cruces. El nombre y el color de la carpeta se sacan del árbol de
   categorías que esta pantalla ya pide por su cuenta: pedirlos
   cruzados era lo que hacía fallar la búsqueda entera. */
const CAMPOS =
  'id, titulo, fecha_documento, importe, proveedor, categoria_id'

export default async function Documentos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; carpeta?: string; papel?: string }>
}) {
  const { q, cat, carpeta: elegidaParam, papel: papelParam } = await searchParams
  const busqueda = (q ?? '').trim()
  const carpeta = (cat ?? '').trim()
  /*
    `carpeta` es la carpeta ELEGIDA en el escritorio, y no tiene nada
    que ver con `cat`, que es la de la búsqueda y manda a otra rama
    entera de esta pantalla. Dos parámetros y dos nombres a propósito:
    llamarlos igual habría hecho que elegir una carpeta con el ratón
    disparara una búsqueda.
  */
  const elegida = (elegidaParam ?? '').trim()

  /* Y el papel elegido dentro de ella: la tercera zona. Mismo motivo
     para que viva en la dirección que la carpeta — se copia, se
     recarga y la flecha de volver hace lo que parece. */
  const elegido = (papelParam ?? '').trim()

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  // ── Buscar ──
  if (busqueda || carpeta) {
    const { data: cats } = await supabase
      .from('categorias')
      .select('id, padre_id, nombre, segmento_drive, orden')
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('activa', true)
    const todasCat = (cats ?? []) as Categoria[]

    let encontrados: Resultado[] = []
    let comoSalio: 'carpeta' | 'exacta' | 'parecida' | 'nada' = 'nada'
    let nombreCarpeta: string | null = null
    /* El mismo cuidado que abajo: si la búsqueda revienta, no puede
       contestar "no hay nada que coincida". Eso es dar por perdido un
       papel que está guardado. */
    let averia: string | null = null

    /*
      1 · POR CARPETA — el camino exacto.

      "Enséñame todas las facturas de la finca" no es una búsqueda de
      texto: es una carpeta entera. MAPPEL sabe qué carpetas existen, así
      que cuando la voz reconoce una, no hay nada que adivinar — se
      piden TODOS los documentos que cuelgan de ella, sus subcarpetas
      incluidas. Ni uno de más ni uno de menos.

      Esto es lo que faltaba. Buscar "facturas finca" por texto sacaba
      una o ninguna porque "finca" es el nombre de una carpeta, no una
      palabra escrita dentro de la factura.
    */
    if (carpeta) {
      const dentro = [...ramaDe(todasCat, carpeta)]
      nombreCarpeta = todasCat.find((c) => c.id === carpeta)?.nombre ?? null

      const { data, error } = await supabase
        .from('documentos')
        .select(CAMPOS)
        .eq('hogar_id', await elEspacioO(supabase))
        .in('categoria_id', dentro)
        .order('fecha_documento', { ascending: false })
        .limit(200)

      averia = error?.message ?? averia
      encontrados = (data ?? []) as unknown as Resultado[]
      comoSalio = 'carpeta'
    }

    /*
      2 · POR TEXTO, con todas las palabras.

      `websearch` une las palabras con Y: tienen que estar todas. Es
      lo correcto cuando acierta, porque el resultado es preciso.
    */
    if (!carpeta && busqueda) {
      const { data, error } = await supabase
        .from('documentos')
        .select(CAMPOS)
        .eq('hogar_id', await elEspacioO(supabase))
        .textSearch('busqueda', busqueda, { config: 'spanish', type: 'websearch' })
        .order('fecha_documento', { ascending: false })
        .limit(60)

      averia = error?.message ?? averia
      encontrados = (data ?? []) as unknown as Resultado[]
      if (encontrados.length > 0) comoSalio = 'exacta'
    }

    /*
      3 · POR TEXTO, con cualquiera de ellas.

      Si exigir todas las palabras no da nada, se buscan documentos
      que tengan ALGUNA. Enseñar cinco papeles parecidos y dejar
      elegir es infinitamente mejor que un "no hay nada" delante de
      alguien que sabe perfectamente que ese papel está guardado.
    */
    if (busqueda && encontrados.length === 0) {
      const sueltas = palabras(busqueda)
      if (sueltas.length > 0) {
        const { data } = await supabase
          .from('documentos')
          .select(CAMPOS)
          .eq('hogar_id', await elEspacioO(supabase))
          .textSearch('busqueda', sueltas.join(' | '), { config: 'spanish' })
          .order('fecha_documento', { ascending: false })
          .limit(40)

        encontrados = (data ?? []) as unknown as Resultado[]
        if (encontrados.length > 0) comoSalio = 'parecida'
      }
    }

    return (
      <main className="min-h-dvh pb-40 lg:pb-16">
        <Cabecera panoramica>
          <div className="lg:hidden">
            <Titulo />
            <Buscador valor={busqueda} />
          </div>
          <Encabezado
            icono="carpeta"
            ambito="azul"
            titulo="Papeles"
            caja={<MappelCaja donde="papeles" valor={busqueda} buscarEn="/documentos" />}
            accion={{ texto: 'Guardar un papel', href: '/guardar', icono: 'foto' }}
          />
        </Cabecera>

        <div className="ancho-panoramica pt-2">

          {averia && (
            <div className="mt-4">
              <Aviso
                titulo="La búsqueda ha fallado"
                explicacion="No quiere decir que no esté guardado: quiere decir que no se ha podido buscar. Inténtalo otra vez en un momento."
              />
            </div>
          )}

          <p className="t-cuerpo mt-4 text-tinta-suave">
            {averia
              ? 'No se ha podido buscar.'
              : encontrados.length === 0
                ? `No hay nada que coincida con “${busqueda || nombreCarpeta}”.`
                : comoSalio === 'carpeta'
                  ? `${encontrados.length} ${encontrados.length === 1 ? 'papel' : 'papeles'} en ${nombreCarpeta}.`
                  : `${encontrados.length} resultado${encontrados.length === 1 ? '' : 's'}.`}{' '}
            <Link href="/documentos" className="font-bold text-verde">
              Ver las carpetas
            </Link>
          </p>

          {/* Que se sepa que esto es lo parecido, no lo pedido. */}
          {comoSalio === 'parecida' && (
            <p className="t-apoyo mt-2.5 rounded-[16px] border border-borde bg-superficie px-4 py-3">
              No hay nada con todas esas palabras. Esto es lo más parecido que
              tenemos guardado.
            </p>
          )}

          {/* Dos columnas en grande. Una carpeta entera pueden ser
              cuarenta papeles, y cuarenta renglones en una tira de 448
              px son cuatro pantallas de deslizar para ver si está el
              que buscas. */}
          <ul className="mt-4 space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:space-y-0">
            {encontrados.map((d) => {
              const c = todasCat.find((x) => x.id === d.categoria_id)
              const s = seccionPintada(c?.segmento_drive)
              return (
                <li key={d.id}>
                  <Fila href={`/documentos/${d.id}`}>
                    <PastillaAmbito icono={s.icono} ambito={s.ambito} tam={44} />
                    <span className="min-w-0 flex-1">
                      <span className="t-cuerpo block truncate font-extrabold">{d.titulo}</span>
                      <span className="t-apoyo mt-0.5 block truncate">
                        {c?.nombre ?? 'Sin carpeta'} · {fechaBreve(d.fecha_documento)}
                      </span>
                    </span>
                    <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
                  </Fila>
                </li>
              )
            })}
          </ul>
        </div>
      </main>
    )
  }

  /*
    ── Las carpetas ──

    OJO CON EL `error`. Aquí estaba el fallo de fondo de esta pantalla,
    y no era este `select`: era que nadie miraba si fallaba.

    Se escribía `const { data } = await consulta` y punto. Si la
    consulta reventaba —por una columna que ya no está, por un permiso
    nuevo, por un cruce que dejó de resolverse— `data` venía vacío y la
    pantalla decía tan tranquila "Todavía no hay papeles". Idéntico a
    no tener ninguno. Una avería así puede durar meses sin que nadie
    sepa que hay una avería: solo parece que la aplicación está vacía.

    Ahora, si algo falla, SE DICE. Un mensaje feo es infinitamente
    mejor que un vacío tranquilo, porque el vacío tranquilo hace que
    alguien piense que sus papeles no se guardaron.
  */
  const espacio = await elEspacioO(supabase)
  const [{ data: cats, error: falloCats }, { data: docs, error: falloDocs }] =
    await Promise.all([
      supabase
        .from('categorias')
        /* `lleva_cuentas` no es una columna nueva —es del SQL 27 y
           media aplicación la pide ya—, sólo que esta pantalla no la
           necesitaba hasta ahora. Es lo que separa las carpetas de
           casa de las de una actividad con cuentas. */
        .select('id, padre_id, nombre, segmento_drive, orden, lleva_cuentas')
        .eq('hogar_id', espacio)
        .eq('activa', true),
      supabase
        .from('documentos')
        /* `creado_en` y `subido_por` son para el rótulo de «nuevo»: cuándo
           llegó el papel —que no es lo mismo que la fecha que pone el
           papel— y quién lo guardó.

           `importe` es nuevo aquí, y es la única columna que hacía falta
           añadir para la tabla del escritorio: estaba en la base de
           datos y en la ficha del papel, pero esta consulta no lo pedía
           porque la lista de tarjetas no lo enseñaba. */
        .select('id, categoria_id, titulo, fecha_documento, anio, trimestre, creado_en, subido_por, importe')
        .eq('hogar_id', espacio)
        .order('fecha_documento', { ascending: false })
        .limit(5000),
    ])

  const averia = falloCats?.message ?? falloDocs?.message ?? null
  if (averia) console.error('[MAPPEL] Documentos no ha podido cargar:', averia)

  const todas = (cats ?? []) as Categoria[]
  const papeles = (docs ?? []) as (Documento & {
    titulo: string
    creado_en?: string | null
    subido_por?: string | null
    importe?: number | null
  })[]

  const secciones = hijosDe(todas, null)

  /*
    ═══════════════════════════════════════════════════════════════
    PRIMERO LO DE CASA, DESPUÉS LO QUE LLEVA CUENTAS
    ═══════════════════════════════════════════════════════════════

    Las carpetas salían todas seguidas, en el orden en que se
    sembraron, y ahí se mezclaban dos cosas que no se buscan igual:

      · CASA, SALUD, VEHÍCULOS, SEGUROS, DOCUMENTOS IMPORTANTES
        son los papeles de la vida. Se entra a buscar UNO: la póliza,
        el informe, la ITV.

      · FINCA, ALQUILERES… son actividades con cuentas. Ahí no se
        busca un papel: se revisa un trimestre, y el papel es la
        prueba de un apunte que ya está en Cuentas.

    Mezcladas, Salud aparecía la cuarta, detrás de dos actividades, y
    lo que más se busca era lo que más costaba encontrar. Separadas y
    con su rótulo, la pantalla se lee en dos golpes de vista.

    Lo de casa VA PRIMERO por una razón y no por gusto: es lo que
    busca cualquiera de los dos, y lo de las cuentas es lo que busca
    quien lleva las cuentas — que es una persona y no todos los días.

    Y si en una casa no hay ninguna actividad con cuentas, no hay dos
    grupos que separar: se queda como estaba, con un solo rótulo.
    Partir en dos una lista que no tiene dos mitades es inventarse una
    distinción.
  */
  const deCasa = secciones.filter((c) => c.lleva_cuentas !== true)
  const conCuentas = secciones.filter((c) => c.lleva_cuentas === true)

  const grupos =
    deCasa.length > 0 && conCuentas.length > 0
      ? [
          { titulo: 'Carpetas personales', lista: deCasa },
          { titulo: 'Carpetas de cuentas', lista: conCuentas },
        ]
      : [{ titulo: 'Todo, por carpetas', lista: secciones }]

  const cuantos = contar(todas, papeles)
  const ultimas = ultima(todas, papeles)

  /*
    ── LO NUEVO ──

    Esta pantalla PINTA las novedades; no las marca como vistas. Sellar
    aquí sería dar por leído todo lo que uno no ha llegado a abrir. La
    marca se pone al entrar en la sección, que es donde uno mira de
    verdad.
  */
  const marcas = await misMarcas(supabase, espacio)

  /* De cada papel a su carpeta raíz. Se calcula una vez y se consulta
     muchas: recorrer el árbol por cada papel sería subir el mismo camino
     cinco mil veces. */
  const raizPorCategoria = new Map<string, string>()
  for (const s of secciones) {
    for (const id of ramaDe(todas, s.id)) raizPorCategoria.set(id, s.id)
  }

  const nuevos = nuevosPorRaiz(
    papeles,
    (catId) => raizPorCategoria.get(catId),
    marcas,
    user.id
  )

  const nombrePorId = new Map(todas.map((c) => [c.id, c.nombre]))
  const segmentoPorId = new Map(todas.map((c) => [c.id, c.segmento_drive]))

  /*
    ═══════════════════════════════════════════════════════════════
    LO QUE HACE FALTA SÓLO EN GRANDE
    ═══════════════════════════════════════════════════════════════

    En el escritorio esta pantalla deja de ser un árbol de puertas y
    pasa a ser dos zonas: las carpetas a la izquierda y lo que hay
    dentro en una tabla, al lado. Elegir una carpeta ya no cambia de
    pantalla — rellena la zona de en medio.

    Y con eso, «Carpeta» deja de ser una pantalla distinta en un
    ordenador. La ruta `/documentos/seccion/<id>` se queda tal cual, y
    es la buena en el móvil y para un enlace: lo que cambia es que
    desde aquí ya no hace falta ir.

    Nada de esto cuesta una consulta más. Las categorías y los papeles
    ya estaban pedidos arriba para contar y para pintar lo último: lo
    único que se hace aquí es mirarlos de otra manera.
  */
  const laElegida = elegida ? todas.find((c) => c.id === elegida) ?? null : null

  /* La sección que se marca en la columna de la izquierda. Puede que lo
     elegido sea una subcarpeta —«Finca › Gastos › Luz»—, y entonces lo
     que se enciende arriba es su raíz: Finca. */
  const seccionElegida = laElegida
    ? secciones.find((s) => s.id === (raizPorCategoria.get(laElegida.id) ?? laElegida.id)) ?? null
    : null

  /* Las subcarpetas, con su recuento. Dejan de ser puertas y pasan a
     ser FILTROS: se ve lo que hay dentro de cada una sin entrar, que es
     justo lo que no se podía hacer cuando cada subcarpeta era una
     tarjeta que ponía «vacía» nueve veces seguidas. */
  const subcarpetas = seccionElegida
    ? hijosDe(todas, seccionElegida.id).map((h) => ({
        id: h.id,
        nombre: h.nombre,
        /* `contar` ya suma la rama entera de cada categoría, así que
           esto no hay que volver a recorrerlo: una subcarpeta con hijas
           ya trae los papeles de sus hijas dentro. */
        cuantos: cuantos.get(h.id) ?? 0,
      }))
    : []

  /*
    Las filas de la tabla.

    Sin carpeta elegida, los últimos de toda la casa. Con una elegida,
    los suyos y los de sus subcarpetas — por eso se mira la RAÍZ de
    cada papel y no su categoría directa: un recibo de la luz está en
    «Finca › Gastos › Luz», y quien elige «Finca» quiere verlo.

    El corte en 200 no es por la pantalla sino por el peso: pintar
    cinco mil renglones de golpe deja el navegador pensando medio
    segundo, y nadie recorre cinco mil líneas con la vista. Cuando
    haya que pasar de ahí, el sitio correcto es el buscador, que ya
    existe y está arriba.
  */
  const rama = laElegida ? ramaDe(todas, laElegida.id) : null
  const deLaCarpeta = rama ? papeles.filter((d) => rama.has(d.categoria_id)) : papeles
  const filas = deLaCarpeta.slice(0, 200)

  /*
    ═══════════════════════════════════════════════════════════════
    LA TERCERA ZONA · EL PAPEL ELEGIDO
    ═══════════════════════════════════════════════════════════════

    Éste es el cambio que más quita de esta pantalla, y se ve mejor
    contando lo que había antes: para mirar un recibo había que
    acertar cuatro veces seguidas —sección, carpeta, año, papel—, y al
    llegar, la pantalla entera se sustituía. Para ver el siguiente,
    volver atrás y repetir.

    Ahora el papel se abre AL LADO. La tabla se queda donde está, con
    su sitio marcado, y se puede ir bajando por los recibos viéndolos
    uno detrás de otro. Es la diferencia entre buscar un papel y
    revisar los papeles, que es lo que de verdad se hace aquí.

    ── LA CONSULTA, SÓLO CUANDO HAY ALGO ELEGIDO ──

    La ficha enseña cosas que la tabla no pide —el proveedor, el
    vencimiento, de qué archivo salió— y por eso va aparte. Sin nada
    elegido no se pide nada: esta pantalla hace exactamente las dos
    consultas que hacía antes.

    Y si el `papel=` de la dirección no lleva a ningún sitio —un
    enlace viejo, un papel borrado— se queda en `null` y la pantalla
    es la de siempre.
  */
  const { data: elPapelCrudo } = elegido
    ? await supabase
        .from('documentos')
        .select(
          'id, categoria_id, titulo, nombre_archivo, tipo_mime, proveedor, fecha_documento, importe, fecha_vencimiento, se_renueva'
        )
        .eq('hogar_id', espacio)
        .eq('id', elegido)
        .maybeSingle()
    : { data: null }

  const elPapel = elPapelCrudo as {
    id: string
    categoria_id: string
    titulo: string
    nombre_archivo: string | null
    tipo_mime: string | null
    proveedor: string | null
    fecha_documento: string | null
    importe: number | null
    fecha_vencimiento: string | null
    se_renueva: boolean | null
  } | null

  /* El camino de la carpeta del papel, para decir dónde está. Sale del
     árbol que ya está cargado: cero consultas. */
  const caminoDelPapel: string[] = []
  if (elPapel) {
    let actual = todas.find((c) => c.id === elPapel.categoria_id) ?? null
    while (actual) {
      caminoDelPapel.unshift(actual.nombre)
      actual = actual.padre_id ? (todas.find((c) => c.id === actual!.padre_id) ?? null) : null
    }
  }

  /*
    El panel. Se escribe una vez y se pinta en dos sitios: debajo de la
    tabla hasta 1440, y al lado desde ahí.

    ── POR QUÉ DEBAJO Y NO ESCONDIDO ──

    Porque entre 1024 y 1440 no hay sitio para tres zonas: con las
    carpetas en 220 y un panel en 340, a la tabla le quedarían 140 px.
    Y la alternativa —que el panel no exista por debajo de 1440— deja
    un clic que no hace nada, que es peor que cualquier reparto.

    La regla del sistema dice *si hay sitio para enseñar lo elegido,
    elegir lo enseña*. Aquí hay sitio, sólo que abajo en vez de al
    lado. **Pulsar siempre avanza.**
  */
  /*
    La dirección de esta pantalla con la carpeta y el papel que se le
    digan. Escrita una vez: son seis enlaces —cada carpeta, cada chip,
    cada renglón y la equis— y tenerla en seis sitios es como uno de
    ellos se queda sin el otro parámetro y elegir un papel te saca de
    la carpeta donde estabas.
  */
  function aquiCon(carpetaId: string | null, papelId: string | null): string {
    const partes: string[] = []
    if (carpetaId) partes.push(`carpeta=${encodeURIComponent(carpetaId)}`)
    if (papelId) partes.push(`papel=${encodeURIComponent(papelId)}`)
    return partes.length > 0 ? `/documentos?${partes.join('&')}` : '/documentos'
  }

  const panelDelPapel = elPapel ? (
    <ElPapel papel={elPapel} camino={caminoDelPapel} cerrar={aquiCon(elegida || null, null)} />
  ) : laElegida ? (
    <LaCarpeta nombre={laElegida.nombre} cuantos={cuantos.get(laElegida.id) ?? 0} />
  ) : null

  /*
    LO ÚLTIMO GUARDADO — la lista directa.

    Hasta ahora, para llegar a un papel había que acertar cuatro veces
    seguidas: sección correcta → carpeta correcta → año correcto →
    papel. Y si cualquiera de esos pasos contaba mal, TODO se veía
    vacío aunque los papeles estuvieran perfectamente guardados.

    Eso es exactamente lo que el punto 12 del planteamiento pide que no
    pase: "no mostrar simplemente la estructura técnica de Google
    Drive; la información visual debe proceder de nuestra base de
    datos". La pantalla enseñaba el árbol de carpetas y nada más.

    Esta lista va directa a los documentos, sin pasar por el árbol. El
    papel que acabas de fotografiar está SIEMPRE aquí arriba, a un
    toque, aunque su carpeta se llame de otra manera o esté mal
    colocada.
  */
  /*
    Seis en el móvil y DOCE en grande.

    No es un número más grande por gusto: en el móvil esta lista va
    encima de las carpetas y cada línea de más aleja la sección que
    estás buscando. En grande va en su propia columna, al lado, y la
    columna se queda a medias con seis. El corte lo hace el CSS —los
    seis últimos se esconden en el móvil—, así no hay dos consultas ni
    dos maneras de contar.
  */
  const recientes = papeles.slice(0, 8)

  return (
    <main className="min-h-dvh pb-40 lg:pb-16">
      {/*
        En el móvil, la cabecera de siempre: el título y debajo la caja
        de MAPPEL a todo lo ancho, que es donde se busca con el pulgar.

        En grande, la banda común: el título a la izquierda con su
        pastilla —como Agenda, Cuentas y El día a día, que la tenían y
        ésta no—, y a la derecha lo que se viene a hacer aquí: buscar
        un papel o guardar uno.
      */}
      <Cabecera panoramica>
        <div className="lg:hidden">
          <Titulo />
          <Buscador valor="" />
        </div>
        <Encabezado
          icono="carpeta"
          ambito="azul"
          titulo="Papeles"
          caja={<MappelCaja donde="papeles" buscarEn="/documentos" />}
          accion={{ texto: 'Guardar un papel', href: '/guardar', icono: 'foto' }}
        />
      </Cabecera>

      <div className="ancho-panoramica pt-2">

        {averia && (
          <div className="mt-3">
            <Aviso
              titulo="Los papeles no se han podido cargar"
              explicacion="Están guardados: esto es un fallo al leerlos, no una pérdida. Vuelve a entrar en un momento."
            />
          </div>
        )}

        {/*
          ══ DOS CAMINOS AL MISMO PAPEL, UNO AL LADO DEL OTRO ══

          Esta pantalla contesta una sola pregunta —«¿dónde está ese
          papel?»— y la contesta de dos maneras que no se parecen en
          nada: por la carpeta donde debería estar, o por lo que se
          guardó hace poco. Quien busca la factura de la luz de julio
          va por carpetas; quien busca «eso que fotografié el martes»
          va por lo reciente.

          En el móvil van una debajo de otra y hay que elegir: lo
          reciente primero, porque el papel recién guardado es el que
          más se busca.

          En grande no hay que elegir. Las carpetas a la izquierda —a
          dos por fila, así se ven las seis secciones sin deslizar— y
          lo último a la derecha, con el doble de líneas.

          El sitio se dice con `col-start`, no con el orden del
          documento: en el móvil manda el orden de lectura de arriba
          abajo, y ése se queda como está.
        */}
        {/*
          ── EL MÓVIL, INTACTO ──

          Todo lo de aquí dentro es exactamente lo que había, sin tocar
          una clase. En un teléfono elegir SÍ es navegar, porque no hay
          sitio para otra cosa: las carpetas siguen siendo tarjetas y
          siguen llevando a su pantalla.

          Las clases `lg:` de dentro quedan sin efecto —esto ya no se
          pinta en grande— y se dejan puestas a propósito: quitarlas
          sería tocar el móvil, y el móvil no entra en esta tanda.
        */}
        <div className="lg:hidden">

        {/* Lo último, directo. Sin pasar por el árbol de carpetas. */}
        {recientes.length > 0 && (
          <section className="lg:col-start-2 lg:row-start-1">
            <h2 className="rotulo mt-3">Lo último guardado</h2>
            <ul className="mt-3 space-y-2.5">
              {recientes.map((d, i) => {
                const s = seccionPintada(segmentoPorId.get(d.categoria_id))
                return (
                  /* Del séptimo en adelante, solo en grande. */
                  <li key={d.id} className={i > 5 ? 'hidden lg:list-item' : undefined}>
                    {/* Seis en el móvil, ocho en grande: los dos
                        últimos solo salen cuando hay columna donde
                        ponerlos. */}
                    <Fila href={`/documentos/${d.id}`}>
                      <PastillaAmbito icono={s.icono} ambito={s.ambito} tam={44} />
                      <span className="min-w-0 flex-1">
                        <span className="t-cuerpo block truncate font-extrabold">
                          {d.titulo}
                        </span>
                        <span className="t-apoyo mt-0.5 block truncate">
                          {nombrePorId.get(d.categoria_id) ?? 'Sin carpeta'} ·{' '}
                          {fechaBreve(d.fecha_documento)}
                        </span>
                      </span>
                      <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
                    </Fila>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className="lg:col-start-1 lg:row-start-1">
        {grupos.map((g, i) => (
          <div key={g.titulo}>
        <h2 className={`rotulo ${i === 0 ? 'mt-6 lg:mt-3' : 'mt-7'}`}>{g.titulo}</h2>
        {/* Dos por fila en grande. Las secciones son seis o siete: en
            una sola columna hay que deslizar para ver Vehículos, y
            entonces la pantalla de las carpetas no enseña las
            carpetas. */}
        <ul className="mt-3 space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {g.lista.map((c) => {
            const s = seccionPintada(c.segmento_drive)
            const n = cuantos.get(c.id) ?? 0
            const u = ultimas.get(c.id)
            return (
              <li key={c.id}>
                <Fila href={`/documentos/seccion/${c.id}`} alto="alta">
                  <PastillaAmbito icono={s.icono} ambito={s.ambito} />
                  <span className="min-w-0 flex-1">
                    <span className="t-tarjeta block truncate">{c.nombre}</span>
                    <span className="t-apoyo mt-0.5 block truncate">
                      {n === 0
                        ? 'Todavía vacía'
                        : `${n} ${n === 1 ? 'papel' : 'papeles'}${u ? ` · ${fechaBreve(u)}` : ''}`}
                    </span>
                    {/* Lo nuevo, en su propia línea y con el verde de la
                        casa. Es lo único de esta pantalla que cambia
                        solo, así que se gana el color. */}
                    {(nuevos.get(c.id) ?? 0) > 0 && (
                      <span className="t-apoyo mt-0.5 block font-extrabold text-verde">
                        {nuevos.get(c.id) === 1
                          ? '1 papel nuevo'
                          : `${nuevos.get(c.id)} papeles nuevos`}
                      </span>
                    )}
                  </span>
                  <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
                </Fila>
              </li>
            )
          })}
        </ul>
          </div>
        ))}
        </section>

        </div>

        {/*
          ══════════════════════════════════════════════════════════
          EL ESCRITORIO · las carpetas, y lo que hay dentro
          ══════════════════════════════════════════════════════════

          Dos zonas. A la izquierda los nombres; en el resto, una tabla
          con lo que hay dentro.

          ── POR QUÉ LAS CARPETAS SON UNA COLUMNA Y NO UNOS CHIPS ──

          Porque son ocho y subiendo. La regla: si la lista cabe holgada
          en una fila, es una fila —las cuentas, que son tres o cuatro—;
          si no cabe o crece sin techo, es una columna. Doscientos veinte
          píxeles para ocho nombres es barato; para tres sería un pasillo
          vacío que además se los quita a la tabla.

          ── Y LO QUE SE VE DE UN VISTAZO ──

          Una carpeta vacía deja de parecerse a una llena. Antes las dos
          eran la misma tarjeta con el mismo chevrón; aquí la que no
          tiene nada sale apagada y con una raya en vez de un número.
          Ése era el peor fallo de la pantalla de carpeta: «Alquileres»
          con nueve subcarpetas diciendo «vacía» nueve veces, y sin
          manera de saberlo desde fuera.
        */}
        <div className="denso-trabajo hidden pt-2 lg:flex lg:items-start lg:gap-5">

          <nav aria-label="Carpetas" className="w-[220px] shrink-0">
            <h2 className="rotulo">Carpetas</h2>
            <div className="mt-2.5 flex flex-col gap-0.5">
              <EnCarpeta
                href="/documentos"
                nombre="Todos los papeles"
                cuantos={papeles.length}
                ambito="pizarra"
                elegida={seccionElegida === null}
              />
              {/* El mismo corte que arriba, y con los mismos rótulos:
                  una carpeta no puede estar en un sitio distinto
                  según el tamaño de la pantalla. Cuando hay un solo
                  grupo, el rótulo no se pinta — «Carpetas» ya está
                  encima y repetirlo no separa nada. */}
              {grupos.map((g) => (
                <div key={g.titulo} className="contents">
                  {grupos.length > 1 && (
                    <h3 className="rotulo mb-1 mt-3.5 px-1">{g.titulo}</h3>
                  )}
                  {g.lista.map((c) => {
                    const s = seccionPintada(c.segmento_drive)
                    return (
                      <EnCarpeta
                        key={c.id}
                        href={aquiCon(c.id, null)}
                        nombre={c.nombre}
                        cuantos={cuantos.get(c.id) ?? 0}
                        ambito={s.ambito}
                        elegida={seccionElegida?.id === c.id}
                        nuevos={nuevos.get(c.id) ?? 0}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </nav>

          <div className="min-w-0 flex-1">
            {/*
              Las subcarpetas, de filtro. La elegida en negro; las demás
              con su recuento al lado, que es lo que antes había que
              entrar a averiguar.
            */}
            {subcarpetas.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                <Chip
                  href={aquiCon(seccionElegida?.id ?? null, null)}
                  elegido={laElegida?.id === seccionElegida?.id}
                >
                  Todo · {cuantos.get(seccionElegida?.id ?? '') ?? 0}
                </Chip>
                {subcarpetas.map((h) => (
                  <Chip
                    key={h.id}
                    href={aquiCon(h.id, null)}
                    elegido={laElegida?.id === h.id}
                  >
                    {h.nombre} · {h.cuantos}
                  </Chip>
                ))}
              </div>
            )}

            <Tabla
              columnas="12px minmax(0,1fr) 150px 96px 104px"
              cabecera={[
                '',
                'Papel',
                'Dónde',
                'Fecha',
                <span key="i" className="block text-right">Importe</span>,
              ]}
              pie={
                filas.length === 0
                  ? laElegida
                    ? 'Aquí todavía no hay ningún papel.'
                    : 'Todavía no hay papeles guardados.'
                  : deLaCarpeta.length > filas.length
                    ? `Los ${filas.length} últimos de ${deLaCarpeta.length}. Para los demás, busca arriba.`
                    : `${deLaCarpeta.length} ${deLaCarpeta.length === 1 ? 'papel' : 'papeles'}.`
              }
            >
              {filas.map((d) => {
                const s = seccionPintada(segmentoPorId.get(d.categoria_id))
                return (
                  <Renglon
                    key={d.id}
                    href={aquiCon(elegida || null, d.id)}
                    elegido={elegido === d.id}
                  >
                    <Punto ambito={s.ambito} />
                    <Nombre>{d.titulo}</Nombre>
                    <Dato>{nombrePorId.get(d.categoria_id) ?? 'Sin carpeta'}</Dato>
                    <Dato>{fechaBreve(d.fecha_documento)}</Dato>
                    {d.importe != null ? (
                      <Cifra>{euros(Number(d.importe))}</Cifra>
                    ) : (
                      <span className="text-right text-[13px] text-apagado">—</span>
                    )}
                  </Renglon>
                )
              })}
            </Tabla>

            {/* El panel, DEBAJO, mientras no haya sitio al lado. */}
            {panelDelPapel && (
              <div className="mt-4 ancha:hidden">{panelDelPapel}</div>
            )}
          </div>

          {/* Y al lado desde 1440: 340 px, y 480 en un monitor grande —
              que es donde el recibo pasa de intuirse a leerse sin
              abrirlo. Pegado al desplazar, sin barra propia. */}
          {panelDelPapel && (
            <aside className="hidden shrink-0 self-start ancha:sticky ancha:top-2 ancha:block ancha:w-[340px] monitor:w-[480px]">
              {panelDelPapel}
            </aside>
          )}
        </div>

        {/* Solo cuando de verdad no hay ninguno. Si la consulta ha
            fallado, arriba sale el aviso rojo: decir "todavía no hay
            papeles" cuando lo que pasa es que no se han podido leer es
            mentirle a alguien sobre sus propios documentos. */}
        {/* `lg:hidden`: en grande lo dice el pie de la tabla, y el botón
            de guardar está arriba en la banda. Decirlo dos veces en la
            misma pantalla es decirlo peor. */}
        {papeles.length === 0 && !averia && (
          <div className="mt-6 lg:hidden">
            <Vacio
              titulo="Todavía no hay papeles"
              explicacion="Haz una foto del primero y yo lo archivo donde toca."
              accion={{ texto: 'Guardar un papel', href: '/guardar', icono: 'foto' }}
            />
          </div>
        )}

        {/* El mismo botón que al final de cada carpeta, para que esté
            siempre en el mismo sitio: abajo del todo. Aquí sin carpeta
            puesta — desde la lista general aún hay que elegirla.

            SOLO EN EL MÓVIL. En grande esta misma acción está arriba a
            la derecha, en la banda, junto al buscador: es donde se
            buscan las cosas que se hacen cuando no hay pulgar. Tenerla
            en los dos sitios sería ofrecer dos veces lo mismo en la
            misma pantalla. */}
        <div className="lg:hidden">
          <Anadir />
        </div>
      </div>
    </main>
  )
}

/*
  ── SE LLAMA PAPELES, Y AQUÍ PONÍA «DOCUMENTOS» ──

  La pestaña de abajo dice Papeles, el rail dice Papeles, y dentro se
  cuentan «papeles guardados» y «1 papel». Esta cabecera era el único
  sitio de MAPPEL donde esa sección se llamaba de otra manera.

  Una cosa con dos nombres obliga a traducir mentalmente cada vez, y
  con personas mayores delante eso no es un detalle: se toca «Papeles»
  abajo y se llega a una pantalla titulada «Documentos», que parece
  otra.

  Gana «Papeles» y no «Documentos» porque es la palabra que ya usa todo
  lo demás — y porque es la que usaría cualquiera al hablar. Nadie dice
  «voy a buscar el documento del coche».

  Y le faltaba el icono: Agenda lleva su calendario, Cuentas su euro y
  el Día a día su taza. Ésta era la única cabecera pelada de las cinco.
*/
function Titulo() {
  return (
    <div className="flex h-12 items-center gap-3">
      <PastillaAmbito icono="carpeta" ambito="azul" tam={44} />
      <h1 className="t-titulo">Papeles</h1>
    </div>
  )
}

/*
  El buscador, a la medida del sistema: 58 px y radio de campo, como
  cualquier otro campo de la aplicación. Era el único `rounded-2xl` de
  esta pantalla y medía 54.

  ─────────────────────────────────────────────────────────────
  Y ESTO ES LO QUE DECÍA LA FASE 1 QUE PASARÍA AQUÍ

  «Esta caja y el asistente hacen hoy la misma pregunta con dos
  motores distintos. Aquí es donde entrará MAPPEL Input — no un buscador
  Y un asistente, sino una sola caja que entiende.»

  Ya está. Escribes lo que sea:

    «facturas agua 2026»          → busca, al instante, como siempre
    «apunta 85 euros de la finca» → lo entiende MAPPEL

  Y lo decide EN EL MÓVIL, sin llamar a ningún modelo: buscar sigue
  costando exactamente lo mismo que antes.
*/
function Buscador({ valor }: { valor: string }) {
  return (
    <div className="mt-1">
      <MappelCaja donde="papeles" valor={valor} buscarEn="/documentos" />
    </div>
  )
}

/*
  ═══════════════════════════════════════════════════════════════
  UN NOMBRE DE CARPETA, EN LA COLUMNA
  ═══════════════════════════════════════════════════════════════

  No es una tarjeta ni lleva chevrón, y las dos cosas son a propósito:
  el chevrón promete «te llevo a otra pantalla», y aquí no se va a
  ninguna parte — se elige, y lo que hay dentro aparece al lado.

  `scroll={false}` es lo que hace que no sea un salto: sin eso, elegir
  la sexta carpeta de la columna sube la pantalla al principio y parece
  que ha cargado otra cosa.

  Y la elegida se marca con lo mismo que un renglón de tabla elegido
  —barra verde de 3 px y fondo verde muy claro— porque es el mismo
  gesto y conviene que se aprenda una sola vez.
*/
/*
  Y SIN PAPEL ELEGIDO, LA CARPETA.

  La zona no se queda vacía esperando: dice de qué carpeta se está
  viendo la tabla y cuántos papeles tiene. Es poco, y es a propósito —
  una zona con un «selecciona un papel» centrado en gris es un hueco
  disfrazado de contenido.

  Aquí es donde entrará «¿quién ve esta carpeta?» cuando los permisos
  por carpeta estén puestos: ése es su sitio y por eso el bloque
  existe ya.
*/
function LaCarpeta({ nombre, cuantos }: { nombre: string; cuantos: number }) {
  return (
    <div>
      <p className="rotulo mb-2.5">La carpeta</p>
      <div className="rounded-[16px] border border-borde bg-superficie px-4 py-4">
        <p className="text-[17px] font-extrabold leading-snug">{nombre}</p>
        <p className="mt-1 text-[14px] text-tenue">
          {cuantos === 0
            ? 'Todavía sin papeles.'
            : `${cuantos} ${cuantos === 1 ? 'papel guardado' : 'papeles guardados'}.`}
        </p>
        <p className="mt-3 border-t border-borde pt-3 text-[13px] leading-snug text-tenue">
          Elige un papel de la lista para verlo aquí sin salir de la carpeta.
        </p>
      </div>
    </div>
  )
}

function EnCarpeta({
  href,
  nombre,
  cuantos,
  ambito,
  elegida,
  nuevos = 0,
}: {
  href: string
  nombre: string
  cuantos: number
  ambito: Ambito
  elegida: boolean
  nuevos?: number
}) {
  const vacia = cuantos === 0
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={elegida ? 'true' : undefined}
      className={
        'objetivo flex items-center gap-2.5 rounded-[11px] px-2.5 text-[15px] transition-colors ' +
        (elegida
          ? 'bg-verde-suave font-bold text-bien shadow-[inset_3px_0_0_var(--color-bien)] '
          : 'roza ') +
        (!elegida && vacia ? 'text-apagado' : !elegida ? 'text-tinta-suave' : '')
      }
    >
      <Punto ambito={ambito} />
      <span className="min-w-0 flex-1 truncate">{nombre}</span>
      {nuevos > 0 ? (
        <span className="shrink-0 text-[13px] font-extrabold text-verde">
          {nuevos} nuevo{nuevos === 1 ? '' : 's'}
        </span>
      ) : (
        /* Una raya y no un cero. «Alquileres — » se lee como «aquí no
           hay nada» de un vistazo; «Alquileres 0» hay que leerlo. */
        <span className="shrink-0 text-[13px] text-tenue">{vacia ? '—' : cuantos}</span>
      )}
    </Link>
  )
}

/*
  UNA SUBCARPETA, DE FILTRO.

  Lo que antes era una tarjeta con chevrón —y nueve de ellas diciendo
  «vacía»— aquí es un chip con su recuento al lado. Sigue estando, pero
  ya no hay que entrar para saber si dentro hay algo.
*/
function Chip({
  href,
  elegido,
  children,
}: {
  href: string
  elegido: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={elegido ? 'true' : undefined}
      className={
        'flex h-9 items-center rounded-full border px-3.5 text-[14px] transition-colors ' +
        (elegido
          ? 'border-tinta bg-tinta font-semibold text-fondo'
          : 'roza border-borde bg-superficie text-tinta-suave')
      }
    >
      {children}
    </Link>
  )
}



/*
  Parte la frase en palabras buscables.

  Se quitan las de relleno —"todas", "las", "de"— y las de una o dos
  letras, que no dicen nada y ensucian el resultado. Y se limpia todo
  lo que no sea letra o número: el buscador de Postgres se atraganta
  con un paréntesis suelto y devuelve un error en vez de resultados.
*/
const RELLENO = new Set([
  'el','la','los','las','un','una','unos','unas','de','del','al','a','en',
  'y','o','que','todo','toda','todos','todas','mi','mis','me','muestra',
  'muestrame','ensena','ensename','busca','buscar','ver','quiero','dame',
  'por','para','con','sobre','este','esta','estos','estas','ultimo','ultima',
])

function palabras(frase: string): string[] {
  return frase
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 2 && !RELLENO.has(p))
    .slice(0, 8)
}
