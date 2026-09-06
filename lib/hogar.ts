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

/*
  ─────────────────────────────────────────────────────────────
  ¿QUÉ CASA ESTÁ MIRANDO?

  Esto tiene que contestar EXACTAMENTE lo mismo que la función
  `mi_hogar()` de la base de datos. Si las dos discrepan, la pantalla
  enseña una casa y las políticas dejan ver otra: se vería una carpeta
  vacía sin explicación, o —peor— un botón de guardar que archiva en el
  sitio equivocado.

  La regla, en las dos:

    1. La casa que ha elegido mirar (`perfiles.casa_activa`), siempre
       que siga siendo miembro ACEPTADO de ella.
    2. Si no ha elegido, o eligió una de la que ya no forma parte: la
       primera casa aceptada, por antigüedad.

  Las invitaciones sin contestar (`aceptado_en is null`) no cuentan:
  que alguien te ofrezca su casa no te mete dentro.

  ─────────────────────────────────────────────────────────────
  Y VA EN DOS INTENTOS

  `aceptado_en` y `casa_activa` son columnas del SQL 34. Pedir una
  columna que no existe no devuelve «esa columna no existe»: Postgres
  rechaza la consulta ENTERA, y esta consulta la hacen casi todas las
  pantallas. Si el SQL no se ha ejecutado todavía, HUBI se queda sin
  saber de quién es nada.

  Así que si el primer intento falla, se pregunta como antes.
*/
export async function miHogar(
  supabase: SupabaseClient,
  perfilId: string
): Promise<string | null> {
  try {
    const { data: filas, error } = await supabase
      .from('miembros')
      .select('hogar_id, aceptado_en')
      .eq('perfil_id', perfilId)
      .order('unido_en')

    if (!error && filas) {
      const aceptadas = filas.filter((m: { aceptado_en: string | null }) => m.aceptado_en)
      if (aceptadas.length === 0) return null

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('casa_activa')
        .eq('id', perfilId)
        .maybeSingle()

      const elegida = (perfil?.casa_activa as string | null) ?? null
      if (elegida && aceptadas.some((m: { hogar_id: string }) => m.hogar_id === elegida)) {
        return elegida
      }

      return (aceptadas[0]?.hogar_id as string | null) ?? null
    }
  } catch {
    /* Cae al modo de antes. */
  }

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
  /* Los que están DENTRO. A quien todavía no ha contestado a la
     invitación no se le manda un aviso de una casa en la que no ha
     entrado. */
  const { data: dentro, error } = await admin
    .from('miembros')
    .select('perfil_id, aceptado_en')
    .eq('hogar_id', hogarId)

  if (!error && dentro) {
    return dentro
      .filter((m: { aceptado_en: string | null }) => m.aceptado_en)
      .map((m: { perfil_id: string }) => m.perfil_id)
  }

  const { data } = await admin.from('miembros').select('perfil_id').eq('hogar_id', hogarId)
  return (data ?? []).map((m: { perfil_id: string }) => m.perfil_id)
}

/*
  ─────────────────────────────────────────────────────────────
  QUIÉN MANDA EN ESTA CASA, POR SU NOMBRE

  Hace falta para una frase que estaba escrita a mano: «Guardar
  documentos estará disponible cuando Juan Miguel conecte el Drive de
  la familia». En la casa de Juan Miguel era verdad. En cualquier otra
  es el nombre de un desconocido, y quien la lea no va a entender nada.
*/
export async function quienManda(
  supabase: SupabaseClient,
  hogarId: string
): Promise<string | null> {
  try {
    const { data: jefe } = await supabase
      .from('miembros')
      .select('perfil_id')
      .eq('hogar_id', hogarId)
      .eq('papel', 'propietario')
      .limit(1)
      .maybeSingle()

    if (!jefe?.perfil_id) return null

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('nombre')
      .eq('id', jefe.perfil_id)
      .maybeSingle()

    const nombre = (perfil?.nombre as string | null) ?? null
    return nombre ? nombre.split(' ')[0] : null
  } catch {
    return null
  }
}

/** El hogar de alguien, leído con la clave de servidor (sin sesión). */
export async function hogarDe(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  perfilId: string
): Promise<string | null> {
  /* Misma regla que `miHogar`, y por el mismo motivo: si el aviso se
     manda a la casa equivocada, le suena el teléfono a gente que no
     tiene nada que ver. En dos intentos, porque las columnas son del
     SQL 34. */
  try {
    const { data: filas, error } = await admin
      .from('miembros')
      .select('hogar_id, aceptado_en')
      .eq('perfil_id', perfilId)
      .order('unido_en')

    if (!error && filas) {
      const aceptadas = filas.filter((m: { aceptado_en: string | null }) => m.aceptado_en)
      if (aceptadas.length === 0) return null

      const { data: perfil } = await admin
        .from('perfiles')
        .select('casa_activa')
        .eq('id', perfilId)
        .maybeSingle()

      const elegida = (perfil?.casa_activa as string | null) ?? null
      if (elegida && aceptadas.some((m: { hogar_id: string }) => m.hogar_id === elegida)) {
        return elegida
      }

      return (aceptadas[0]?.hogar_id as string | null) ?? null
    }
  } catch {
    /* Cae al modo de antes. */
  }

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
  perfilId: string,
  hogarId?: string | null
): Promise<boolean> {
  try {
    /*
      En LA CASA QUE ESTÁ MIRANDO, no en la primera que tenga.

      Quien tiene su propia casa y además ayuda en la de sus padres
      manda en la suya y no en la de ellos. Preguntando por la primera
      fila, mandaría en las dos: vería el botón de conectar el Drive de
      una casa que no es suya, y podría invitar gente a ella.
    */
    const casa = hogarId ?? (await miHogar(supabase, perfilId))
    if (!casa) return false

    const { data } = await supabase
      .from('miembros')
      .select('papel')
      .eq('perfil_id', perfilId)
      .eq('hogar_id', casa)
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
