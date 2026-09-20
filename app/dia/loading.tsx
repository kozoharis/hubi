import Espera, { Hueco } from '../espera'

/*
  El día a día mientras llega: las tarjetas grandes de la compra, la
  casa, los menús y el corcho. Son cuadradas y grandes, y por eso el
  armazón no se parece al de las demás — que es exactamente lo que se
  busca.

  En el móvil la cabecera es sólo la pastilla y el nombre, **sin
  subtítulo**: «La compra, la casa, los menús y el corcho» es de la
  cabecera de escritorio.
*/
export default function Cargando() {
  return (
    <Espera
      icono="taza"
      ambito="arena"
      titulo="El día a día"
      pie="La compra, la casa, los menús y el corcho"
      conCaja
      arriba="pt-1"
    >
      {/* La caja de MAPPEL, que en el móvil vive aquí abajo. */}
      <div className="pb-1.5 lg:hidden">
        <Hueco alto={64} redondez={18} />
      </div>

      {/* En el móvil son cuatro puertas en fila —76 px, la medida de
          `TarjetaAccion`—; en el ordenador la pantalla enseña lo que
          hay dentro de cada una, y eso son láminas grandes. */}
      <div className="space-y-2.5 lg:hidden">
        <Hueco alto={76} redondez={20} />
        <Hueco alto={76} redondez={20} />
        <Hueco alto={76} redondez={20} />
        <Hueco alto={76} redondez={20} />
      </div>
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-3">
        <Hueco alto={210} redondez={24} />
        <Hueco alto={210} redondez={24} />
        <Hueco alto={210} redondez={24} />
        <Hueco alto={210} redondez={24} />
      </div>
    </Espera>
  )
}
