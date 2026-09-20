import Espera, { Hueco } from '../espera'

/*
  La Agenda: la fila de Semana · Mes · El día, y debajo los días con
  sus renglones. Sin la tira de los siete: a 360 px es una fila de
  casillas pequeñas y en gris parece suciedad.
*/
export default function Cargando() {
  return (
    <Espera
      icono="calendario"
      ambito="azul"
      titulo="Agenda"
      conCaja
      ancho="ancho-panoramica"
    >
      <div className="flex gap-2">
        <Hueco alto={48} redondez={999} />
        <Hueco alto={48} redondez={999} />
        <Hueco alto={48} redondez={999} />
      </div>
      <div className="mt-5 space-y-3">
        <Hueco ancho={140} alto={15} />
        <Hueco alto={64} redondez={20} />
        <Hueco alto={64} redondez={20} />
        <Hueco ancho={140} alto={15} />
        <Hueco alto={64} redondez={20} />
      </div>
    </Espera>
  )
}
