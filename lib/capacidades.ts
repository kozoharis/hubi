import type { SupabaseClient } from '@supabase/supabase-js'

/*
  ═══════════════════════════════════════════════════════════════
  QUÉ PUEDE USAR ESTE ESPACIO
  ═══════════════════════════════════════════════════════════════

  Una pregunta: *¿este espacio puede usar esta capacidad?*

  Y todo lo que NO es:

    · no dice quién entra          → eso es `miembros`
    · no dice qué ve cada uno      → eso son los roles y las carpetas
    · no dice cuánto gasta         → eso será `uso_ia`, que no existe

  ─────────────────────────────────────────────────────────────
  CAPACIDAD ≠ ACCESO

  Una promotora puede pagar la IA de papeles para una casa. Eso
  concede una capacidad a la casa. No la mete dentro.

  `concesiones` no tiene ni una columna de permiso. No es una promesa:
  es que no hay por dónde colarlo. Y `pruebas/aislamiento.sql` lo
  comprueba contra un Postgres de verdad.

      claude/regla-sponsor-no-es-miembro.md

  ─────────────────────────────────────────────────────────────
  EL ESPACIO SE DICE, NO SE ADIVINA

  `hogar` es obligatorio y explícito. Nunca sale de `casa_activa`, ni
  de la cabecera, ni de ningún estado global: quien pregunta ya sabe
  por qué espacio pregunta, y si no lo sabe, el compilador se lo dice.

  Quien tenga a mano una sesión, lo saca de `elEspacio(supabase)`.

  ─────────────────────────────────────────────────────────────
  CERRADO POR DEFECTO

  Sin fila, falso. Es deliberado y va en la dirección de la regla de
  siempre —*se abre, no se cierra*—: el día que se enchufe lo primero
  de pago, olvidarse de conceder la capacidad a las casas que ya
  existen se ve en el acto. Al revés, ese mismo olvido regalaría la
  funcionalidad en silencio durante meses.

  ─────────────────────────────────────────────────────────────
  HOY NO LA LLAMA NADIE

  Y está bien así. Se construye ahora para que el día que haga falta
  no haya que decidir deprisa dónde vive esto.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

/**
 * ¿Puede este espacio usar esta capacidad?
 *
 * Contesta la base de datos, con la función `puede_el_espacio` de
 * `sql/96`: hay una concesión viva —empezada, sin caducar y sin
 * revocar— para ese espacio y esa capacidad.
 *
 * Con la sesión de una persona, `concesiones` sólo enseña las de los
 * espacios de los que es miembro. Preguntar por un espacio ajeno
 * devuelve falso por el mismo camino por el que no ve su contenido: la
 * política RLS. Un mecanismo, no dos.
 *
 * Ante cualquier fallo, falso. Cerrado por defecto también cuando algo
 * va mal.
 */
export async function puedeElEspacio(
  supabase: Cliente,
  hogar: string,
  capacidad: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('puede_el_espacio', {
      hogar,
      cap: capacidad,
    })

    if (error) {
      console.error('[MAPPEL] No se ha podido preguntar por la capacidad:', error)
      return false
    }

    return data === true
  } catch (e) {
    console.error('[MAPPEL] No se ha podido preguntar por la capacidad:', e)
    return false
  }
}
