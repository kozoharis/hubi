import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacioO } from '@/lib/espacio'
import { hoyAqui, type Recordatorio } from '@/lib/tablon'
import { pintaDe } from '../iconos'
import { AMBITO, PastillaAmbito } from '../piezas'
import Reloj from './reloj'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  HUBI CASA · la pantalla de la pared
  ═══════════════════════════════════════════════════════════════

  La pregunta que contesta: **¿qué pasa hoy en casa?**
  Lo que NO es: el HUBI de una persona puesto en horizontal.

  ─────────────────────────────────────────────────────────────
  ⚠️  LO QUE SE APRENDIÓ AQUÍ, Y ES LA LECCIÓN MÁS CARA DEL DÍA

  La primera versión de esta pantalla **no hablaba el idioma de HUBI**.
  Era texto suelto sobre un fondo liso, con emojis por iconos: un panel
  de administrador, exactamente lo que el punto 28 del planteamiento
  descarta. Colgado en una cocina al lado del resto de la aplicación,
  parecía otro producto.

  Y pasó por una razón concreta que conviene dejar escrita: se escribió
  desde cero, «porque una pared es otra cosa». No lo es. Una pared es
  **la misma casa vista desde más lejos**.

      LA PANTALLA NUEVA NO INVENTA UN LENGUAJE. USA EL QUE HAY,
      MÁS GRANDE.

  Así que todo lo que se ve aquí sale de las mismas piezas que las
  cuarenta y cuatro pantallas del móvil:

    · el papel cálido y el blanco de las tarjetas — `bg-fondo`,
      `bg-superficie`, `border-borde`;
    · los iconos DIBUJADOS de `iconos.tsx`, nunca emojis;
    · `pintaDe(titulo)`, que es la misma función que decide el icono y
      el color de una tarea en el tablón y en la agenda — así una cita
      médica es rosa en los tres sitios;
    · `PastillaAmbito`, la misma pieza, solo que a 64 px en vez de 44;
    · la marca de ámbito al borde izquierdo, como en `Fila`.

  Si mañana cambia el color de Salud, cambia aquí solo.

  ─────────────────────────────────────────────────────────────
  Y LAS CINCO DECISIONES DE SIEMPRE

  **1 · Saluda al sitio, no a la persona.** El nombre de la casa y la
  hora grande. Sin avatar y sin «Buenas tardes, Juan Miguel»: la tableta
  no es de nadie. Saludar por su nombre a la cuenta del aparato sería
  además mentira — se llama «La cocina».

  **2 · No hay navegación.** Ni rail ni barra: los dos se apagan solos
  cuando quien mira es un `dispositivo` (`app/rail.tsx`,
  `app/barra.tsx`). Las cinco pestañas son para una mano que viene a
  hacer algo concreto; esto lo lee alguien de paso, a dos metros y sin
  parar de andar.

  **3 · Solo lo que se decidió que saliera.** Y eso no lo decide esta
  pantalla: lo decide la base. Las restrictivas del paso 63 y del 64
  filtran por `visible_en_casa` y por el techo de la clase, así que aquí
  se piden los recordatorios **sin una sola condición añadida** y llega
  únicamente lo que puede llegar.

  Es a propósito: si esta pantalla filtrara por su cuenta, habría dos
  reglas para lo mismo y la de arriba —la de verdad— dejaría de ser la
  única. El día que una se olvide, que se olvide la que no protege.

  **4 · Tamaño de pared.** La hora a 96 px, lo de hoy a 34, lo de
  después a 27. No es para leerlo sentado: es para verlo desde la
  puerta.

  **5 · Cosas de pantalla encendida.** Se refresca sola cada cinco
  minutos, sin ruedas girando, y a partir de las once de la noche baja
  el brillo. Lo lleva `reloj.tsx`, que es lo único de navegador que
  tiene esta pantalla. Y va siempre en claro: el tema se fija en el
  `<html>` desde `layout.tsx`, porque en una tableta colgada de una
  pared no hay nadie que vaya a entrar en Ajustes.
*/

export default async function LaPared() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const casa = await elEspacioO(supabase)

  /*
    ¿DE VERDAD ES UNA PANTALLA QUIEN MIRA?

    Si entra una persona aquí, se la manda al HUBI de siempre. No es
    una comprobación de seguridad —esta pantalla no enseña nada que esa
    persona no pueda ver— sino de sitio: quien tiene manos quiere la
    aplicación, no un cartel.
  */
  const { data: mio } = await supabase
    .from('miembros')
    .select('clase')
    .eq('perfil_id', user.id)
    .eq('hogar_id', casa)
    .maybeSingle()

  if ((mio?.clase as string | null) !== 'dispositivo') redirect('/')

  const hoy = hoyAqui()

  const [laCasa, cosas] = await Promise.all([
    supabase.from('hogares').select('nombre').eq('id', casa).maybeSingle(),
    /*
      Sin filtro de `visible_en_casa` A PROPÓSITO. Lo pone la base:
      `recordatorios_solo_lo_de_la_casa_en_la_pantalla` (paso 63) más
      `recordatorios_nivel_para_leer` (paso 64). Lo que llegue aquí es
      lo que puede llegar, y punto.
    */
    supabase
      .from('recordatorios')
      .select('id, titulo, tipo, fecha, hora, estado')
      .eq('hogar_id', casa)
      .is('eliminado_en', null)
      .eq('estado', 'pendiente')
      .gte('fecha', hoy)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true, nullsFirst: true })
      .limit(40),
  ])

  const todas = (cosas.data ?? []) as Recordatorio[]
  const deHoy = todas.filter((r) => r.fecha === hoy)
  const luego = todas.filter((r) => r.fecha !== hoy).slice(0, 6)

  /* Para saber cuándo hace falta escribir el año. `hoy` es «2026-09-13». */
  const anoDeHoy = Number(hoy.slice(0, 4))

  /*
    ── DOS COLUMNAS CUANDO LA PARED ES ANCHA ──

    Una tableta de cocina en horizontal, o un televisor, son 1280 px o
    más. Con una sola columna todo bajaba pegado al borde izquierdo y
    los otros dos tercios se quedaban vacíos: lo que se ve desde la
    puerta es un cartel pequeño en la esquina de un rectángulo.

    Se parte en dos solo cuando hay las dos cosas. Si no hay nada
    después, «Hoy» se queda ancho — media pantalla vacía a la derecha
    sería el mismo fallo con otra forma.
  */
  const enDos = luego.length > 0

  return (
    <main className="min-h-screen bg-fondo px-10 py-9 xl:px-14" id="la-pared">
      {/* ── Dónde y cuándo ── */}
      <header className="min-w-0">
        <p className="truncate text-[22px] font-extrabold uppercase tracking-[0.2em] text-tenue">
          {laCasa.data?.nombre ?? 'En casa'}
        </p>
        <Reloj />
      </header>

      <div className={enDos ? 'xl:grid xl:grid-cols-2 xl:items-start xl:gap-14' : undefined}>
        {/* ── HOY ── */}
        <section className="mt-12">
          <h2 className="text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">Hoy</h2>

          {deHoy.length === 0 ? (
            /*
              El vacío es la mejor pantalla posible y se diseña con
              cariño: no dice «no hay datos», dice que no hay nada que
              hacer, que es una buena noticia.

              Va en tarjeta como todo lo demás. Un párrafo suelto sobre
              el papel parecía que la pantalla no había terminado de
              cargar.
            */
            <div className="mt-6 rounded-[28px] border border-borde bg-superficie px-8 py-10">
              <p className="text-[32px] font-extrabold leading-snug text-tinta-suave">
                Hoy no hay nada apuntado.
              </p>
            </div>
          ) : (
            <ul className="mt-6 space-y-4">
              {deHoy.map((r) => (
                <EnLaPared key={r.id} r={r} cuando={r.hora ? r.hora.slice(0, 5) : ''} grande />
              ))}
            </ul>
          )}
        </section>

        {/* ── LO QUE VIENE ── */}
        {luego.length > 0 && (
          <section className="mt-12">
            <h2 className="text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">
              Después
            </h2>
            <ul className="mt-6 space-y-3">
              {luego.map((r) => (
                <EnLaPared key={r.id} r={r} cuando={diaCorto(r.fecha, anoDeHoy)} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}

/*
  ═══════════════════════════════════════════════════════════════
  UNA COSA EN LA PARED
  ═══════════════════════════════════════════════════════════════

  La misma tarjeta de `tablon/tarjeta.tsx`, sin nada de lo que se toca:
  papel blanco, marca del ámbito al borde izquierdo, pastilla con el
  icono dibujado, y el cuándo en cifra tabular a la izquierda del texto.

  Dos tamaños y ni uno más —el de hoy y el de después—, por la misma
  razón por la que `Fila` tiene dos alturas: en cuanto haya tres,
  vuelve a haber un dibujo por pantalla en vez de un sistema.
*/
function EnLaPared({
  r,
  cuando,
  grande = false,
}: {
  r: Recordatorio
  /** La hora, o el día. Ya escrito, porque quien lo sabe es de fuera. */
  cuando: string
  grande?: boolean
}) {
  /*
    La MISMA función que pinta esa tarea en el tablón y en la agenda.
    Antes esta pantalla tenía su propia tabla de emojis, así que una
    cita médica era 🩺 aquí y un corazón rosa en el móvil: dos idiomas
    para la misma cosa, y ninguno de los dos era el de HUBI.
  */
  const p = pintaDe(r.titulo)

  return (
    <li
      className={`flex items-center rounded-[28px] border bg-superficie ${
        grande ? 'gap-7 px-7 py-6' : 'gap-5 px-6 py-4'
      }`}
      style={{
        borderColor: 'var(--t-borde)',
        borderLeft: `6px solid ${AMBITO[p.ambito]}`,
      }}
    >
      {/*
        El cuándo va PRIMERO, que es lo que se busca desde la puerta, y
        en columna fija para que los títulos de todas las filas empiecen
        en el mismo sitio. Sin hora, la columna se queda vacía en vez de
        poner una raya: un guion a 40 px es una cosa que hay que leer
        para descubrir que no dice nada.

        275 px en «después», y `whitespace-nowrap`. Con 230 px, «mar 10
        ago 2027» partía y dejaba el «2027» solo en la línea de abajo —
        que es la regla 1 de `reglas-de-pantalla.md` otra vez, y ya van
        dos veces en esta misma pantalla. Se vio renderizándola y
        mirándola, no leyendo el código.
      */}
      <span
        className={`shrink-0 whitespace-nowrap font-extrabold tabular-nums tracking-tight ${
          grande
            ? 'w-[132px] text-[40px] text-tinta xl:w-[150px] xl:text-[48px]'
            : 'w-[275px] text-[26px] text-tinta-suave'
        }`}
      >
        {cuando}
      </span>

      <PastillaAmbito icono={p.icono} ambito={p.ambito} tam={grande ? 64 : 48} />

      <span
        className={`min-w-0 flex-1 font-extrabold leading-tight text-tinta ${
          grande ? 'text-[34px] xl:text-[38px]' : 'text-[27px]'
        }`}
      >
        {r.titulo}
      </span>
    </li>
  )
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * «mar 16 sep», y «mar 10 ago 2027» cuando no es de este año.
 *
 * El año no estaba, y en la pantalla de la cocina salió esto:
 *
 *     lun 14 sep   Presentación del cole de Paula
 *     mar 10 ago   Último día para cancelar: IONOS
 *     jue  9 sep   Se renueva: IONOS
 *
 * Todo correcto por dentro —las dos de IONOS son de 2027 y van
 * ordenadas— y todo equivocado por fuera: puesto debajo del 14 de
 * septiembre, un «10 de agosto» sin año se lee como una fecha pasada, y
 * una pantalla que enseña cosas caducadas deja de creerse.
 *
 * Corto es bueno, pero no a costa de decir algo que no es.
 */
function diaCorto(fecha: string | null, anoDeHoy: number): string {
  if (!fecha) return ''
  const [a, m, d] = fecha.split('-').map(Number)
  /* Mediodía y no medianoche: con la hora a cero, un desfase de zona de
     una hora hacia atrás cambia el día. */
  const f = new Date(a, m - 1, d, 12)
  const base = `${DIAS[f.getDay()]} ${d} ${MESES[m - 1]}`
  return a === anoDeHoy ? base : `${base} ${a}`
}
