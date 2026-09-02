import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { cuando, atrasado, hoyAqui, type Recordatorio } from '@/lib/tablon'
import { Ico, Pastilla, pintaDe } from '../iconos'
import { citasDeLaFamilia, calendariosVisibles } from '@/lib/agenda-google'
import Refrescar from './refrescar'

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

  const delDia = porDia.get(diaElegido) ?? []

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
  const deGoogle = googleDelMes.filter((c) => c.fecha === diaElegido)

  const conGoogle = new Map<string, string[]>()
  for (const c of googleDelMes) {
    const ya = conGoogle.get(c.fecha) ?? []
    if (!ya.includes(c.color)) conGoogle.set(c.fecha, [...ya, c.color])
  }

  const filtro = dueno ? `&de=${dueno}` : ''

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
                <Filtro
                  texto="Los dos"
                  href={`/agenda?vista=mes&mes=${anio}-${String(mesNum).padStart(2, '0')}`}
                  puesto={!dueno}
                  color="#0F172A"
                />
                {calendarios.map((c) => (
                  <Filtro
                    key={c.id}
                    texto={c.nombre.split(' ')[0]}
                    href={`/agenda?vista=mes&mes=${anio}-${String(mesNum).padStart(2, '0')}&de=${c.id}`}
                    puesto={dueno === c.id}
                    color={c.color}
                  />
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
                href={`/agenda?vista=mes&mes=${anio}-${String(mesNum).padStart(2, '0')}&dia=${f}${filtro}`}
                className={`flex aspect-square flex-col items-center justify-center gap-[3px] rounded-[13px] text-[16px] ${
                  f === diaElegido
                    ? 'bg-boton font-extrabold text-boton-texto'
                    : f === hoyISO
                      ? 'bg-verde-suave font-extrabold text-verde'
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
                          f === diaElegido ? 'var(--t-boton-texto)' : colorDe(r),
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
                        borderColor: f === diaElegido ? 'var(--t-boton-texto)' : color,
                      }}
                    />
                  ))}
                </span>
              </Link>
            )
          )}
        </div>

        {/* ── Lo de ese día ── */}
        <section className="mt-6">
          <h2 className="rotulo">{enPalabras(diaElegido)}</h2>

          {delDia.length === 0 ? (
            <p className="mt-3 rounded-[20px] bg-superficie px-6 py-8 text-center text-[17px] font-medium text-tinta-suave">
              Nada este día.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {delDia.map((r) => {
                const pinta = pintaDe(r.titulo)
                const vence = r.tipo === 'vencimiento'
                /* Se pasó la fecha y sigue sin hacerse. Antes esto no
                   se veía: en el mes todo salía del mismo verde para
                   siempre, así que una cita de hace tres semanas que
                   nadie marcó tenía exactamente el mismo aspecto que
                   la de mañana. */
                const tarde = atrasado(r)
                const hecho = r.estado === 'hecho'
                return (
                  <li key={r.id}>
                    <Link
                      href={`/tablon/${r.id}`}
                      className={`flex items-center gap-3 rounded-[20px] border bg-superficie px-3.5 py-3 ${
                        (vence || tarde) && !hecho ? 'border-coral' : 'border-borde'
                      } ${hecho ? 'opacity-55' : ''}`}
                    >
                      <span
                        className={`w-[52px] shrink-0 text-[15px] font-extrabold ${
                          tarde ? 'text-coral' : ''
                        }`}
                      >
                        {r.hora ? r.hora.slice(0, 5) : <span className="text-tenue">—</span>}
                      </span>
                      <Pastilla
                        nombre={vence || tarde ? 'reloj' : pinta.icono}
                        color={vence || tarde ? '#FF6B6B' : pinta.color}
                        fondo={vence || tarde ? '#FFE7E7' : pinta.fondo}
                        tam={38}
                        icono={20}
                        redondez={12}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-[16.5px] font-bold leading-snug ${
                            hecho ? 'text-tinta-suave line-through' : ''
                          }`}
                        >
                          {r.titulo}
                        </span>
                        <span
                          className={`block text-[14px] font-semibold ${
                            tarde ? 'text-coral' : 'text-tenue'
                          }`}
                        >
                          {tarde && 'Sin hacer · '}
                          {r.documento_origen_id
                            ? 'Detectado en un papel'
                            : r.asignado_a
                              ? (nombres[r.asignado_a] ?? '')
                              : 'Los dos'}
                        </span>
                      </span>
                      <Ico nombre="flecha" tam={19} grosor={2.2} className="shrink-0 text-borde" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {deGoogle.length > 0 && (
          <section className="mt-5">
            <h2 className="rotulo">
              {calendarios.length > 1 ? 'De Google' : 'De tu Google'}
            </h2>
            <ul className="mt-2.5 space-y-2.5">
              {deGoogle.map((c) => (
                <li
                  key={c.uid}
                  className="flex items-center gap-3 rounded-[20px] border border-dashed border-borde bg-superficie px-3.5 py-3"
                >
                  <span className="w-[52px] shrink-0 text-[15px] font-extrabold">
                    {c.hora ?? <span className="text-tenue">—</span>}
                  </span>
                  <span
                    className="h-9 w-[4px] shrink-0 rounded-full"
                    style={{ background: c.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16.5px] font-bold leading-snug">{c.titulo}</span>
                    <span className="block text-[14px] font-semibold text-tenue">
                      {[calendarios.length > 1 ? c.de : null, c.lugar, 'Google']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link
          href="/tablon/nuevo"
          className="mt-5 flex h-[60px] items-center justify-center gap-2.5 rounded-[18px] bg-boton text-[18px] font-extrabold text-boton-texto"
        >
          <Ico nombre="mas" tam={22} grosor={2.3} />
          Apuntar algo
        </Link>

        {/* Qué significa cada punto. Sin esto, el rojo asusta sin
            decir por qué, y el gris parece un fallo de la pantalla.

            LOS TRES VAN EN UNA SOLA LÍNEA. Partidos en dos renglones
            se leían como una lista de opciones —algo que hay que
            elegir— en vez de como el pie de un dibujo. Cabían de sobra:
            lo que los partía era un `pr-24` puesto para esquivar el
            botón de voz, que ya no pasa por ahí. */}
        <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
          <Leyenda color="#14B8A6" texto="Por hacer" />
          <Leyenda color="#FF6B6B" texto="Sin hacer o vence" />
          <Leyenda color="#94A3B8" texto="Hecho" />
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
  if (r.estado === 'hecho') return '#94A3B8'
  if (atrasado(r)) return '#FF6B6B'
  if (r.tipo === 'vencimiento') return '#FF6B6B'
  return '#14B8A6'
}

function Filtro({
  texto,
  href,
  puesto,
  color,
}: {
  texto: string
  href: string
  puesto: boolean
  color: string
}) {
  return (
    <Link
      href={href}
      aria-current={puesto ? 'page' : undefined}
      className="flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-extrabold"
      style={
        puesto
          ? { background: color, color: '#FFFFFF' }
          : {
              background: 'var(--t-superficie)',
              color: 'var(--t-tinta-suave)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      {!puesto && (
        <span className="h-[9px] w-[9px] rounded-full" style={{ background: color }} />
      )}
      {texto}
    </Link>
  )
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

function enPalabras(diaISO: string): string {
  const [a, m, d] = diaISO.split('-')
  const f = new Date(Number(a), Number(m) - 1, Number(d))
  const semana = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  const etiqueta = cuando(diaISO, null)
  if (etiqueta === 'Hoy' || etiqueta === 'Mañana' || etiqueta === 'Ayer') {
    return `${etiqueta} · ${Number(d)} de ${MESES[Number(m) - 1]}`
  }
  return `${semana[f.getDay()]} ${Number(d)} de ${MESES[Number(m) - 1]}`
}
