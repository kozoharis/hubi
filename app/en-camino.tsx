'use client'

import { useLinkStatus } from 'next/link'

/*
  ═══════════════════════════════════════════════════════════════
  «VOY EN CAMINO» · la tarjeta que sigue pulsada
  ═══════════════════════════════════════════════════════════════

  EL HUECO QUE TAPA

  Al tocar una tarjeta pasan tres cosas, en este orden:

      el dedo baja     →  la tarjeta se hunde (`.tocable`)
      el dedo se va    →  la tarjeta vuelve a su sitio
      280 ms después   →  aparece el armazón gris de `loading.tsx`

  Entre el segundo y el tercero hay un agujero de hasta 280 ms en el
  que la tarjeta ya ha vuelto a la normalidad y todavía no ha salido
  nada nuevo. En ese hueco la pantalla dice «no ha pasado nada», y es
  mentira: el servidor está trabajando.

  El armazón no puede salir antes —eso ya se probó y se descartó: en
  una navegación rápida se veía un destello gris entre dos pantallas y
  quedaba peor—. Así que lo que hace falta no es adelantarlo, sino que
  la TARJETA aguante.

  ── QUÉ PINTA ──

  El mismo velo que ya usa el chip de Ajustes, encima de la tarjeta,
  mientras el enlace esté en marcha. No es un símbolo nuevo que haya
  que aprender: se lee como que sigue pulsada, que es exactamente lo
  que está pasando.

  Sin ruedecitas y sin «Cargando…». Una ruedecita en cada tarjeta de
  una lista convierte una pantalla tranquila en un panel de control, y
  la palabra «cargando» le pide a alguien de 75 años que interprete un
  tecnicismo para saber si su móvil va bien.

  ── POR QUÉ ES UN FICHERO APARTE ──

  `piezas.tsx` se renderiza en el servidor y así debe seguir: es el
  sistema de diseño entero y volverlo de cliente arrastraría con él
  cada pantalla que lo usa. `useLinkStatus` solo funciona en cliente y
  solo contesta desde DENTRO del enlace que pregunta, así que esto es
  lo más pequeño que puede ser: un hijo de cliente que no recibe
  nada, no guarda nada y solo sabe pintar un velo.
*/
export default function EnCamino({ redondez = 20 }: { redondez?: number }) {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span
      aria-hidden
      className="en-camino pointer-events-none absolute inset-0"
      style={{ borderRadius: redondez }}
    />
  )
}
