import { hoyAqui } from '@/lib/tablon'
import { elLunesDe } from '@/lib/menus'
import { laPared, loApuntado, loDestacado, losMenus } from '@/lib/pared'
import { loDeHoy } from '@/lib/rutinas'
import { Ico } from '../iconos'
import { pintaDe } from '../iconos'
import { AMBITO, PastillaAmbito } from '../piezas'
import Cosa from './cosa'
import Mes from './calendario/mes'
import Fotos from './fotos'
import Rutinas from './rutinas'
import Tiempo from './tiempo'
import { Nada, Rotulo } from './rotulo'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  HOY · la pantalla en la que se queda la pared
  ═══════════════════════════════════════════════════════════════

  Es la que se ve el 95 % del tiempo: a las demás se va a mirar algo
  concreto y la pared vuelve sola aquí a los tres minutos
  (`vuelve-a-hoy.tsx`).

  Así que ésta no puede ser una lista más. Es el resumen de la casa, y
  contesta de un vistazo —desde la puerta— las cinco preguntas que se
  hacen todos los días:

      ¿Qué hay hoy?        → lo apuntado, con su hora
      ¿Y lo importante?    → lo que alguien dejó a la vista
      ¿Qué se come?        → la comida y la cena de hoy
      ¿Falta algo?         → la lista de la compra
      ¿Y lo que viene?     → los próximos días, en pequeño

  ─────────────────────────────────────────────────────────────
  DOS COLUMNAS, Y NO POR SIMETRÍA

  A la izquierda lo de HOY y lo destacado: son las dos cosas que llevan
  frases largas y que hay que leer enteras. A la derecha lo que se
  contesta con tres palabras — qué se come, qué falta, qué viene.

  El reparto es 1,4 a 1 y no la mitad y la mitad: una lista de tareas
  con títulos de diez palabras necesita sitio; «Lentejas con chorizo»,
  no.

  ─────────────────────────────────────────────────────────────
  LO QUE SE PIDE, Y LO QUE NO SE FILTRA

  Todo se pide sin una sola condición de visibilidad, a propósito: la
  que filtra es la base. Está explicado en `lib/pared.ts`.
*/

export default async function Hoy() {
  const { supabase, casa } = await laPared()
  const hoy = hoyAqui()

  /* Hasta dentro de dos semanas: de ahí sale «después». */
  const dentroDeDos = sumarDias(hoy, 14)

  /* Y el mes entero, solo para los puntitos del calendario pequeño. */
  const [ano, mes] = hoy.split('-').map(Number)
  const delMes = `${ano}-${String(mes).padStart(2, '0')}`
  const ultimo = String(new Date(ano, mes, 0).getDate()).padStart(2, '0')

  const [cosas, menus, destacado, laCompra, delMesEntero, rutinas, gente] = await Promise.all([
    loApuntado(supabase, casa, hoy, dentroDeDos),
    losMenus(supabase, casa, hoy, hoy),
    loDestacado(supabase, casa),
    /*
      La compra. Envuelta, como todo lo que puede no estar: una casa que
      tenga la compra apagada (`hogares.usa_compra`) no debe romper la
      pantalla de la cocina, que es donde más falta hace que no se rompa
      nada.
    */
    (async () => {
      try {
        const { data, error } = await supabase
          .from('compra')
          .select('id, que')
          .eq('hogar_id', casa)
          .eq('comprado', false)
          .is('archivado_en', null)
          .order('creado_en', { ascending: true })
          .limit(30)
        if (error) return []
        return (data ?? []) as { id: string; que: string }[]
      } catch {
        return []
      }
    })(),
    loApuntado(supabase, casa, `${delMes}-01`, `${delMes}-${ultimo}`),
    /* Lo que toca hoy. `loDeHoy` ya envuelve sus fallos y devuelve
       vacío si las tablas no están. */
    loDeHoy(supabase, casa),
    /* Los nombres, para poder decir DE QUIÉN es cada rutina. En una
       casa de dos da igual; en una con niños, «17:00 · Inglés» sin
       decir de quién no sirve de nada. */
    supabase.from('perfiles').select('id, nombre'),
  ])

  const nombreDe = new Map(
    ((gente.data ?? []) as { id: string; nombre: string }[]).map((p) => [
      p.id,
      p.nombre.split(' ')[0],
    ])
  )

  const conAlgo = new Set(delMesEntero.map((c) => c.fecha).filter(Boolean) as string[])

  const pendientes = cosas.filter((c) => c.estado !== 'hecho')
  const deHoy = pendientes.filter((c) => c.fecha === hoy)
  const luego = pendientes.filter((c) => c.fecha !== hoy).slice(0, 4)

  const comida = menus.find((m) => m.momento === 'comida')?.que ?? null
  const cena = menus.find((m) => m.momento === 'cena')?.que ?? null

  return (
    <div className="mt-12 xl:grid xl:grid-cols-[1.4fr_1fr] xl:items-start xl:gap-14">
      {/* ── IZQUIERDA · lo que hay que leer ── */}
      <div>
        <section>
          <Rotulo>Hoy</Rotulo>

          {deHoy.length === 0 ? (
            <Nada>Hoy no hay nada apuntado.</Nada>
          ) : (
            <ul className="mt-6 space-y-4">
              {deHoy.map((c) => (
                <Cosa
                  key={c.id}
                  titulo={c.titulo}
                  cuando={c.hora ? c.hora.slice(0, 5) : ''}
                  talla="hoy"
                />
              ))}
            </ul>
          )}
        </section>

        {/*
          ── LO DE CADA DÍA ──

          Debajo de lo de hoy y encima de lo destacado. Es lo que se
          mira al pasar por la cocina —regar, la basura, las pastillas de
          la mañana— y lo único de esta pantalla que además se TACHA.

          Y existía en HUBI desde hace tiempo sin salir por ninguna
          parte de la pared, que es donde más falta hacía.
        */}
        {rutinas.length > 0 && (
          <section className="mt-11">
            <Rutinas
              rutinas={rutinas.map((r) => ({
                id: r.id,
                que: r.que,
                hora: r.hora,
                hecha: r.hecha,
                dequien: r.para ? (nombreDe.get(r.para) ?? null) : null,
              }))}
            />
          </section>
        )}

        {/*
          Lo destacado sale también aquí, y no solo en el Calendario. Es
          justamente lo que no se puede quedar a dos toques de
          distancia: si algo merece estar «a la vista», tiene que estar a
          la vista en la pantalla que se ve el 95 % del tiempo.
        */}
        {destacado.length > 0 && (
          <section className="mt-11">
            <Rotulo>A la vista</Rotulo>
            <ul className="mt-6 space-y-3">
              {destacado.slice(0, 4).map((c) => {
                const p = pintaDe(c.titulo)
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-5 rounded-[28px] border bg-superficie px-6 py-4"
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
                    <span className="shrink-0 text-apagado">
                      <Ico nombre="chincheta" tam={22} grosor={2.1} />
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/*
          ── Y LAS FOTOS, ABAJO DEL TODO Y A LA IZQUIERDA ──

          Estaban a la derecha y Haris lo vio enseguida: «muévelo para la
          izquierda, que hay más espacio». Es verdad y es estructural, no
          casualidad de un día tranquilo — la columna izquierda es la
          ancha, y una foto es lo único de esta pantalla que gana de
          verdad con el tamaño. Una lista de la compra no.

          Abajo del todo a propósito. Lo de arriba es lo que hay que
          SABER —qué hay hoy, qué está pendiente— y se lee en segundos
          desde la puerta. Las fotos son lo que hace que uno se quede
          mirando, y eso va después de lo útil, nunca delante.

          El ancho tope de 760 px no es por estética: sin él, en la
          columna ancha una foto en 16/10 mide 630 px de alto y empuja
          todo lo demás fuera de la pantalla. Una pared no se desliza.

          `puedeSubir`: aquí sí, porque quien mira esto ES la pantalla de
          la cocina, y es la única cosa que puede escribir en todo HUBI
          aparte de la compra.
        */}
        <section className="mt-11">
          <Rotulo>En casa</Rotulo>
          <div className="mt-6 max-w-[760px]">
            <Fotos puedeSubir />
          </div>
        </section>
      </div>

      {/* ── DERECHA · lo que se contesta con tres palabras ── */}
      <div className="mt-12 xl:mt-0">
        {/*
          ── EL TIEMPO, LO PRIMERO DE LA DERECHA ──

          Es lo que más se mira de esta columna y lo primero que mira
          cualquiera por la mañana en una cocina. En una casa con finca
          no es curiosidad: es si hay que regar, si se puede tender y si
          conviene adelantar la recogida.

          Si la previsión no llega, este bloque no se pinta — ni cartel
          de error ni hueco gris. Lo decide `tiempo.tsx`.
        */}
        <div className="mb-11">
          <Tiempo />
        </div>

        <section>
          <Rotulo>Qué se come</Rotulo>

          {!comida && !cena ? (
            <Nada>Hoy no hay menú puesto.</Nada>
          ) : (
            <div className="mt-6 space-y-3">
              <Plato momento="Comida" que={comida} />
              <Plato momento="Cena" que={cena} />
            </div>
          )}
        </section>

        {/*
          ── LA COMPRA ──

          Aquí sí tiene sentido, y es la única de las cinco cosas de esta
          pantalla que un aparato PUEDE tocar: su nivel en `compra` es
          `anadir`, a propósito, porque una tableta colgada en la cocina
          existe sobre todo para apuntar que se ha acabado la leche.

          Hoy solo se enseña. Apuntar desde la pared es lo siguiente que
          tiene sentido añadir, y necesita un teclado de pantalla bien
          resuelto — que es otra conversación.
        */}
        {laCompra.length > 0 && (
          <section className="mt-11">
            <div className="flex items-baseline gap-4">
              <Rotulo>Falta en casa</Rotulo>
              <p className="text-[19px] font-extrabold text-tinta-suave">
                {laCompra.length === 1 ? '1 cosa' : `${laCompra.length} cosas`}
              </p>
            </div>

            <div
              className="mt-6 rounded-[28px] border bg-superficie px-6 py-5"
              style={{ borderColor: 'var(--t-borde)', borderLeft: `6px solid ${AMBITO.oliva}` }}
            >
              {/* En dos columnas: una lista de la compra son palabras de
                  dos sílabas, y en una columna deja media tarjeta vacía. */}
              <ul className="columns-2 gap-6 [&>*]:mb-1.5 [&>*]:break-inside-avoid">
                {laCompra.slice(0, 12).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start gap-2.5 text-[20px] font-extrabold leading-snug text-tinta"
                  >
                    <span
                      className="mt-[9px] block h-[7px] w-[7px] shrink-0 rounded-full"
                      style={{ background: AMBITO.oliva }}
                    />
                    <span className="min-w-0">{c.que}</span>
                  </li>
                ))}
              </ul>

              {laCompra.length > 12 && (
                <p className="mt-3 text-[17px] font-bold text-tenue">
                  y {laCompra.length - 12} más
                </p>
              )}
            </div>
          </section>
        )}

        {luego.length > 0 && (
          <section className="mt-11">
            <Rotulo>Después</Rotulo>
            <ul className="mt-6 space-y-3">
              {luego.map((c) => (
                <Cosa
                  key={c.id}
                  titulo={c.titulo}
                  cuando={diaCorto(c.fecha, Number(hoy.slice(0, 4)))}
                  talla="columna"
                />
              ))}
            </ul>
          </section>
        )}

        {/*
          ── EL MES ──

          Aquí abajo a la derecha, la misma rejilla que en el Calendario
          y la misma pieza: hoy en círculo, un punto en los días que
          tienen algo, y la semana en curso teñida.

          No es repetir el Calendario: es la pregunta que ninguna de las
          listas de esta pantalla contesta — «¿en qué parte del mes
          estamos?» y «el día 4, ¿qué día cae?». Sin un mes delante eso
          se cuenta con los dedos.
        */}
        <section className="mt-11">
          <Rotulo>El mes</Rotulo>
          <div className="mt-6">
            <Mes hoy={hoy} conAlgo={conAlgo} lunes={elLunesDe(hoy)} />
          </div>
        </section>
      </div>
    </div>
  )
}

/*
  Un plato. Sin plato puesto NO se esconde la fila: se dice que está
  vacía.

  Es lo contrario de lo que hace `Dato` en la aplicación —allí un valor
  vacío no pinta la fila—, y la diferencia es real. En una ficha, una
  etiqueta con un hueco al lado parece un dato que falta. Aquí, que la
  cena esté sin poner es justamente lo que alguien necesita ver al pasar
  por la cocina a las siete.
*/
function Plato({ momento, que }: { momento: string; que: string | null }) {
  return (
    <div
      className="flex items-center gap-4 rounded-[24px] border bg-superficie px-5 py-4"
      style={{
        borderColor: 'var(--t-borde)',
        borderLeft: `6px solid ${AMBITO.arena}`,
      }}
    >
      <span
        className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[16px]"
        style={{
          background: `color-mix(in srgb, ${AMBITO.arena} 16%, var(--t-superficie))`,
          color: AMBITO.arena,
        }}
      >
        <Ico nombre="taza" tam={24} grosor={2.1} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-extrabold uppercase tracking-wider text-tenue">
          {momento}
        </span>
        <span
          className={`block text-[22px] font-extrabold leading-tight ${
            que ? 'text-tinta' : 'text-apagado'
          }`}
        >
          {que ?? 'Sin poner'}
        </span>
      </span>
    </div>
  )
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** «2026-09-13» + 14 → «2026-09-27». */
function sumarDias(iso: string, cuantos: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + cuantos)
  return d.toISOString().slice(0, 10)
}

/** «4 de octubre» · «4 de octubre · 12:00». Con el año si no es éste. */
function enPalabras(iso: string, hora: string | null): string {
  const [a, m, d] = iso.split('-').map(Number)
  const ano = new Date().getFullYear()
  const cuando = `${d} de ${MESES_LARGOS[m - 1]}${a === ano ? '' : ` de ${a}`}`
  return hora ? `${cuando} · ${hora.slice(0, 5)}` : cuando
}

/**
 * «mar 16 sep», y «mar 10 ago 2027» cuando no es de este año.
 *
 * El año no estaba, y en la pared salió esto:
 *
 *     lun 14 sep   Presentación del cole de Paula
 *     mar 10 ago   Último día para cancelar: IONOS
 *
 * Todo correcto por dentro —la de IONOS es de 2027 y va ordenada— y
 * todo equivocado por fuera: puesto debajo del 14 de septiembre, un «10
 * de agosto» sin año se lee como una fecha pasada, y una pantalla que
 * parece enseñar cosas caducadas deja de creerse.
 *
 * Corto es bueno, pero no a costa de decir algo que no es.
 */
export function diaCorto(fecha: string | null, anoDeHoy: number): string {
  if (!fecha) return ''
  const [a, m, d] = fecha.split('-').map(Number)
  /* Mediodía y no medianoche: con la hora a cero, un desfase de zona de
     una hora hacia atrás cambia el día. */
  const f = new Date(a, m - 1, d, 12)
  const base = `${DIAS[f.getDay()]} ${d} ${MESES[m - 1]}`
  return a === anoDeHoy ? base : `${base} ${a}`
}
