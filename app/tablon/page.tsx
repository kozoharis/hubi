import { redirect } from 'next/navigation'
import { aqui } from '@/lib/enlaces'

/*
  El Tablón vive ahora dentro de la Agenda.

  Esto se queda como redirección y no se borra: los avisos que ya se
  mandaron al móvil llevan `/tablon` dentro, y quien los abra dentro de
  un mes tiene que llegar a algún sitio. Un enlace roto en un aviso es
  peor que no haber avisado.
*/
/*
  Antes esto miraba `?ver=hechas` y redirigía a `/agenda?ver=hechas`.
  Ese parámetro dejó de existir en Fase 2 —lo hecho ya no tiene
  pestaña propia, se ve tachado en su día— así que ahora todo va a la
  Agenda a secas, que es donde está lo que se buscaba.
*/
export default async function Tablon() {
  redirect(await aqui('/agenda'))
}
