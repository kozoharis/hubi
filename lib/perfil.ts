import type { SupabaseClient } from '@supabase/supabase-js'

/*
  Leer el perfil de quien está usando HUBI.

  Parece de más tener esto en un archivo aparte, pero tiene un motivo
  concreto: la foto es un añadido reciente y su columna puede no existir
  todavía en la base de datos. Si se pide en la misma consulta que el
  nombre, un fallo por la foto se lleva por delante TODO el perfil:
  desaparece el nombre de la pantalla y —mucho peor— la aplicación deja
  de saber que Juan Miguel es el dueño del Drive, así que ni siquiera
  puede reconectarlo.

  Pasó de verdad, el 27 de agosto. De ahí las tres reglas de aquí:

  1. Lo accesorio no puede tumbar lo esencial. La foto se pide con el
     resto y, si esa consulta falla, se vuelve a pedir sin ella.

  2. EL NOMBRE NUNCA SE QUEDA VACÍO. Si la base de datos no responde,
     se saca del correo de la sesión, que es de donde salió el día que
     se creó la cuenta. Una pantalla que saluda a nadie —"Buenas
     tardes,"— está rota a la vista de cualquiera, y le hace dudar de
     todo lo demás que hay debajo.

  3. Quien no tenga perfil no es dueño del Drive. Ante la duda, no.
*/

export type Perfil = {
  nombre: string
  es_propietario_drive: boolean
  foto: string | null
}

export async function leerPerfil(
  supabase: SupabaseClient,
  id: string,
  correo?: string | null
): Promise<Perfil> {
  const respaldo: Perfil = {
    nombre: deCorreo(correo),
    es_propietario_drive: false,
    foto: null,
  }

  try {
    const conFoto = await supabase
      .from('perfiles')
      .select('nombre, es_propietario_drive, foto')
      .eq('id', id)
      .maybeSingle()

    if (!conFoto.error && conFoto.data) {
      return completar(conFoto.data as Partial<Perfil>, respaldo)
    }

    const sinFoto = await supabase
      .from('perfiles')
      .select('nombre, es_propietario_drive')
      .eq('id', id)
      .maybeSingle()

    if (!sinFoto.error && sinFoto.data) {
      return completar(sinFoto.data as Partial<Perfil>, respaldo)
    }
  } catch {
    // La base de datos no responde. Se sigue con el respaldo: mejor
    // saludar por el correo que dejar la pantalla a medias.
  }

  return respaldo
}

function completar(datos: Partial<Perfil>, respaldo: Perfil): Perfil {
  const nombre = (datos.nombre ?? '').trim()
  return {
    nombre: nombre || respaldo.nombre,
    es_propietario_drive: datos.es_propietario_drive === true,
    foto: datos.foto ?? null,
  }
}

/** "jmnazco@gmail.com" → "Jmnazco". Feo, pero nunca vacío. */
function deCorreo(correo?: string | null): string {
  const parte = (correo ?? '').split('@')[0].replace(/[._-]+/g, ' ').trim()
  if (!parte) return 'de nuevo'
  return parte.charAt(0).toUpperCase() + parte.slice(1)
}
