import { redirect } from 'next/navigation'

/*
  El Tablón vive ahora dentro de la Agenda.

  Esto se queda como redirección y no se borra: los avisos que ya se
  mandaron al móvil llevan `/tablon` dentro, y quien los abra dentro de
  un mes tiene que llegar a algún sitio. Un enlace roto en un aviso es
  peor que no haber avisado.
*/
export default async function Tablon({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>
}) {
  const { ver } = await searchParams
  redirect(ver === 'hechas' ? '/agenda?ver=hechas' : '/agenda')
}
