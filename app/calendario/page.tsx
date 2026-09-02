import { redirect } from 'next/navigation'

/* El calendario vive ahora dentro de la Agenda. Ver `app/tablon/page.tsx`
   para el motivo de dejar la redirección en pie. */
export default async function Calendario({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; dia?: string }>
}) {
  const p = await searchParams
  const extra = [
    p.mes ? `mes=${encodeURIComponent(p.mes)}` : '',
    p.dia ? `dia=${encodeURIComponent(p.dia)}` : '',
  ].filter(Boolean)

  redirect(`/agenda?vista=mes${extra.length ? '&' + extra.join('&') : ''}`)
}
