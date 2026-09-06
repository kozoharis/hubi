'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../../../iconos'

/*
  ═══════════════════════════════════════════════════════════════
  QUITAR ESTA ACTIVIDAD
  ═══════════════════════════════════════════════════════════════

  Va al final de «Cómo la llevas», que es donde se busca lo que se
  hace una vez y no se vuelve a tocar. Arriba, entre las partidas y
  las partes, sería un botón peligroso en medio del camino.

  ─────────────────────────────────────────────────────────────
  SE DICE QUÉ VA A PASAR ANTES DE PULSAR, NO DESPUÉS

  Y son dos cosas distintas:

    vacía          desaparece
    con apuntes    se retira, y lo de dentro se queda

  Un botón que unas veces borra del todo y otras no, sin decirlo
  antes, es un botón en el que no se puede confiar — y entonces no se
  toca, que es como acabamos con actividades equivocadas para siempre.

  El aviso lleva el NÚMERO, no un «tiene datos»: entre «se queda con
  lo que hay» y «se queda con 214 apuntes y 38 papeles» hay toda la
  diferencia del mundo a la hora de decidir.
*/

export default function Quitar({
  seccionId,
  nombre,
  apuntes,
  papeles,
}: {
  seccionId: string
  nombre: string
  apuntes: number
  papeles: number
}) {
  const router = useRouter()

  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const vacia = apuntes + papeles === 0

  async function quitar() {
    setFallo(null)
    setOcupado(true)

    const r = await fetch(`/api/actividades?id=${encodeURIComponent(seccionId)}`, {
      method: 'DELETE',
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      retirada?: boolean
      error?: string
      detalle?: string
    } | null

    setOcupado(false)

    if (!r.ok || d?.bien !== true) {
      setFallo(
        d
          ? [d.error ?? 'No se ha podido quitar.', d.detalle].filter(Boolean).join(' · ')
          : 'HUBI no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return
    }

    /* Al Inicio, y no a la actividad que acaba de desaparecer: volver
       a una pantalla que ya no existe enseña un «no encontrado» justo
       después de hacer algo bien. */
    router.replace('/')
    router.refresh()
  }

  if (!abierto) {
    return (
      <div className="mt-8">
        <button
          onClick={() => setAbierto(true)}
          className="h-[52px] w-full rounded-[16px] border border-borde text-[16.5px] font-extrabold text-coral"
        >
          Quitar «{nombre}»
        </button>
      </div>
    )
  }

  return (
    <div className="mt-8 rounded-[20px] border border-borde bg-superficie px-4 py-4">
      <p className="text-[17.5px] font-extrabold leading-snug">
        {vacia ? `¿Borrar «${nombre}»?` : `¿Retirar «${nombre}»?`}
      </p>

      <p className="mt-1.5 text-[15.5px] font-semibold leading-snug text-tinta-suave">
        {vacia ? (
          <>
            Está vacía: no tiene ni un apunte ni un papel. Desaparece del todo, con sus
            partidas. Esto no se deshace.
          </>
        ) : (
          <>
            Tiene {cuantos(apuntes, 'apunte', 'apuntes')}
            {papeles > 0 && <> y {cuantos(papeles, 'papel', 'papeles')}</>}, así que{' '}
            <strong className="text-tinta">no se borra nada</strong>: deja de verse y ya está.
            Sus cuentas de años anteriores se quedan como están, y los documentos siguen en
            Drive.
            <br />
            <br />
            Si algún día la quieres de vuelta, créala otra vez con el mismo nombre y vuelve
            entera.
          </>
        )}
      </p>

      <div className="mt-3.5 flex gap-2">
        <button
          onClick={quitar}
          disabled={ocupado}
          className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-[16px] text-[17px] font-extrabold text-white disabled:opacity-50"
          style={{ background: '#E11D48' }}
        >
          <Ico nombre="check" tam={19} grosor={2.3} />
          {ocupado ? 'Un momento…' : vacia ? 'Borrar' : 'Retirar'}
        </button>
        <button
          onClick={() => setAbierto(false)}
          disabled={ocupado}
          className="h-[56px] flex-1 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave disabled:opacity-50"
        >
          Dejarlo
        </button>
      </div>

      {fallo && (
        <p className="mt-3 rounded-[16px] bg-coral-suave px-4 py-3 text-[15.5px] font-semibold text-coral">
          {fallo}
        </p>
      )}
    </div>
  )
}

function cuantos(n: number, uno: string, varios: string): string {
  return n === 1 ? `1 ${uno}` : `${n} ${varios}`
}
