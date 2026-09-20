import Espera, { Hueco } from '../espera'

/*
  Los menús mientras llegan: la tira de la semana arriba y debajo los
  siete días. En el ordenador es panorámica porque las recetas se abren
  en dos columnas.
*/
export default function Cargando() {
  return (
    <Espera icono="taza" ambito="arena" titulo="Menús" volver ancho="ancho-panoramica">
      <Hueco alto={52} redondez={999} />
      <div className="mt-4 space-y-2.5">
        <Hueco alto={68} redondez={20} />
        <Hueco alto={68} redondez={20} />
        <Hueco alto={68} redondez={20} />
        <Hueco alto={68} redondez={20} />
      </div>
    </Espera>
  )
}
