import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../../../barra'
import Cabecera from '../../../cabecera'
import { Ico, Pastilla, Volver, seccionDe, tintaSobre, MORADO_CLARO } from '../../../iconos'
import {
  contar,
  hijosDe,
  ramaDe,
  type Categoria,
  type Documento,
} from '@/lib/carpetas'
import { fechaBreve } from '@/lib/carpetas'
import { euros } from '@/lib/periodos'

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
  const [{ data: cats, error: falloCats }, { data: docs, error: falloDocs }] =
    await Promise.all([
      supabase
        .from('categorias')
        .select('id, padre_id, nombre, segmento_drive, orden, naturaleza')
        .eq('activa', true),
      supabase
        .from('documentos')
        .select('id, categoria_id, titulo, fecha_documento, anio, trimestre, importe')
        .limit(5000),
    ])

  const averia = falloCats?.message ?? falloDocs?.message ?? null
  if (averia) console.error('[HUBI] Sección no ha podido cargar:', averia)

  const todas = (cats ?? []) as Categoria[]
  const seccion = todas.find((c) => c.id === id)
  if (!seccion) notFound()

  const dentro = ramaDe(todas, seccion.id)
  type Papel = Documento & { titulo: string; importe: number | null }
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
  const s = seccionDe(seccion.segmento_drive)
  const colorPildora = s.color === '#8B5CF6' ? MORADO_CLARO : s.color

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

  const base = `/documentos/seccion/${seccion.id}`
  const conFiltro = (a: number | null, t: number | null) => {
    const partes = []
    if (a != null) partes.push(`anio=${a}`)
    if (t != null) partes.push(`t=${t}`)
    return partes.length ? `${base}?${partes.join('&')}` : base
  }

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href="/documentos" texto="Documentos" />
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5">

        <div className="flex items-center gap-3">
          <Pastilla nombre={s.icono} color={s.color} fondo={s.fondo} tam={48} icono={25} redondez={15} />
          <div>
            <h1 className="text-[27px] font-extrabold tracking-tight">{seccion.nombre}</h1>
            <p className="text-[14.5px] font-bold text-tenue">
              {papeles.length} {papeles.length === 1 ? 'papel guardado' : 'papeles guardados'}
            </p>
          </div>
        </div>

        {averia && (
          <div className="mt-4 rounded-[20px] border border-coral bg-coral-suave px-4 py-4">
            <p className="text-[17px] font-extrabold text-coral">
              No se han podido leer los papeles
            </p>
            <p className="mt-2 break-words rounded-[14px] bg-superficie px-3 py-2 text-[14px] font-semibold text-tinta-suave">
              {averia}
            </p>
          </div>
        )}

        {/* ── Cuándo ── */}
        {anios.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Pildora href={base} puesta={anio == null} color={colorPildora}>
              Todo
            </Pildora>
            {anios.slice(0, 4).map((a) => (
              <Pildora
                key={a}
                href={conFiltro(a, null)}
                puesta={anio === a && trimestre == null}
                color={colorPildora}
              >
                {a}
              </Pildora>
            ))}
            {anio != null &&
              [1, 2, 3, 4].map((t) => (
                <Pildora key={t} href={conFiltro(anio, t)} puesta={trimestre === t} color={colorPildora}>
                  T{t}
                </Pildora>
              ))}
          </div>
        )}

        {/* ── Las carpetas ── */}
        {grupos.map((g, i) => (
          <section key={g.titulo ?? `sueltas-${i}`} className="mt-5">
            {g.titulo && <h2 className="rotulo">{g.titulo}</h2>}
            <ul className={g.titulo ? 'mt-2.5 space-y-2' : 'space-y-2'}>
              {g.carpetas.map((c) => {
                const n = cuantos.get(c.id) ?? 0
                const dineros = filtrados
                  .filter((d) => ramaDe(todas, c.id).has(d.categoria_id) && d.importe != null)
                  .reduce((t, d) => t + Number(d.importe), 0)
                return (
                  <li key={c.id}>
                    <Link
                      href={`/documentos/carpeta/${c.id}${anio != null ? `?anio=${anio}${trimestre ? `&t=${trimestre}` : ''}` : ''}`}
                      className="block rounded-[18px] border border-borde bg-superficie px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[17.5px] font-extrabold tracking-tight">{c.nombre}</p>
                          <p className="text-[14.5px] font-semibold text-tenue">
                            {n === 0 ? 'vacía' : `${n} ${n === 1 ? 'papel' : 'papeles'}`}
                          </p>
                        </div>
                        {dineros > 0 && (
                          <p className="shrink-0 text-[17px] font-extrabold tabular-nums">
                            {euros(dineros)}
                          </p>
                        )}
                        <Ico nombre="flecha" tam={19} grosor={2.2} className="shrink-0 text-borde" />
                      </div>
                      {n > 0 && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fondo">
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${Math.max(6, (n / mayor) * 100)}%`, background: s.color }}
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
          <p className="mt-6 rounded-[20px] bg-superficie px-6 py-8 text-center text-[17px] font-medium text-tinta-suave">
            Esta sección todavía no tiene carpetas dentro.
          </p>
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
            <ul className="mt-2.5 space-y-2.5">
              {filtrados.slice(0, 100).map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/documentos/${d.id}`}
                    className="flex items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-3.5 py-3"
                  >
                    <Pastilla nombre={s.icono} color={s.color} fondo={s.fondo} tam={44} icono={22} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17.5px] font-bold">{d.titulo}</span>
                      <span className="mt-0.5 block text-[15px] font-semibold text-tenue">
                        {todas.find((c) => c.id === d.categoria_id)?.nombre ?? 'Sin carpeta'}
                        {' · '}
                        {fechaBreve(d.fecha_documento)}
                        {d.importe != null ? ` · ${euros(Number(d.importe))}` : ''}
                      </span>
                    </span>
                    <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0 text-borde" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <Barra activa="documentos" />
    </main>
  )
}

function Pildora({
  href,
  puesta,
  color,
  children,
}: {
  href: string
  puesta: boolean
  color: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex h-11 items-center rounded-full px-4 text-[15px] font-extrabold"
      style={
        puesta
          ? { background: color, color: tintaSobre(color) }
          : { background: 'var(--t-superficie)', color: 'var(--t-tinta-suave)', border: '1px solid var(--t-borde)' }
      }
    >
      {children}
    </Link>
  )
}
