import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente de Supabase para el NAVEGADOR.
 *
 * Usa la Publishable key, que por sí sola no da acceso a nada:
 * todo lo filtran las reglas de seguridad de la base de datos.
 */
export function clienteNavegador() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publica = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publica) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local'
    )
  }

  return createBrowserClient(url, publica)
}
