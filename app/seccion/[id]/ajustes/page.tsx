import { notFound, redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../../../barra'
import Cabecera from '../../../cabecera'
import { Pastilla, Volver, iconoDeEmoji } from '../../../iconos'
import Unidades, { type UnidadDeLaLista } from '../../../ajustes/unidades'
import Dividir from './dividir'
import Partidas, { type Partida } from './partidas'

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

  const [gastos, ingresos] = await Promise.all([
    partidasDe(supabase, deGasto?.id as string | undefined),
    partidasDe(supabase, deIngreso?.id as string | undefined),
  ])

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href={`/seccion/${id}`} texto={nombre} />
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

        <Partidas seccionId={id} gastos={gastos} ingresos={ingresos} />
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
  grupoId: string | undefined
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

  const { data: movimientos } = await supabase
    .from('movimientos')
    .select('categoria_id')
    .in('categoria_id', partidas.map((p) => p.id))

  const cuenta = new Map<string, number>()
  for (const m of movimientos ?? []) {
    const k = m.categoria_id as string
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
  }

  return partidas.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    apuntes: cuenta.get(p.id) ?? 0,
  }))
}
