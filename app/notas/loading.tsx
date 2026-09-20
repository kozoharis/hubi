import Espera, { Hueco, VolverQuieto } from '../espera'

/*
  Las notas mientras llegan: el corcho, que en el móvil es una columna
  y en el ordenador tres.

  En el móvil la cabecera es el botón de volver y el nombre a secas
  —sin pastilla—, y las dos pastillas de elegir («En el corcho» y
  «Guardadas») van ya en el cuerpo. Está copiado de `page.tsx`.
*/
export default function Cargando() {
  return (
    <Espera
      icono="chincheta"
      ambito="arena"
      titulo="Notas"
      volver
      conControles
      movil={
        <>
          <VolverQuieto />
          <div className="flex h-12 items-center">
            <h1 className="t-titulo">Notas</h1>
          </div>
        </>
      }
    >
      <div className="mb-4 lg:hidden">
        <Hueco ancho={260} alto={48} redondez={999} />
      </div>

      <div className="space-y-2.5 lg:[columns:17rem] lg:gap-3 lg:space-y-0">
        <Hueco alto={96} redondez={20} />
        <Hueco alto={72} redondez={20} />
        <Hueco alto={120} redondez={20} />
      </div>
    </Espera>
  )
}
