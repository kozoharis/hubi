import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { actividadesDe } from '@/lib/actividades'
import { gastadoEnCasa } from '@/lib/gastos-casa'
import { miHogar } from '@/lib/hogar'
import Barra from '../barra'
import HubiCaja from '../hubi-caja'
import Cabecera from '../cabecera'
import { Ico, Volver } from '../iconos'
import { Fila, PastillaAmbito, seccionPintada, TarjetaAccion, Vacio } from '../piezas'
import NuevaActividad from '../ajustes/nueva-actividad'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  CUENTAS · una de las cinco pestañas
  ═══════════════════════════════════════════════════════════════

  Todo el dinero de la casa en un sitio: las actividades con su
  balance, lo que se va en la casa y lo que se paga todos los meses.

  ─────────────────────────────────────────────────────────────
  POR QUÉ EXISTE, Y NO ES SOLO ORDEN

  Las actividades ESTABAN en la barra, cada una con su pestaña: aquí
  la Finca y Los Helechos. Eso tenía dos problemas.

  El primero, que la barra no tenía forma fija —tres funciones y dos
  nombres propios que cambian en cada casa—, así que no se podía
  aprender ni explicar por teléfono.

  El segundo es el que de verdad dolía: con esas dos ocupando sitio no
  quedaba hueco para nada más, y La compra, los Menús, las Notas, La
  casa y el asesor acababan todos colgando del Inicio. Mil doscientas
  líneas de Inicio, y media pantalla de scroll para llegar al médico
  de las diez.

  Juntándolas aquí se abre ese hueco. El precio está dicho y aceptado:
  quien abre la Finca a diario paga un toque más.

  ─────────────────────────────────────────────────────────────
  Y EL DINERO DE LA CASA ESTABA EN TRES SITIOS

  «Cuentas de casa» colgaba del Inicio, «Pagos fijos» no colgaba de
  ningún sitio —había que saberse la dirección— y cada actividad iba
  por su cuenta. Tres maneras de mirar lo mismo. Ahora es una.
*/
export default async function Cuentas() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) redirect('/empezar')

  const actividades = await actividadesDe(supabase)

  /*
    El balance de cada actividad este mes, y lo de la casa, a la vez.

    Los movimientos se piden UNA vez y se reparten aquí, en vez de una
    consulta por actividad: con ocho obras serían ocho viajes a la base
    de datos para pintar una pantalla, y eso se nota en un móvil con
    mala cobertura.
  */
  const hoy = new Date()
  const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`

  const [{ data: categorias }, { data: movimientos }, gastoCasa] = await Promise.all([
    supabase.from('categorias').select('id, padre_id'),
    supabase
      .from('movimientos')
      .select('tipo, importe, categoria_id')
      .gte('fecha', `${mes}-01`)
      .lte('fecha', `${mes}-31`),
    gastadoEnCasa(supabase),
  ])

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

  const nombreMes = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(hoy)

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href="/" />
        <div className="flex h-14 items-center gap-3">
          <PastillaAmbito icono="euro" ambito="pizarra" tam={44} />
          <h1 className="t-titulo">Cuentas</h1>
        </div>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-1">
        {/*
          La caja de HUBI. La misma que en Inicio y en Papeles, con la
          sugerencia de aquí: lo que cambia entre pantallas es lo que
          se propone, no lo que hace.
        */}
        <div className="mb-4">
          <HubiCaja donde="cuentas" />
        </div>
        {/* ══ LAS ACTIVIDADES ══ */}
        {actividades.length > 0 ? (
          <>
            <h2 className="t-seccion mt-4">Cómo va cada una</h2>
            <p className="t-apoyo mt-1">En {nombreMes}</p>

            <ul className="mt-3 space-y-2.5">
              {actividades.map((a) => {
                const balance = balances.get(a.id) ?? 0
                const pintada = seccionPintada(a.segmento)
                return (
                  <li key={a.id}>
                    <Fila href={a.ruta} alto="alta" ambito={pintada.ambito}>
                      <PastillaAmbito icono={pintada.icono} ambito={pintada.ambito} tam={48} />
                      <span className="min-w-0 flex-1">
                        <span className="t-tarjeta block truncate">{a.nombre}</span>
                        {/* Un balance es de los pocos sitios donde el
                            color ES el signo, así que lleva los colores
                            de estado — no los de ámbito. */}
                        <span
                          className="t-cuerpo mt-0.5 block tabular-nums"
                          style={{ color: balance >= 0 ? 'var(--t-bien)' : 'var(--t-alerta)' }}
                        >
                          {balance >= 0 ? '+' : '−'}
                          {Math.abs(Math.round(balance)).toLocaleString('es-ES')} €
                        </span>
                      </span>
                      <Ico nombre="flecha" tam={21} grosor={2.3} className="shrink-0" />
                    </Fila>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <div className="mt-4">
            <Vacio
              titulo="Todavía no llevas las cuentas de nada"
              explicacion="Una finca, una obra, unos pisos… aquí abajo se empieza."
            />
          </div>
        )}

        {/*
          ══ LA CASA ══

          Lo que se va fuera de las actividades: la compra, el taller,
          las reparaciones. Es lo que estaba en el Inicio con el nombre
          «Cuentas de casa» y una tarjeta morada.

          Va SIEMPRE, aunque no haya nada apuntado: es el sitio donde
          se mira, y si desapareciera cuando está a cero habría que
          recordar que existe.
        */}
        <h2 className="t-seccion mt-8">La casa</h2>
        <p className="t-apoyo mt-1">Lo que no es de ninguna actividad</p>

        <div className="mt-3 space-y-2.5">
          <TarjetaAccion
            href="/gastos"
            icono="euro"
            ambito="arena"
            titulo={
              gastoCasa.total > 0
                ? `${Math.round(gastoCasa.total).toLocaleString('es-ES')} € este trimestre`
                : 'Gastos de la casa'
            }
            pie={
              gastoCasa.total > 0
                ? gastoCasa.mayor
                  ? `Lo que más, ${gastoCasa.mayor.toLowerCase()}`
                  : 'Ver el desglose'
                : 'Todavía no hay nada apuntado'
            }
          />

          {/*
            Y los pagos fijos, que hasta hoy no colgaban de NINGÚN
            sitio: había que saberse la dirección de memoria. Internet,
            el teléfono, los seguros — justamente el dinero que se va
            solo y que nadie fotografía.
          */}
          <TarjetaAccion
            href="/pagos"
            icono="reloj"
            ambito="pizarra"
            titulo="Lo que se paga todos los meses"
            pie="Internet, teléfono, seguros, suscripciones"
          />
        </div>

        {/* Crear una actividad desde aquí. Mandar a Ajustes a alguien
            que está mirando justo sus cuentas es hacerle dar un rodeo
            para volver al mismo sitio. */}
        <div className="mt-6">
          <NuevaActividad />
        </div>
      </div>

      <Barra activa="cuentas" />
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
