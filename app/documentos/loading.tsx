import Espera, { Hueco, TituloMovil } from '../espera'

/*
  Papeles mientras llega.

  En el móvil su cabecera es una fila de 48 —no de 56— con la caja de
  MAPPEL justo debajo, pegada. Está copiada de `Titulo` y `Buscador`
  en `page.tsx`, que es de donde sale.
*/
export default function Cargando() {
  return (
    <Espera
      icono="carpeta"
      ambito="azul"
      titulo="Papeles"
      conCaja
      ancho="ancho-panoramica"
      movil={
        <>
          <TituloMovil icono="carpeta" ambito="azul" titulo="Papeles" alto="h-12" />
          <div className="espera mt-1">
            <Hueco alto={64} redondez={18} />
          </div>
        </>
      }
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
