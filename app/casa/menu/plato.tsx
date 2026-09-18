'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../../iconos'
import { AMBITO } from '../../piezas'
import ComprobarEnLaPared from './comprobar'
import Poner from './poner'
import type { Receta } from './recetas'
import type { ListaDeCompra, MenuQueSeComprueba } from '@/lib/comprobar-menu'

/*
  ═══════════════════════════════════════════════════════════════
  UNA COMIDA EN LA PARED, CON LOS PLATOS QUE HAGA FALTA
  ═══════════════════════════════════════════════════════════════

  Haris: *«en una cena o comida pueden haber varios platos, no sólo
  uno»*.

  Esto pintaba UN plato porque la base sólo dejaba uno: el índice único
  del paso 48. El paso 85 lo cambia, y aquí se nota en que la comida
  pasa a ser una columna: un renglón por plato y, debajo, «Otro plato».

  ─────────────────────────────────────────────────────────────
  EL ESTADO SE VE SIN ABRIR NADA

  Debajo de cada plato, una línea que contesta lo único que importa a
  las siete de la tarde:

      sin mirar   «¿Tienes lo que lleva? · 6»   en gris
      falta algo  «Faltan 3 cosas»              en rojo
      listo       «Está todo»                   en verde, con tic

  Es lo que pedía Haris cuando dijo *«siempre hay que hacer una
  checklist para que se pueda hacer, si no que se haga otro»*: la
  decisión de cambiar el menú del viernes se toma mirando la semana, no
  entrando en siete fichas.

  Y va por plato, no por comida: si la comida son lentejas y merluza,
  puede faltar el pescado y estar todo lo demás.

  ─────────────────────────────────────────────────────────────
  LOS DÍAS PASADOS NO SE TOCAN

  Ni se cambian ni se añaden platos. Cambiar lo que se comió el lunes
  no es una función, es un despiste.
*/

export type PlatoDelDia = {
  id?: string
  que: string | null
  momento: 'comida' | 'cena'
  fecha: string
  comprobado_en?: string | null
  faltan?: string[] | null
  receta_id?: string | null
  /*
    LO QUE LLEVA ESE PLATO, YA RESUELTO.

    Viene dentro del plato y no como una función que lo busque, y no es
    un capricho: esta pantalla la pinta el servidor y esto es un
    componente de cliente. Entre los dos sólo pasan DATOS — una función
    no se puede mandar, y Next lo para en el momento de abrir la
    pantalla, no al compilar.

    Es el error que rompió el menú la primera vez que se pusieron
    varios platos.
  */
  ingredientes: string[]
}

export default function Comida({
  etiqueta,
  fecha,
  momento,
  platos,
  listas,
  recetas = [],
  apagado = false,
}: {
  etiqueta: string
  fecha: string
  momento: 'comida' | 'cena'
  /** Los platos de esa comida, en el orden en que se escribieron. */
  platos: PlatoDelDia[]
  listas: ListaDeCompra[]
  /** El cajón de la casa, para poder poner un plato con un toque. */
  recetas?: Receta[]
  apagado?: boolean
}) {
  /* Qué se está poniendo: un plato concreto por su identificador, o
     `'nuevo'` cuando es uno más. Nulo, nada abierto. */
  const [poniendo, setPoniendo] = useState<string | 'nuevo' | null>(null)

  const elQueSePone = poniendo && poniendo !== 'nuevo'
    ? (platos.find((p) => p.id === poniendo) ?? null)
    : null

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

      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-extrabold uppercase tracking-wider text-tenue">
          {etiqueta}
        </span>

        {/* Sin nada puesto se dice, no se esconde: que la cena esté sin
            poner es justamente lo que hace falta ver al pasar por la
            cocina a las siete. */}
        {platos.length === 0 ? (
          apagado ? (
            <span className="block text-[23px] font-extrabold leading-tight text-apagado">
              Sin poner
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setPoniendo('nuevo')}
              className="tocable flex items-center gap-2.5 text-left"
              style={{ minHeight: 44 }}
            >
              <span className="text-[23px] font-extrabold leading-tight text-apagado">
                Poner algo
              </span>
              <span aria-hidden className="shrink-0 text-apagado">
                <Ico nombre="lapiz" tam={19} grosor={2.2} />
              </span>
            </button>
          )
        ) : (
          platos.map((p) => (
            <UnPlato
              key={p.id ?? p.que}
              plato={p}
              ingredientes={p.ingredientes}
              listas={listas}
              apagado={apagado}
              alTocar={() => setPoniendo(p.id ?? null)}
            />
          ))
        )}

        {/*
          ── Y UNO MÁS ──

          Con su palabra, no un «+» suelto: el punto 5 del
          planteamiento. Sólo aparece cuando ya hay algo — en una comida
          vacía, «poner algo» y «otro plato» serían dos botones para lo
          mismo.
        */}
        {platos.length > 0 && !apagado && (
          <button
            type="button"
            onClick={() => setPoniendo('nuevo')}
            className="tocable mt-0.5 flex items-center gap-2 text-left text-[17px] font-extrabold text-tenue"
            style={{ minHeight: 44 }}
          >
            <Ico nombre="mas" tam={18} grosor={2.6} />
            Otro plato
          </button>
        )}
      </span>

      {poniendo && (
        <Poner
          fecha={fecha}
          momento={momento}
          id={elQueSePone?.id ?? null}
          que={elQueSePone?.que ?? null}
          recetas={recetas}
          cerrar={() => setPoniendo(null)}
        />
      )}
    </span>
  )
}

/* ── Un plato suelto dentro de la comida ──────────────────── */

function UnPlato({
  plato,
  ingredientes,
  listas,
  apagado,
  alTocar,
}: {
  plato: PlatoDelDia
  ingredientes: string[]
  listas: ListaDeCompra[]
  apagado: boolean
  alTocar: () => void
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  /* Lo comprobado se pinta ya, sin esperar a que vuelva la pantalla
     entera: en una pared, un toque que tarda medio segundo se repite. */
  const [faltan, setFaltan] = useState<string[] | null>(plato.faltan ?? null)
  const [mirado, setMirado] = useState(Boolean(plato.comprobado_en))

  const sePuedeComprobar = Boolean(plato.id) && ingredientes.length > 0 && !apagado
  const cuantasFaltan = faltan?.length ?? 0

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

  return (
    <span className="block">
      {apagado ? (
        <span className="block text-[23px] font-extrabold leading-tight text-tinta">
          {plato.que}
        </span>
      ) : (
        <button
          type="button"
          onClick={alTocar}
          className="tocable flex items-center gap-2.5 text-left"
          style={{ minHeight: 44 }}
        >
          <span className="text-[23px] font-extrabold leading-tight text-tinta">{plato.que}</span>
          {/* El lápiz es lo que dice que esto se puede cambiar. Una
              pared en la que unas cosas se tocan y otras no tiene que
              decir cuáles. */}
          <span aria-hidden className="shrink-0 text-apagado">
            <Ico nombre="lapiz" tam={19} grosor={2.2} />
          </span>
        </button>
      )}

      {sePuedeComprobar && (
        <button
          onClick={() => setAbierto(true)}
          className="tocable flex items-center gap-2 text-left text-[17px] font-extrabold"
          style={{
            minHeight: 52,
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
