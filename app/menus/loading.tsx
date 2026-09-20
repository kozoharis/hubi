import Espera, { Hueco, VolverQuieto } from '../espera'

/*
  Los menús mientras llegan: la tira de la semana arriba y debajo los
  siete días. En el ordenador es panorámica porque las recetas se abren
  en dos columnas.

  En el móvil, volver y el nombre a secas, sin pastilla — como en
  `page.tsx`.
*/
export default function Cargando() {
  return (
    <Espera
      icono="taza"
      ambito="arena"
      titulo="Menús"
      volver
      ancho="ancho-panoramica"
      arriba=""
      movil={
        <>
          <VolverQuieto />
          <h1 className="t-titulo mt-2.5">Menús</h1>
        </>
      }
    >
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
