import Cuentas from '../cuentas'

export const dynamic = 'force-dynamic'

/* La Finca. Las cuentas las lleva la pantalla compartida. */
export default function Finca({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; ancla?: string }>
}) {
  return (
    <Cuentas
      seccion={{
        raiz: 'FINCA',
        nombre: 'Finca',
        icono: 'hoja',
        color: '#14B8A6',
        fondo: '#DFF7F3',
        ruta: '/finca',
        pestana: 'finca',
      }}
      searchParams={searchParams}
    />
  )
}
