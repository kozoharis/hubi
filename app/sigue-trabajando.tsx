'use client'

import { useEffect } from 'react'
import { montarSigueTrabajando } from '@/lib/sigue-trabajando'

/*
  El velo de «sigue trabajando», encendido una vez para toda la
  aplicación. Todo lo que hace está en `lib/sigue-trabajando.ts`, con
  el porqué y con lo que puede fallar escrito entero.

  Aquí sólo queda esto: un hijo de cliente que no recibe nada, no
  guarda nada y no pinta nada. Vive en el armazón para que valga en
  las cincuenta pantallas sin que ninguna tenga que enterarse.
*/
export default function SigueTrabajando() {
  useEffect(() => montarSigueTrabajando(), [])
  return null
}
