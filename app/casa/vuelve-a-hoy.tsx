'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { elTrozoDelEspacio } from '@/lib/api'

/*
  ═══════════════════════════════════════════════════════════════
  A LOS TRES MINUTOS, VUELVE SOLA A HOY
  ═══════════════════════════════════════════════════════════════

  Es la pieza que hace que una pantalla de pared pueda tener pestañas.

  Sin ella pasa esto, y pasa el primer día: alguien mira el menú del
  jueves, se va, y a las tres horas la pared sigue enseñando el menú del
  jueves a quien pasa por delante buscando la hora. Una pantalla colgada
  en una cocina no tiene a nadie que la «cierre»: lo tiene que hacer
  ella.

  Tres minutos y no treinta segundos: hay que poder leer la semana
  entera sin que la pantalla se vaya de debajo. Y no diez: a los diez
  minutos ya no está nadie delante.

  ─────────────────────────────────────────────────────────────
  LO QUE CUENTA COMO «TOCARLA»

  Cualquier toque, cualquier tecla, cualquier movimiento del ratón.
  `pointerdown` y no `click`: hay que reiniciar la cuenta en cuanto el
  dedo baja, no cuando acaba el gesto — si no, deslizar una lista larga
  durante dos minutos no contaría como usarla.

  ─────────────────────────────────────────────────────────────
  Y EN HOY NO HACE NADA

  Estando ya en Hoy no hay adonde volver, así que ni se pone el
  temporizador. Un `router.replace` a la misma dirección cada tres
  minutos sería trabajo y parpadeo a cambio de nada.
*/

const ESPERA = 3 * 60_000

export default function VuelveAHoy() {
  const router = useRouter()
  const donde = usePathname() ?? '/casa'
  const cuenta = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ¿Estamos ya en Hoy? Con el espacio en la dirección, Hoy es
     cualquier camino que TERMINE en `/casa`. */
  const enHoy = /\/casa\/?$/.test(donde)

  useEffect(() => {
    if (enHoy) return

    /* Con el espacio delante si lo hay. Escribir «/casa» a secas
       sacaría de la casa a una pantalla de quien tenga dos. */
    const trozo = elTrozoDelEspacio(donde)
    const hoy = trozo ? `${trozo}/casa` : '/casa'

    function rearmar() {
      if (cuenta.current) clearTimeout(cuenta.current)
      cuenta.current = setTimeout(() => router.replace(hoy), ESPERA)
    }

    rearmar()

    const sucesos: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    for (const s of sucesos) window.addEventListener(s, rearmar, { passive: true })

    return () => {
      for (const s of sucesos) window.removeEventListener(s, rearmar)
      if (cuenta.current) clearTimeout(cuenta.current)
    }
  }, [enHoy, donde, router])

  return null
}
