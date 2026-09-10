import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { atrasado, hoyAqui, type Recordatorio } from '@/lib/tablon'
import { Ico, pintaDe } from '../iconos'
import { AMBITO, ambitoDeColor } from '@/lib/ambitos'
import { citasDeLaFamilia, calendariosVisibles } from '@/lib/agenda-google'
import Refrescar from './refrescar'
import { BotonPrincipal, Pildora } from '../piezas'
import { elEspacioO } from '@/lib/espacio'

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]

// La semana empieza en lunes, como en España.
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/* El mes de la Agenda. Antes era la pantalla "Calendario". */
export default async function Mes({
  mes,
  dia,
  de,
}: {
  mes?: string
  dia?: string
  de?: string
}) {
  const p = { mes, dia }

  /* Hoy donde viven ellos, no donde está el servidor: el servidor va
     en hora de Londres y cambiaba de día antes de tiempo. El porqué
     está en `lib/tablon.ts`. */
  const hoyISO = hoyAqui()
  const [ha, hm, hd] = hoyISO.split('-').map(Number)
  const hoy = new Date(ha, hm - 1, hd)

  const [anio, mesNum] = /^\d{4}-\d{2}$/.test(p.mes ?? '')
    ? p.mes!.split('-').map(Number)
    : [hoy.getFullYear(), hoy.getMonth() + 1]

  const primero = new Date(anio, mesNum - 1, 1)
  const ultimo = new Date(anio, mesNum, 0)

  const desde = iso(primero)
  const hasta = iso(ultimo)

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const { data: perfiles } = await supabase.from('perfiles').select('id, nombre')
  const nombres = Object.fromEntries((perfiles ?? []).map((x) => [x.id, x.nombre]))

  const { data } = await supabase
    .from('recordatorios')
    .select('id, titulo, tipo, asignado_a, creado_por, fecha, hora, estado, nota, documento_origen_id')
    .eq('hogar_id', await elEspacioO(supabase))
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('hora', { ascending: true, nullsFirst: true })

  const delMes = (data ?? []) as Recordatorio[]

  const porDia = new Map<string, Recordatorio[]>()
  for (const r of delMes) {
    if (!r.fecha) continue
    porDia.set(r.fecha, [...(porDia.get(r.fecha) ?? []), r])
  }

  const diaElegido =
    p.dia && diaValido(p.dia, anio, mesNum)
      ? p.dia
      : hoy.getFullYear() === anio && hoy.getMonth() + 1 === mesNum
        ? hoyISO
        : desde

  const huecos = (primero.getDay() + 6) % 7
  const celdas: (string | null)[] = [
    ...Array(huecos).fill(null),
    ...Array.from({ length: ultimo.getDate() }, (_, i) => iso(new Date(anio, mesNum - 1, i + 1))),
  ]

  const anterior = mesNum === 1 ? `${anio - 1}-12` : `${anio}-${String(mesNum - 1).padStart(2, '0')}`
  const siguiente = mesNum === 12 ? `${anio + 1}-01` : `${anio}-${String(mesNum + 1).padStart(2, '0')}`


  /*
    Y las citas de su Google, si las ha volcado.

    Van en su propio grupo, debajo, y NO SE PUEDEN TOCAR: son suyas,
    viven en su calendario y HUBI solo las enseña. Mezclarlas con las
    de HUBI y dejar marcarlas "hecho" sería prometer algo que no
    podemos cumplir — el cambio no llegaría a Google.

    Si Google no responde, esto viene vacío y aquí no se entera nadie:
    la Agenda sigue enseñando lo de HUBI. */
  const calendarios = await calendariosVisibles(user.id)
  const dueno = de && calendarios.some((c) => c.id === de) ? de : null

  /* Del mes entero, para poder pintar el punto en la cuadrícula; y del
     día elegido, para la lista de abajo. Es UNA sola petición: partir
     esto en dos sería pedirle a Google el mismo archivo dos veces. */
  const googleDelMes = await citasDeLaFamilia(user.id, desde, hasta, dueno)

  const conGoogle = new Map<string, string[]>()
  for (const c of googleDelMes) {
    const ya = conGoogle.get(c.fecha) ?? []
    if (!ya.includes(c.color)) conGoogle.set(c.fecha, [...ya, c.color])
  }

  const filtro = dueno ? `&de=${dueno}` : ''

  /*
    ── EL MES ENTERO, DÍA A DÍA ──

    Solo los días que tienen algo: treinta renglones diciendo «nada»
    ocupan cinco pantallas para no contar nada. Los vacíos siguen en la
    cuadrícula de arriba, que es donde se ve el hueco.
  */
  const porDiaGoogle = new Map<string, typeof googleDelMes>()
  for (const c of googleDelMes) {
    porDiaGoogle.set(c.fecha, [...(porDiaGoogle.get(c.fecha) ?? []), c])
  }

  const conAlgo = Array.from(new Set([...porDia.keys(), ...porDiaGoogle.keys()]))
    .sort()
    .map((f) => ({
      fecha: f,
      lista: porDia.get(f) ?? [],
      google: porDiaGoogle.get(f) ?? [],
    }))

  const cuantasCosas = conAlgo.reduce((n, d) => n + d.lista.length + d.google.length, 0)

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
          <p className="text-[19px] font-extrabold tracking-tight">
            {MESES[mesNum - 1].charAt(0).toUpperCase() + MESES[mesNum - 1].slice(1)} {anio}
          </p>
          <div className="flex items-center gap-1">
            <Link
              href={`/agenda?vista=mes&mes=${anterior}${filtro}`}
              aria-label="Mes anterior"
              className="flex h-11 w-11 items-center justify-center text-tenue"
            >
              <Ico nombre="atras" tam={22} grosor={2.4} />
            </Link>
            <Link
              href={`/agenda?vista=mes&mes=${siguiente}${filtro}`}
              aria-label="Mes siguiente"
              className="flex h-11 w-11 items-center justify-center text-tenue"
            >
              <Ico nombre="flecha" tam={22} grosor={2.4} />
            </Link>
          </div>
        </div>

      {calendarios.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {calendarios.length > 1 && (
              <>
                <Pildora
                  href={`/agenda?vista=mes&mes=${anio}-${String(mesNum).padStart(2, '0')}`}
                  puesta={!dueno}
                >
                  Los dos
                </Pildora>
                {calendarios.map((c) => (
                  <Pildora
                    key={c.id}
                    href={`/agenda?vista=mes&mes=${anio}-${String(mesNum).padStart(2, '0')}&de=${c.id}`}
                    puesta={dueno === c.id}
                    color={AMBITO[ambitoDeColor(c.color)]}
                  >
                    {c.nombre.split(' ')[0]}
                  </Pildora>
                ))}
              </>
            )}
            <Refrescar cuantasHabia={googleDelMes.length} />
          </div>
        )}

      {/* ── La cuadrícula ── */}
        <div className="mt-4 grid grid-cols-7 gap-1">
          {DIAS.map((d, i) => (
            <p key={i} className="pb-1 text-center text-[13px] font-extrabold text-tenue">
              {d}
            </p>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {celdas.map((f, i) =>
            f === null ? (
              <span key={`h${i}`} />
            ) : (
              <Link
                key={f}
                href={`/agenda?vista=dia&dia=${f}${filtro}`}
                className={`flex aspect-square flex-col items-center justify-center gap-[3px] rounded-[13px] text-[16px] ${
                  /* Elegido = tinta (un estado). Hoy = el velo del
                     color de acción, que es lo único que dice «estás
                     aquí». Iban con `bg-boton` y `bg-verde-suave`, los
                     dos colores de antes. */
                  f === diaElegido
                    ? 'bg-[color:var(--t-tinta)] font-extrabold text-[color:var(--t-fondo)]'
                    : f === hoyISO
                      ? 'font-extrabold text-[color:var(--color-accion)]'
                      : 'font-semibold text-tinta'
                }`}
              >
                {Number(f.slice(8))}
                <span className="flex h-[5px] gap-[3px]">
                  {(porDia.get(f) ?? []).slice(0, 3).map((r) => (
                    <span
                      key={r.id}
                      className="h-[5px] w-[5px] rounded-full"
                      style={{
                        background:
                          f === diaElegido ? 'var(--t-fondo)' : colorDe(r),
                      }}
                    />
                  ))}
                  {/* Las de Google, con el color de su dueño y huecas:
                      de un vistazo se ve QUÉ es de HUBI y qué viene de
                      fuera, sin tener que entrar en el día. */}
                  {(conGoogle.get(f) ?? []).slice(0, 2).map((color) => (
                    <span
                      key={color}
                      className="h-[5px] w-[5px] rounded-full border"
                      style={{
                        borderColor: f === diaElegido ? 'var(--t-fondo)' : color,
                      }}
                    />
                  ))}
                </span>
              </Link>
            )
          )}
        </div>

        {/*
          ═══════════════════════════════════════════════════════
          Y DEBAJO, EL MES ENTERO
          ═══════════════════════════════════════════════════════

          Antes salía UN día: el elegido en la cuadrícula. Y eso
          convertía el mes en una manera lenta de mirar un día — la
          cuadrícula decía en qué días hay puntos, pero para saber QUÉ
          hay en el mes había que ir tocando día por día, treinta
          veces.

          Ahora se enseña el mes entero, resumido: los días que tienen
          algo, con una línea por cosa. La cuadrícula sigue arriba para
          ver la forma del mes de un vistazo, y tocar un día ENTRA en
          él, hora a hora.

          Es la misma regla en las tres escalas: lo que estás mirando
          se ve entero, y se entra para ver el detalle.
        */}
        <section className="mt-6">
          <h2 className="rotulo">
            {conAlgo.length === 0
              ? 'Este mes'
              : `Este mes · ${cuantasCosas} ${cuantasCosas === 1 ? 'cosa' : 'cosas'}`}
          </h2>

          {conAlgo.length === 0 ? (
            <p className="mt-3 rounded-[20px] bg-superficie px-6 py-8 text-center text-[17px] font-medium text-tinta-suave">
              No hay nada apuntado este mes.
            </p>
          ) : (
            <div className="mt-3 space-y-5">
              {conAlgo.map((d) => (
                <div key={d.fecha}>
                  <Link
                    href={`/agenda?vista=dia&dia=${d.fecha}${filtro}`}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <p
                      className="text-[15.5px] font-extrabold tracking-tight"
                      style={d.fecha === hoyISO ? { color: 'var(--color-verde)' } : undefined}
                    >
                      {d.fecha === hoyISO ? 'Hoy · ' : ''}
                      {cortoEnPalabras(d.fecha)}
                    </p>
                    <span className="flex items-center gap-1 text-[13.5px] font-bold text-tenue">
                      Ver el día
                      <Ico nombre="flecha" tam={14} grosor={2.6} />
                    </span>
                  </Link>

                  <ul className="mt-2 space-y-1.5">
                    {d.lista.map((r) => {
                      const pinta = pintaDe(r.titulo)
                      const tarde = atrasado(r)
                      return (
                        <li key={r.id}>
                          <Renglon
                            href={`/tablon/${r.id}`}
                            hora={r.hora}
                            titulo={r.titulo}
                            /* Era `#FF6B6B`, un coral fuera de
                               paleta. Algo con fecha pasada y sin hacer
                               SÍ es una alerta: va con su token. */
                            color={tarde ? 'var(--t-alerta)' : AMBITO[pinta.ambito]}
                            hecha={r.estado === 'hecho'}
                            pie={
                              tarde
                                ? 'Sin hacer'
                                : r.asignado_a
                                  ? (nombres[r.asignado_a] ?? '').split(' ')[0]
                                  : null
                            }
                          />
                        </li>
                      )
                    })}
                    {d.google.map((c) => (
                      <li key={c.uid}>
                        <Renglon
                          href={null}
                          hora={c.hora}
                          titulo={c.titulo}
                          color={c.color}
                          hecha={false}
                          pie={
                            [calendarios.length > 1 ? c.de.split(' ')[0] : null, c.lugar]
                              .filter(Boolean)
                              .join(' · ') || null
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-5">
          <BotonPrincipal href="/tablon/nuevo" icono="mas">
            Apuntar algo
          </BotonPrincipal>
        </div>

        {/* Qué significa cada punto. Sin esto, el rojo asusta sin
            decir por qué, y el gris parece un fallo de la pantalla.

            LOS TRES VAN EN UNA SOLA LÍNEA. Partidos en dos renglones
            se leían como una lista de opciones —algo que hay que
            elegir— en vez de como el pie de un dibujo. Cabían de sobra:
            lo que los partía era un `pr-24` puesto para esquivar el
            botón de voz, que ya no pasa por ahí. */}
        <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
          <Leyenda color="var(--t-tenue)" texto="Por hacer" />
          <Leyenda color="var(--t-alerta)" texto="Sin hacer" />
          <Leyenda color="var(--t-atencion)" texto="Vence" />
          <Leyenda color="var(--t-bien)" texto="Hecho" />
        </div>
    </>
  )
}

/*
  El color de un punto del calendario.

  ANTES TODO ERA VERDE PARA SIEMPRE. Una cita de hace tres semanas que
  nadie llegó a marcar se veía igual que la de mañana, y una ya hecha
  igual que una pendiente. El mes servía para saber QUÉ DÍA hay algo,
  pero no para saber si estáis al día — que es justo lo que se mira de
  un vistazo.

  El orden importa: lo hecho manda sobre lo atrasado. Una cita del mes
  pasado que se cumplió no debe salir en rojo.
*/
function colorDe(r: Recordatorio): string {
  /*
    Los tres eran hexadecimales fuera de paleta. Y el de «por hacer»
    era `#14B8A6`, el color de ACCIÓN: cada punto pendiente del mes
    decía «púlsame».

    Ahora son los tres estados, que es exactamente lo que significan:
    hecho, atrasado, y lo normal — que no es un estado, es tinta.
  */
  if (r.estado === 'hecho') return 'var(--t-bien)'
  if (atrasado(r)) return 'var(--t-alerta)'
  if (r.tipo === 'vencimiento') return 'var(--t-atencion)'
  return 'var(--t-tenue)'
}


function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-[13.5px] font-bold text-tenue">
      <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} />
      {texto}
    </span>
  )
}

function iso(f: Date): string {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

function diaValido(dia: string, anio: number, mes: number): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia.startsWith(`${anio}-${String(mes).padStart(2, '0')}`)
}


/*
  Una cosa del mes, en un renglón.

  El mismo dibujo que usa la semana, a propósito: si las dos escalas
  pintaran sus líneas distintas, cambiar de una a otra obligaría a
  volver a aprender a leerlas. La hora en columna fija a la izquierda
  para que el ojo pueda bajar por ellas sin leer los títulos.
*/
function Renglon({
  href,
  hora,
  titulo,
  color,
  pie,
  hecha,
}: {
  href: string | null
  hora: string | null
  titulo: string
  color: string
  pie: string | null
  hecha: boolean
}) {
  const dentro = (
    <span
      className={`flex items-center gap-2.5 rounded-[14px] border border-borde bg-superficie px-3 py-2.5 ${
        hecha ? 'opacity-55' : ''
      }`}
    >
      <span
        className="w-[40px] shrink-0 text-[12.5px] font-extrabold tabular-nums"
        style={{ color: hora ? color : 'var(--t-apagado)' }}
      >
        {hora ? hora.slice(0, 5) : '—'}
      </span>
      <span
        className="h-[26px] w-[3px] shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[16px] font-bold leading-snug ${
            hecha ? 'line-through' : ''
          }`}
        >
          {titulo}
        </span>
        {pie && <span className="block truncate text-[13px] font-bold text-tenue">{pie}</span>}
      </span>
    </span>
  )

  if (!href) return <span className="block">{dentro}</span>
  return (
    <Link href={href} className="block">
      {dentro}
    </Link>
  )
}

/** «2026-09-09» → «Miércoles 9». En el mes, el día de la semana ayuda. */
function cortoEnPalabras(iso: string): string {
  const nombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(a, m - 1, d)
  return `${nombres[f.getDay()]} ${d}`
}
