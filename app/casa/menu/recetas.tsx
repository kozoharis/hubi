'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { deDondeEs } from '@/lib/menus'
import { paraLaVentana, SANDBOX } from '@/lib/enlace-seguro'
import { Ico } from '../../iconos'
import { AMBITO } from '../../piezas'
import GuardarReceta from './guardar-receta'

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

export type Receta = {
  id: string
  titulo: string
  url: string | null
  nota: string | null
  /* Lo que lleva, una línea por ingrediente (paso 80). */
  ingredientes?: string[] | null
}

export default function Recetas({ recetas }: { recetas: Receta[] }) {
  const router = useRouter()
  const [abierta, setAbierta] = useState<Receta | null>(null)
  /* Cuál se está corrigiendo. Nula, ninguna. */
  const [corrigiendo, setCorrigiendo] = useState<Receta | null>(null)
  const [grande, setGrande] = useState(false)
  const [compra, setCompra] = useState<'quieto' | 'yendo' | 'hecho' | 'fallo'>('quieto')
  /* Guardar una receta desde la cocina, que es donde se apuntan. Ver
     `guardar-receta.tsx`. */
  const [guardando, setGuardando] = useState(false)

  /*
    ── LOS INGREDIENTES, A LA COMPRA DE UN TOQUE ──

    Haris: *«un espacio donde añadir ingredientes, que estarán
    vinculados con la compra»*. Ésta es la vinculación, y es la parte
    que vale: copiar seis ingredientes a mano de una receta a la lista
    es trabajo doble hecho por una persona.

    Se mandan TAL CUAL están escritos —«medio kilo de harina»— y no
    partidos ni limpiados. La ruta de la compra ya descarta lo que
    seguro que no es un producto; lo demás entra, que es lo correcto:
    ante la duda, que esté apuntado.
  */
  async function aLaCompra(r: Receta) {
    const cuales = (r.ingredientes ?? []).filter((i) => i && i.trim().length > 1)
    if (cuales.length === 0) return

    setCompra('yendo')
    try {
      const res = await fetch(api('/api/compra'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cosas: cuales.map((q) => ({ que: q })) }),
      })
      if (!res.ok) throw new Error()
      setCompra('hecho')
      router.refresh()
      /* Vuelve a su sitio solo: un cartel de «hecho» permanente en una
         pared lo acaba tapando alguien con la mano. */
      setTimeout(() => setCompra('quieto'), 2500)
    } catch {
      setCompra('fallo')
    }
  }

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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <h2 className="text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">
            Recetas
          </h2>
          {recetas.length > 0 && (
            <p className="text-[19px] font-extrabold text-tinta-suave">{recetas.length}</p>
          )}
        </div>

        {/*
          ── Y AQUÍ SE GUARDAN, NO SOLO SE MIRAN ──

          El botón va arriba y con su palabra, no un «+» suelto en una
          esquina: el punto 5 del planteamiento, los iconos siempre
          acompañados de texto.
        */}
        <button
          type="button"
          onClick={() => setGuardando(true)}
          className="tocable flex h-[60px] shrink-0 items-center gap-3 rounded-full border border-borde bg-superficie px-6 text-[18px] font-extrabold text-tinta"
        >
          <Ico nombre="mas" tam={22} grosor={2.6} />
          Guardar una receta
        </button>
      </div>

      {guardando && <GuardarReceta cerrar={() => setGuardando(false)} />}

      {/* Y la misma ventana, con la receta dentro, para corregirla. */}
      {corrigiendo && (
        <GuardarReceta receta={corrigiendo} cerrar={() => setCorrigiendo(null)} />
      )}

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
                /*
                  ⚠️  AQUÍ PONÍA `no-referrer`, Y ERA UN FALLO

                  Se veía como un **Error 153** de YouTube dentro de la
                  ventana: «error de configuración del reproductor».

                  YouTube exige saber QUÉ PÁGINA le está incrustando el
                  vídeo, para poder comprobar si ese dueño permite que
                  se incruste. Con `no-referrer` el navegador no manda
                  ninguna cabecera, YouTube no puede comprobarlo, y se
                  niega a reproducir. Lo puse por prudencia y lo que
                  hice fue romper la función.

                  `origin` manda SOLO el dominio —
                  `https://family-hub-…vercel.app` — y nunca la ruta. O
                  sea: YouTube sabe que le incrusta MAPPEL, y no sabe qué
                  pantalla de MAPPEL, ni de qué casa, ni qué receta. La
                  privacidad que se buscaba se mantiene entera; lo único
                  que se pierde es el error.
                */
                referrerPolicy="origin"
                allow="encrypted-media; picture-in-picture"
              />
            </div>
          ) : (
            /* Una receta sin enlace no es un error: hay recetas que se
               escriben. Se enseña lo escrito, que es lo que hay. */
            <div className="rounded-[28px] border border-borde bg-superficie px-8 py-8">
              <p className="whitespace-pre-wrap text-[24px] font-extrabold leading-snug text-tinta">
                {abierta.nota || 'Esta receta todavía no está escrita. Se escribe desde el móvil, en El día a día → Menús.'}
              </p>
            </div>
          )}

          {/*
            ── Y LO ESCRITO TAMBIÉN CUANDO HAY VÍDEO ──

            Antes la nota solo salía si NO había enlace, y eso estaba
            mal: quien apunta «le pongo menos azúcar que en el vídeo»
            lo apunta justamente en la que tiene vídeo. Se pierde el
            único trozo que es de esta casa.
          */}
          {ventana && abierta.nota && (
            <div className="mt-4 rounded-[24px] border border-borde bg-superficie px-7 py-5">
              <p className="whitespace-pre-wrap text-[21px] font-extrabold leading-snug text-tinta">
                {abierta.nota}
              </p>
            </div>
          )}

          {/* ── Lo que lleva, y el botón que lo manda a la compra ── */}
          {(abierta.ingredientes ?? []).length > 0 && (
            <div
              className="mt-4 rounded-[24px] border bg-superficie px-7 py-5"
              style={{ borderColor: 'var(--t-borde)', borderLeft: `6px solid ${AMBITO.oliva}` }}
            >
              <p className="text-[17px] font-extrabold uppercase tracking-[0.14em] text-tenue">
                Lo que lleva
              </p>

              <ul className="mt-3 space-y-1.5">
                {(abierta.ingredientes ?? []).map((i, n) => (
                  <li
                    key={`${i}-${n}`}
                    className="flex items-start gap-3 text-[21px] font-extrabold leading-snug text-tinta"
                  >
                    <span
                      className="mt-[10px] block h-[8px] w-[8px] shrink-0 rounded-full"
                      style={{ background: AMBITO.oliva }}
                    />
                    {i}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => aLaCompra(abierta)}
                disabled={compra === 'yendo'}
                className="tocable mt-5 flex h-[72px] w-full items-center justify-center gap-3 rounded-[22px] text-[22px] font-extrabold disabled:opacity-50"
                style={{ background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }}
              >
                <Ico nombre="bolsa" tam={26} grosor={2.3} />
                {compra === 'yendo'
                  ? 'Apuntando…'
                  : compra === 'hecho'
                    ? 'Apuntado en la compra'
                    : 'Añadirlo a la compra'}
              </button>

              {compra === 'fallo' && (
                <p className="mt-3 text-[18px] font-bold" style={{ color: 'var(--t-alerta)' }}>
                  No se ha podido apuntar. Inténtalo otra vez.
                </p>
              )}
            </div>
          )}

          {/*
            ── CAMBIARLA ──

            Dentro de la ventana y no en la lista: la lista es para
            encontrar una receta, y ahí un botón de cambiar por renglón
            sería un botón peligroso al lado de cada cosa que se busca.
            Aquí ya se está mirando ÉSA.
          */}
          <button
            type="button"
            onClick={() => setCorrigiendo(abierta)}
            className="tocable mt-5 flex h-[64px] items-center gap-3 rounded-full border border-borde bg-superficie px-7 text-[19px] font-extrabold text-tinta"
          >
            <Ico nombre="lapiz" tam={22} grosor={2.4} />
            Cambiar esta receta
          </button>

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
            Toca «Guardar una receta» aquí arriba y se guarda. Después, poner la cena del jueves
            será un toque.
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
