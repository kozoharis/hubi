import { pintaDe } from '../iconos'
import { AMBITO, PastillaAmbito } from '../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  UNA COSA EN LA PARED
  ═══════════════════════════════════════════════════════════════

  La misma tarjeta de `tablon/tarjeta.tsx`, sin nada de lo que se toca:
  papel blanco, marca del ámbito al borde izquierdo, pastilla con el
  icono dibujado, y el cuándo en cifra tabular a la izquierda del texto.

  Tres tamaños: el de Hoy, el de las listas, y el de dentro de un día de
  la semana, que va en una columna estrecha y no lleva columna de
  cuándo. Y ni uno más — por la misma razón por la que `Fila` tiene dos
  alturas: en cuanto haya cuatro, vuelve a haber un dibujo por pantalla
  en vez de un sistema.
*/

export type Talla = 'hoy' | 'lista' | 'columna'

/*
  ═══════════════════════════════════════════════════════════════
  UN RENGLÓN · para las siete columnas de la semana
  ═══════════════════════════════════════════════════════════════

  En la pestaña de la Semana, cada día mide unos 250 px. Ahí una
  tarjeta NO cabe, y se vio renderizándola: la pastilla de 40 px más los
  dos rellenos se comían la mitad del ancho, y «Recoger la medicación en
  la farmacia» salía en CUATRO renglones. Encima era una tarjeta blanca
  dentro de otra tarjeta blanca — dos bordes y dos redondeos para decir
  lo mismo.

  Así que dentro de una columna, una cosa no es una tarjeta: es un
  renglón. Un punto de su color, la hora, y el texto con todo el ancho.

  No es un dibujo nuevo: es la misma idea de la marca de ámbito de
  `Fila`, reducida a lo que cabe. Y es la misma forma con la que se
  escriben los platos justo debajo, para que un día de la semana se lea
  como una sola lista y no como dos inventos.
*/
export function Renglon({
  titulo,
  cuando,
  hecha = false,
}: {
  titulo: string
  cuando?: string
  hecha?: boolean
}) {
  const p = pintaDe(titulo)

  return (
    <li className={`flex gap-2.5 ${hecha ? 'opacity-50' : ''}`}>
      <span
        className="mt-[9px] block h-[9px] w-[9px] shrink-0 rounded-full"
        style={{ background: AMBITO[p.ambito] }}
      />
      <span className="min-w-0 flex-1">
        {cuando && (
          <span className="block text-[15px] font-extrabold tabular-nums text-tenue">{cuando}</span>
        )}
        <span
          className={`block text-[17.5px] font-extrabold leading-snug text-tinta ${
            hecha ? 'line-through' : ''
          }`}
        >
          {titulo}
        </span>
      </span>
    </li>
  )
}

export default function Cosa({
  titulo,
  cuando,
  talla = 'lista',
  hecha = false,
}: {
  titulo: string
  /** La hora, o el día. Ya escrito: quien lo sabe es de fuera. */
  cuando?: string
  talla?: Talla
  hecha?: boolean
}) {
  /*
    La MISMA función que pinta esa tarea en el tablón y en la agenda.
    Esta pantalla llegó a tener su propia tabla de emojis, así que una
    cita médica era 🩺 aquí y un corazón rosa en el móvil: dos idiomas
    para la misma cosa, y ninguno de los dos era el de HUBI.
  */
  const p = pintaDe(titulo)

  const marco =
    talla === 'hoy'
      ? 'gap-7 px-7 py-6'
      : talla === 'lista'
        ? 'gap-5 px-6 py-4'
        : 'gap-3.5 px-4 py-3'

  return (
    <li
      className={`flex items-center rounded-[28px] border bg-superficie ${marco} ${
        hecha ? 'opacity-50' : ''
      }`}
      style={{
        borderColor: 'var(--t-borde)',
        borderLeft: `6px solid ${AMBITO[p.ambito]}`,
      }}
    >
      {/*
        El cuándo va PRIMERO, que es lo que se busca desde la puerta, y
        en columna fija para que los títulos de todas las filas empiecen
        en el mismo sitio. Sin hora, la columna se queda vacía en vez de
        poner una raya: un guion a 40 px es una cosa que hay que leer
        para descubrir que no dice nada.

        275 px en las listas, y `whitespace-nowrap`. Con 230, «mar 10
        ago 2027» partía y dejaba el «2027» solo en la línea de abajo —
        la regla 1 de `reglas-de-pantalla.md`, que en esta pantalla ya ha
        aparecido dos veces.
      */}
      {talla !== 'columna' && (
        <span
          className={`shrink-0 whitespace-nowrap font-extrabold tabular-nums tracking-tight ${
            talla === 'hoy'
              ? 'w-[132px] text-[40px] text-tinta xl:w-[150px] xl:text-[48px]'
              : 'w-[275px] text-[26px] text-tinta-suave'
          }`}
        >
          {cuando ?? ''}
        </span>
      )}

      <PastillaAmbito
        icono={p.icono}
        ambito={p.ambito}
        tam={talla === 'hoy' ? 64 : talla === 'lista' ? 48 : 40}
      />

      <span className="min-w-0 flex-1">
        {/* En columna el cuándo no cabe al lado, así que va encima y
            pequeño. Quitarlo del todo dejaría un día entero de la
            semana sin decir a qué hora es nada. */}
        {talla === 'columna' && cuando && (
          <span className="block text-[15px] font-extrabold tabular-nums text-tenue">{cuando}</span>
        )}
        <span
          className={`block font-extrabold leading-tight text-tinta ${
            talla === 'hoy'
              ? 'text-[34px] xl:text-[38px]'
              : talla === 'lista'
                ? 'text-[27px]'
                : 'text-[18px]'
          } ${hecha ? 'line-through' : ''}`}
        >
          {titulo}
        </span>
      </span>
    </li>
  )
}
