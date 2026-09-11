import Link from '@/app/enlace'
import { redirect, notFound } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Anadir from "../../anadir"
import Barra from '../../../barra'
import Cabecera from '../../../cabecera'
import { Ico, Volver } from '../../../iconos'
import {
  Aviso,
  Fila,
  PastillaAmbito,
  Pildora,
  Vacio,
  seccionPintada,
} from '../../../piezas'
import {
  contar,
  hijosDe,
  ramaDe,
  type Categoria,
  type Documento,
} from '@/lib/carpetas'
import { fechaBreve } from '@/lib/carpetas'
import { euros } from '@/lib/periodos'
import { elEspacioO } from '@/lib/espacio'
import { entrarEn, confirmarVisto } from '@/lib/novedades'

export const dynamic = 'force-dynamic'

/*
  Dentro de una sección.

  Se aplasta un nivel: si la sección tiene carpetas que a su vez tienen
  carpetas (Finca → Gastos → Luz), se enseñan las nietas agrupadas bajo
  el nombre de su madre. Así se llega al papel en dos toques en vez de
  cuatro, y Drive sigue guardando la ruta completa por debajo.
*/

export default async function Seccion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ anio?: string; t?: string }>
}) {
  const { id } = await params
  const filtro = await searchParams

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  /* Si la consulta falla, SE DICE. Antes se ignoraba el error y la
     sección salía "vacía" — indistinguible de no tener papeles. */
  const espacio = await elEspacioO(supabase)
  const [{ data: cats, error: falloCats }, { data: docs, error: falloDocs }] =
    await Promise.all([
      supabase
        .from('categorias')
        .select('id, padre_id, nombre, segmento_drive, orden, naturaleza')
        .eq('hogar_id', espacio)
        .eq('activa', true),
      supabase
        .from('documentos')
        .select('id, categoria_id, titulo, fecha_documento, anio, trimestre, importe, creado_en, subido_por')
        .eq('hogar_id', espacio)
        .limit(5000),
    ])

  const averia = falloCats?.message ?? falloDocs?.message ?? null
  if (averia) console.error('[HUBI] Sección no ha podido cargar:', averia)

  const todas = (cats ?? []) as Categoria[]
  const seccion = todas.find((c) => c.id === id)
  if (!seccion) notFound()

  /*
    ── ENTRAR AQUÍ ES LO QUE MARCA ──

    `entrarEn` NO escribe: devuelve desde cuándo contar lo nuevo y un
    sello. El sello se confirma al final de esta función, cuando ya se
    sabe que los papeles se han leído bien. Si la consulta de arriba
    hubiera fallado, no se confirma y las novedades siguen ahí la
    próxima vez.

    El ámbito se saca de la propia sección: lo pone HUBI al crear la
    estructura y es la clave canónica del paso 60. Nulo se lee como
    «otros», que también es un ámbito de carpeta y por tanto lleva su
    marca igual.
  */
  const ambito = (seccion as Categoria & { ambito?: string | null }).ambito ?? 'otros'
  const { desde, sello } = await entrarEn(supabase, espacio, ambito, seccion.id)

  const dentro = ramaDe(todas, seccion.id)
  type Papel = Documento & {
    titulo: string
    importe: number | null
    creado_en?: string | null
    subido_por?: string | null
  }
  const papeles = ((docs ?? []) as Papel[])
    .filter((d) => dentro.has(d.categoria_id))
    .sort((a, b) => b.fecha_documento.localeCompare(a.fecha_documento))

  // ── Qué años hay ──
  const anios = [...new Set(papeles.map((d) => d.anio).filter((a): a is number => a != null))].sort(
    (a, b) => b - a
  )
  const anio = filtro.anio && anios.includes(Number(filtro.anio)) ? Number(filtro.anio) : null
  const trimestre = filtro.t && /^[1-4]$/.test(filtro.t) ? Number(filtro.t) : null

  const filtrados = papeles.filter(
    (d) => (anio == null || d.anio === anio) && (trimestre == null || d.trimestre === trimestre)
  )

  const cuantos = contar(todas, filtrados)
  const s = seccionPintada(seccion.segmento_drive)

  /*
    Cuántos nuevos hay en cada carpeta de dentro, con la MISMA regla que
    la pantalla anterior: llegó después de mi marca y no lo guardé yo.
    Sin marca —primera visita— no sale nada como nuevo.
  */
  const nuevosPorCarpeta = new Map<string, number>()
  if (desde) {
    for (const c of todas) {
      const rama = ramaDe(todas, c.id)
      let n = 0
      for (const d of papeles) {
        if (!d.creado_en || d.subido_por === user.id) continue
        if (!rama.has(d.categoria_id)) continue
        if (d.creado_en >= desde) n++
      }
      if (n > 0) nuevosPorCarpeta.set(c.id, n)
    }
  }

  // ── Los grupos que se enseñan ──
  const hijas = hijosDe(todas, seccion.id)
  const grupos: { titulo: string | null; carpetas: Categoria[] }[] = []
  const sueltas: Categoria[] = []

  for (const h of hijas) {
    const nietas = hijosDe(todas, h.id)
    if (nietas.length > 0) grupos.push({ titulo: h.nombre, carpetas: nietas })
    else sueltas.push(h)
  }
  if (sueltas.length > 0) grupos.unshift({ titulo: null, carpetas: sueltas })

  const mayor = Math.max(1, ...grupos.flatMap((g) => g.carpetas.map((c) => cuantos.get(c.id) ?? 0)))

  /*
    ── Y AHORA SÍ SE MARCA ──

    Aquí abajo, cuando los papeles ya están leídos y contados. Si algo
    de lo de arriba hubiera fallado, esta línea no se alcanza y las
    novedades siguen ahí la próxima vez, que es justo lo que se quería.
  */
  await confirmarVisto(supabase, espacio, ambito, sello, seccion.id)

  const base = `/documentos/seccion/${seccion.id}`
  const conFiltro = (a: number | null, t: number | null) => {
    const partes = []
    if (a != null) partes.push(`anio=${a}`)
    if (t != null) partes.push(`t=${t}`)
    return partes.length ? `${base}?${partes.join('&')}` : base
  }

  return (
    <main className="min-h-screen pb-40 lg:pb-16">
      {/* El título vive en la cabecera (D6): aquí estaba en el cuerpo
          y se perdía al hacer scroll. */}
      <Cabecera ancho>
        <Volver href="/documentos" />
        <div className="mt-2.5 flex items-center gap-3">
          <PastillaAmbito icono={s.icono} ambito={s.ambito} />
          <div className="min-w-0">
            <h1 className="t-titulo truncate">{seccion.nombre}</h1>
            <p className="t-apoyo">
              {papeles.length} {papeles.length === 1 ? 'papel guardado' : 'papeles guardados'}
            </p>
          </div>
        </div>
      </Cabecera>

      <div className="columna">

        {averia && (
          <div className="mt-4">
            <Aviso
              titulo="No se han podido leer los papeles"
              explicacion="Siguen guardados. Esto es un fallo al leerlos, no una pérdida."
            />
          </div>
        )}

        {/* ── Cuándo ── */}
        {/* Las píldoras eran de 44 px —por debajo del suelo de 48 que
            declara el propio CSS— y se rellenaban del color de la
            sección al elegirlas. Ahora son las del sistema: 48 px y
            relleno de tinta, iguales en toda la aplicación. */}
        {anios.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Pildora href={base} puesta={anio == null}>
              Todo
            </Pildora>
            {anios.slice(0, 4).map((a) => (
              <Pildora key={a} href={conFiltro(a, null)} puesta={anio === a && trimestre == null}>
                {a}
              </Pildora>
            ))}
            {anio != null &&
              [1, 2, 3, 4].map((t) => (
                <Pildora key={t} href={conFiltro(anio, t)} puesta={trimestre === t}>
                  T{t}
                </Pildora>
              ))}
          </div>
        )}

        {/* ── Las carpetas ── */}
        {grupos.map((g, i) => (
          <section key={g.titulo ?? `sueltas-${i}`} className="mt-5">
            {g.titulo && <h2 className="rotulo">{g.titulo}</h2>}
            {/* Las carpetas, a dos por fila en grande: una sección
                como Finca tiene siete u ocho y en una sola tira hay que
                deslizar para ver la última. */}
            <ul
              className={
                (g.titulo ? 'mt-2.5 space-y-2' : 'space-y-2') +
                ' lg:grid lg:grid-cols-2 lg:gap-2.5 lg:space-y-0'
              }
            >
              {g.carpetas.map((c) => {
                const n = cuantos.get(c.id) ?? 0
                const dineros = filtrados
                  .filter((d) => ramaDe(todas, c.id).has(d.categoria_id) && d.importe != null)
                  .reduce((t, d) => t + Number(d.importe), 0)
                return (
                  <li key={c.id}>
                    <Link
                      href={`/documentos/carpeta/${c.id}${anio != null ? `?anio=${anio}${trimestre ? `&t=${trimestre}` : ''}` : ''}`}
                      className="block rounded-[20px] border border-borde bg-superficie px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="t-tarjeta truncate">{c.nombre}</p>
                          <p className="t-apoyo">
                            {n === 0 ? 'vacía' : `${n} ${n === 1 ? 'papel' : 'papeles'}`}
                            {/* Y lo que ha llegado desde la última vez.
                                En la misma línea: es un matiz del
                                recuento, no otro dato. */}
                            {(nuevosPorCarpeta.get(c.id) ?? 0) > 0 && (
                              <span className="font-extrabold text-verde">
                                {' · '}
                                {nuevosPorCarpeta.get(c.id)} nuevo
                                {nuevosPorCarpeta.get(c.id) === 1 ? '' : 's'}
                              </span>
                            )}
                          </p>
                        </div>
                        {dineros > 0 && (
                          <p className="t-cuerpo shrink-0 font-extrabold tabular-nums">
                            {euros(dineros)}
                          </p>
                        )}
                        <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
                      </div>
                      {/* La barra toma el color de ámbito de la sección:
                          es una señal de cuánto hay, no una acción. */}
                      {n > 0 && (
                        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-fondo">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.max(6, (n / mayor) * 100)}%`,
                              background: `var(--color-ambito-${s.ambito})`,
                            }}
                          />
                        </div>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        {grupos.length === 0 && (
          <div className="mt-6">
            <Vacio
              titulo="Esta sección todavía no tiene carpetas"
              explicacion="Se crean solas al guardar el primer papel de cada tipo."
            />
          </div>
        )}

        {/*
          TODOS LOS PAPELES, A LA VISTA.

          Esta pantalla enseñaba SOLO carpetas, y ahí había un agujero
          de verdad: solo son pulsables las carpetas de segundo nivel
          (Luz, Agua) y las de primero que no tengan hijas. Un papel
          guardado en una carpeta intermedia —en "Gastos" y no en
          "Gastos → Luz"— no aparecía en NINGÚN sitio. Estaba bien
          guardado, contaba en los totales de arriba, y no había manera
          humana de abrirlo.

          Con la lista completa debajo eso deja de poder pasar: si el
          papel está en esta sección, está aquí, venga de la carpeta
          que venga. Y de paso es lo que pide el punto 12 —enseñar los
          documentos, no la estructura de Drive—.
        */}
        {filtrados.length > 0 && (
          <section className="mt-6">
            <h2 className="rotulo">
              {anio == null
                ? `Todos los papeles · ${filtrados.length}`
                : `Papeles de ${trimestre ? `T${trimestre} ` : ''}${anio} · ${filtrados.length}`}
            </h2>
            {/* Cien papeles en una tira de 448 px son ocho pantallas
                de deslizar. A dos columnas, cuatro. */}
            <ul className="mt-2.5 space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:space-y-0">
              {filtrados.slice(0, 100).map((d) => (
                <li key={d.id}>
                  <Fila href={`/documentos/${d.id}`}>
                    <PastillaAmbito icono={s.icono} ambito={s.ambito} tam={44} />
                    <span className="min-w-0 flex-1">
                      <span className="t-cuerpo block truncate font-extrabold">{d.titulo}</span>
                      <span className="t-apoyo mt-0.5 block truncate">
                        {todas.find((c) => c.id === d.categoria_id)?.nombre ?? 'Sin carpeta'}
                        {' · '}
                        {fechaBreve(d.fecha_documento)}
                        {d.importe != null ? ` · ${euros(Number(d.importe))}` : ''}
                      </span>
                    </span>
                    <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
                  </Fila>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sin carpeta concreta: desde una sección aún hay que elegir
            dónde va, porque una sección tiene varias dentro. */}
        <Anadir texto="Añadir documento aquí" />
      </div>

      <Barra activa="documentos" />
    </main>
  )
}

