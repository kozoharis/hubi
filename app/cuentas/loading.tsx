import Espera, { Hueco } from '../espera'

/*
  Cuentas mientras llega: el título de «Cómo va cada una» y las
  actividades, que es lo primero que hay. La lámina de la casa va
  después y no se dibuja — un armazón que promete más de lo que a veces
  hay se lee como que falta algo.

  En el móvil la cabecera es sólo la pastilla y el nombre: **sin
  subtítulo**. El subtítulo («Todo el dinero de la casa · septiembre»)
  es de la cabecera de escritorio, y ahí lleva el mes dentro, así que
  no se escribe: `conPie` reserva su altura y ya.
*/
export default function Cargando() {
  return (
    <Espera icono="euro" ambito="pizarra" titulo="Cuentas" conPie conCaja arriba="pt-1">
      {/* La caja de MAPPEL, que en el móvil vive aquí abajo. */}
      <div className="mb-4 lg:hidden">
        <Hueco alto={64} redondez={18} />
      </div>

      <Hueco ancho={180} alto={22} />
      <div className="mt-4 space-y-2.5">
        <Hueco alto={80} redondez={20} />
        <Hueco alto={80} redondez={20} />
      </div>
      <div className="mt-7 space-y-2.5">
        <Hueco ancho={120} alto={15} />
        <Hueco alto={74} redondez={20} />
        <Hueco alto={74} redondez={20} />
      </div>
    </Espera>
  )
}
