import Espera from './espera'

/*
  Lo que se ve mientras la pantalla llega, cuando no sabemos cuál.

  Sin este archivo, Next no puede mandar NADA hasta que el servidor ha
  terminado de leer la base de datos: el teléfono se queda en blanco
  toda la espera. Con él, manda el armazón al instante y el contenido
  entra después.

  El tiempo total es el mismo. La sensación no: una pantalla en blanco
  parece averiada, y una que ya ha empezado a dibujarse parece rápida.
  Para Juan Miguel y Conchita eso es la diferencia entre volver a
  pulsar el botón —creyendo que no ha funcionado— y esperar tranquilos.

  A propósito no lleva ni texto ni «Cargando…» ni ruedecitas: solo la
  forma de lo que va a venir, en gris muy suave. Nada que leer, nada
  que dé la impresión de que algo va mal.

  ─────────────────────────────────────────────────────────────
  ESTE ES EL DE LA RAÍZ, Y ES EL GENÉRICO

  Desde aquí se puede ir a cualquier sitio, así que no hay cabecera
  que pintar: no sabemos ni el icono, ni el color, ni el nombre. Se
  pintan bloques y ya.

  Las pestañas sí lo saben, y cada una tiene el suyo —`loading.tsx`
  dentro de su carpeta— con su icono, su color y su título de verdad.
  Ver `app/espera.tsx`, que es de donde sale la forma común.

  El ancho también cambia: antes esto era `columna-formulario` —448 px
  para todas—, y en un ordenador eso significaba una columnita estrecha
  que después se abría de golpe. Ahora es el ancho de trabajo, que es
  el que declara la mayoría de las pantallas.
*/

export default function Cargando() {
  return <Espera />
}
