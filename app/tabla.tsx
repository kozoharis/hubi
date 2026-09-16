'use client'

import type { ReactNode } from 'react'
import Link from './enlace'
import { AMBITO, type Ambito } from '@/lib/ambitos'

/*
  ═══════════════════════════════════════════════════════════════
  LA TABLA · una lista bien alineada, no una hoja de cálculo
  ═══════════════════════════════════════════════════════════════

  Es la pieza que más cambia la sensación de escritorio de MAPPEL, y la
  que más fácil se va hacia lo corporativo. Sustituye a las rejillas de
  tarjetas con chevrón en Papeles, Cuentas, Pagos y el escritorio de
  casas.

  ─────────────────────────────────────────────────────────────
  POR QUÉ UNA TABLA Y NO TARJETAS

  Una tarjeta es un objeto para el pulgar, y el chevrón de su derecha
  es una promesa: «te llevo a otra pantalla». En un ordenador eso es
  justo lo que sobra. Lo que se quiere ahí es COMPARAR —fecha, importe,
  quién lo guardó— y comparar exige que las cosas estén alineadas.

  En Papeles la cuenta sale sola: la rejilla de dos columnas enseñaba
  cuatro papeles; esto enseña doce.

  ─────────────────────────────────────────────────────────────
  LOS CINCO FRENOS

  Contra la hoja de cálculo hay cinco cosas puestas a propósito, y
  conviene no quitarlas de una en una sin darse cuenta:

    1 · SIN CEBRA. El renglón de 1 px ya separa. Pintar una fila sí y
        otra no añade una raya horizontal cada 50 px que no significa
        nada.

    2 · SIN LÍNEAS VERTICALES. Ninguna. Son las que convierten una
        lista en una cuadrícula.

    3 · LA CABECERA, CALLADA. Diez píxeles, versales, gris claro y una
        sola línea debajo. SIN FONDO: el fondo gris de cabecera era lo
        que más «rejilla» daba de todo.

    4 · MUCHO AIRE ENTRE EL NOMBRE Y SUS DATOS. Veintiocho píxeles, no
        trece. Es lo que convierte una rejilla en una lista bien
        alineada, y es gratis.

    5 · UNA PASTILLA DE COLOR POR RENGLÓN. El cuadradito del ámbito a
        la izquierda es lo que ancla el ojo al recorrer en vertical, y
        es lo único de color que hay.

  Y la regla que las gobierna: **si hay que meter una columna más y no
  cabe, se quita una columna. Nunca se baja la letra.** El nombre va a
  16 px y el resto a 15; por debajo de eso no se baja aunque sobren
  columnas que enseñar.

  ─────────────────────────────────────────────────────────────
  UNA SOLA FUENTE PARA LAS COLUMNAS

  `columnas` es una plantilla de rejilla y la usan la cabecera y todos
  los renglones, leyéndola de la misma variable. Escribirla dos veces
  —una en la cabecera, otra en cada fila— es como se desalinean las
  tablas: alguien añade una columna en un sitio y no en el otro, y el
  fallo aparece tres semanas después en una pantalla que nadie estaba
  mirando.

  ─────────────────────────────────────────────────────────────
  ESTO NO EXISTE EN EL MÓVIL

  `hidden lg:block`. En un teléfono una tabla de seis columnas no se
  puede leer, y la lista de tarjetas de siempre es lo correcto. Cada
  pantalla mantiene la suya dentro de un `lg:hidden`, igual que ya hace
  con las cabeceras.

  ─────────────────────────────────────────────────────────────
  Y LA ALTURA LA PONE LA DENSIDAD

  `--fila` y `--hueco`, que vienen de `globals.css` y dependen del
  puntero, no del ancho. La tabla no decide su densidad: la hereda. Una
  pantalla que quiera la de trabajo se pone `denso-trabajo` y ya está,
  y ni siquiera entonces baja de 44 px de objetivo.
*/

export function Tabla({
  columnas,
  cabecera,
  children,
  pie,
}: {
  /** La plantilla de rejilla. Una sola vez, para todo. */
  columnas: string
  /** Los rótulos de arriba, en el mismo orden que las celdas. */
  cabecera?: ReactNode[]
  children: ReactNode
  /** La frase de debajo del todo, si la pantalla tiene algo que decir. */
  pie?: ReactNode
}) {
  return (
    <div
      className="hidden overflow-hidden rounded-[16px] border border-borde bg-superficie lg:block"
      style={{ ['--columnas' as string]: columnas }}
    >
      {cabecera && (
        <div
          role="row"
          className="grid items-center gap-x-7 border-b border-borde px-4 py-2"
          style={{ gridTemplateColumns: 'var(--columnas)' }}
        >
          {cabecera.map((c, i) => (
            <span
              key={i}
              className="text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-apagado"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {children}

      {pie && (
        <div className="border-t border-borde/60 px-4 py-4 text-center text-[14px] text-tenue">
          {pie}
        </div>
      )}
    </div>
  )
}

/*
  UN RENGLÓN.

  Puede ser un enlace —el caso normal, y entonces es pulsable de punta
  a punta, no solo el nombre— o un botón, cuando elegir no lleva a
  ninguna parte sino que rellena la zona de al lado.

  Los tres estados están aquí y son los tres del espécimen aprobado:

    en reposo      blanco, una línea casi invisible debajo
    bajo el cursor fondo de papel, y SOLO con ratón
    elegido        barra verde de 3 px, fondo verde muy claro y el
                   nombre en semibold

  El de en medio va dentro de `(pointer: fine)` a propósito: con el
  dedo no existe el «pasar por encima», y dejarlo puesto hace que una
  fila se quede pintada después de tocarla, como si siguiera elegida.
*/
export function Renglon({
  children,
  href,
  alElegir,
  elegido = false,
  apagado = false,
}: {
  children: ReactNode
  /** A dónde lleva. En el móvil y cuando no hay zona donde enseñarlo. */
  href?: string
  /** Rellena la zona de al lado en vez de llevar a otra pantalla. */
  alElegir?: () => void
  elegido?: boolean
  /** Lo que ya no reclama: un papel viejo, una casa callada. */
  apagado?: boolean
}) {
  const clases =
    'fila-lista grid w-full items-center gap-x-7 border-b border-borde/60 px-4 py-2 text-left text-[15px] transition-colors last:border-b-0 ' +
    (elegido
      ? 'bg-verde-suave shadow-[inset_3px_0_0_var(--color-bien)] '
      : 'roza ') +
    (apagado ? 'text-apagado' : '')

  const dentro = <>{children}</>

  if (href) {
    return (
      <Link
        href={href}
        aria-current={elegido ? 'true' : undefined}
        className={clases}
        style={{ gridTemplateColumns: 'var(--columnas)' }}
      >
        {dentro}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={alElegir}
      aria-current={elegido ? 'true' : undefined}
      className={clases}
      style={{ gridTemplateColumns: 'var(--columnas)' }}
    >
      {dentro}
    </button>
  )
}

/*
  EL CUADRADITO DE COLOR.

  Diez píxeles y nada más. No es un icono ni una pastilla: es el ancla
  que deja recorrer la columna de nombres en vertical sin perderse, y
  lo único de color que hay en toda la tabla.
*/
export function Punto({ ambito }: { ambito: Ambito }) {
  return (
    <span
      aria-hidden
      className="block h-[10px] w-[10px] shrink-0 rounded-[3px]"
      style={{ background: AMBITO[ambito] }}
    />
  )
}

/*
  EL NOMBRE, con su segunda línea opcional.

  Va a 16 px —un punto por encima del resto de la fila— porque es lo
  que se lee al recorrer, y porque la regla dice que cuando falta sitio
  se quita una columna y no se baja la letra.
*/
export function Nombre({ children, pie }: { children: ReactNode; pie?: ReactNode }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-[16px] font-semibold">{children}</span>
      {pie && <span className="mt-0.5 block truncate text-[13px] text-tenue">{pie}</span>}
    </span>
  )
}

/** Un dato secundario: la categoría, la fecha, quién lo guardó. */
export function Dato({ children }: { children: ReactNode }) {
  return <span className="truncate text-[13px] text-tenue">{children}</span>
}

/*
  UNA CANTIDAD.

  A la derecha y con cifras de ancho fijo, que es lo único que permite
  compararlas de un vistazo: sin `tabular-nums`, un 1 ocupa menos que
  un 8 y las columnas de euros quedan dentadas.
*/
export function Cifra({
  children,
  color,
}: {
  children: ReactNode
  /** Sólo cuando el signo significa algo: un ingreso, un descubierto. */
  color?: 'bien' | 'alerta'
}) {
  return (
    <span
      className={
        'truncate text-right font-bold tabular-nums ' +
        (color === 'bien' ? 'text-bien' : color === 'alerta' ? 'text-alerta' : '')
      }
    >
      {children}
    </span>
  )
}
