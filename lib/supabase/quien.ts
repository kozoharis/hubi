import type { SupabaseClient } from '@supabase/supabase-js'

/*
  Quién está navegando.

  Antes esto era `supabase.auth.getUser()`, y ahí estaba escondida la
  mayor parte de la lentitud: `getUser()` NO lee la sesión de la
  cookie, sino que pregunta al servidor de Supabase «¿este usuario es
  de verdad?» — una ida y vuelta por internet.

  Y se hacía DOS veces por pantalla: una en el proxy, que se ejecuta
  antes de cada página, y otra dentro de la propia página. Dos viajes
  a Europa antes de leer un solo dato.

  `getClaims()` hace lo mismo pero comprobando la firma del token con
  la llave pública de Supabase, que se guarda en memoria. Si el
  proyecto usa llaves asimétricas, la comprobación es local: cero
  viajes. Y si todavía no las usa, se comporta igual que antes — así
  que este cambio nunca empeora nada, solo mejora en cuanto se activan
  las llaves en Supabase.

  Sigue siendo seguro: se verifica la firma. No es leer la cookie y
  fiarse.
*/

export type Entra = { id: string; email: string | undefined }

export async function quien(
  supabase: SupabaseClient
): Promise<Entra | null> {
  try {
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims?.sub) return null

    return {
      id: data.claims.sub as string,
      email: data.claims.email as string | undefined,
    }
  } catch {
    return null
  }
}
