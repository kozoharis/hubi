import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { actividadesDe } from '@/lib/actividades'
import Barra from '../barra'
import Cabecera from '../cabecera'
import { Ico, Pastilla, Volver, iconoDeEmoji } from '../iconos'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LAS ACTIVIDADES DE LA CASA
  ═══════════════════════════════════════════════════════════════

  Solo hace falta cuando hay tres o más: con una o dos, cada una tiene
  su propia pestaña abajo y esta pantalla no la ve nadie.

  ─────────────────────────────────────────────────────────────
  PANTALLA ENTERA, NO UN DESPLEGABLE

  Se pensó en un popup, y se descartó por tres razones concretas: en
  un móvil sale estrecho, se cierra sin querer al tocar fuera, y su
  botón de cerrar es una equis diminuta — justo lo contrario del
  «botón volver siempre evidente» del punto 5.

  ─────────────────────────────────────────────────────────────
  Y NO ES UN MENÚ: ES UN RESUMEN

  Ésta es la parte que hace que el toque de más valga la pena. Una
  lista de enlaces sería un peaje —tocar dos veces para llegar donde
  antes se llegaba en una—. Con el balance del mes en cada tarjeta,
  quien entra aquí YA se ha enterado de cómo va cada cosa, y muchas
  veces ni necesita entrar en ninguna.
*/

export default async function Actividades() {
  const supabase = await clienteSesion()
  if (!(await quien(supabase))) redirect('/entrar')

  const actividades = await actividadesDe(supabase)

  /*
    El balance de cada una, este mes.

    Se piden todos los movimientos del mes de una vez y se reparten
    aquí, en vez de una consulta por actividad. Con ocho obras serían
    ocho viajes a la base de datos para pintar una sola pantalla, y
    eso se nota en un móvil con mala cobertura.
  */
  const hoy = new Date()
  const desde = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
  const hasta = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-31`

  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, padre_id')

  const { data: movimientos } = await supabase
    .from('movimientos')
    .select('tipo, importe, categoria_id')
    .gte('fecha', desde)
    .lte('fecha', hasta)

  const balances = new Map<string, number>()

  for (const a of actividades) {
    const suyas = ramaDe(categorias ?? [], a.id)
    let balance = 0
    for (const m of movimientos ?? []) {
      if (!m.categoria_id || !suyas.has(m.categoria_id as string)) continue
      balance += (m.tipo === 'ingreso' ? 1 : -1) * Number(m.importe)
    }
    balances.set(a.id, balance)
  }

  const mes = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(hoy)

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href="/" texto="Inicio" />
        <h1 className="text-[27px] font-extrabold tracking-tight">Actividades</h1>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-1">
        <p className="mt-1 text-[16px] font-semibold text-tenue">
          Cómo va cada una en {mes}
        </p>

        <ul className="mt-4 space-y-2.5">
          {actividades.map((a) => {
            const balance = balances.get(a.id) ?? 0
            return (
              <li key={a.id}>
                <Link
                  href={a.ruta}
                  className="flex min-h-[84px] items-center gap-3.5 rounded-[22px] border border-borde bg-superficie px-4 py-4"
                >
                  <Pastilla
                    nombre={iconoDeEmoji(a.icono)}
                    color={a.color}
                    fondo={a.fondo}
                    tam={48}
                    icono={25}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[19px] font-extrabold tracking-tight">
                      {a.nombre}
                    </p>
                    <p
                      className="text-[17px] font-extrabold tabular-nums"
                      style={{ color: balance >= 0 ? '#14B8A6' : '#FF6B6B' }}
                    >
                      {balance >= 0 ? '+' : '−'}
                      {Math.abs(Math.round(balance)).toLocaleString('es-ES')} €
                    </p>
                  </div>
                  <Ico nombre="flecha" tam={21} grosor={2.3} />
                </Link>
              </li>
            )
          })}
        </ul>

        {actividades.length === 0 && (
          <p className="mt-4 rounded-[20px] bg-superficie px-6 py-8 text-center text-[17px] font-medium text-tinta-suave">
            Todavía no hay ninguna actividad. Se crean en Ajustes.
          </p>
        )}
      </div>

      <Barra activa="actividades" />
    </main>
  )
}

/** La rama entera de una raíz: ella y todo lo que cuelga. */
function ramaDe(
  categorias: { id: string; padre_id: string | null }[],
  raizId: string
): Set<string> {
  const hijos = new Map<string, string[]>()
  for (const c of categorias) {
    if (!c.padre_id) continue
    hijos.set(c.padre_id, [...(hijos.get(c.padre_id) ?? []), c.id])
  }

  const dentro = new Set<string>([raizId])
  const cola = [raizId]
  while (cola.length) {
    const actual = cola.pop()!
    for (const h of hijos.get(actual) ?? []) {
      if (dentro.has(h)) continue
      dentro.add(h)
      cola.push(h)
    }
  }
  return dentro
}
