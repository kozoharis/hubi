import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { Ico, pintaDe } from '../iconos'
import { AMBITO } from '@/lib/ambitos'
import { BotonPrincipal } from '../piezas'
import { hoyAqui, type Recordatorio } from '@/lib/tablon'
import { citasDeLaFamilia, calendariosVisibles } from '@/lib/agenda-google'

/*
  ═══════════════════════════════════════════════════════════════
  UN DÍA, HORA A HORA
  ═══════════════════════════════════════════════════════════════

  La tercera escala. Semana enseña los siete días resumidos; Mes,
  treinta; y aquí se entra a UNO y se ve dónde cae cada cosa.

  ─────────────────────────────────────────────────────────────
  POR QUÉ HACÍA FALTA

  Con una lista, «el médico a las diez y la farmacia a las diez y
  media» son dos renglones seguidos y parecen dos cosas cualquiera.
  Puestos en su hora se ve de un vistazo que van pegados y que no da
  tiempo — que es la pregunta que se hace uno al mirar el día.

  ─────────────────────────────────────────────────────────────
  LO QUE NO TIENE HORA VA ARRIBA, NO EN UN HUECO

  La mayoría de las cosas de una casa no tienen hora: «llevar los
  papeles a Silvia», «sacar la basura». Inventarles una las pondría en
  un sitio del día que nadie ha decidido, y entonces la línea de las
  horas deja de decir la verdad.

  Van en una franja arriba, como el «todo el día» de cualquier agenda.

  ─────────────────────────────────────────────────────────────
  Y LA REGLA DE ALTO A BAJO

  Una hora son 60 px. No es un número bonito: es lo que hace que media
  hora —30 px— siga siendo una banda que se ve, y que quepan las horas
  de un día de verdad sin tener que deslizar tres pantallas.
*/

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]

/** Píxeles por hora. Media hora tiene que seguir viéndose. */
const ALTO = 60
/** Lo que dura una cosa cuando nadie ha dicho cuánto dura. */
const DURA = 50

type Bloque = {
  clave: string
  titulo: string
  minuto: number
  color: string
  pie: string | null
  href: string | null
  hecha: boolean
  /* En qué carril va, y cuántos hay: es lo que permite poner dos
     cosas de la misma hora una al lado de la otra en vez de una
     encima de la otra. */
  carril: number
  carriles: number
}

export default async function Dia({ dia, de }: { dia?: string; de?: string }) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const hoyISO = hoyAqui()
  const fecha = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : hoyISO
  const esHoy = fecha === hoyISO

  const { data: perfiles } = await supabase.from('perfiles').select('id, nombre')
  const nombres = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p.nombre as string]))

  const { data } = await supabase
    .from('recordatorios')
    .select(
      'id, titulo, tipo, asignado_a, creado_por, fecha, hora, estado, nota, documento_origen_id'
    )
    .eq('fecha', fecha)
    .order('hora', { ascending: true, nullsFirst: true })

  const delDia = (data ?? []) as Recordatorio[]

  const calendarios = await calendariosVisibles(user.id)
  const dueno = de && calendarios.some((c) => c.id === de) ? de : null
  const citas = await citasDeLaFamilia(user.id, fecha, fecha, dueno)

  /* Todo junto: lo de HUBI y lo de Google son «cosas que tengo que
     recordar», y en un día se miran igual. */
  const conHora: Bloque[] = []
  const sinHora: Bloque[] = []

  for (const r of delDia) {
    const p = pintaDe(r.titulo)
    const quienEs = r.asignado_a ? (nombres[r.asignado_a] ?? '').split(' ')[0] : null

    const b: Bloque = {
      clave: `t-${r.id}`,
      titulo: r.titulo,
      minuto: enMinutos(r.hora),
      color: AMBITO[p.ambito],
      pie: quienEs,
      href: `/tablon/${r.id}`,
      hecha: r.estado === 'hecho',
      carril: 0,
      carriles: 1,
    }
    ;(r.hora ? conHora : sinHora).push(b)
  }

  for (const c of citas) {
    const b: Bloque = {
      clave: `g-${c.uid}`,
      titulo: c.titulo,
      minuto: enMinutos(c.hora),
      color: c.color,
      pie: [calendarios.length > 1 ? c.de.split(' ')[0] : null, c.lugar]
        .filter(Boolean)
        .join(' · ') || null,
      /* Las citas de Google no se pueden tocar: viven en su calendario
         y HUBI solo las enseña. Un enlace que no lleva a nada es peor
         que ningún enlace. */
      href: null,
      hecha: false,
      carril: 0,
      carriles: 1,
    }
    ;(c.hora ? conHora : sinHora).push(b)
  }

  conHora.sort((a, b) => a.minuto - b.minuto)
  repartirCarriles(conHora)

  /*
    ── DE QUÉ HORA A QUÉ HORA ──

    De ocho a diez de la noche por defecto: es la franja en la que
    pasa la vida de una casa. Y se estira si hay algo fuera — una cita
    a las siete de la mañana no puede quedarse sin sitio donde
    dibujarse.
  */
  const horas = conHora.map((b) => Math.floor(b.minuto / 60))
  const inicio = Math.min(8, ...horas)
  const fin = Math.max(22, ...horas.map((h) => h + 1))

  const alto = (fin - inicio) * ALTO

  const ahora = new Date()
  const minutoAhora = ahora.getHours() * 60 + ahora.getMinutes()
  const enPantalla = esHoy && minutoAhora >= inicio * 60 && minutoAhora <= fin * 60

  return (
    <>
      {/* ── De qué día estamos hablando ── */}
      <div className="mt-1 flex items-center gap-1">
        <Link
          href={enlace(sumarDias(fecha, -1), dueno)}
          aria-label="Día anterior"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-tinta"
        >
          <Ico nombre="atras" tam={23} grosor={2.4} />
        </Link>

        <p className="flex-1 text-center text-[17px] font-extrabold leading-tight tracking-tight">
          {esHoy ? 'Hoy' : DIAS[diaDeLaSemana(fecha)]}
          <span className="mt-0.5 block text-[14px] font-bold text-tenue">
            {enPalabras(fecha)}
          </span>
        </p>

        <Link
          href={enlace(sumarDias(fecha, 1), dueno)}
          aria-label="Día siguiente"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-tinta"
        >
          <Ico nombre="flecha" tam={23} grosor={2.4} />
        </Link>
      </div>

      {/* ── Lo que no tiene hora ── */}
      {sinHora.length > 0 && (
        <section className="mt-4">
          <h2 className="t-seccion">A lo largo del día</h2>
          <ul className="mt-2 space-y-1.5">
            {sinHora.map((b) => (
              <li key={b.clave}>
                <Enlace href={b.href}>
                  <span
                    className="flex items-center gap-2.5 rounded-[14px] border px-3 py-2.5"
                    style={{
                      borderColor: `color-mix(in srgb, ${b.color} 38%, transparent)`,
                      background: `color-mix(in srgb, ${b.color} 9%, var(--t-superficie))`,
                    }}
                  >
                    <span
                      className="h-[9px] w-[9px] shrink-0 rounded-full"
                      style={{ background: b.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[16px] font-bold ${
                          b.hecha ? 'text-tenue line-through' : ''
                        }`}
                      >
                        {b.titulo}
                      </span>
                      {b.pie && (
                        <span className="block truncate text-[13px] font-bold text-tenue">
                          {b.pie}
                        </span>
                      )}
                    </span>
                  </span>
                </Enlace>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ══ LAS HORAS ══════════════════════════════════════ */}
      <section className="mt-5">
        <h2 className="t-seccion">Las horas</h2>

        <div className="relative mt-2.5" style={{ height: alto }}>
          {/* Las rayas de cada hora, con su número a la izquierda. */}
          {Array.from({ length: fin - inicio }, (_, i) => {
            const h = inicio + i
            return (
              <div
                key={h}
                className="absolute left-0 right-0 flex items-start gap-2"
                style={{ top: i * ALTO, height: ALTO }}
              >
                <span className="w-[42px] shrink-0 -translate-y-[7px] text-right text-[12.5px] font-bold tabular-nums text-tenue">
                  {String(h).padStart(2, '0')}:00
                </span>
                <span className="mt-[1px] h-px flex-1 bg-borde" />
              </div>
            )
          })}

          {/*
            LA LÍNEA DE AHORA.

            Es lo primero que busca el ojo al abrir el día de hoy: dice
            qué queda por delante sin tener que mirar el reloj. Solo
            sale si es hoy y si la hora cae dentro de lo dibujado.
          */}
          {enPantalla && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-10 flex items-center gap-1"
              style={{ top: minutoAhora - inicio * 60 }}
              aria-hidden
            >
              <span className="w-[42px] shrink-0" />
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-coral" />
              <span className="h-[2px] flex-1 rounded-full bg-coral" />
            </div>
          )}

          {/* Y encima, cada cosa en su hora. */}
          <div className="absolute inset-y-0 left-[50px] right-0">
            {conHora.map((b) => {
              const ancho = 100 / b.carriles
              return (
                <div
                  key={b.clave}
                  className="absolute"
                  style={{
                    top: b.minuto - inicio * 60,
                    height: DURA,
                    left: `${b.carril * ancho}%`,
                    width: `calc(${ancho}% - 4px)`,
                  }}
                >
                  <Enlace href={b.href}>
                    <span
                      className="flex h-full flex-col justify-center overflow-hidden rounded-[12px] border px-2.5 py-1"
                      style={{
                        borderColor: `color-mix(in srgb, ${b.color} 45%, transparent)`,
                        background: `color-mix(in srgb, ${b.color} 15%, var(--t-superficie))`,
                        borderLeft: `3px solid ${b.color}`,
                      }}
                    >
                      <span
                        className={`truncate text-[14.5px] font-extrabold leading-tight tracking-tight ${
                          b.hecha ? 'text-tenue line-through' : ''
                        }`}
                      >
                        {b.titulo}
                      </span>
                      <span
                        className="truncate text-[12px] font-bold"
                        style={{ color: b.color }}
                      >
                        {enHora(b.minuto)}
                        {b.pie ? ` · ${b.pie}` : ''}
                      </span>
                    </span>
                  </Enlace>
                </div>
              )
            })}
          </div>
        </div>

        {conHora.length === 0 && sinHora.length === 0 && (
          <p className="mt-3 rounded-[20px] bg-superficie px-6 py-6 text-center text-[16.5px] font-medium text-tinta-suave">
            {esHoy ? 'Hoy no tienes nada.' : 'Ese día no hay nada.'}
          </p>
        )}
      </section>

      <div className="mt-5">
        <BotonPrincipal href="/tablon/nuevo" icono="mas">
          Apuntar algo
        </BotonPrincipal>
      </div>
    </>
  )
}

/* Un enlace solo si lleva a algún sitio. Las citas de Google no se
   pueden abrir: viven en su calendario y HUBI solo las enseña. */
function Enlace({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <span className="block">{children}</span>
  return (
    <Link href={href} className="block">
      {children}
    </Link>
  )
}

/*
  ─────────────────────────────────────────────────────────────
  DOS COSAS A LA MISMA HORA VAN UNA AL LADO DE LA OTRA

  Sin esto, el médico de las diez taparía la farmacia de las diez y
  cuarto y la pantalla estaría escondiendo algo — que es lo único que
  una agenda no puede hacer.

  Se reparte por carriles: cada bloque va al primero que esté libre a
  su hora, y todos los que se solapan acaban con el mismo número de
  carriles para que queden del mismo ancho.
*/
function repartirCarriles(bloques: Bloque[]) {
  let grupo: Bloque[] = []
  let hasta = -1

  const cerrar = () => {
    for (const b of grupo) b.carriles = Math.max(...grupo.map((x) => x.carril)) + 1
    grupo = []
    hasta = -1
  }

  for (const b of bloques) {
    if (b.minuto >= hasta) cerrar()

    const ocupados = new Set(grupo.filter((x) => x.minuto + DURA > b.minuto).map((x) => x.carril))
    let c = 0
    while (ocupados.has(c)) c++
    b.carril = c

    grupo.push(b)
    hasta = Math.max(hasta, b.minuto + DURA)
  }
  if (grupo.length > 0) cerrar()
}

function enMinutos(hora: string | null): number {
  if (!hora) return 0
  const [h, m] = hora.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function enHora(minuto: number): string {
  return `${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`
}

function diaDeLaSemana(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).getDay()
}

/** «2026-09-09» → «9 de septiembre de 2026». */
function enPalabras(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${a}`
}

function sumarDias(iso: string, cuantos: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(a, m - 1, d + cuantos)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(
    f.getDate()
  ).padStart(2, '0')}`
}

function enlace(fecha: string, de: string | null): string {
  return `/agenda?vista=dia&dia=${fecha}${de ? `&de=${de}` : ''}`
}
