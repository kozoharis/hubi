'use client'

import { useState } from 'react'
import { deDondeEs } from '@/lib/menus'
import { paraLaVentana, SANDBOX } from '@/lib/enlace-seguro'
import { Ico } from '../../iconos'
import { AMBITO } from '../../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  LAS RECETAS · y la ventana donde se ven
  ═══════════════════════════════════════════════════════════════

  A la derecha del menú de la semana: la lista de recetas de la casa y,
  encima, una ventana donde se abre la que se toque — un vídeo de
  YouTube o la página de donde salió.

  Es la cocina: aquí es donde se cocina de verdad, y tener la receta en
  la pared en vez de en el móvil apoyado en la encimera con las manos
  llenas de harina es toda la diferencia.

  ─────────────────────────────────────────────────────────────
  ⚠️  DE ESA VENTANA NO SE SALE, Y ESO ES EL PUNTO

  Lo pidió Haris así: *«que no se pueda abrir ni reproducir nada más en
  esa ventana»*. Y es la decisión correcta, porque esa pantalla la toca
  cualquiera que entre en la casa.

  Lo impone el `sandbox` del `<iframe>`, que NO lleva
  `allow-top-navigation` ni `allow-popups`: la página puede moverse por
  dentro —darle a reproducir, bajar por la receta— pero no puede
  llevarse la pared a otro sitio ni abrir nada encima. No es una
  comprobación nuestra que se pueda olvidar: lo hace el navegador.

  Y a los vídeos de YouTube se les quita lo de después: `rel=0` para que
  al acabar no aparezcan vídeos de otros, que es exactamente
  «reproducir otra cosa». Está en `lib/enlace-seguro.ts`.

  ─────────────────────────────────────────────────────────────
  GRANDE Y PEQUEÑA, Y NADA MÁS

  Dos tamaños: en su sitio, o la pared entera. Sin arrastrar, sin
  redimensionar, sin esquinas. Una ventana que se puede dejar a medias
  es una ventana que alguien deja a medias y el siguiente no sabe
  arreglar.

  En grande se sale con un botón grande, y también con Escape. Nunca
  solo con Escape: en una tableta colgada de una pared no hay teclado.
*/

export type Receta = { id: string; titulo: string; url: string | null; nota: string | null }

export default function Recetas({ recetas }: { recetas: Receta[] }) {
  const [abierta, setAbierta] = useState<Receta | null>(null)
  const [grande, setGrande] = useState(false)

  const ventana = paraLaVentana(abierta?.url ?? null)

  function abrir(r: Receta) {
    /* Tocar la que ya está abierta la cierra. Sin eso, la única manera
       de quitar una receta de la ventana sería abrir otra. */
    if (abierta?.id === r.id) {
      setAbierta(null)
      setGrande(false)
      return
    }
    setAbierta(r)
  }

  return (
    <>
      <div className="flex items-baseline gap-4">
        <h2 className="text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">
          Recetas
        </h2>
        {recetas.length > 0 && (
          <p className="text-[19px] font-extrabold text-tinta-suave">{recetas.length}</p>
        )}
      </div>

      {/* ── La ventana ── */}
      {abierta && (
        <div
          className={
            grande
              ? /* La pared entera. `z-50` por encima de todo, incluidas
                   las pestañas: en grande no se navega, se mira. */
                'fixed inset-0 z-50 flex flex-col bg-fondo p-8'
              : 'mt-6'
          }
        >
          <div
            className={`flex items-center justify-between gap-5 ${grande ? 'mb-5' : 'mb-3'}`}
          >
            <p className="min-w-0 flex-1">
              <span
                className={`block truncate font-extrabold leading-tight text-tinta ${
                  grande ? 'text-[32px]' : 'text-[22px]'
                }`}
              >
                {abierta.titulo}
              </span>
              {abierta.url && (
                <span className="block text-[16px] font-bold text-tenue">
                  {deDondeEs(abierta.url)}
                </span>
              )}
            </p>

            <div className="flex shrink-0 gap-2.5">
              <button
                type="button"
                onClick={() => setGrande((g) => !g)}
                className="tocable flex h-[60px] items-center gap-3 rounded-full border border-borde bg-superficie px-6 text-[18px] font-extrabold text-tinta"
              >
                <Ico nombre={grande ? 'atras' : 'ojo'} tam={22} grosor={2.3} />
                {grande ? 'Hacerla pequeña' : 'Verla grande'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAbierta(null)
                  setGrande(false)
                }}
                aria-label="Cerrar la receta"
                className="tocable flex h-[60px] w-[60px] items-center justify-center rounded-full border border-borde bg-superficie text-tinta"
              >
                <Ico nombre="mas" tam={24} grosor={2.6} className="rotate-45" />
              </button>
            </div>
          </div>

          {ventana ? (
            <div
              className={`overflow-hidden rounded-[28px] border border-borde bg-superficie ${
                grande ? 'flex-1' : 'aspect-video w-full'
              }`}
            >
              <iframe
                /* La `key` con la dirección: sin ella, cambiar de receta
                   reutiliza el mismo marco y algunos vídeos se quedan
                   sonando con la imagen de otro. */
                key={ventana.src}
                src={ventana.src}
                title={abierta.titulo}
                className="h-full w-full border-0"
                /* Lo que de verdad cierra esta ventana. Ver
                   `lib/enlace-seguro.ts`. */
                sandbox={SANDBOX}
                referrerPolicy="no-referrer"
                allow="encrypted-media; picture-in-picture"
              />
            </div>
          ) : (
            /* Una receta sin enlace no es un error: hay recetas que son
               una nota escrita a mano. Se enseña la nota, que es lo que
               hay. */
            <div className="rounded-[28px] border border-borde bg-superficie px-8 py-8">
              <p className="whitespace-pre-wrap text-[22px] font-extrabold leading-snug text-tinta">
                {abierta.nota || 'Esta receta no tiene ni enlace ni nota.'}
              </p>
            </div>
          )}

          {/*
            El aviso de lo que no podemos evitar. Muchas páginas se
            niegan a que las metan en una ventana de otra, y el navegador
            no nos deja saberlo antes de intentarlo: sale en blanco y ya.

            Decirlo con palabras es mejor que dejar un hueco gris sin
            explicación. Solo para páginas: los vídeos de YouTube se sabe
            que funcionan.
          */}
          {ventana?.tipo === 'pagina' && !grande && (
            <p className="mt-3 text-[16px] font-bold leading-snug text-tenue">
              Si sale en blanco, esa página no se deja abrir aquí. Ábrela en el móvil.
            </p>
          )}
        </div>
      )}

      {/* ── La lista ── */}
      {recetas.length === 0 ? (
        <div className="mt-6 rounded-[28px] border border-borde bg-superficie px-7 py-8">
          <p className="text-[22px] font-extrabold leading-snug text-tinta-suave">
            Todavía no hay recetas guardadas.
          </p>
          <p className="mt-2 text-[18px] font-bold leading-snug text-tenue">
            Se guardan desde el móvil, en El día a día → Menús.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2.5">
          {recetas.map((r) => {
            const puesta = abierta?.id === r.id
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => abrir(r)}
                  className="tocable flex w-full items-center gap-4 rounded-[24px] border px-6 py-4 text-left"
                  style={{
                    background: puesta
                      ? `color-mix(in srgb, ${AMBITO.arena} 12%, var(--t-superficie))`
                      : 'var(--t-superficie)',
                    borderColor: puesta
                      ? `color-mix(in srgb, ${AMBITO.arena} 45%, transparent)`
                      : 'var(--t-borde)',
                    borderLeft: `6px solid ${puesta ? AMBITO.arena : 'var(--t-borde)'}`,
                  }}
                >
                  <span
                    className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px]"
                    style={{
                      background: `color-mix(in srgb, ${AMBITO.arena} 16%, var(--t-superficie))`,
                      color: AMBITO.arena,
                    }}
                  >
                    {/* El dibujo dice si eso es un vídeo o una página,
                        que es lo único que hace falta saber antes de
                        tocarlo. */}
                    <Ico
                      nombre={paraLaVentana(r.url)?.tipo === 'video' ? 'onda' : 'hoja'}
                      tam={22}
                      grosor={2.1}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[21px] font-extrabold leading-tight text-tinta">
                      {r.titulo}
                    </span>
                    {r.url && (
                      <span className="block text-[16px] font-bold text-tenue">
                        {deDondeEs(r.url)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
