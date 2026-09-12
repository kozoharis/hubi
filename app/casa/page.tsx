import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacioO } from '@/lib/espacio'
import { hoyAqui, iconoDe, type Recordatorio } from '@/lib/tablon'
import Reloj from './reloj'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  HUBI CASA · la pantalla de la pared
  ═══════════════════════════════════════════════════════════════

  La pregunta que contesta: **¿qué pasa hoy en casa?**
  Lo que NO es: el HUBI de una persona puesto en horizontal.

  ─────────────────────────────────────────────────────────────
  CINCO DECISIONES, Y NINGUNA ES DE ADORNO

  **1 · Saluda al sitio, no a la persona.** «SOLETES · viernes 12 de
  septiembre», y la hora grande. Sin avatar y sin «Buenas tardes,
  Juan Miguel»: la tableta no es de nadie. Saludar por su nombre a la
  cuenta del aparato sería además mentira — se llama «La cocina».

  **2 · No hay navegación.** Ni rail ni barra: los dos se apagan solos
  cuando quien mira es un `dispositivo` (`app/rail.tsx`,
  `app/barra.tsx`). Las cinco pestañas son para una mano que viene a
  hacer algo concreto; esto lo lee alguien de paso, a dos metros y sin
  parar de andar.

  **3 · Solo lo que se decidió que saliera.** Y eso no lo decide esta
  pantalla: lo decide la base. Las restrictivas del paso 63 y del 64 ya
  filtran por `visible_en_casa` y por el techo de la clase, así que
  aquí se piden los recordatorios del día **sin una sola condición
  añadida** y llega únicamente lo que puede llegar.

  Es a propósito: si esta pantalla filtrara por su cuenta, habría dos
  reglas para lo mismo y la de arriba —la de verdad— dejaría de ser la
  única. El día que una se olvide, que se olvide la que no protege.

  **4 · Tamaño de pared.** El cuerpo va a 26–34 px. No es para leerlo
  sentado: es para verlo desde la puerta.

  **5 · Cosas de pantalla encendida.** Se refresca sola cada cinco
  minutos, sin ruedas girando, y a partir de las once de la noche baja
  el brillo. Lo lleva `reloj.tsx`, que es lo único de navegador que
  tiene esta pantalla.

  ─────────────────────────────────────────────────────────────
  Y LO QUE NO LLEVA, DICHO

  No lleva la lista de la compra ni el corcho todavía. El aparato SÍ
  tiene nivel para los dos (`compra` y `dia` son `anadir` para una
  pantalla), así que caben — pero una pantalla de pared que se toca es
  otra conversación, y hoy lo que hace falta es que se VEA. Primero
  esto, y cuando esté colgada de verdad se decide lo demás mirándola.
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

  return (
    <main className="min-h-screen px-10 py-8" id="la-pared">
      {/* ── Dónde y cuándo ── */}
      <header className="flex items-end justify-between gap-8">
        <div className="min-w-0">
          <p className="truncate text-[26px] font-extrabold uppercase tracking-[0.18em] text-tenue">
            {laCasa.data?.nombre ?? 'En casa'}
          </p>
          <Reloj />
        </div>
      </header>

      {/* ── HOY ── */}
      <section className="mt-10">
        <h2 className="text-[22px] font-extrabold uppercase tracking-[0.18em] text-tenue">Hoy</h2>

        {deHoy.length === 0 ? (
          /* El vacío es la mejor pantalla posible, y se diseña con
             cariño: no dice «no hay datos», dice que no hay nada que
             hacer, que es una buena noticia. */
          <p className="mt-5 text-[32px] font-extrabold leading-snug text-tinta-suave">
            Hoy no hay nada apuntado.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {deHoy.map((r) => (
              <li key={r.id} className="flex items-baseline gap-5">
                <span className="w-[130px] shrink-0 text-[30px] font-extrabold tabular-nums text-tinta-suave">
                  {r.hora ? r.hora.slice(0, 5) : '—'}
                </span>
                <span className="text-[34px] leading-none" aria-hidden>
                  {iconoDe(r.tipo)}
                </span>
                <span className="min-w-0 text-[34px] font-extrabold leading-tight text-tinta">
                  {r.titulo}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── LO QUE VIENE ── */}
      {luego.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[22px] font-extrabold uppercase tracking-[0.18em] text-tenue">
            Después
          </h2>
          <ul className="mt-5 space-y-3">
            {luego.map((r) => (
              <li key={r.id} className="flex items-baseline gap-5">
                <span className="w-[130px] shrink-0 text-[24px] font-extrabold tabular-nums text-tenue">
                  {diaCorto(r.fecha)}
                </span>
                <span className="text-[26px] leading-none" aria-hidden>
                  {iconoDe(r.tipo)}
                </span>
                <span className="min-w-0 text-[26px] font-extrabold leading-tight text-tinta-suave">
                  {r.titulo}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** «mar 16 sep». Corto porque va en una columna estrecha y a dos metros. */
function diaCorto(fecha: string | null): string {
  if (!fecha) return ''
  const [a, m, d] = fecha.split('-').map(Number)
  /* Mediodía y no medianoche: con la hora a cero, un desfase de zona de
     una hora hacia atrás cambia el día. */
  const f = new Date(a, m - 1, d, 12)
  return `${DIAS[f.getDay()]} ${d} ${MESES[m - 1]}`
}
