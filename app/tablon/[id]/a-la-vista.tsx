'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Ico } from '../../iconos'
import { refrescar } from '@/lib/refrescar'

/*
  ═══════════════════════════════════════════════════════════════
  DEJARLO A LA VISTA
  ═══════════════════════════════════════════════════════════════

  Lo destacado sale SIEMPRE en el calendario de la pantalla de la
  cocina, esté en la semana que esté. «La comunión es el 4 de octubre»,
  «el viernes viene el fontanero», «no olvidar el pasaporte».

  ─────────────────────────────────────────────────────────────
  NO ES LO MISMO QUE «QUE SE VEA EN LA COCINA», Y SE PARECE MUCHO

  Están una al lado de la otra y hacen cosas distintas. Conviene tenerlo
  claro antes de tocar cualquiera de las dos:

      visible_en_casa  →  ¿PUEDE salir en la pantalla de la cocina?
                          Es una cuestión de intimidad. Sin esto, no
                          sale nunca, ni en su día.

      destacado        →  ¿Se queda a la vista aunque no sea esta
                          semana? Es una cuestión de importancia.

  O sea que lo primero es un permiso y lo segundo es un subrayado. Algo
  destacado pero no visible en casa no sale: manda el permiso, que es
  como tiene que ser.

  ─────────────────────────────────────────────────────────────
  Y SE DECIDE AQUÍ, MIRANDO LA COSA

  No en el formulario de apuntarla. Dos reglas del proyecto lo piden:
  «formularios mínimos» y «pocas decisiones por pantalla». Preguntar
  esto al apuntar cada recado convierte una decisión rara en un peaje
  diario.
*/
export default function ALaVista({ id, inicial }: { id: string; inicial: boolean | null }) {
  const [valor, setValor] = useState<boolean>(inicial === true)
  const [fallo, setFallo] = useState<string | null>(null)
  const [enCurso, empezar] = useTransition()
  const router = useRouter()

  function cambiar() {
    const antes = valor
    const nuevo = !valor

    /* Se pinta ya. Si falla, se vuelve — y se dice. Una pantalla que
       miente sobre lo que ha guardado es peor que una lenta. */
    setValor(nuevo)
    setFallo(null)

    empezar(async () => {
      try {
        const r = await fetch(api(`/api/recordatorios/${id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destacado: nuevo }),
        })
        if (!r.ok) throw new Error(String(r.status))
        refrescar(router)
      } catch {
        setValor(antes)
        setFallo('No se ha podido cambiar. Inténtalo otra vez.')
      }
    })
  }

  return (
    <section className="mt-6 rounded-[24px] bg-superficie p-7">
      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-tenue">
        A la vista
      </h2>

      <p className="mt-3 text-xl leading-relaxed text-tinta">
        {valor
          ? 'Esto se queda a la vista en el calendario de la cocina, sea la semana que sea.'
          : 'Esto solo sale en la cocina el día que toca.'}
      </p>

      <button
        type="button"
        onClick={cambiar}
        disabled={enCurso}
        aria-pressed={valor}
        className="mt-5 flex w-full items-center justify-center gap-3 rounded-[18px] border-2 border-borde bg-fondo px-6 py-5 text-lg font-extrabold text-tinta disabled:opacity-60"
      >
        <Ico nombre="chincheta" tam={22} grosor={2.2} />
        {valor ? 'Quitarlo de la vista' : 'Dejarlo a la vista'}
      </button>

      {fallo && (
        <p className="mt-4 text-base" style={{ color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}
    </section>
  )
}
