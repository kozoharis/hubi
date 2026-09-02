/*
  Lo que se ve mientras la pantalla llega.

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
*/

export default function Cargando() {
  return (
    <main className="espera min-h-screen pb-40" aria-hidden>
      <div className="techo mx-auto w-full max-w-md px-5">
        <div className="flex h-14 items-center justify-between">
          <Hueco ancho={120} alto={26} />
          <Hueco ancho={44} alto={44} redondez={999} />
        </div>

        <div className="mt-4 space-y-2">
          <Hueco ancho={140} alto={15} />
          <Hueco ancho={230} alto={28} />
        </div>

        <div className="mt-6 space-y-3">
          <Hueco alto={74} redondez={22} />
          <Hueco alto={74} redondez={22} />
          <Hueco alto={74} redondez={22} />
        </div>
      </div>
    </main>
  )
}

function Hueco({
  ancho,
  alto,
  redondez = 12,
}: {
  ancho?: number
  alto: number
  redondez?: number
}) {
  return (
    <div
      className="latido"
      style={{
        width: ancho ? `${ancho}px` : '100%',
        height: `${alto}px`,
        borderRadius: `${redondez}px`,
        background: 'var(--t-borde)',
      }}
    />
  )
}
