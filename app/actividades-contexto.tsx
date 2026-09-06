'use client'

import { createContext, useContext } from 'react'
import type { Actividad } from '@/lib/actividades'

/*
  ═══════════════════════════════════════════════════════════════
  LO QUE LA BARRA NECESITA SABER, EN CUALQUIER PANTALLA
  ═══════════════════════════════════════════════════════════════

  POR QUÉ ESTO EXISTE, QUE NO ES OBVIO.

  La barra de abajo sale en TODAS las pantallas, y sus pestañas
  dependen de qué actividades tenga cada casa y de quién esté
  entrando. O sea: hay que leer la base de datos para pintarla.

  Pero la barra es un componente de navegador —tiene enlaces y estado
  visual— y cuatro pantallas que la usan también lo son: Entrar, los
  Avisos, el Arranque y Hablar. Un componente de servidor no puede
  vivir dentro de uno de navegador, así que la barra no puede
  consultar la base de datos por su cuenta.

  Las dos salidas malas:

  · Que cada pantalla se lo pase a la barra. Son quince archivos, y el
    día que alguien añada uno nuevo se le olvidará — y esa pantalla
    tendrá la barra de otra familia.

  · Que la barra lo pida al servidor al montarse. Entonces PARPADEA en
    cada pantalla: aparece con las pestañas de siempre y cambia medio
    segundo después. En una aplicación para personas mayores, una
    barra que se mueve sola bajo el dedo es inaceptable.

  La salida buena es ésta: la plantilla de la aplicación —que sí es de
  servidor— lo lee UNA vez y lo deja disponible aquí.

  ─────────────────────────────────────────────────────────────
  Y ESTO NO PROTEGE NADA

  Que a alguien no le salga la pestaña de Papeles no le impide abrir
  `/documentos` escribiéndolo. Eso lo impiden las políticas de la base
  de datos, y así tiene que seguir siendo. Aquí solo se decide qué se
  le OFRECE — que es distinto, y es de lo que va tener una barra
  propia: no de esconder, sino de que encuentre lo suyo.
*/

export type Casa = {
  actividades: Actividad[]
  /** Quién es quien está mirando: familia, ayuda, asesor, mirar. */
  rol: string | null
  /** Si esta casa usa la lista de la compra. */
  usaCompra: boolean
}

const VACIA: Casa = { actividades: [], rol: null, usaCompra: true }

const Contexto = createContext<Casa | null>(null)

export function ProveedorActividades({
  casa,
  children,
}: {
  casa: Casa
  children: React.ReactNode
}) {
  return <Contexto.Provider value={casa}>{children}</Contexto.Provider>
}

/** Todo lo que la barra necesita. Nunca falla: si falta, va lo de siempre. */
export function useCasa(): Casa {
  return useContext(Contexto) ?? VACIA
}

/**
 * Las actividades de esta casa.
 *
 * Devuelve una lista vacía si por lo que sea no están —y quien la usa
 * tiene que saber seguir funcionando con eso—. Que falte la lista no
 * puede dejar a nadie sin poder navegar.
 */
export function useActividades(): Actividad[] {
  return useCasa().actividades
}
