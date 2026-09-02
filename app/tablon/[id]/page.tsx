import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { cuando, iconoDe, atrasado, type Recordatorio } from '@/lib/tablon'
import AccionHecho from './accion'
import Editar from './editar'
import Barra from '../../barra'

export const dynamic = 'force-dynamic'

const CUANTO_ANTES: Record<string, string> = {
  sin_aviso: 'Sin aviso',
  '30_min': '30 minutos antes',
  '1_dia': 'Un día antes',
  '1_semana': 'Una semana antes',
  '1_mes': 'Un mes antes',
}

export default async function Detalle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const { data } = await supabase
    .from('recordatorios')
    .select(
      'id, titulo, tipo, asignado_a, creado_por, fecha, hora, estado, nota, documento_origen_id, aviso_previo, repite, repite_hasta, creado_en, hecho_en, hecho_por'
    )
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()

  const r = data as Recordatorio & {
    aviso_previo: string | null
    repite: string | null
    repite_hasta: string | null
    creado_en: string
    hecho_en: string | null
    hecho_por: string | null
  }

  const { data: perfiles } = await supabase.from('perfiles').select('id, nombre')
  const nombres = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p.nombre]))

  const { data: documento } = r.documento_origen_id
    ? await supabase
        .from('documentos')
        .select('id, titulo, tipo_mime')
        .eq('id', r.documento_origen_id)
        .maybeSingle()
    : { data: null }

  const hecho = r.estado === 'hecho'
  const tarde = atrasado(r)

  return (
    <main className="techo-holgado min-h-screen px-6 pb-40">
      <div className="mx-auto w-full max-w-md">
        <Link href="/tablon" className="flex h-11 items-center gap-2 text-[16px] font-bold text-tinta-suave">
          ← Volver al tablón
        </Link>

        <p className="mt-8 flex items-start gap-3">
          <span className="text-4xl leading-none">{iconoDe(r.tipo)}</span>
        </p>

        <h1
          className={`mt-4 text-[26px] font-extrabold leading-tight tracking-tight ${
            hecho ? 'text-tinta-suave line-through' : 'text-tinta'
          }`}
        >
          {r.titulo}
        </h1>

        <p className={`mt-3 text-xl ${tarde ? 'text-coral' : 'text-tinta-suave'}`}>
          {cuando(r.fecha, r.hora)}
          {tarde && ' · sin hacer'}
        </p>

        {/* ── La nota, entera ── */}
        {r.nota && (
          <section className="mt-8 rounded-[24px] bg-superficie p-7">
            <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-tenue">
              Nota
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-xl leading-relaxed text-tinta">
              {r.nota}
            </p>
          </section>
        )}

        {/* ── Todo lo demás ── */}
        <div className="mt-6 divide-y divide-borde rounded-[24px] bg-superficie px-7">
          <Dato
            etiqueta="Para quién"
            valor={r.asignado_a ? (nombres[r.asignado_a] ?? '') : 'Los dos'}
          />
          <Dato etiqueta="Lo apuntó" valor={nombres[r.creado_por] ?? ''} />
          <Dato etiqueta="Estado" valor={hecho ? 'Hecho' : 'Pendiente'} />
          {hecho && r.hecho_por && (
            <Dato etiqueta="Lo marcó" valor={nombres[r.hecho_por] ?? ''} />
          )}
          {r.tipo === 'vencimiento' && (
            <Dato etiqueta="Aviso" valor={CUANTO_ANTES[r.aviso_previo ?? 'sin_aviso']} />
          )}
        </div>

        {/* ── De dónde salió ── */}
        {documento && (
          <Link
            href={`/documentos/${documento.id}`}
            className="mt-6 flex items-center justify-between rounded-[20px] border-2 border-borde bg-superficie px-6 py-5"
          >
            <span className="text-lg text-tinta">
              Sale de un documento
              <span className="mt-1 block text-base text-tenue">{documento.titulo}</span>
            </span>
            <span className="text-verde">›</span>
          </Link>
        )}

        <div className="mt-10">
          <AccionHecho id={r.id} hecho={hecho} />

          {/* Cambiar y borrar, siempre a mano. Lo que no se puede
              corregir se deja mal, y una lista con cosas mal apuntadas
              deja de servir para nada. */}
          <Editar
            id={r.id}
            inicial={{
              titulo: r.titulo,
              asignado_a: r.asignado_a,
              fecha: r.fecha,
              hora: r.hora,
              nota: r.nota,
              repite: r.repite,
              repite_hasta: r.repite_hasta,
            }}
            personas={(perfiles ?? []) as { id: string; nombre: string }[]}
          />
        </div>
      </div>
      <Barra activa="agenda" />
    </main>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="py-5">
      <p className="text-sm uppercase tracking-[0.15em] text-tenue">{etiqueta}</p>
      <p className={`mt-1 text-xl leading-snug ${valor ? 'text-tinta' : 'text-tenue'}`}>
        {valor || '—'}
      </p>
    </div>
  )
}
