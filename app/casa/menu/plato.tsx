'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../../iconos'
import { AMBITO } from '../../piezas'
import ComprobarEnLaPared from './comprobar'
import type { ListaDeCompra, MenuQueSeComprueba } from '@/lib/comprobar-menu'

/*
  ═══════════════════════════════════════════════════════════════
  UN PLATO EN LA PARED, Y SI SE PUEDE HACER
  ═══════════════════════════════════════════════════════════════

  Era un trozo de servidor que solo pintaba el nombre. Ahora además
  contesta la pregunta que se hace delante de la nevera: **¿esto se
  puede hacer hoy?**

  ─────────────────────────────────────────────────────────────
  EL ESTADO SE VE SIN ABRIR NADA

  Tres maneras, y ninguna obliga a entrar:

      sin mirar   «¿Tienes lo que lleva? · 6»   en gris
      falta algo  «Faltan 3 cosas»              en rojo
      listo       «Está todo»                   en verde, con tic

  Es lo que pedía Haris cuando dijo *«siempre hay que hacer una
  checklist para que se pueda hacer, si no que se haga otro»*: la
  decisión de cambiar el menú del viernes se toma mirando la semana,
  no entrando en siete fichas.

  ─────────────────────────────────────────────────────────────
  Y SOLO SALE CUANDO HAY ALGO QUE COMPROBAR

  Si el plato no viene de una receta con ingredientes, aquí no hay nada
  que preguntar y no se pinta nada. Un renglón que dice «0 cosas» ocupa
  lo mismo que uno que sirve.
*/

export type PlatoDelDia = {
  id?: string
  que: string | null
  momento: 'comida' | 'cena'
  fecha: string
  comprobado_en?: string | null
  faltan?: string[] | null
}

export default function Plato({
  etiqueta,
  plato,
  ingredientes,
  listas,
  apagado = false,
}: {
  etiqueta: string
  plato: PlatoDelDia
  ingredientes: string[]
  listas: ListaDeCompra[]
  apagado?: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  /* Lo comprobado se pinta ya, sin esperar a que vuelva la pantalla
     entera: en una pared, un toque que tarda medio segundo se repite. */
  const [faltan, setFaltan] = useState<string[] | null>(plato.faltan ?? null)
  const [mirado, setMirado] = useState(Boolean(plato.comprobado_en))

  const sePuedeComprobar = Boolean(plato.id) && ingredientes.length > 0 && !apagado

  const menu: MenuQueSeComprueba | null = plato.id
    ? {
        id: plato.id,
        fecha: plato.fecha,
        momento: plato.momento,
        que: plato.que ?? '',
        comprobado_en: plato.comprobado_en ?? null,
        faltan: plato.faltan ?? null,
      }
    : null

  const cuantasFaltan = faltan?.length ?? 0

  return (
    <span className="flex min-w-0 flex-1 items-start gap-3.5">
      <span
        className="mt-0.5 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px]"
        style={{
          background: `color-mix(in srgb, ${AMBITO.arena} 16%, var(--t-superficie))`,
          color: AMBITO.arena,
        }}
      >
        <Ico nombre="taza" tam={22} grosor={2.1} />
      </span>

      <span className="min-w-0">
        <span className="block text-[13.5px] font-extrabold uppercase tracking-wider text-tenue">
          {etiqueta}
        </span>
        {/* Sin plato puesto se dice, no se esconde: que la cena esté sin
            poner es justamente lo que hace falta ver al pasar por la
            cocina a las siete. */}
        <span
          className={`block text-[23px] font-extrabold leading-tight ${
            plato.que ? 'text-tinta' : 'text-apagado'
          }`}
        >
          {plato.que ?? 'Sin poner'}
        </span>

        {sePuedeComprobar && (
          <button
            onClick={() => setAbierto(true)}
            className="tocable mt-1 flex items-center gap-2 text-left text-[17px] font-extrabold"
            style={{
              minHeight: 44,
              color: !mirado
                ? 'var(--t-tinta-suave)'
                : cuantasFaltan > 0
                  ? 'var(--t-alerta)'
                  : 'var(--t-bien)',
            }}
          >
            {mirado && cuantasFaltan === 0 && <Ico nombre="check" tam={19} grosor={2.6} />}
            {!mirado
              ? `¿Tienes lo que lleva? · ${ingredientes.length}`
              : cuantasFaltan > 0
                ? `Faltan ${cuantasFaltan} ${cuantasFaltan === 1 ? 'cosa' : 'cosas'}`
                : 'Está todo'}
          </button>
        )}
      </span>

      {abierto && menu && (
        <ComprobarEnLaPared
          menu={menu}
          ingredientes={ingredientes}
          listas={listas}
          alGuardar={(f) => {
            setFaltan(f)
            setMirado(true)
            router.refresh()
          }}
          cerrar={() => setAbierto(false)}
        />
      )}
    </span>
  )
}
