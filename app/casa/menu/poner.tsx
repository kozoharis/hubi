'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { comoSeLlamaElDia } from '@/lib/menus'
import { Ico } from '../../iconos'
import type { Receta } from './recetas'

/*
  ═══════════════════════════════════════════════════════════════
  PONER LO QUE SE COME, DESDE LA PARED
  ═══════════════════════════════════════════════════════════════

  ⚠️  ESTO CORRIGE UNA DECISIÓN MÍA, Y ESTABA ESCRITA EN EL ARCHIVO

  `menu/page.tsx` decía, con todas sus letras: *«se mira, no se
  escribe. Y es una decisión, no una falta»*. El argumento era que
  escribir «lentejas con chorizo» de pie, con las manos mojadas, en un
  teclado en pantalla, es peor que hacerlo sentado en el móvil.

  Haris: *«no se puede editar el tema del menú, y eso es importante»*.
  Tiene razón, y el propio archivo ya había escrito la salida sin darse
  cuenta de que era la respuesta:

      «Lo que sí tendrá sentido el día que se pida es lo contrario:
       elegir de un cajón de recetas ya escritas, que son tres toques
       y ninguna letra.»

  Es el mismo error que los pasos 74, 75, 76 y el del micrófono:
  **quitar una capacidad en lugar de diseñarla.** Que escribir en una
  pared sea incómodo no es una razón para no poder poner la cena — es
  una razón para que poner la cena no se escriba.

  ─────────────────────────────────────────────────────────────
  TRES TOQUES Y NINGUNA LETRA

      1 · se toca el plato del jueves
      2 · se toca una receta del cajón
      3 · ya está

  Las recetas de la casa salen como botones grandes. Se toca una y el
  plato queda puesto, con su `receta_id` — o sea que además hereda lo
  que lleva, y el «¿tienes lo que lleva?» del paso 81 empieza a
  funcionar solo.

  ─────────────────────────────────────────────────────────────
  Y ESCRIBIR SIGUE ESTANDO, DEBAJO

  Para el día que se cene algo que no está en el cajón. No es lo
  primero que se ofrece, es lo último: el punto 29 del planteamiento —
  *la complejidad pertenece al sistema, no al usuario*— no dice que
  haya que esconder la salida, dice que no puede ser la única.

  ─────────────────────────────────────────────────────────────
  NINGÚN PERMISO NUEVO

  La base ya lo dejaba: `menus_escribir` pide `puedo_escribir(casa)`, y
  una pantalla de cocina no es `lector`. No hace falta tocar SQL, y
  conviene que se note — el permiso llevaba meses dado y sin usar,
  exactamente como pasó con las rutinas en el paso 74.
*/

export default function Poner({
  fecha,
  momento,
  id = null,
  que,
  recetas,
  cerrar,
}: {
  fecha: string
  momento: 'comida' | 'cena'
  /*
    CUÁL de los platos de esa comida se está poniendo.

    Nulo quiere decir uno nuevo — desde el paso 85 en una comida caben
    varios—. Con identificador se cambia ése y los demás se quedan.
  */
  id?: string | null
  /** Lo que hay puesto ahora en ESE plato, si hay algo. */
  que: string | null
  recetas: Receta[]
  cerrar: () => void
}) {
  const router = useRouter()
  const [escribiendo, setEscribiendo] = useState(false)
  const [texto, setTexto] = useState(que ?? '')
  const [trabajando, setTrabajando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function guardar(nuevo: string, receta: string | null) {
    setFallo(null)
    setTrabajando(true)

    try {
      const r = await fetch(api('/api/menus'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id ?? undefined, fecha, momento, que: nuevo, receta_id: receta }),
      })
      const d = (await r.json().catch(() => null)) as { error?: string } | null

      if (!r.ok) {
        setFallo(d?.error ?? 'No se ha podido guardar. Inténtalo otra vez.')
        setTrabajando(false)
        return
      }

      /* Vacío significa quitarlo. Con identificador se quita ese
         plato; los demás de esa comida se quedan. Lo decide la API. */
      router.refresh()
      cerrar()
    } catch {
      setFallo('No se ha podido guardar. Inténtalo otra vez.')
      setTrabajando(false)
    }
  }

  const comoSeLlama = momento === 'cena' ? 'Cena' : 'Comida'

  return (
    /*
      El mismo telón que `comprobar.tsx`, y a propósito: en esta
      pantalla ya hay una ventana que se abre así, y dos maneras
      distintas de abrir una ventana en la misma pared serían dos cosas
      que aprender donde solo hay una.
    */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-12 py-12"
      style={{ background: 'rgba(26,23,20,.55)' }}
      onClick={cerrar}
    >
      <div
        className="max-h-full w-full max-w-[980px] overflow-y-auto rounded-[36px] border border-borde bg-fondo px-12 py-10"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">
          {comoSeLlama} del {comoSeLlamaElDia(fecha)}
        </p>
        <p
          className={`mt-1 text-[39px] font-extrabold leading-tight ${
            que ? 'text-tinta' : 'text-apagado'
          }`}
        >
          {que ?? 'Otro plato'}
        </p>

        {/* ── 1 · EL CAJÓN, QUE ES EL CAMINO CORTO ── */}
        {recetas.length > 0 && !escribiendo && (
          <>
            <p className="mt-8 text-[28px] font-extrabold text-tinta">
              Toca lo que se come.
            </p>

            <ul className="mt-4 grid grid-cols-2 gap-3">
              {recetas.map((r) => {
                const puesta = (que ?? '').trim() === r.titulo.trim()
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => guardar(r.titulo, r.id)}
                      disabled={trabajando}
                      aria-pressed={puesta}
                      className="tocable flex w-full items-center gap-4 rounded-[22px] border px-6 text-left disabled:opacity-45"
                      style={{
                        minHeight: 84,
                        background: puesta ? 'var(--t-tinta)' : 'var(--t-superficie)',
                        color: puesta ? 'var(--t-fondo)' : 'var(--t-tinta)',
                        borderColor: puesta ? 'var(--t-tinta)' : 'var(--t-borde)',
                      }}
                    >
                      <span className="text-[25px] font-extrabold leading-tight">{r.titulo}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {recetas.length === 0 && !escribiendo && (
          <p className="mt-8 text-[25px] font-semibold leading-snug text-tinta-suave">
            Todavía no hay recetas guardadas en esta casa. Se guardan desde el móvil, en El día a
            día → Menús — y a partir de ahí poner la cena aquí son dos toques.
          </p>
        )}

        {/* ── 2 · O ESCRIBIRLO ── */}
        {escribiendo && (
          <>
            <label
              htmlFor="que-se-come"
              className="mt-8 block text-[20px] font-extrabold uppercase tracking-[0.14em] text-tenue"
            >
              Qué se come
            </label>
            <input
              id="que-se-come"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && texto.trim().length > 1) guardar(texto, null)
              }}
              maxLength={200}
              placeholder="Lentejas"
              autoComplete="off"
              autoFocus
              className="entrada mt-3 h-[84px] w-full text-[30px] font-extrabold"
            />
          </>
        )}

        {fallo && (
          <p className="mt-5 text-[22px] font-bold" style={{ color: 'var(--t-alerta)' }}>
            {fallo}
          </p>
        )}

        {/* ── Los botones, siempre los mismos tres sitios ── */}
        <div className="mt-8 flex flex-wrap gap-3">
          {escribiendo ? (
            <>
              <Boton
                principal
                onClick={() => guardar(texto, null)}
                desactivado={trabajando || texto.trim().length < 2}
              >
                <Ico nombre="check" tam={26} grosor={2.6} />
                {trabajando ? 'Un momento…' : 'Guardar'}
              </Boton>
              {recetas.length > 0 && (
                <Boton onClick={() => setEscribiendo(false)} desactivado={trabajando}>
                  Ver las recetas
                </Boton>
              )}
            </>
          ) : (
            <Boton onClick={() => setEscribiendo(true)} desactivado={trabajando}>
              <Ico nombre="lapiz" tam={24} grosor={2.4} />
              Escribir otra cosa
            </Boton>
          )}

          {/* Quitar solo aparece si hay algo que quitar. Un botón de
              borrar encendido sobre un día vacío es un botón que no
              hace nada y que da miedo igual. */}
          {que && (
            <Boton onClick={() => guardar('', null)} desactivado={trabajando}>
              Quitarlo
            </Boton>
          )}

          <Boton onClick={cerrar} desactivado={trabajando}>
            Ahora no
          </Boton>
        </div>
      </div>
    </div>
  )
}

/*
  Los botones de la pared. Los mismos que usa `comprobar.tsx` y por lo
  mismo: las piezas del sistema miden 60 px y letra de 19 porque son
  las del teléfono, y aquí harían botones de móvil en una pantalla de
  27 pulgadas. Colores del sistema, ni uno inventado.
*/
function Boton({
  children,
  onClick,
  principal = false,
  desactivado = false,
}: {
  children: React.ReactNode
  onClick: () => void
  principal?: boolean
  desactivado?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivado}
      className="tocable flex items-center justify-center gap-3 rounded-full border px-9 text-[22px] font-extrabold disabled:opacity-45"
      style={{
        minHeight: 72,
        background: principal ? 'var(--t-boton)' : 'var(--t-superficie)',
        color: principal ? 'var(--t-boton-texto)' : 'var(--t-tinta)',
        borderColor: principal ? 'transparent' : 'var(--t-borde)',
      }}
    >
      {children}
    </button>
  )
}
