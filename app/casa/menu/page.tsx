import { hoyAqui } from '@/lib/tablon'
import { elLunesDe, laSemanaDe, comoSeLlamaLaSemana } from '@/lib/menus'
import { laPared, losMenus } from '@/lib/pared'
import { Ico } from '../../iconos'
import { AMBITO } from '../../piezas'
import { Nada, Rotulo } from '../rotulo'

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

  const menus = await losMenus(supabase, casa, dias[0], dias[6])

  const hayAlguno = menus.some((m) => (m.que ?? '').trim().length > 0)

  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-5">
        <Rotulo>Qué se come</Rotulo>
        <p className="text-[20px] font-extrabold text-tinta-suave">
          {comoSeLlamaLaSemana(lunes)}
        </p>
      </div>

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
