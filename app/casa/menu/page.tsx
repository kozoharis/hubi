import { hoyAqui } from '@/lib/tablon'
import { elLunesDe, laSemanaDe, comoSeLlamaLaSemana } from '@/lib/menus'
import { laPared, losMenus } from '@/lib/pared'
import { Ico } from '../../iconos'
import { AMBITO } from '../../piezas'
import { Nada, Rotulo } from '../rotulo'
import Recetas, { type Receta } from './recetas'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  EL MENÚ · qué se come esta semana
  ═══════════════════════════════════════════════════════════════

  Siete filas, comida y cena. La pregunta que contesta es la que se hace
  a las siete de la tarde delante de la nevera.

  ─────────────────────────────────────────────────────────────
  SE MIRA, NO SE ESCRIBE. Y ES UNA DECISIÓN, NO UNA FALTA

  La base SÍ dejaría escribir: un aparato tiene `anadir` en el ámbito
  `dia`, así que esta pantalla podría poner el menú del jueves.

  No lo hace, y por una razón práctica: escribir «lentejas con chorizo»
  en una pared es teclear de pie en un teclado en pantalla, con las
  manos mojadas, en una tableta que no se mueve. El menú se pone desde
  el teléfono, sentado, que es donde se decide.

  Lo que sí tendrá sentido el día que se pida es lo contrario: elegir de
  un cajón de recetas ya escritas, que son tres toques y ninguna letra.

  ─────────────────────────────────────────────────────────────
  Y LOS DÍAS PASADOS NO SE ESCONDEN

  Se atenúan. Esconderlos dejaría la semana empezando el jueves, y
  entonces habría que leer los rótulos para saber dónde está uno. Es lo
  mismo que hace la pestaña de la Semana y por el mismo motivo.
*/

export default async function Menu() {
  const { supabase, casa } = await laPared()

  const hoy = hoyAqui()
  const lunes = elLunesDe(hoy)
  const dias = laSemanaDe(lunes)

  const [menus, lasRecetas] = await Promise.all([
    losMenus(supabase, casa, dias[0], dias[6]),
    /*
      El cajón de recetas de la casa. Envuelto como todo lo que puede no
      estar: sin el sql/48, la pantalla del menú no puede caerse por una
      columna de la derecha.
    */
    (async () => {
      try {
        const { data, error } = await supabase
          .from('recetas')
          .select('id, titulo, url, nota, ingredientes')
          .eq('hogar_id', casa)
          .order('creado_en', { ascending: false })
          .limit(40)

        /*
          Los ingredientes son del paso 80. Sin él, Postgres rechaza la
          consulta ENTERA y la pared se quedaría sin recetas por una
          casilla que todavía no existe. Se vuelve a pedir sin ellos.

          Es la misma red que en `/api/menus`, y por lo mismo: una
          columna nueva nunca puede ser obligatoria para lo que ya
          funcionaba.
        */
        if (error) {
          const segunda = await supabase
            .from('recetas')
            .select('id, titulo, url, nota')
            .eq('hogar_id', casa)
            .order('creado_en', { ascending: false })
            .limit(40)
          if (segunda.error) return []
          return (segunda.data ?? []) as Receta[]
        }
        return (data ?? []) as Receta[]
      } catch {
        return []
      }
    })(),
  ])

  const hayAlguno = menus.some((m) => (m.que ?? '').trim().length > 0)

  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-5">
        <Rotulo>Qué se come</Rotulo>
        <p className="text-[20px] font-extrabold text-tinta-suave">
          {comoSeLlamaLaSemana(lunes)}
        </p>
      </div>

      <div className="mt-2 xl:grid xl:grid-cols-[1.35fr_1fr] xl:items-start xl:gap-12">
      <div>
      {!hayAlguno ? (
        <Nada>
          Esta semana no hay menú puesto. Se pone desde el móvil, en El día a día → Menús.
        </Nada>
      ) : (
        <ul className="mt-6 space-y-3">
          {dias.map((dia) => {
            const esHoy = dia === hoy
            const pasado = dia < hoy
            const comida = menus.find((m) => m.fecha === dia && m.momento === 'comida')?.que ?? null
            const cena = menus.find((m) => m.fecha === dia && m.momento === 'cena')?.que ?? null

            return (
              <li
                key={dia}
                className={`flex items-center gap-7 rounded-[28px] border px-7 py-5 ${
                  pasado ? 'opacity-45' : ''
                }`}
                style={{
                  background: esHoy
                    ? `color-mix(in srgb, ${AMBITO.arena} 8%, var(--t-superficie))`
                    : 'var(--t-superficie)',
                  borderColor: esHoy
                    ? `color-mix(in srgb, ${AMBITO.arena} 45%, transparent)`
                    : 'var(--t-borde)',
                  borderLeft: `6px solid ${esHoy ? AMBITO.arena : 'var(--t-borde)'}`,
                }}
              >
                <span className="w-[190px] shrink-0">
                  <span className="block text-[15px] font-extrabold uppercase tracking-wider text-tenue">
                    {esHoy ? 'Hoy' : nombreDelDia(dia)}
                  </span>
                  <span className="block text-[30px] font-extrabold leading-none tabular-nums text-tinta">
                    {Number(dia.slice(8, 10))}
                  </span>
                </span>

                <Plato etiqueta="Comida" que={comida} />
                <Plato etiqueta="Cena" que={cena} />
              </li>
            )
          })}
        </ul>
      )}
      </div>

      {/*
        ── LAS RECETAS, A LA DERECHA ──

        Con su ventana encima: se toca una y se abre ahí mismo, sea un
        vídeo de YouTube o la página de donde salió.

        Es la cocina. Tener la receta en la pared en vez de en el móvil
        apoyado en la encimera con las manos llenas de harina es toda la
        diferencia — y es, probablemente, lo que más se va a usar de
        toda esta pantalla.

        De esa ventana no se sale: lo impone el `sandbox` del marco, que
        no lleva ni `allow-top-navigation` ni `allow-popups`. Está
        explicado en `lib/enlace-seguro.ts`.
      */}
      <div className="mt-12 xl:mt-0">
        <Recetas recetas={lasRecetas} />
      </div>
      </div>
    </section>
  )
}

function Plato({ etiqueta, que }: { etiqueta: string; que: string | null }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3.5">
      <span
        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px]"
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
            que ? 'text-tinta' : 'text-apagado'
          }`}
        >
          {que ?? 'Sin poner'}
        </span>
      </span>
    </span>
  )
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function nombreDelDia(iso: string): string {
  return DIAS[new Date(`${iso}T12:00:00`).getDay()]
}
