import Link from '@/app/enlace'
import { notFound } from 'next/navigation'
import { hoyAqui } from '@/lib/tablon'
import { elLunesDe } from '@/lib/menus'
import { laPared, loApuntado, losMenus } from '@/lib/pared'
import { Ico } from '../../../iconos'
import { AMBITO } from '../../../piezas'
import Cosa from '../../cosa'
import { Nada, Rotulo } from '../../rotulo'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  UN DÍA, ENTERO
  ═══════════════════════════════════════════════════════════════

  Se llega tocando una columna del calendario. Es lo que en la semana no
  cabe: las cosas de ese día a tamaño de pared, con su hora, y lo que se
  come.

  ─────────────────────────────────────────────────────────────
  POR QUÉ ESTE DETALLE ES DE LA PARED Y NO EL DE LA APLICACIÓN

  Lo fácil habría sido enlazar a `/tablon/<id>`, la ficha de la tarea que
  ya existe. Y habría sido un error, por dos motivos:

  **1 · Esa ficha está llena de botones que a una pantalla le fallan.**
  «Hecho», «Cambiar», «Borrar» — ninguno de los tres puede una pantalla
  de casa, porque su nivel en la agenda es `mirar`. Se enseñarían y no
  funcionarían, que es peor que no enseñarlos.

  **2 · Y saldría del armazón de la pared.** Sin pestañas, sin reloj y
  sin la vuelta automática a Hoy: una pantalla colgada de una pared
  acabaría en la ficha de una tarea y ahí se quedaría hasta que alguien
  la rescatara.

  Así que el detalle de la pared es de la pared. Enseña, no toca.

  ─────────────────────────────────────────────────────────────
  Y SE VUELVE A LA SEMANA DE ESE DÍA

  No a «esta semana». Quien llega aquí desde el 6 de octubre quiere
  volver a la semana del 6 de octubre, no a la de hoy.
*/

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export default async function ElDia({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params

  /* La fecha llega de la dirección, o sea de fuera. Si no tiene la forma
     exacta, no se consulta nada: una fecha torcida en un `gte` es una
     consulta que puede devolver cualquier cosa. */
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound()

  const { supabase, casa } = await laPared()
  const hoy = hoyAqui()

  const [cosas, menus] = await Promise.all([
    loApuntado(supabase, casa, fecha, fecha),
    losMenus(supabase, casa, fecha, fecha),
  ])

  const pendientes = cosas.filter((c) => c.estado !== 'hecho')
  const hechas = cosas.filter((c) => c.estado === 'hecho')
  const comida = menus.find((m) => m.momento === 'comida')?.que ?? null
  const cena = menus.find((m) => m.momento === 'cena')?.que ?? null

  const d = new Date(`${fecha}T12:00:00`)
  const esHoy = fecha === hoy

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between gap-8">
        <div className="flex items-baseline gap-5">
          <Rotulo>{esHoy ? 'Hoy' : DIAS[d.getDay()]}</Rotulo>
          <p className="text-[34px] font-extrabold leading-none tracking-tight text-tinta">
            {d.getDate()} de {MESES[d.getMonth()]}
          </p>
        </div>

        <Link
          href={`/casa/calendario?lunes=${elLunesDe(fecha)}`}
          className="tocable flex h-[60px] shrink-0 items-center gap-3 rounded-full border border-borde bg-superficie px-6 text-[18px] font-extrabold text-tinta"
        >
          <Ico nombre="atras" tam={22} grosor={2.3} />
          Volver a la semana
        </Link>
      </div>

      <div className="mt-8 grid gap-10 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div>
          {pendientes.length === 0 && hechas.length === 0 ? (
            <Nada>Este día no tiene nada apuntado.</Nada>
          ) : (
            <ul className="space-y-4">
              {pendientes.map((c) => (
                <Cosa
                  key={c.id}
                  titulo={c.titulo}
                  cuando={c.hora ? c.hora.slice(0, 5) : ''}
                  talla="hoy"
                />
              ))}
              {/* Lo ya hecho va al final y apagado. No se esconde: en una
                  casa, saber que algo YA está hecho evita que alguien lo
                  vuelva a hacer. */}
              {hechas.map((c) => (
                <Cosa
                  key={c.id}
                  titulo={c.titulo}
                  cuando={c.hora ? c.hora.slice(0, 5) : ''}
                  talla="hoy"
                  hecha
                />
              ))}
            </ul>
          )}
        </div>

        <div>
          <Rotulo>Qué se come</Rotulo>
          {!comida && !cena ? (
            <Nada>Este día no tiene menú puesto.</Nada>
          ) : (
            <div className="mt-6 space-y-3">
              <Plato etiqueta="Comida" que={comida} />
              <Plato etiqueta="Cena" que={cena} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Plato({ etiqueta, que }: { etiqueta: string; que: string | null }) {
  return (
    <div
      className="flex items-center gap-4 rounded-[24px] border bg-superficie px-6 py-5"
      style={{ borderColor: 'var(--t-borde)', borderLeft: `6px solid ${AMBITO.arena}` }}
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
          {etiqueta}
        </span>
        <span
          className={`block text-[24px] font-extrabold leading-tight ${
            que ? 'text-tinta' : 'text-apagado'
          }`}
        >
          {que ?? 'Sin poner'}
        </span>
      </span>
    </div>
  )
}
