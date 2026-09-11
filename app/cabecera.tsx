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
/*
  ── `ancho` ──

  La cabecera tiene que medir lo mismo que lo que hay debajo, o el
  título se queda flotando en mitad del papel mientras el contenido
  llega hasta el borde. Con `ancho` usa la misma columna que ellas:
  448 px en el móvil, 1100 y a la izquierda en grande.

  Es opcional y por defecto no hace nada: las pantallas que todavía no
  tienen tratamiento ancho siguen exactamente como estaban.
*/
export default function Cabecera({
  children,
  ancho = false,
}: {
  children: React.ReactNode
  ancho?: boolean
}) {
  return (
    <div className="cabecera">
      <div className={ancho ? 'columna' : 'mx-auto w-full max-w-md px-5'}>{children}</div>
    </div>
  )
}
