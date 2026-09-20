import Espera, { Hueco, VolverQuieto } from '../espera'

/*
  Los pagos fijos mientras llegan: la lista de lo que se paga solo,
  cada uno con su renglón y su cifra a la derecha. En el móvil, volver
  y el nombre a secas — como en `page.tsx`.
*/
export default function Cargando() {
  return (
    <Espera
      icono="euro"
      ambito="pizarra"
      titulo="Pagos fijos"
      volver
      arriba=""
      movil={
        <>
          <VolverQuieto />
          <h1 className="t-titulo mt-2.5">Pagos fijos</h1>
        </>
      }
    >
      <div className="space-y-2.5">
        <Hueco alto={78} redondez={20} />
        <Hueco alto={78} redondez={20} />
        <Hueco alto={78} redondez={20} />
      </div>
    </Espera>
  )
}
