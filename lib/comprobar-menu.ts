'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

/*
  ═══════════════════════════════════════════════════════════════
  «¿TIENES TODO ESTO?» — LA PARTE QUE NO SE VE
  ═══════════════════════════════════════════════════════════════

  Haris, sobre la comprobación de ingredientes: *«desde luego tiene que
  estar en la cocina como en el móvil»*.

  Y ahí está el motivo de que esto sea un archivo aparte. Son dos
  pantallas muy distintas por fuera —el móvil a 17 px con botones de
  60, la pared a 25 px con botones de 72— y **exactamente la misma
  conversación** por dentro:

      ¿lo tienes todo?  →  sí, y ya está
                        →  no, esto falta, a esta lista
                        →  y esa lista, ¿avisa a tiempo?

  Copiar esas tres reglas en dos sitios es tener dos sitios donde
  arreglar el día que cambie una. Y cambian: la del aviso de fecha ya
  se afinó una vez.

  ─────────────────────────────────────────────────────────────
  LO QUE VIVE AQUÍ Y LO QUE NO

  Aquí: las dos llamadas, el paso en que va la conversación, qué está
  marcado y las tres reglas de arriba.

  Fuera: cómo se pinta. Ni un solo tamaño, ni un color, ni una palabra
  de las que se leen. Si algún día esto empieza a decidir textos, es
  que se ha metido donde no debe.
*/

export type MenuQueSeComprueba = {
  id: string
  fecha: string
  momento: 'comida' | 'cena'
  que: string
  comprobado_en?: string | null
  faltan?: string[] | null
}

export type ListaDeCompra = {
  id: string
  nombre: string
  fecha: string | null
  hora: string | null
  asignado_a: string | null
}

export type Paso = 'pregunta' | 'marcar' | 'hecho'

/** El día antes del menú: lo que falta tiene que estar para entonces. */
export function elDiaDeAntes(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/*
  ── Y SE LLAMA `useComprobacion`, NO `usarComprobacion` ──

  Es lo único de este proyecto que no está en castellano, y no es un
  descuido. React decide qué es un hook **por el nombre**: si no empieza
  por `use`, ni el compilador ni el linter aplican las reglas que
  garantizan que los estados se llamen siempre en el mismo orden.

  Con `usarComprobacion` el código funcionaba y la comprobación de
  React estaba apagada. Un nombre más bonito a cambio de perder la red
  que evita el fallo más difícil de encontrar que tiene esta librería.
*/
export function useComprobacion({
  menu,
  listas,
  alGuardar,
  cerrar,
}: {
  menu: MenuQueSeComprueba
  listas: ListaDeCompra[]
  alGuardar: (faltan: string[]) => void
  cerrar: () => void
}) {
  const [paso, setPaso] = useState<Paso>('pregunta')
  const [marcados, setMarcados] = useState<string[]>([])
  const [lista, setLista] = useState<string>(listas[0]?.id ?? '')
  const [trabajando, setTrabajando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [apuntados, setApuntados] = useState(0)
  const [diaPuesto, setDiaPuesto] = useState(false)

  const laLista = listas.find((l) => l.id === lista) ?? null
  const tope = elDiaDeAntes(menu.fecha)

  /*
    ¿Avisa a tiempo esa lista? Avisa si tiene día y ese día no es
    después del menú. Sin día no avisa de nada: la tarea de la Agenda
    nace de la fecha de la lista (paso 23).
  */
  const avisaATiempo = Boolean(laLista?.fecha && laLista.fecha <= menu.fecha)

  function alternar(que: string) {
    setMarcados((m) => (m.includes(que) ? m.filter((x) => x !== que) : [...m, que]))
  }

  async function mandar(faltan: string[]) {
    setTrabajando(true)
    setAviso(null)

    const r = await fetch(api('/api/menus'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: menu.id,
        faltan,
        /* Sin nada que comprar no hay lista a la que mandar nada.
           Mandarla igual apuntaría cero cosas y dejaría escrito que se
           tocó una lista que nadie tocó. */
        lista_id: faltan.length > 0 ? lista || null : null,
      }),
    })
    const d = (await r.json().catch(() => ({}))) as {
      apuntados?: number
      error?: string
      detalle?: string
    }
    setTrabajando(false)

    if (!r.ok) {
      setAviso(d.detalle ?? d.error ?? 'No se ha podido guardar.')
      return
    }

    setApuntados(d.apuntados ?? 0)
    alGuardar(faltan)

    /* Si no hay nada que comprar se cierra sin ceremonia: la respuesta
       era SÍ y no hay nada que contar. */
    if (faltan.length === 0) {
      cerrar()
      return
    }
    setPaso('hecho')
  }

  /*
    Ponerle día a la lista.

    Se manda `fecha`, `hora` y `asignado_a` tal y como estaban, porque
    esa ruta gobierna las tres cosas A LA VEZ junto con la tarea de la
    Agenda: un campo que no viaja se entiende como «quítalo», y poner el
    día borraría la hora y a quien le tocaba.
  */
  async function ponerleDia() {
    if (!laLista) return
    setTrabajando(true)
    setAviso(null)

    const r = await fetch(api('/api/compra/listas'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: laLista.id,
        fecha: tope,
        hora: laLista.hora,
        asignado_a: laLista.asignado_a,
      }),
    })
    setTrabajando(false)

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string; detalle?: string }
      setAviso(d.detalle ?? d.error ?? 'No se ha podido poner el día.')
      return
    }
    setDiaPuesto(true)
  }

  return {
    paso,
    setPaso,
    marcados,
    alternar,
    lista,
    setLista,
    laLista,
    trabajando,
    aviso,
    apuntados,
    diaPuesto,
    tope,
    avisaATiempo,
    mandar,
    ponerleDia,
  }
}
