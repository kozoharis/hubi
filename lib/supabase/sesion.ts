import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente de Supabase con la SESIÓN del usuario que está navegando.
 *
 * Usa la Publishable key, así que todo lo que devuelva pasa por las
 * reglas de seguridad de la base de datos. Es el cliente correcto
 * para leer datos "como Juan Miguel" o "como Conchita".
 */
export async function clienteSesion() {
  const almacen = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
    {
      cookies: {
        getAll() {
          return almacen.getAll()
        },
        setAll(lista) {
          try {
            lista.forEach(({ name, value, options }) =>
              almacen.set(name, value, options)
            )
          } catch {
            // Llamado desde un componente de servidor: el middleware
            // ya se encarga de refrescar la sesión.
          }
        },
      },
    }
  )
}
