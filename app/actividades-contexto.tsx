'use client'

import { createContext, useContext } from 'react'
import type { Actividad } from '@/lib/actividades'

/*
  ═══════════════════════════════════════════════════════════════
  LAS ACTIVIDADES, DISPONIBLES EN CUALQUIER PANTALLA
  ═══════════════════════════════════════════════════════════════

  POR QUÉ ESTO EXISTE, QUE NO ES OBVIO.

  La barra de abajo sale en TODAS las pantallas, y a partir de ahora
  sus pestañas dependen de qué actividades tenga cada casa. O sea:
  hay que leer la base de datos para pintarla.

  Pero la barra es un componente de navegador —tiene enlaces y estado
  visual— y cuatro pantallas que la usan también lo son: Entrar, los
  Avisos, el Arranque y Hablar. Un componente de servidor no puede
  vivir dentro de uno de navegador, así que la barra no puede
  consultar la base de datos por su cuenta.

  Las dos salidas malas:

  · Que cada pantalla le pase las actividades a la barra. Son quince
    archivos, y el día que alguien añada uno nuevo se le olvidará —y
    esa pantalla tendrá la barra de otra familia—.

  · Que la barra las pida al servidor al montarse. Entonces PARPADEA
    en cada pantalla: aparece con las pestañas de siempre y cambia
    medio segundo después. En una aplicación para personas mayores,
    una barra que se mueve sola bajo el dedo es inaceptable.

  La salida buena es ésta: la plantilla de la aplicación —que sí es de
  servidor— las lee UNA vez y las deja disponibles aquí. La barra las
  coge ya hechas, sin pedir nada y sin parpadear, y ninguna pantalla
  tiene que acordarse de pasárselas.
*/

const Contexto = createContext<Actividad[] | null>(null)

export function ProveedorActividades({
  actividades,
  children,
}: {
  actividades: Actividad[]
  children: React.ReactNode
}) {
  return <Contexto.Provider value={actividades}>{children}</Contexto.Provider>
}

/**
 * Las actividades de esta casa.
 *
 * Devuelve una lista vacía si por lo que sea no están —y quien la usa
 * tiene que saber seguir funcionando con eso—. Que falte la lista no
 * puede dejar a nadie sin poder navegar.
 */
export function useActividades(): Actividad[] {
  return useContext(Contexto) ?? []
}
