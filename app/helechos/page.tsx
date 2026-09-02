import Cuentas from '../cuentas'

export const dynamic = 'force-dynamic'

/*
  Los Helechos — la casa de Los Realejos.

  Tres apartamentos en alquiler vacacional, con sus gastos (gestión,
  limpieza, mantenimiento, suministros) y sus ingresos (las plataformas
  y las reservas directas).

  Empezó contando como una sola casa, a propósito. Ya no: cada apunte
  lleva su apartamento —Helechos 1, 2 o 3, o "toda la casa"— y los
  ingresos llevan además las noches y las personas. Eso es lo que
  permite saber cuál se reserva más y cuál RENTA más, que no son
  siempre el mismo.

  Los gastos comunes —la luz, el seguro, la gestoría— no son de ningún
  apartamento: se apuntan a "toda la casa" y la pantalla los reparte a
  partes iguales, diciéndolo.
*/
export default function Helechos({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; ancla?: string }>
}) {
  return (
    <Cuentas
      seccion={{
        raiz: 'HELECHOS',
        nombre: 'Los Helechos',
        icono: 'casa',
        color: '#F59E0B',
        fondo: '#FEF1DC',
        ruta: '/helechos',
        pestana: 'helechos',
        apartamentos: true,
        etiquetaUnidades: 'Cada apartamento',
      }}
      searchParams={searchParams}
    />
  )
}
