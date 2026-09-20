import Espera, { Hueco } from '../espera'

/*
  Los pagos fijos mientras llegan: la lista de lo que se paga solo,
  cada uno con su renglón y su cifra a la derecha.
*/
export default function Cargando() {
  return (
    <Espera icono="euro" ambito="pizarra" titulo="Pagos fijos" volver>
      <div className="space-y-2.5">
        <Hueco alto={78} redondez={20} />
        <Hueco alto={78} redondez={20} />
        <Hueco alto={78} redondez={20} />
      </div>
    </Espera>
  )
}
