'use client'

import { useState } from 'react'

/*
  ═══════════════════════════════════════════════════════════════
  AL DÍA · lo que se pinta ya, sin quedarse congelado
  ═══════════════════════════════════════════════════════════════

  ⚠️  ESTO ARREGLA EL FALLO DE LA COMPRA EN LA TABLETA

  Haris: *«le digo que falta algo, lo añado, y no se ve en la pantalla
  que lo he añadido. Sin embargo sí que veo que lo registra: lo veo en
  el móvil, pero en la tableta no»*.

  Y era verdad las dos veces. Se guardaba perfectamente; lo que no
  pasaba era que la pantalla lo enseñara.

  ─────────────────────────────────────────────────────────────
  POR QUÉ

  Media pared usa el mismo patrón, y es el correcto: lo que se toca se
  pinta EN EL ACTO, sin esperar a que conteste el servidor, porque en
  una pared un toque que tarda medio segundo se vuelve a dar. Para eso
  cada pieza se guardaba una copia local de lo que le llegaba:

      const [locales, setLocales] = useState(grupos.flatMap(...))

  El fallo está en la segunda palabra. El valor que se le da a
  `useState` **solo se usa la primera vez que se pinta**. Después, esa
  copia local ya no vuelve a mirar lo que llega del servidor, nunca.

  Así que al apuntar la leche pasaba esto: se manda, se guarda,
  `router.refresh()` trae la lista nueva desde el servidor… y la
  pantalla sigue enseñando la copia congelada del momento en que se
  encendió la tableta. La leche estaba en la base, estaba en la
  respuesta, estaba en las propiedades del componente — y no se veía.

  Lo mismo pasaba con todo lo que cambiara desde OTRO sitio: tachar
  algo desde el móvil no se reflejaba en la pared hasta recargar
  entera, y como la pared se refresca sola cada cinco minutos sin
  recargar, no se reflejaba nunca.

  ─────────────────────────────────────────────────────────────
  LO QUE HACE ESTO

  Mantiene la copia local —que es lo que hace que un toque se vea al
  instante— pero la **vuelve a coger del servidor en cuanto el servidor
  dice algo distinto**.

  Para saber si dice algo distinto hace falta una `firma`: un texto
  corto que cambie cuando cambie lo que importa. Comparar los objetos
  no vale — el servidor manda objetos nuevos en cada refresco aunque no
  haya cambiado nada, y la copia local se borraría cada cinco minutos
  en mitad de un toque.

  El orden es el que hay que respetar, y es el que evita el problema
  clásico:

    1. se toca  →  la copia local cambia, la firma NO (el servidor
       todavía no sabe nada) → lo tocado se queda en pantalla;
    2. contesta el servidor  →  la firma cambia → se coge lo suyo, que
       ya incluye lo tocado.

  Cambiar el estado mientras se pinta parece raro y no lo es: es el
  patrón que documenta React para esto, y es lo que evita el parpadeo
  de pintar una vez con lo viejo y otra con lo nuevo.
*/

export function useAlDia<T>(
  /** Lo que acaba de llegar del servidor. */
  delServidor: T,
  /** Un texto que cambia cuando cambia lo que importa de `delServidor`. */
  firma: string
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [local, setLocal] = useState<T>(delServidor)
  const [ultima, setUltima] = useState(firma)

  if (firma !== ultima) {
    setUltima(firma)
    setLocal(delServidor)
  }

  return [local, setLocal]
}
