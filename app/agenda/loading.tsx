import Espera, { Hueco, TituloMovil } from '../espera'

/*
  La Agenda mientras llega.

  En el móvil, debajo del nombre van las tres pastillas —Semana · Mes ·
  El día— y después, ya en el cuerpo, la caja de MAPPEL. Sin la tira de
  los siete días: a 360 px es una fila de casillas pequeñas y en gris
  parece suciedad.
*/
export default function Cargando() {
  return (
    <Espera
      icono="calendario"
      ambito="azul"
      titulo="Agenda"
      conCaja
      conControles
      ancho="ancho-panoramica"
      movil={
        <>
          <TituloMovil icono="calendario" ambito="azul" titulo="Agenda" />
          <div className="espera mt-2">
            <Hueco alto={48} redondez={999} />
          </div>
        </>
      }
    >
      {/* La caja de MAPPEL, que en el móvil vive aquí abajo. */}
      <div className="mb-4 lg:hidden">
        <Hueco alto={64} redondez={18} />
      </div>

      <div className="space-y-3">
        <Hueco ancho={140} alto={15} />
        <Hueco alto={64} redondez={20} />
        <Hueco alto={64} redondez={20} />
        <Hueco ancho={140} alto={15} />
        <Hueco alto={64} redondez={20} />
      </div>
    </Espera>
  )
}
