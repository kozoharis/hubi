import Espera, { Hueco } from '../espera'

/*
  Cuentas: el título de «Cómo va cada una» y las actividades, que es
  lo primero que hay. La lámina de la casa va después y no se dibuja —
  un armazón que promete más de lo que a veces hay se lee como que
  falta algo.

  El pie de esta pantalla («Todo el dinero de la casa · septiembre»)
  lleva el mes dentro, así que aquí no se escribe: `conPie` reserva su
  altura y ya. Escribirlo significaría calcularlo dos veces en dos
  sitios, y el día que uno de los dos cambie, el título daría un salto
  al llegar la pantalla.
*/
export default function Cargando() {
  return (
    <Espera icono="euro" ambito="pizarra" titulo="Cuentas" conPie conCaja>
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
