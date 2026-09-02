import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../../../barra'
import Cabecera from '../../../cabecera'
import { Ico, Pastilla, Volver, seccionDe } from '../../../iconos'
import { caminoDe, ramaDe, fechaCorta, type Categoria } from '@/lib/carpetas'
import { euros } from '@/lib/periodos'

export const dynamic = 'force-dynamic'

type Papel = {
  id: string
  titulo: string
  fecha_documento: string
  tipo_mime: string
  importe: number | null
  proveedor: string | null
  visibilidad: string
  categoria_id: string
  subido_por: string | null
}

export default async function Carpeta({
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

  const { data: cats } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, orden')
    .eq('activa', true)

  const todas = (cats ?? []) as Categoria[]
  const carpeta = todas.find((c) => c.id === id)
  if (!carpeta) notFound()

  const camino = caminoDe(todas, carpeta.id)
  const seccion = camino[0]
  const s = seccionDe(seccion?.segmento_drive)
  const dentro = [...ramaDe(todas, carpeta.id)]

  let consulta = supabase
    .from('documentos')
    .select(
      /* Sin cruce con `perfiles`: desde que existen los hogares hay dos
         caminos para ir de un documento a una persona y la base de datos
         se niega a elegir, así que la consulta entera fallaba. Los
         nombres se piden aparte, abajo. */
      'id, titulo, fecha_documento, tipo_mime, importe, proveedor, visibilidad, categoria_id, subido_por'
    )
    .in('categoria_id', dentro)
    .order('fecha_documento', { ascending: false })
    .limit(200)

  if (filtro.anio && /^\d{4}$/.test(filtro.anio)) consulta = consulta.eq('anio', Number(filtro.anio))
  if (filtro.t && /^[1-4]$/.test(filtro.t)) consulta = consulta.eq('trimestre', Number(filtro.t))

  /* Si esto falla, SE DICE. Ignorando el error, la carpeta salía
     "vacía" — que es justo lo que se ve cuando de verdad no hay nada. */
  const { data, error: averia } = await consulta
  if (averia) console.error('[HUBI] Carpeta no ha podido cargar:', averia.message)
  const papeles = (data ?? []) as unknown as Papel[]

  /* Los nombres, en una consulta aparte y sin cruces. Si fallara, las
     tarjetas dirían "Guardó alguien" — y los papeles seguirían ahí. */
  const { data: gente } = await supabase.from('perfiles').select('id, nombre')
  const quienEs = new Map((gente ?? []).map((g) => [g.id as string, g.nombre as string]))

  const total = papeles.reduce((t, p) => t + (p.importe != null ? Number(p.importe) : 0), 0)
  const cuando =
    filtro.anio && filtro.t
      ? `T${filtro.t} ${filtro.anio}`
      : filtro.anio
        ? String(filtro.anio)
        : 'Todo'

  const volver = seccion
    ? `/documentos/seccion/${seccion.id}${filtro.anio ? `?anio=${filtro.anio}${filtro.t ? `&t=${filtro.t}` : ''}` : ''}`
    : '/documentos'

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href={volver} texto={seccion?.nombre ?? 'Documentos'} />
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5">

        <div className="flex items-center gap-3">
          <Pastilla nombre={s.icono} color={s.color} fondo={s.fondo} tam={48} icono={25} redondez={15} />
          <div className="min-w-0">
            <h1 className="truncate text-[27px] font-extrabold tracking-tight">{carpeta.nombre}</h1>
            <p className="text-[14.5px] font-bold text-tenue">
              {cuando} · {papeles.length} {papeles.length === 1 ? 'papel' : 'papeles'}
              {total > 0 ? ` · ${euros(total)}` : ''}
            </p>
          </div>
        </div>

        {averia ? (
          <div className="mt-6 rounded-[20px] border border-coral bg-coral-suave px-4 py-4">
            <p className="text-[17px] font-extrabold text-coral">
              No se han podido leer los papeles de esta carpeta
            </p>
            <p className="mt-1.5 text-[15.5px] font-semibold leading-snug text-tinta-suave">
              Siguen guardados. Esto es un fallo al leerlos.
            </p>
            <p className="mt-2 break-words rounded-[14px] bg-superficie px-3 py-2 text-[14px] font-semibold text-tinta-suave">
              {averia.message}
            </p>
          </div>
        ) : papeles.length === 0 ? (
          <p className="mt-6 rounded-[20px] bg-superficie px-6 py-8 text-center text-[17px] font-medium text-tinta-suave">
            Aquí no hay nada guardado todavía.
          </p>
        ) : (
          <ul className="mt-5 space-y-2.5">
            {papeles.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/documentos/${p.id}`}
                  className="flex items-start gap-3.5 rounded-[20px] border border-borde bg-superficie px-3.5 py-3"
                >
                  <Hoja color={s.color} pdf={p.tipo_mime === 'application/pdf'} />
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="block text-[17px] font-extrabold leading-snug">{p.titulo}</span>
                    <span className="mt-1 block text-[14.5px] font-semibold text-tenue">
                      {p.proveedor ? `${p.proveedor} · ` : ''}
                      {fechaCorta(p.fecha_documento)}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-tenue">
                      <Ico nombre={p.visibilidad === 'privado' ? 'candado' : 'gente'} tam={15} grosor={2} />
                      {p.visibilidad === 'privado'
                        ? 'Privado'
                        : `Guardó ${(p.subido_por && quienEs.get(p.subido_por)) ?? 'alguien'}`}
                    </span>
                  </span>
                  {p.importe != null && (
                    <span className="shrink-0 pt-0.5 text-[17px] font-extrabold tabular-nums">
                      {euros(Number(p.importe))}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Barra activa="documentos" />
    </main>
  )
}

/** Una hojita de papel, para que la lista se lea de un vistazo. */
function Hoja({ color, pdf }: { color: string; pdf: boolean }) {
  return (
    <span className="flex h-[66px] w-[52px] shrink-0 flex-col gap-1 rounded-[9px] border border-borde bg-superficie px-[7px] pt-[9px]">
      <span className="h-[3px] rounded-sm" style={{ background: color }} />
      <span className="h-[3px] w-[70%] rounded-sm bg-borde" />
      <span className="h-[3px] rounded-sm bg-borde" />
      <span className="h-[3px] w-[55%] rounded-sm bg-borde" />
      <span className="h-[3px] rounded-sm bg-borde" />
      <span className="mt-auto mb-[7px] text-[8px] font-extrabold tracking-wider text-tenue">
        {pdf ? 'PDF' : 'FOTO'}
      </span>
    </span>
  )
}
