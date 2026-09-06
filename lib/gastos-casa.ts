import type { SupabaseClient } from '@supabase/supabase-js'
import { calcular } from './periodos'
import { hoyAqui } from './tablon'

/*
  ═══════════════════════════════════════════════════════════════
  CUÁNTO SE VA EN CASA ESTE TRIMESTRE
  ═══════════════════════════════════════════════════════════════

  Solo el número, para la tarjeta del Inicio. Y va con número y no con
  un «Mira las cuentas» a secas a propósito: una tarjeta que no dice
  nada no se toca. La que pone «1.240 € este trimestre» se toca el
  primer día.

  ─────────────────────────────────────────────────────────────
  QUÉ ENTRA

  Todo lo que NO cuelga de una actividad. La finca y los alquileres
  tienen sus propias cuentas y su propia pantalla; mezclarlas aquí
  daría un número que no significa nada — ni el gasto de la casa ni el
  del negocio.

  ─────────────────────────────────────────────────────────────
  Y VA ENVUELTO ENTERO

  Lo lee el Inicio, la primera pantalla de la mañana. `lleva_cuentas`
  es del SQL 27: si no estuviera, Postgres no dice «esa columna no
  existe», rechaza la consulta entera. Sin ella, la tarjeta enseña
  cero y no se rompe nada.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

export async function gastadoEnCasa(supabase: Cliente): Promise<number> {
  try {
    const periodo = calcular('trimestre', hoyAqui())

    const { data: cats, error } = await supabase
      .from('categorias')
      .select('id, padre_id, lleva_cuentas')

    if (error || !cats) return 0

    type Cat = { id: string; padre_id: string | null; lleva_cuentas?: boolean }
    const porId = new Map((cats as Cat[]).map((c) => [c.id, c]))

    /* Las que cuelgan de una raíz SIN cuentas propias. Se recorre
       hacia arriba y no hacia abajo: así da igual cuántos niveles
       tenga cada casa. */
    const deCasa = new Set<string>()
    for (const c of cats as Cat[]) {
      let actual = c
      while (actual.padre_id) {
        const padre = porId.get(actual.padre_id)
        if (!padre) break
        actual = padre
      }
      if (actual.lleva_cuentas !== true) deCasa.add(c.id)
    }

    if (deCasa.size === 0) return 0

    const { data: movs } = await supabase
      .from('movimientos')
      .select('importe, categoria_id')
      .eq('tipo', 'gasto')
      .gte('fecha', periodo.desde)
      .lte('fecha', periodo.hasta)

    return (movs ?? [])
      .filter((m: { categoria_id: string | null }) => m.categoria_id && deCasa.has(m.categoria_id))
      .reduce((suma: number, m: { importe: number }) => suma + Number(m.importe), 0)
  } catch {
    return 0
  }
}
