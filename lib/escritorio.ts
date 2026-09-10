import type { SupabaseClient } from '@supabase/supabase-js'
import { calcular } from './periodos'
import { hoyAqui } from './tablon'

/*
  ═══════════════════════════════════════════════════════════════
  EL ESCRITORIO
  ═══════════════════════════════════════════════════════════════

  Todas tus casas de una vez: qué estás esperando de cada una, cuándo
  llegó el último papel y cómo va su trimestre.

  ─────────────────────────────────────────────────────────────
  NO SE LLAMA «EL ASESOR», Y ES A PROPÓSITO

  La idea salió de uno —«llevo quince clientes, y desde el móvil eso
  es imposible»—, pero un hijo con dos casas, la suya y la de sus
  padres, tiene el mismo problema en pequeño. Ponerle el nombre de un
  rol la habría dejado escondida para él.

  ─────────────────────────────────────────────────────────────
  Y TODO EL TRABAJO LO HACE LA BASE DE DATOS

  A propósito, y por seguridad, no por rendimiento.

  Todo HUBI está atado a UNA casa: las políticas preguntan «¿esta fila
  es de la casa que estás mirando?». Traer aquí quince casas habría
  significado aflojar eso — y una política mal escrita no da error:
  enseña lo que no debía.

  Así que la consulta vive dentro, en `mi_escritorio()` (SQL 52), y lo
  único que sale de ella son recuentos y sumas. No hay ninguna columna
  donde quepa un documento. Ver un papel sigue exigiendo entrar en su
  casa, exactamente como antes.
*/

export type CasaEnLaMesa = {
  id: string
  nombre: string
  rol: string | null
  papeles: number
  ultimoPapel: string | null
  /** Lo que YO dejé apuntado ahí y sigue sin hacerse. */
  esperando: number
  ingresos: number
  gastos: number
  balance: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

/**
 * Las casas de quien mira, con su resumen del trimestre en curso.
 *
 * Devuelve `null` —y no una lista vacía— cuando la consulta no existe
 * todavía: son dos cosas distintas y la pantalla dice una u otra. Una
 * lista vacía es «no tienes casas»; `null` es «falta ejecutar el SQL
 * 52», y confundirlas manda a alguien a buscar un fallo donde no está.
 */
export async function laMesa(supabase: Cliente): Promise<CasaEnLaMesa[] | null> {
  /* El trimestre en curso, con el día de AQUÍ. `new Date()` en el
     servidor da la hora de Londres, y el 1 de enero a las once de la
     noche eso cambia de trimestre antes que ellos. */
  const { desde, hasta } = calcular('trimestre', hoyAqui())

  try {
    const { data, error } = await supabase.rpc('mi_escritorio', {
      desde,
      hasta,
    })

    if (error) {
      console.error('[HUBI] El escritorio no ha podido leerse:', error.message)
      return null
    }

    type Fila = {
      hogar_id: string
      nombre: string
      rol: string | null
      papeles: number | string
      ultimo_papel: string | null
      esperando: number | string
      ingresos: number | string
      gastos: number | string
    }

    /* Los recuentos vienen de `count()`, que en Postgres es `bigint`, y
       un bigint llega como TEXTO por si no cabe en un número de
       JavaScript. Sin el `Number()` la suma de dos casas daría "23"
       en vez de 5. */
    return (data ?? []).map((f: Fila) => {
      const ingresos = Number(f.ingresos) || 0
      const gastos = Number(f.gastos) || 0
      return {
        id: f.hogar_id,
        nombre: f.nombre,
        rol: f.rol,
        papeles: Number(f.papeles) || 0,
        ultimoPapel: f.ultimo_papel,
        esperando: Number(f.esperando) || 0,
        ingresos,
        gastos,
        balance: ingresos - gastos,
      }
    })
  } catch (e) {
    console.error('[HUBI] El escritorio ha fallado:', e)
    return null
  }
}

/**
 * «hace 3 días», «hace un mes», «hoy».
 *
 * En una tabla de quince casas la fecha exacta no dice nada —nadie
 * compara 14/08 con 02/09 de un vistazo— y lo que se busca ahí es
 * justo lo contrario: cuál lleva más tiempo callada.
 */
export function haceCuanto(fecha: string | null, hoy: string): string {
  if (!fecha) return 'Nunca'

  const a = new Date(fecha + 'T12:00:00Z').getTime()
  const b = new Date(hoy + 'T12:00:00Z').getTime()
  const dias = Math.round((b - a) / 86_400_000)

  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 7) return `Hace ${dias} días`
  if (dias < 14) return 'Hace una semana'
  if (dias < 31) return `Hace ${Math.round(dias / 7)} semanas`
  if (dias < 60) return 'Hace un mes'
  if (dias < 365) return `Hace ${Math.round(dias / 30)} meses`
  return 'Hace más de un año'
}
