import { notFound, redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../../../barra'
import Cabecera from '../../../cabecera'
import { Pastilla, Volver, iconoDeEmoji } from '../../../iconos'
import Unidades, { type UnidadDeLaLista } from '../../../ajustes/unidades'
import Dividir from './dividir'
import Partidas, { type Partida } from './partidas'
import Quitar from './quitar'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  CÓMO SE LLEVA ESTA ACTIVIDAD
  ═══════════════════════════════════════════════════════════════

  Aquí caben las dos cosas que definen una actividad, y son las dos
  que hacen que HUBI sirva para algo más que para esta casa:

  · **Las partes** —las unidades—: de quién es el gasto.
      Obra Manuel · Helechos 2 · la huerta de arriba

  · **Las partidas** —las categorías—: de qué es el gasto.
      Albañilería · Carpintería · Luz · Productos

  Son dos EJES, no una jerarquía, y por eso están en la misma pantalla
  pero separadas. Cruzándolas sale la tabla que de verdad quiere ver
  un reformista en febrero:

      ┌──────────────┬────────────┬─────────────┬────────┐
      │              │ Albañilería│ Carpintería │ Total  │
      │ Obra Manuel  │      4.200 │         380 │  7.680 │
      │ Baño de Ana  │        900 │          90 │  2.190 │
      │ Total        │      5.100 │         470 │        │
      └──────────────┴────────────┴─────────────┴────────┘

  Si las partidas fueran partes, la fila del total desaparece — y con
  ella la pregunta «¿cuánto llevo en carpintería en todas las obras?».

  ─────────────────────────────────────────────────────────────
  POR QUÉ ESTÁ AQUÍ Y NO EN AJUSTES

  Porque esto es de ESTA actividad, no de la aplicación. Con una
  familia que tenga cinco, Ajustes se convertiría en una lista
  interminable de cosas que no son ajustes de HUBI sino de su finca.
  Cada actividad guarda lo suyo dentro.
*/

export default async function AjustesDeLaSeccion({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await clienteSesion()
  if (!(await quien(supabase))) redirect('/entrar')

  /* Las columnas nuevas, en su propio intento: si el SQL no está,
     Postgres rechaza la consulta ENTERA y esta pantalla diría «no
     existe» sobre una actividad que sí está. */
  const columnas = 'id, nombre, icono, padre_id, activa'

  let fila: Record<string, unknown> | null = null

  const completa = await supabase
    .from('categorias')
    .select(`${columnas}, color, fondo, usa_unidades, reparte_comunes, palabra_unidad`)
    .eq('id', id)
    .maybeSingle()

  if (completa.error) {
    const basica = await supabase.from('categorias').select(columnas).eq('id', id).maybeSingle()
    fila = basica.data as Record<string, unknown> | null
  } else {
    fila = completa.data as Record<string, unknown> | null
  }

  if (!fila || fila.padre_id || fila.activa === false) notFound()

  const nombre = fila.nombre as string

  // ── Las partes ──
  let unidades: UnidadDeLaLista[] = []
  try {
    const { data } = await supabase
      .from('unidades')
      .select('id, nombre, referencia, presupuesto')
      .eq('seccion_id', id)
      .eq('activa', true)
      .order('orden')

    unidades = (data ?? []).map((u) => ({
      id: u.id as string,
      nombre: u.nombre as string,
      referencia: (u.referencia as string | null) ?? null,
      presupuesto: u.presupuesto == null ? null : Number(u.presupuesto),
    }))
  } catch {
    /* Sin la tabla todavía. La pantalla sigue sirviendo para el resto. */
  }

  // ── Las partidas ──
  const { data: hijas } = await supabase
    .from('categorias')
    .select('id, nombre, naturaleza, padre_id, segmento_drive, activa, orden')
    .eq('padre_id', id)

  const grupos = (hijas ?? []).filter((c) => c.activa !== false)

  const deGasto = grupos.find((c) => c.segmento_drive === 'GASTOS')
  const deIngreso = grupos.find((c) => c.segmento_drive === 'INGRESOS')
  const dePapeles = grupos.find((c) => c.segmento_drive === 'DOCUMENTOS')

  const [gastos, ingresos, carpetasDePapel] = await Promise.all([
    partidasDe(supabase, deGasto?.id as string | undefined),
    partidasDe(supabase, deIngreso?.id as string | undefined),
    /* Las carpetas de papeles se cuentan por DOCUMENTOS y no por
       apuntes: en Contratos no hay ni un movimiento y sí está el
       contrato. Decir «no tiene nada» sería mentira. */
    partidasDe(supabase, dePapeles?.id as string | undefined, 'papeles'),
  ])

  /*
    ── LO QUE TIENE DENTRO, PARA PODER DECIRLO ANTES DE QUITARLA ──

    Quitar una actividad vacía la borra; quitar una que ya tiene
    cuentas la retira. Y eso hay que decírselo a quien va a pulsar,
    con el número delante: entre «tiene datos» y «tiene 214 apuntes y
    38 papeles» hay toda la diferencia a la hora de decidir.

    Los apuntes ya están contados partida a partida —se hizo arriba
    para la lista—, así que aquí solo se suman. Los papeles sí hay que
    pedirlos, y se piden de una vez para todo el árbol.
  */
  const apuntes =
    gastos.reduce((n, p) => n + p.apuntes, 0) + ingresos.reduce((n, p) => n + p.apuntes, 0)

  let papeles = 0
  try {
    const bajoEsta = [
      id,
      ...(hijas ?? []).map((c) => c.id as string),
      ...gastos.map((p) => p.id),
      ...ingresos.map((p) => p.id),
      ...carpetasDePapel.map((p) => p.id),
    ]

    const { count } = await supabase
      .from('documentos')
      .select('id', { count: 'exact', head: true })
      .in('categoria_id', bajoEsta)
      .is('eliminado_en', null)

    papeles = count ?? 0
  } catch {
    /* Sin recuento se enseña cero y la ruta decide igualmente qué
       hacer: la cuenta de verdad la vuelve a hacer el servidor antes
       de tocar nada. */
  }

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href={`/seccion/${id}`} />
        <div className="flex h-14 items-center gap-3">
          <Pastilla
            nombre={iconoDeEmoji(fila.icono as string | null)}
            color={(fila.color as string) || '#64748B'}
            fondo={(fila.fondo as string) || '#EEF2F7'}
            tam={44}
            icono={23}
          />
          <h1 className="text-[25px] font-extrabold tracking-tight">Cómo la llevas</h1>
        </div>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-1">
        <Dividir
          seccionId={id}
          seccionNombre={nombre}
          seDivide={fila.usa_unidades === true}
          palabra={(fila.palabra_unidad as string | null) ?? null}
          reparte={fila.reparte_comunes === true}
          cuantas={unidades.length}
        />

        {fila.usa_unidades === true && (
          <Unidades
            seccionId={id}
            seccionNombre="Las que tienes"
            palabra={(fila.palabra_unidad as string | null) ?? 'la parte'}
            unidades={unidades}
            /* El presupuesto solo tiene sentido donde alguien cobra
               por lo que hace. Un apartamento en alquiler no lo tiene;
               una obra sí — y sin él no se puede contestar lo único
               que de verdad quiere saber un reformista: cuánto le
               queda por cobrar. */
            conPresupuesto={/obra/i.test((fila.palabra_unidad as string) ?? '')}
          />
        )}

        <Partidas
          seccionId={id}
          gastos={gastos}
          ingresos={ingresos}
          papeles={carpetasDePapel}
        />

        {/* Al final del todo: es lo que se hace una vez, y en medio
            del camino sería un botón peligroso donde no toca. */}
        <Quitar seccionId={id} nombre={nombre} apuntes={apuntes} papeles={papeles} />
      </div>

      <Barra activa={id} voz={false} />
    </main>
  )
}

/*
  Las partidas de un grupo, con cuántos apuntes tiene cada una.

  El recuento se pide de una vez para todas y se reparte aquí. Con
  quince partidas, una consulta por cada una serían quince viajes a la
  base de datos para pintar una pantalla — y eso en un móvil con mala
  cobertura se nota.
*/
async function partidasDe(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  grupoId: string | undefined,
  /* Qué se cuenta en cada una. Las de dinero, apuntes. Las de papel
     —Contratos, Seguros—, documentos: ahí no hay ni un movimiento. */
  contar: 'apuntes' | 'papeles' = 'apuntes'
): Promise<Partida[]> {
  if (!grupoId) return []

  const { data } = await supabase
    .from('categorias')
    .select('id, nombre, activa, orden')
    .eq('padre_id', grupoId)
    .eq('activa', true)
    .order('orden')

  const partidas = (data ?? []) as { id: string; nombre: string }[]
  if (partidas.length === 0) return []

  const ids = partidas.map((p) => p.id)

  const { data: filas } =
    contar === 'papeles'
      ? await supabase
          .from('documentos')
          .select('categoria_id')
          .in('categoria_id', ids)
          .is('eliminado_en', null)
      : await supabase.from('movimientos').select('categoria_id').in('categoria_id', ids)

  const cuenta = new Map<string, number>()
  for (const m of filas ?? []) {
    const k = m.categoria_id as string
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
  }

  return partidas.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    apuntes: cuenta.get(p.id) ?? 0,
  }))
}
