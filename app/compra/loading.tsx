import Espera, { Hueco } from '../espera'

/*
  La compra mientras llega: la lista, que es lo único que hay. Renglones
  cortos y muchos, porque es una lista de la compra y no un informe.
*/
export default function Cargando() {
  return (
    <Espera icono="bolsa" ambito="arena" titulo="La compra" volver>
      <div className="space-y-2">
        <Hueco alto={58} redondez={18} />
        <Hueco alto={58} redondez={18} />
        <Hueco alto={58} redondez={18} />
        <Hueco alto={58} redondez={18} />
        <Hueco alto={58} redondez={18} />
      </div>
    </Espera>
  )
}
