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
/*
  ── `formulario` ──

  La tercera postura, y la que faltaba. Un formulario no se ensancha
  —448 px en las dos superficies— pero en grande sí se PEGA A LA
  IZQUIERDA, porque con el rail delante una columna centrada deja un
  pasillo vacío. Si la cabecera se quedara centrada y el formulario se
  fuera a la izquierda, el título flotaría encima de nada.

  Es `.columna-formulario`, que está escrita una sola vez en
  `globals.css` al lado de `.columna`.
*/
/*
  ── `texto` ──

  Y la cuarta, para las pantallas que son prosa seguida: 650 px a la
  izquierda. Ni 448, que parte las frases en renglones de ocho
  palabras, ni 1100, que el ojo recorre pero no lee.
*/
export default function Cabecera({
  children,
  ancho = false,
  formulario = false,
  texto = false,
}: {
  children: React.ReactNode
  ancho?: boolean
  formulario?: boolean
  texto?: boolean
}) {
  const medida = ancho
    ? 'columna'
    : texto
      ? 'columna-texto'
      : formulario
        ? 'columna-formulario'
        : 'mx-auto w-full max-w-md px-5'

  return (
    <div className="cabecera">
      <div className={medida}>{children}</div>
    </div>
  )
}
