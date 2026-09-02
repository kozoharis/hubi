/*
  La cabecera de cada pantalla, clavada arriba.

  Va suelta dentro de <main>, no dentro de la columna de contenido, y
  por eso ocupa todo el ancho: si estuviera dentro de la columna, al
  hacer scroll el contenido asomaría por los 20 px de margen de los
  lados. Detalle pequeño, feo de ver.

  El fondo es el del tema a un 80% con desenfoque por detrás: así el
  color que se mueve en Inicio no desaparece bajo una banda opaca,
  pero el título se sigue leyendo sobre lo que pase por debajo.
*/
export default function Cabecera({ children }: { children: React.ReactNode }) {
  return (
    <div className="cabecera">
      <div className="mx-auto w-full max-w-md px-5">{children}</div>
    </div>
  )
}
