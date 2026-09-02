import { createClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase para el SERVIDOR.
 *
 * Usa la Secret key, que salta todas las reglas de seguridad.
 * Este archivo NUNCA debe importarse desde un componente de navegador.
 */
export function clienteServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secreta = process.env.SUPABASE_SECRET_KEY

  if (!url || !secreta) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local'
    )
  }

  return createClient(url, secreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
