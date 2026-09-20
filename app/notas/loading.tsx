import Espera, { Hueco } from '../espera'

/*
  Las notas mientras llegan: el corcho, que en el móvil es una columna
  y en el ordenador tres. Con las dos pastillas reservadas arriba —«En
  el corcho» y «Guardadas»— porque van a su propia línea y son 48 px
  que, sin reservar, empujan el corcho entero al llegar.
*/
export default function Cargando() {
  return (
    <Espera icono="chincheta" ambito="arena" titulo="Notas" volver conControles>
      <div className="space-y-2.5 lg:[columns:17rem] lg:gap-3 lg:space-y-0">
        <Hueco alto={96} redondez={20} />
        <Hueco alto={72} redondez={20} />
        <Hueco alto={120} redondez={20} />
      </div>
    </Espera>
  )
}
