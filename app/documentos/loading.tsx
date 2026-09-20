import Espera, { Hueco } from '../espera'

/*
  Papeles mientras llega: las carpetas de dos en dos, que es lo que hay
  debajo del título. La caja de MAPPEL no se dibuja aquí porque no vive
  aquí: vive en la cabecera, y la pone `Espera` con `conCaja`.
*/
export default function Cargando() {
  return (
    <Espera
      icono="carpeta"
      ambito="azul"
      titulo="Papeles"
      conCaja
      ancho="ancho-panoramica"
    >
      <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        <Hueco alto={84} redondez={20} />
        <Hueco alto={84} redondez={20} />
        <Hueco alto={84} redondez={20} />
        <Hueco alto={84} redondez={20} />
      </div>
    </Espera>
  )
}
