import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { miHogar } from './hogar'

/*
  ═══════════════════════════════════════════════════════════════
  EN QUÉ ESPACIO ESTOY
  ═══════════════════════════════════════════════════════════════

  Una función. Una respuesta. Y es LA MISMA para las doscientas
  consultas de HUBI.

  ─────────────────────────────────────────────────────────────
  POR QUÉ NO SE LLAMA `miHogar` A SECAS

  `miHogar()` contesta «la casa que estás mirando», y lo averigua
  leyendo `perfiles.casa_activa`: un dato GLOBAL de la persona, el
  mismo en todas las pestañas.

  Eso funciona con una casa. Con dos —el gestor con quince clientes,
  o quien tiene su casa y ayuda en la de sus padres— es un fallo
  esperando: abres tu casa en una pestaña, el cliente en otra,
  guardas un papel, y va a parar a la que cambiaste la última vez.
  No da error. Archiva en el sitio equivocado.

  El arreglo acordado es sacar el espacio del estado global y llevarlo
  a la RUTA: `/e/<espacio>/papeles`. Entonces cada pestaña sabe dónde
  está porque lo pone en su dirección, y dos pestañas no se pisan
  jamás.

  ─────────────────────────────────────────────────────────────
  Y POR QUÉ SE ESCRIBE HOY, ANTES DE QUE EXISTAN ESAS RUTAS

  Porque si las doscientas consultas se arreglan llamando a
  `miHogar()`, el día que llegue la ruta hay que volver a tocar
  cincuenta y cinco archivos. Llamando a `elEspacio()` hay que tocar
  UNO: éste.

  Hoy contesta lo mismo que siempre. Es un cambio sin efecto —a
  propósito—: lo que instala es la costura por donde entrará la ruta.

  ─────────────────────────────────────────────────────────────
  CÓMO ENTRARÁ LA RUTA, PARA QUE CONSTE

  No por parámetro. Si `elEspacio()` recibiera el espacio, habría que
  pasárselo desde cada pantalla hasta cada función de `lib/`, y eso son
  otra vez cincuenta y cinco archivos.

  Entrará por una cabecera que pondrá `proxy.ts` leyendo la propia
  dirección. Con dos cautelas escritas desde ya:

    · La cabecera que venga de fuera SE TIRA. La pone el proxy a
      partir de la URL, nunca el navegador. Si no se tirara, cualquiera
      podría mandarla a mano y elegir espacio.

    · Y aunque se colara, no abre nada: la base de datos seguirá
      preguntando `soy_de(<ese espacio>)`. La cabecera elige entre TUS
      espacios; no te mete en uno ajeno.

  ─────────────────────────────────────────────────────────────
  UNA SOLA VEZ POR PETICIÓN

  Con `cache()` de React, las veinte llamadas de una pantalla son una
  sola consulta. Sin eso, arreglar el espacio costaría veinte viajes a
  la base de datos por página, y el arreglo se notaría —mal— en el
  móvil de Conchita.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

async function averiguar(supabase: Cliente): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (!user) return null

    /* Aquí entrará la ruta. Mientras no exista, la casa de siempre. */
    return await miHogar(supabase, user.id)
  } catch {
    return null
  }
}

/**
 * El espacio en el que está ocurriendo esta petición, o `null` si quien
 * entra no pertenece a ninguno.
 *
 * Toda consulta a una tabla de un espacio debe filtrar por lo que
 * devuelva esto. `npm run probar-espacio` comprueba que no se olvida
 * ninguna.
 */
export const elEspacio = cache(averiguar)

/*
  ─────────────────────────────────────────────────────────────
  CUANDO NO HAY ESPACIO

  Alguien que ha entrado pero no está en ninguna casa: una invitación
  a medias, o una cuenta recién creada.

  Filtrar por `null` en Supabase no devuelve cero filas —devuelve
  `hogar_id is null`, que casa con nada, pero por accidente—. Se
  escribe un valor imposible para que la intención esté a la vista y no
  dependa de cómo traduzca la biblioteca un nulo.
*/
export const NINGUNO = '00000000-0000-0000-0000-000000000000'

/** El espacio, o un valor que no casa con ninguna fila. Para filtrar. */
export async function elEspacioO(supabase: Cliente): Promise<string> {
  return (await elEspacio(supabase)) ?? NINGUNO
}
