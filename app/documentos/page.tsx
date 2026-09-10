import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Anadir from "./anadir"
import Barra from '../barra'
import Cabecera from '../cabecera'
import { Ico } from '../iconos'
import { Fila, Vacio, Aviso, PastillaAmbito, seccionPintada } from '../piezas'
import HubiCaja from '../hubi-caja'
import { elEspacioO } from '@/lib/espacio'
import {
  contar,
  hijosDe,
  ramaDe,
  ultima,
  fechaBreve,
  type Categoria,
  type Documento,
} from '@/lib/carpetas'

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
  searchParams: Promise<{ q?: string; cat?: string }>
}) {
  const { q, cat } = await searchParams
  const busqueda = (q ?? '').trim()
  const carpeta = (cat ?? '').trim()

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
      texto: es una carpeta entera. HUBI sabe qué carpetas existen, así
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
      <main className="min-h-screen pb-40">
        <Cabecera>
          <Titulo />
          <Buscador valor={busqueda} />
        </Cabecera>

        <div className="mx-auto w-full max-w-md px-5 pt-2">

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

          <ul className="mt-4 space-y-2.5">
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
        <Barra activa="documentos" />
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
        .select('id, padre_id, nombre, segmento_drive, orden')
        .eq('hogar_id', espacio)
        .eq('activa', true),
      supabase
        .from('documentos')
        .select('id, categoria_id, titulo, fecha_documento, anio, trimestre')
        .eq('hogar_id', espacio)
        .order('fecha_documento', { ascending: false })
        .limit(5000),
    ])

  const averia = falloCats?.message ?? falloDocs?.message ?? null
  if (averia) console.error('[HUBI] Documentos no ha podido cargar:', averia)

  const todas = (cats ?? []) as Categoria[]
  const papeles = (docs ?? []) as (Documento & { titulo: string })[]

  const secciones = hijosDe(todas, null)
  const cuantos = contar(todas, papeles)
  const ultimas = ultima(todas, papeles)

  const nombrePorId = new Map(todas.map((c) => [c.id, c.nombre]))
  const segmentoPorId = new Map(todas.map((c) => [c.id, c.segmento_drive]))

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
  const recientes = papeles.slice(0, 6)

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Titulo />
        <Buscador valor="" />
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-2">

        {averia && (
          <div className="mt-3">
            <Aviso
              titulo="Los papeles no se han podido cargar"
              explicacion="Están guardados: esto es un fallo al leerlos, no una pérdida. Vuelve a entrar en un momento."
            />
          </div>
        )}

        {/* Lo último, directo. Sin pasar por el árbol de carpetas. */}
        {recientes.length > 0 && (
          <>
            <h2 className="rotulo mt-3">Lo último guardado</h2>
            <ul className="mt-3 space-y-2.5">
              {recientes.map((d) => {
                const s = seccionPintada(segmentoPorId.get(d.categoria_id))
                return (
                  <li key={d.id}>
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
          </>
        )}

        <h2 className="rotulo mt-6">Todo, por carpetas</h2>
        <ul className="mt-3 space-y-2.5">
          {secciones.map((c) => {
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
                  </span>
                  <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
                </Fila>
              </li>
            )
          })}
        </ul>

        {/* Solo cuando de verdad no hay ninguno. Si la consulta ha
            fallado, arriba sale el aviso rojo: decir "todavía no hay
            papeles" cuando lo que pasa es que no se han podido leer es
            mentirle a alguien sobre sus propios documentos. */}
        {papeles.length === 0 && !averia && (
          <div className="mt-6">
            <Vacio
              titulo="Todavía no hay papeles"
              explicacion="Haz una foto del primero y yo lo archivo donde toca."
              accion={{ texto: 'Guardar un papel', href: '/guardar', icono: 'foto' }}
            />
          </div>
        )}

        {/* El mismo botón que al final de cada carpeta, para que esté
            siempre en el mismo sitio: abajo del todo. Aquí sin carpeta
            puesta — desde la lista general aún hay que elegirla. */}
        <Anadir />
      </div>
      <Barra activa="documentos" />
    </main>
  )
}

function Titulo() {
  return (
    <div className="flex h-12 items-center">
      <h1 className="t-titulo">Documentos</h1>
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
  motores distintos. Aquí es donde entrará HUBI Input — no un buscador
  Y un asistente, sino una sola caja que entiende.»

  Ya está. Escribes lo que sea:

    «facturas agua 2026»          → busca, al instante, como siempre
    «apunta 85 euros de la finca» → lo entiende HUBI

  Y lo decide EN EL MÓVIL, sin llamar a ningún modelo: buscar sigue
  costando exactamente lo mismo que antes.
*/
function Buscador({ valor }: { valor: string }) {
  return (
    <div className="mt-1">
      <HubiCaja donde="papeles" valor={valor} buscarEn="/documentos" />
    </div>
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
