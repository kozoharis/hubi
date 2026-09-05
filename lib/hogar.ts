import type { SupabaseClient } from '@supabase/supabase-js'

/*
  ═══════════════════════════════════════════════════════════════
  DE QUÉ CASA ES QUIEN ESTÁ ENTRANDO
  ═══════════════════════════════════════════════════════════════

  Esta pregunta se hacía suelta en cada ruta que la necesitaba:

      const { data } = await supabase
        .from('miembros').select('hogar_id').eq('perfil_id', user.id)...

  Copiada tres veces ya, y a punto de copiarse en diez más. Copiar una
  consulta de seguridad es exactamente como se cuelan los fallos que no
  se ven: basta con que una copia se escriba con `.limit(1)` sin
  `.eq(...)`, o que alguien olvide una, para que un documento acabe en
  la casa de al lado. Se escribe UNA vez.

  ─────────────────────────────────────────────────────────────
  SE LEE CON LA SESIÓN, NUNCA CON LA CLAVE DE SERVIDOR

  La clave de servidor se salta las políticas de la base de datos, así
  que con ella esta consulta devolvería la fila de cualquiera. Con la
  sesión, la propia base de datos garantiza que solo se ve lo de uno.
*/

/*
  Lo que se le dice a alguien que ha entrado pero no está en ninguna
  casa. Pasa mientras no exista la pantalla de alta (bomba nº 3), y
  pasará siempre que una invitación quede a medias. Se escribe una vez
  para que en todas las pantallas diga lo mismo y no parezca una
  avería distinta cada vez.
*/
export const SIN_CASA =
  'Tu cuenta todavía no está en ninguna casa, así que no hay dónde guardar esto. Avisa a quien te invitó.'

/** El hogar de esta persona, o null si todavía no tiene ninguno. */
export async function miHogar(
  supabase: SupabaseClient,
  perfilId: string
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('miembros')
      .select('hogar_id')
      .eq('perfil_id', perfilId)
      .order('unido_en')
      .limit(1)
      .maybeSingle()

    return (data?.hogar_id as string | null) ?? null
  } catch {
    return null
  }
}

/*
  ─────────────────────────────────────────────────────────────
  LOS DE SU CASA, LEÍDOS CON LA CLAVE DE SERVIDOR

  Hay tres sitios que trabajan sin sesión —los avisos al móvil y la
  tarea diaria que los manda— y ésos NO tienen las políticas de la base
  de datos protegiéndolos: la clave de servidor se las salta. Ahí
  «todos los perfiles» significa literalmente todos los de HUBI.

  Con una familia eso era correcto. Con dos, un «recoger la medicación»
  sin persona asignada le habría sonado el teléfono a Juan Miguel, a
  Conchita y a una familia que no conocen de nada.

  Se pasa el hogar y se leen solo los suyos.
*/
export async function losDeLaCasa(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  hogarId: string
): Promise<string[]> {
  const { data } = await admin.from('miembros').select('perfil_id').eq('hogar_id', hogarId)
  return (data ?? []).map((m: { perfil_id: string }) => m.perfil_id)
}

/** El hogar de alguien, leído con la clave de servidor (sin sesión). */
export async function hogarDe(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  perfilId: string
): Promise<string | null> {
  const { data } = await admin
    .from('miembros')
    .select('hogar_id')
    .eq('perfil_id', perfilId)
    .order('unido_en')
    .limit(1)
    .maybeSingle()

  return (data?.hogar_id as string | null) ?? null
}

/*
  ─────────────────────────────────────────────────────────────
  ¿MANDA EN SU CASA?

  Quien conecta Google es el dueño del Drive donde se guarda todo. En
  la casa de Juan Miguel y Conchita eso lo decidía una casilla en
  `perfiles`:

      es_propietario_drive

  Que es de la persona, no de la casa. Con una familia daba igual; con
  dos deja fuera al fundador de la segunda —esa casilla no la tiene
  nadie más— y por tanto NADIE en la casa nueva podría conectar su
  Drive. Es media bomba nº 2.

  Lo que manda ahora es el papel dentro de SU hogar. Y la casilla vieja
  se sigue mirando como respaldo: si un día la fila de `miembros` se
  quedara sin papel, Juan Miguel no se queda fuera de su propio Drive.
*/
export async function mandaEnSuCasa(
  supabase: SupabaseClient,
  perfilId: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('miembros')
      .select('papel')
      .eq('perfil_id', perfilId)
      .order('unido_en')
      .limit(1)
      .maybeSingle()

    if (data?.papel === 'propietario') return true
  } catch {
    /* Sin tabla de miembros todavía: decide la casilla de siempre. */
  }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('es_propietario_drive')
    .eq('id', perfilId)
    .maybeSingle()

  return perfil?.es_propietario_drive === true
}
