'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Ico, pintaDe } from '../iconos'
import { AMBITO, PastillaAmbito } from '../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  UNA COSA EN LA PARED
  ═══════════════════════════════════════════════════════════════

  La misma tarjeta de `tablon/tarjeta.tsx`: papel blanco, marca del
  ámbito al borde izquierdo, pastilla con el icono dibujado, y el cuándo
  en cifra tabular a la izquierda del texto.

  Tres tamaños: el de Hoy, el de las listas, y el de dentro de una
  columna. Y ni uno más — por la misma razón por la que `Fila` tiene dos
  alturas: en cuanto haya cuatro, vuelve a haber un dibujo por pantalla
  en vez de un sistema.

  ─────────────────────────────────────────────────────────────
  Y DESDE EL PASO 74, SE PUEDE TACHAR

  Con `id`, la tarjeta entera es un botón que marca hecho y deshecho.
  Sin `id`, es papel: se lee y no se toca.

  Se pasa `id` donde tachar significa algo —lo de HOY y el día que se
  abre desde el calendario— y no en «Después» ni dentro de las columnas
  de la semana. Tachar el martes que viene desde una pared, de paso, es
  la clase de toque que se da sin querer y que nadie deshace porque
  nadie se entera.

  ─────────────────────────────────────────────────────────────
  LO QUE LA PARED PUEDE Y LO QUE NO, Y DÓNDE ESTÁ DECIDIDO

  Aquí no se comprueba nada: se intenta y manda la base.

      la política del 74  →  solo las filas que se ven en la pared
      el disparador       →  solo las columnas `estado`, `hecho_en`
                             y `hecho_por`

  Si alguien quitara la política mañana, esto empezaría a fallar solo,
  que es lo que tiene que pasar. Comprobarlo también aquí sería una
  segunda regla para lo mismo, y el día que una se olvide conviene que
  se olvide la que no protege.
*/

export type Talla = 'hoy' | 'lista' | 'columna'

export default function Cosa({
  id,
  titulo,
  cuando,
  talla = 'lista',
  hecha = false,
}: {
  /** Con identificador, se puede tachar. Sin él, es papel. */
  id?: string
  titulo: string
  /** La hora, o el día. Ya escrito: quien lo sabe es de fuera. */
  cuando?: string
  talla?: Talla
  hecha?: boolean
}) {
  const router = useRouter()
  const [marcada, setMarcada] = useState(hecha)
  const [fallo, setFallo] = useState(false)

  /*
    La MISMA función que pinta esa tarea en el tablón y en la agenda.
    Esta pantalla llegó a tener su propia tabla de emojis, así que una
    cita médica era 🩺 aquí y un corazón rosa en el móvil: dos idiomas
    para la misma cosa, y ninguno de los dos era el de HUBI.
  */
  const p = pintaDe(titulo)

  async function tachar() {
    if (!id) return
    const antes = marcada

    /* Se pinta ya. En una pared, un toque que tarda medio segundo en
       responder se vuelve a dar. */
    setMarcada(!antes)
    setFallo(false)

    try {
      const r = await fetch(api(`/api/recordatorios/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: antes ? 'pendiente' : 'hecho' }),
      })
      if (!r.ok) throw new Error()
      router.refresh()
    } catch {
      setMarcada(antes)
      setFallo(true)
    }
  }

  const marco =
    talla === 'hoy'
      ? 'gap-7 px-7 py-6'
      : talla === 'lista'
        ? 'gap-5 px-6 py-4'
        : 'gap-3.5 px-4 py-3'

  const dentro = (
    <>
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
          } ${marcada ? 'line-through' : ''}`}
        >
          {titulo}
        </span>
        {fallo && (
          <span className="mt-1 block text-[17px] font-bold" style={{ color: 'var(--t-alerta)' }}>
            No se ha podido cambiar
          </span>
        )}
      </span>

      {/*
        La casilla, al final. No es lo que se toca —se toca la fila
        entera— : está para DECIR que esto se tacha, y para que se vea
        desde lejos cuáles quedan.

        Al final y no al principio a propósito: delante rompería el
        orden de lectura que ya tiene esta tarjeta —cuándo, qué— y que
        es el mismo en las cinco pantallas de la pared.
      */}
      {id && (
        <span
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] border-2"
          style={{
            borderColor: marcada ? 'transparent' : 'var(--t-borde)',
            background: marcada ? AMBITO.verde : 'transparent',
            color: '#FFFFFF',
          }}
        >
          {marcada && <Ico nombre="check" tam={26} grosor={2.6} />}
        </span>
      )}
    </>
  )

  const pinta = {
    borderColor: 'var(--t-borde)',
    borderLeft: `6px solid ${marcada ? 'var(--t-borde)' : AMBITO[p.ambito]}`,
  }

  const clase =
    `flex w-full items-center rounded-[28px] border bg-superficie ${marco} ` +
    `${marcada ? 'opacity-50' : ''}`

  return (
    <li>
      {id ? (
        <button type="button" onClick={tachar} className={`tocable ${clase} text-left`} style={pinta}>
          {dentro}
        </button>
      ) : (
        <div className={clase} style={pinta}>
          {dentro}
        </div>
      )}
    </li>
  )
}

/*
  ═══════════════════════════════════════════════════════════════
  UN RENGLÓN · para las siete columnas de la semana
  ═══════════════════════════════════════════════════════════════

  En la pestaña del Calendario, cada día mide unos 250 px. Ahí una
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
