'use client'

import { useCallback, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/*
  ═══════════════════════════════════════════════════════════════
  LO ELEGIDO VIVE EN LA DIRECCIÓN
  ═══════════════════════════════════════════════════════════════

  Es la mitad invisible de las dos zonas, y la que de verdad cuesta
  hacer bien.

  En escritorio, elegir un papel ya no cambia de pantalla: rellena la
  zona de al lado. Y ahí aparece la pregunta que hunde a la mayoría de
  las aplicaciones que lo intentan: **¿dónde vive lo elegido?**

  Si vive en el estado del componente, se pierde todo lo que hace que
  una web sea una web. Recargar borra la elección. Copiar la dirección
  y mandarla por WhatsApp manda la lista pelada. Y el botón de atrás
  del navegador —que la gente usa sin pensarlo— se lleva por delante la
  pantalla entera en vez de deshacer lo último que se hizo.

  Así que vive en la dirección, en un parámetro:

      /documentos                        la lista, sin nada elegido
      /documentos?papel=<id>             la lista, con ese papel abierto

  ─────────────────────────────────────────────────────────────
  Y EL DETALLE SIGUE TENIENDO SU PROPIA PANTALLA

  Esto NO sustituye a `/documentos/<id>`. Esa ruta se queda como está y
  es la buena para compartir: en el móvil es la pantalla de siempre, y
  en un ordenador es el visor a pantalla completa.

  Son dos cosas distintas y las dos hacen falta:

      LLEGAR DESDE LA LISTA   → se elige, y se abre al lado
      LLEGAR DESDE FUERA      → se entra, y se abre entero

  Que es exactamente lo que dice el diseño del visor: el mismo
  componente, con dos vidas.

  ─────────────────────────────────────────────────────────────
  UNA SOLA ENTRADA EN EL HISTORIAL POR EPISODIO

  Aquí hay una trampa que sólo se ve al usarlo. Si cada elección
  empujara una entrada al historial, mirar diez papeles seguidos
  dejaría diez entradas, y volver atrás serían diez pulsaciones para
  salir de una pantalla en la que no se ha ido a ninguna parte.

  Y si ninguna empujara, el botón de atrás se llevaría la pantalla
  entera a la primera, que es justo lo que queríamos evitar.

  La regla que resuelve las dos:

      la PRIMERA elección empuja      (atrás deshace la elección)
      cambiar de elegido reemplaza    (no se acumulan entradas)
      cerrar reemplaza                (la × no ensucia el historial)

  O sea: una entrada por cada vez que el panel se abre desde cero. Ni
  una más.

  ─────────────────────────────────────────────────────────────
  Y NADA DE ESTO DESPLAZA LA PANTALLA

  `scroll: false` en las dos llamadas. Sin eso, Next sube al principio
  al cambiar la dirección, y elegir la fila número veinte de una tabla
  te dejaría mirando la primera. Es el fallo que hace que una zona de
  contexto se sienta como una pantalla nueva aunque no lo sea.
*/
export function useElegido(clave: string) {
  const router = useRouter()
  const ruta = usePathname() ?? '/'
  const busqueda = useSearchParams()

  const elegido = busqueda?.get(clave) ?? null

  /* Si se ha entrado por un enlace que YA traía algo elegido, la
     primera elección de la sesión tampoco debe empujar: la entrada del
     historial ya existe. */
  const hayEpisodio = useRef(elegido !== null)

  const direccionCon = useCallback(
    (valor: string | null) => {
      const parametros = new URLSearchParams(busqueda?.toString() ?? '')
      if (valor === null) parametros.delete(clave)
      else parametros.set(clave, valor)

      /* Los demás parámetros se respetan: una pantalla puede llevar el
         periodo o el filtro puestos, y elegir un papel no tiene por qué
         perderlos. */
      const cola = parametros.toString()
      return cola ? `${ruta}?${cola}` : ruta
    },
    [busqueda, clave, ruta],
  )

  const elegir = useCallback(
    (valor: string) => {
      const destino = direccionCon(valor)
      if (hayEpisodio.current) {
        router.replace(destino, { scroll: false })
      } else {
        router.push(destino, { scroll: false })
        hayEpisodio.current = true
      }
    },
    [direccionCon, router],
  )

  const cerrar = useCallback(() => {
    router.replace(direccionCon(null), { scroll: false })
    hayEpisodio.current = false
  }, [direccionCon, router])

  return { elegido, elegir, cerrar }
}
