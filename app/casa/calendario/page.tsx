import Link from '@/app/enlace'
import { hoyAqui } from '@/lib/tablon'
import { elLunesDe, laSemanaDe, comoSeLlamaLaSemana, otraSemana } from '@/lib/menus'
import { laPared, loApuntado, loDestacado, loSinFecha, losMenus } from '@/lib/pared'
import { Ico, type Icono } from '../../iconos'
import { AMBITO, PastillaAmbito } from '../../piezas'
import { pintaDe } from '../../iconos'
import { Renglon } from '../cosa'
import { Rotulo } from '../rotulo'
import Mes from './mes'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  EL CALENDARIO · la semana arriba, y debajo el mes y lo destacado
  ═══════════════════════════════════════════════════════════════

  La semana entera de un vistazo: lo apuntado y lo que se come, día a
  día. Es la pantalla que pidió Haris cuando dijo «acceso semanal full»,
  y es la razón de que la pared tenga mínimo 1920 px — en menos, siete
  columnas legibles no caben.

  ─────────────────────────────────────────────────────────────
  SE LLAMA CALENDARIO, Y NO SEMANA

  La pestaña decía «Semana» y Haris lo cazó: *«cuando estás en semana,
  eso debe seguir siendo calendario»*. Y es que la semana no es una
  cosa: es una VISTA de una cosa, que es el calendario. Poner el nombre
  de la vista en la pestaña obliga a preguntarse dónde está el
  calendario — está ahí, pero no lo dice.

  Es la regla 7, «una cosa, un nombre», aplicada al revés de como
  apareció en Papeles: allí había dos nombres para una cosa; aquí había
  el nombre de una parte en el sitio del todo.

  ─────────────────────────────────────────────────────────────
  Y DEBAJO, DOS MITADES

      ┌──────────────── LA SEMANA · 7 columnas ────────────────┐
      ├─────────── A LA VISTA ───────────┬────── EL MES ───────┤

  **A la vista**, a la izquierda y más ancha, porque lleva texto que hay
  que leer. **El mes**, a la derecha, porque es una rejilla de tamaño
  fijo que no crece por mucho sitio que se le dé.

  ─────────────────────────────────────────────────────────────
  DE LUNES A DOMINGO, SIEMPRE

  Y no «los próximos siete días». Una casa no piensa en «dentro de
  cuatro días»: piensa en «el jueves». Si la primera columna cambiara
  cada mañana, habría que leer los siete rótulos para saber dónde está
  uno; con la semana fija, el jueves está siempre en el mismo sitio.

  El coste es que el lunes por la noche la mitad de la pantalla es
  pasado. Se acepta: el domingo por la tarde, saber que el lunes hay
  médico vale más.

  ─────────────────────────────────────────────────────────────
  HOY SE SEÑALA, Y CON LA MISMA MARCA DE SIEMPRE

  La columna de hoy va teñida al 6 % de su ámbito, que es el `tinte` de
  `Fila`. No un borde de color ni una sombra: la manera que mappel ya usa
  para decir «ésta, entre sus vecinas».
*/

/*
  Los platos de una comida, en un renglón. Un punto medio entre ellos,
  que no se confunde con el nombre de un plato como sí hace la coma
  («lentejas con chorizo, y arroz»). Desde el paso 85 una comida puede
  tener varios.
*/
function juntos(menus: { momento: string; que: string | null }[], cual: string): string | null {
  const nombres = menus
    .filter((m) => m.momento === cual)
    .map((m) => (m.que ?? '').trim())
    .filter(Boolean)
  return nombres.length > 0 ? nombres.join(' · ') : null
}

export default async function Calendario({
  searchParams,
}: {
  searchParams: Promise<{ lunes?: string }>
}) {
  const { supabase, casa } = await laPared()

  const hoy = hoyAqui()

  /*
    ── QUÉ SEMANA SE ESTÁ MIRANDO ──

    Va en la dirección y no en un `useState`, por lo mismo que las cinco
    pestañas: así la vuelta automática a Hoy se lleva por delante también
    la semana en la que alguien dejó la pantalla, sin que haya que
    acordarse de reiniciar nada.

    Y se valida la forma antes de usarla. Una fecha que llegue torcida
    —a mano, o por un enlace viejo— se ignora y se enseña esta semana,
    que es lo único que nunca está mal.
  */
  const pedida = (await searchParams).lunes ?? ''
  const lunes = /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? elLunesDe(pedida) : elLunesDe(hoy)
  const dias = laSemanaDe(lunes)

  const estaSemana = lunes === elLunesDe(hoy)

  /*
    El mes que se enseña abajo es el de la semana que se está mirando, y
    no siempre el de hoy: mirando la semana del 29 de septiembre al 5 de
    octubre, un calendario de septiembre no ayuda a nada.
  */
  const [ano, mes] = lunes.split('-').map(Number)
  const delMes = `${ano}-${String(mes).padStart(2, '0')}`
  const ultimo = String(new Date(ano, mes, 0).getDate()).padStart(2, '0')

  const [cosas, menus, delMesEntero, destacado, sinFecha] = await Promise.all([
    loApuntado(supabase, casa, dias[0], dias[6]),
    losMenus(supabase, casa, dias[0], dias[6]),
    loApuntado(supabase, casa, `${delMes}-01`, `${delMes}-${ultimo}`),
    loDestacado(supabase, casa),
    loSinFecha(supabase, casa),
  ])

  /* Lo destacado primero y lo que no tiene día detrás, sin repetir: algo
     puede estar en las dos listas. */
  const yaEsta = new Set(destacado.map((c) => c.id))
  const pendiente = [...destacado, ...sinFecha.filter((c) => !yaEsta.has(c.id))]

  const conAlgo = new Set(delMesEntero.map((c) => c.fecha).filter(Boolean) as string[])

  return (
    <>
    <section className="mt-12">
      <div className="flex items-center justify-between gap-8">
        <div className="flex items-baseline gap-5">
          <Rotulo>{estaSemana ? 'Esta semana' : 'La semana'}</Rotulo>
          <p className="text-[20px] font-extrabold text-tinta-suave">
            {comoSeLlamaLaSemana(lunes)}
          </p>
        </div>

        {/*
          ── ADELANTE Y ATRÁS ──

          Botones de 60 px y no de 44. En un calendario de pared, «la
          semana que viene» se mira de pie y de paso, muchas veces con
          una mano ocupada.

          Y el del medio solo sale cuando hace falta. Un «Esta semana»
          encendido estando ya en esta semana es un botón que no hace
          nada, y en una pared eso lo prueba todo el mundo una vez.
        */}
        <div className="flex shrink-0 items-center gap-3">
          <Flecha hacia={otraSemana(lunes, -1)} icono="atras" que="Semana anterior" />
          {!estaSemana && (
            <a
              href="/casa/calendario"
              className="flex h-[60px] items-center rounded-full border border-borde bg-superficie px-6 text-[18px] font-extrabold text-tinta"
            >
              Esta semana
            </a>
          )}
          <Flecha hacia={otraSemana(lunes, 1)} icono="flecha" que="Semana siguiente" />
        </div>
      </div>

      {/*
        Sin `items-start`: las siete columnas miden lo mismo, la del día
        más cargado. Dejadas a su aire quedaban siete tarjetas de altura
        distinta flotando, que es un desorden y no un calendario. Una
        semana se lee como un tablero.
      */}
      <div className="mt-6 grid grid-cols-7 gap-3">
        {dias.map((dia) => {
          const esHoy = dia === hoy
          const suyas = cosas.filter((c) => c.fecha === dia)
          const delDia = menus.filter((m) => m.fecha === dia)
          const comida = juntos(delDia, 'comida')
          const cena = juntos(delDia, 'cena')

          return (
            /*
              La columna entera es un enlace al día. Y entera, no un
              «ver más» al final: en una pared, el sitio donde hay que
              dar es el mismo sitio donde está lo que se quiere mirar.
            */
            <Link
              key={dia}
              href={`/casa/dia/${dia}`}
              className="tocable block rounded-[28px] border px-3.5 py-4"
              style={{
                background: esHoy
                  ? `color-mix(in srgb, ${AMBITO.verde} 6%, var(--t-superficie))`
                  : 'var(--t-superficie)',
                borderColor: esHoy
                  ? `color-mix(in srgb, ${AMBITO.verde} 40%, transparent)`
                  : 'var(--t-borde)',
              }}
            >
              {/* El nombre del día, y «HOY» en vez del nombre cuando lo
                  es: nadie busca «sábado» si lo que quiere saber es qué
                  hay hoy. */}
              <p className="text-[15px] font-extrabold uppercase tracking-wider text-tenue">
                {esHoy ? 'Hoy' : nombreCorto(dia)}
              </p>
              <p className="mt-0.5 text-[30px] font-extrabold leading-none tabular-nums text-tinta">
                {Number(dia.slice(8, 10))}
              </p>

              {suyas.length > 0 && (
                <ul className="mt-4 space-y-2.5">
                  {suyas.map((c) => (
                    <Renglon
                      key={c.id}
                      titulo={c.titulo}
                      cuando={c.hora ? c.hora.slice(0, 5) : undefined}
                      hecha={c.estado === 'hecho'}
                    />
                  ))}
                </ul>
              )}

              {/* La raya solo si hay algo ARRIBA que separar. Sin
                  tareas, un día con menú salía con un renglón suelto
                  colgando de una línea que no dividía nada. */}
              {(comida || cena) && (
                <div
                  className={
                    suyas.length > 0 ? 'mt-4 border-t border-borde pt-3.5' : 'mt-4'
                  }
                >
                  {comida && <Linea que={comida} />}
                  {cena && <Linea que={cena} />}
                </div>
              )}

              {suyas.length === 0 && !comida && !cena && (
                <p className="mt-3.5 text-[16px] font-bold leading-snug text-apagado">
                  Nada apuntado
                </p>
              )}
            </Link>
          )
        })}
      </div>
    </section>

    {/* ── Debajo: lo destacado y el mes ── */}
    <div className="mt-9 grid gap-8 xl:grid-cols-[1.55fr_1fr]">
      {/*
        ── A LA VISTA ──

        Lo que alguien ha decidido que no se olvide, esté en la semana
        que esté. «La comunión es el 4 de octubre.» Una fecha dice
        CUÁNDO; destacar dice QUE NO SE OLVIDE, y eso no caduca el
        domingo — por eso esto no está dentro de la semana de arriba.

        Se destaca desde el móvil. La pantalla no puede: una pared que
        decide qué es importante no la quiere nadie.
      */}
      <section>
        {/*
          Se llamaba «A la vista» y ahora es «Pendiente», porque lleva
          dos cosas: lo que alguien dejó clavado con la chincheta, y lo
          apuntado que no tiene día. Antes de fundir Tareas con el
          Calendario, lo segundo vivía en su pestaña; ahora vive aquí,
          que es donde se busca «¿me queda algo?».

          Lo destacado va primero y lleva su chincheta. Lo demás va
          detrás, sin ella.
        */}
        <Rotulo>Pendiente</Rotulo>

        {pendiente.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-borde bg-superficie px-8 py-8">
            <p className="text-[24px] font-extrabold leading-snug text-tinta-suave">
              No queda nada pendiente.
            </p>
            <p className="mt-2.5 text-[19px] font-bold leading-snug text-tenue">
              Desde el móvil, abre una cosa de la agenda y pulsa «Dejar a la vista».
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-3 2xl:grid-cols-2">
            {pendiente.map((c) => {
              const p = pintaDe(c.titulo)
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-5 rounded-[28px] border bg-superficie px-6 py-5"
                  style={{
                    borderColor: 'var(--t-borde)',
                    borderLeft: `6px solid ${AMBITO[p.ambito]}`,
                  }}
                >
                  <PastillaAmbito icono={p.icono} ambito={p.ambito} tam={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[24px] font-extrabold leading-tight text-tinta">
                      {c.titulo}
                    </span>
                    {c.fecha && (
                      <span className="mt-0.5 block text-[17px] font-bold text-tenue">
                        {enPalabras(c.fecha, c.hora)}
                      </span>
                    )}
                  </span>
                  {/* La chincheta solo en lo destacado: es lo que
                      distingue «alguien decidió que esto no se olvide»
                      de «esto está apuntado y no tiene día». */}
                  {yaEsta.has(c.id) && (
                    <span className="shrink-0 text-apagado">
                      <Ico nombre="chincheta" tam={22} grosor={2.1} />
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <Rotulo>El mes</Rotulo>
        <div className="mt-5">
          <Mes hoy={hoy} conAlgo={conAlgo} lunes={lunes} />
        </div>
      </section>
    </div>
    </>
  )
}

const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** «4 de octubre» · «4 de octubre · 12:00». Con el año si no es éste. */
function enPalabras(iso: string, hora: string | null): string {
  const [a, m, d] = iso.split('-').map(Number)
  const ano = new Date().getFullYear()
  const cuando = `${d} de ${MESES_LARGOS[m - 1]}${a === ano ? '' : ` de ${a}`}`
  return hora ? `${cuando} · ${hora.slice(0, 5)}` : cuando
}

/* Un plato dentro de una columna. Sin pastilla: a este tamaño, siete
   pastillas de comida en fila serían siete manchas del mismo color y
   dejarían de identificar nada. Basta el punto. */
function Linea({ que }: { que: string }) {
  return (
    <p className="flex items-start gap-2 text-[16px] font-bold leading-snug text-tinta-suave">
      <span
        className="mt-[7px] block h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: AMBITO.arena }}
      />
      <span className="min-w-0">{que}</span>
    </p>
  )
}

const CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function nombreCorto(iso: string): string {
  return CORTO[new Date(`${iso}T12:00:00`).getDay()]
}

/*
  Una flecha de semana. 60 px de alto, el dibujo solo —es la única
  excepción a «un dibujo nunca va solo», y se paga con el `aria-label`:
  dos flechas a los lados de una fecha son el idioma universal de
  cualquier calendario, y escribir «Semana anterior» al lado de cada una
  robaría a la fecha el sitio que necesita.
*/
function Flecha({ hacia, icono, que }: { hacia: string; icono: Icono; que: string }) {
  return (
    <Link
      href={`/casa/calendario?lunes=${hacia}`}
      aria-label={que}
      title={que}
      className="tocable flex h-[60px] w-[60px] items-center justify-center rounded-full border border-borde bg-superficie text-tinta"
    >
      <Ico nombre={icono} tam={26} grosor={2.3} />
    </Link>
  )
}
