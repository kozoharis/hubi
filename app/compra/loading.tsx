import Espera, { Hueco } from '../espera'

/*
  La compra mientras llega: la lista, que es lo único que hay.
  Renglones cortos y muchos, porque es una lista de la compra y no un
  informe. La cabecera de móvil es la corriente —pastilla y nombre en
  una fila de 56—, que es justo lo que pinta `page.tsx`.
*/
export default function Cargando() {
  return (
    <Espera icono="bolsa" ambito="arena" titulo="La compra" volver arriba="pt-1">
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
