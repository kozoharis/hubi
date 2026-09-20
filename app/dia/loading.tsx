import Espera, { Hueco } from '../espera'

/*
  El día a día: las tarjetas grandes de la compra, los menús y las
  notas. Son cuadradas y grandes, y por eso el armazón no se parece al
  de las demás — que es exactamente lo que se busca.
*/
export default function Cargando() {
  return (
    <Espera
      icono="taza"
      ambito="arena"
      titulo="El día a día"
      pie="La compra, la casa, los menús y el corcho"
      conCaja
    >
      <div className="grid grid-cols-2 gap-3">
        <Hueco alto={132} redondez={24} />
        <Hueco alto={132} redondez={24} />
        <Hueco alto={132} redondez={24} />
        <Hueco alto={132} redondez={24} />
      </div>
    </Espera>
  )
}
