'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Ico } from '../../iconos'
import { AMBITO } from '../../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  UNA NOTA DEL CORCHO, Y CÓMO SE RETIRA
  ═══════════════════════════════════════════════════════════════

  Haris: *«las notas desde la cocina, si están asignadas a la pared
  deberían poder darse por buenas y eliminarlas»*.

  Y es lo que hace un corcho de verdad: se clava «he dejado los papeles
  del seguro en la mesa», alguien los coge, y se quita el papel. Un
  corcho del que no se puede quitar nada acaba siendo una pared de
  papeles viejos que ya nadie lee — y entonces tampoco se lee el que
  importa.

  ─────────────────────────────────────────────────────────────
  UN BOTÓN, NO DOS

  «Darla por buena» y «quitarla» son aquí la misma cosa, y ponerlas
  como dos botones sería inventar una diferencia que en una cocina no
  existe: cuando el recado está hecho, el papel se quita.

  Y el otro botón que podría haber —«Visto»— no puede existir en esta
  pantalla, y conviene entender por qué: «visto» significa *YO lo he
  visto*, y una pared no es nadie. Una nota dirigida a Conchita marcada
  como vista porque alguien pasó por la cocina es peor que no marcarla:
  le dice a quien la escribió que llegó cuando no ha llegado. Eso se
  hace desde el móvil, donde hay un nombre detrás. Está escrito también
  en el `sql/86`.

  ─────────────────────────────────────────────────────────────
  Y SE PUEDE DESHACER, SIN PRISA

  Quitar no borra: pone fecha en `guardada_en`, lo mismo que «Quitar»
  desde el móvil. La nota sale del corcho y sigue guardada.

  Pero eso es la red de abajo, no la de arriba. Aquí, al quitarla, la
  tarjeta NO desaparece: se queda apagada y con un «Volver a ponerla»
  del mismo tamaño. Quien la ha quitado sin querer lo ve en el sitio
  donde acaba de tocar, que es el único sitio donde va a mirar. Se va
  de verdad al cambiar de pestaña.

  Es la diferencia entre poder deshacerlo y saber que se puede.
*/

export type NotaDelCorcho = {
  id: string
  texto: string
  creada_en: string | null
}

export default function Nota({
  nota,
  sePuedeQuitar,
}: {
  nota: NotaDelCorcho
  /** Lo dice la base (`la_cocina_quita_notas`), no esta pantalla. */
  sePuedeQuitar: boolean
}) {
  const router = useRouter()
  const [quitada, setQuitada] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function cambiar(quitar: boolean) {
    setTrabajando(true)
    setFallo(null)

    try {
      const r = await fetch(api('/api/pared/nota'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: nota.id, que: quitar ? 'quitar' : 'volver-a-ponerla' }),
      })
      const d = (await r.json().catch(() => null)) as { error?: string } | null

      if (!r.ok) {
        setFallo(d?.error ?? 'No se ha podido. Inténtalo otra vez.')
        setTrabajando(false)
        return
      }

      setQuitada(quitar)
      setTrabajando(false)
      /* Se refresca para que Hoy y el resto de la pared se enteren,
         pero esta tarjeta se queda puesta y apagada: lo de arriba es
         el «deshacer» que se ve, y no depende de este refresco. */
      router.refresh()
    } catch {
      setFallo('No se ha podido. Inténtalo otra vez.')
      setTrabajando(false)
    }
  }

  return (
    <div
      className="rounded-[28px] border bg-superficie px-6 py-5 transition-opacity"
      style={{
        borderColor: 'var(--t-borde)',
        borderLeft: `6px solid ${AMBITO.rosa}`,
        opacity: quitada ? 0.45 : 1,
      }}
    >
      <p
        className={`whitespace-pre-wrap text-[24px] font-extrabold leading-snug text-tinta ${
          quitada ? 'line-through' : ''
        }`}
      >
        {nota.texto}
      </p>

      {nota.creada_en && !quitada && (
        <p className="mt-2.5 text-[16px] font-bold text-tenue">{haceCuanto(nota.creada_en)}</p>
      )}

      {fallo && (
        <p className="mt-3 text-[17px] font-bold" style={{ color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}

      {/*
        El botón solo si la base dice que sí. Un botón que falla es peor
        que ningún botón — la misma regla que con lo de tachar, lo de
        apuntar y lo de dejar una nota.
      */}
      {sePuedeQuitar && (
        <button
          type="button"
          onClick={() => cambiar(!quitada)}
          disabled={trabajando}
          className="tocable mt-3 flex items-center gap-2.5 text-left text-[19px] font-extrabold disabled:opacity-45"
          style={{ minHeight: 56, color: quitada ? 'var(--t-tenue)' : 'var(--t-bien)' }}
        >
          {quitada ? (
            <>
              <Ico nombre="refrescar" tam={21} grosor={2.4} />
              Volver a ponerla
            </>
          ) : (
            <>
              <Ico nombre="check" tam={22} grosor={2.8} />
              Hecho
            </>
          )}
        </button>
      )}
    </div>
  )
}

/*
  «Hoy», «Ayer», «Hace 3 días».

  Y no la fecha exacta: en un corcho lo que importa es si es de esta
  mañana o de la semana pasada. «12/09/2026» obliga a restar.
*/
function haceCuanto(iso: string): string {
  const cuando = new Date(iso)
  const dias = Math.floor((Date.now() - cuando.getTime()) / 86_400_000)

  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 7) return `Hace ${dias} días`
  if (dias < 14) return 'Hace una semana'
  if (dias < 31) return `Hace ${Math.floor(dias / 7)} semanas`
  return 'Hace más de un mes'
}
