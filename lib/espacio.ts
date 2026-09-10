import { cache } from 'react'
import { headers } from 'next/headers'
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

  Y así fue: cuando llegó la ruta se cambió UN archivo, éste.

  ─────────────────────────────────────────────────────────────
  CÓMO ENTRA LA RUTA

  No por parámetro. Si `elEspacio()` recibiera el espacio, habría que
  pasárselo desde cada pantalla hasta cada función de `lib/`, y eso son
  otra vez cincuenta y cinco archivos.

  Entra por una cabecera que pone `proxy.ts` leyendo la propia
  dirección. Con dos cautelas:

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

    /*
      ── PRIMERO, LA RUTA ──

      La cabecera la pone `proxy.ts` leyendo la dirección, y borra
      cualquiera que venga de fuera. Aquí solo puede llegar la suya.

      Pero SE COMPRUEBA IGUAL. No por desconfiar del proxy: porque si
      un día alguien cambia el `matcher` y alguna ruta deja de pasar
      por él, el fallo no puede ser «entras donde no debes». Con la
      comprobación, lo peor que pasa es que no entres.

      Y `aceptado_en` importa: que te ofrezcan una casa no te mete
      dentro.
    */
    const puesto = (await headers()).get('x-espacio')

    if (puesto) {
      const { data: dentro } = await supabase
        .from('miembros')
        .select('hogar_id')
        .eq('perfil_id', user.id)
        .eq('hogar_id', puesto)
        .not('aceptado_en', 'is', null)
        .maybeSingle()

      /*
        Si la dirección nombra un espacio que no es tuyo, esto devuelve
        `null` y la pantalla te manda a empezar. NO se cae de vuelta a
        `casa_activa`: enseñarte tu casa cuando has pedido otra sería
        justo la confusión que estamos quitando.
      */
      return (dentro?.hogar_id as string | null) ?? null
    }

    /* Sin espacio en la dirección: la casa de siempre. Es lo que hace
       que todas las direcciones de hoy sigan funcionando igual. */
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
