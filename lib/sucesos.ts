import { after } from 'next/server'
import { clienteServidor } from '@/lib/supabase/servidor'
import type { Rol } from '@/lib/roles'

/*
  ═══════════════════════════════════════════════════════════════
  QUÉ PASA DE VERDAD
  ═══════════════════════════════════════════════════════════════

  Tres preguntas, y ninguna más:

    · ¿la gente que crea un espacio llega a usarlo?
    · ¿lo usan VARIAS personas o acaba siendo un archivador de uno?
    · ¿vuelven semana tras semana?

  No es un registro de actividad. No es observabilidad. No es
  consumo. Cada una de esas tres cosas, metida aquí, convierte esta
  tabla en un cajón, y un cajón no se puede volver a mirar como
  analítica de producto.

  Por eso NO hay latencia, ni códigos de error, ni tokens, ni modelo,
  ni duración. No es que esté prohibido apuntarlos: es que no hay
  columna donde ponerlos.

  ─────────────────────────────────────────────────────────────
  LO QUE NUNCA ENTRA AQUÍ

  Ni un título, ni un nombre de archivo, ni un importe, ni un
  proveedor, ni un trozo de nota, ni lo que alguien le dictó al
  micrófono. `detalle` admite TRES claves y cada una tiene sus valores
  contados, y eso lo comprueba Postgres con un `check`: si alguien
  intenta colar texto libre dentro de una clave permitida, la fila se
  rechaza.

  Una casa entera podría leerse en un `detalle` que admitiera texto.
  No lo admite.

  ─────────────────────────────────────────────────────────────
  POR QUÉ LA APLICACIÓN NO PUEDE NI LEER ESTA TABLA

  `sql/95` hace `revoke all on sucesos from anon, authenticated`, deja
  la RLS encendida y no escribe ni una política. O sea: con la sesión
  de una persona esta tabla no existe. Se escribe sólo desde el
  servidor con la llave de servicio, que es lo que usa
  `clienteServidor()`.

  Ninguna pantalla puede enseñarla y ningún navegador puede
  inventarse un suceso.

  ─────────────────────────────────────────────────────────────
  POR QUÉ `after()` Y NO «fuego y olvido»

  En serverless, lanzar la escritura sin esperarla pierde eventos: la
  función puede terminar —y el runtime cortarla— antes de que la
  escritura llegue. `after()` es el mecanismo oficial de Next para
  trabajo posterior a la respuesta: la respuesta sale ya, y la
  invocación sigue viva hasta que esto termina.

  Tres propiedades, y son las tres que hacen falta:

    1 · quien usa MAPPEL no espera por la analítica;
    2 · el suceso no se pierde;
    3 · un fallo aquí NO puede hacer fallar una acción. `apunta()` no
        lanza nunca. Como mucho escribe en el log del servidor.

  ─────────────────────────────────────────────────────────────
  Y DÓNDE SE PONE LA LLAMADA

  SIEMPRE después de que la acción principal haya salido bien. Nunca
  antes, nunca en paralelo. Un suceso apuntado de algo que después
  falló es peor que no tener el suceso: falsea la métrica hacia
  arriba, y una métrica optimista es la única clase de métrica que no
  sirve para decidir nada.
*/

/*
  LA LISTA CERRADA.

  Para meter un tipo nuevo hay que escribir una migración Y que
  alguien la lea. Ésa es toda la defensa contra que esto degenere.

  Tiene que decir EXACTAMENTE lo mismo que el `check` de `sql/95`.
  `pruebas/sucesos.ts` compara los dos archivos y falla si se separan.
*/
export const SUCESOS = [
  'cuenta_creada',
  'espacio_creado',
  'invitacion_aceptada',
  'documento_guardado',
  'tarea_creada',
  'tarea_hecha',
  'nota_creada',
  'compra_apuntada',
  'voz_usada',
  'papel_leido_por_ia',
  'papel_no_entendido',
] as const

export type Suceso = (typeof SUCESOS)[number]

/** Desde dónde se está usando MAPPEL. */
export const ORIGENES = ['movil', 'escritorio', 'cocina'] as const
export type Origen = (typeof ORIGENES)[number]

/** Cómo ha entrado: hablando, fotografiando o escribiendo. */
export const VIAS = ['voz', 'foto', 'escrito'] as const
export type Via = (typeof VIAS)[number]

/*
  El único suceso que puede no tener espacio, porque ocurre antes de
  que exista ninguno.
*/
const SIN_ESPACIO: Suceso = 'cuenta_creada'

type Apunte = {
  /*
    EL ESPACIO SE DICE, NO SE ADIVINA.

    Obligatorio y explícito, igual que en `accesoDrive(hogarId)` y por
    el mismo motivo: así el compilador señala todos los sitios desde
    los que se llama. Nunca sale de `casa_activa` ni de ningún estado
    global.

    `null` sólo vale para `cuenta_creada`, y además lo comprueba un
    `check` de la base de datos.
  */
  hogar: string | null
  /** Quién lo ha hecho. `null` si todavía no hay perfil. */
  perfil?: string | null
  origen?: Origen
  via?: Via
  rol?: Rol
}

/**
 * Apunta que algo ha pasado. No espera, no lanza y no puede hacer
 * fallar lo que la llamó.
 *
 * Se pone SIEMPRE después de que la acción principal haya salido bien.
 */
export function apunta(tipo: Suceso, donde: Apunte): void {
  try {
    after(() => guardar(tipo, donde))
  } catch (e) {
    /*
      `after()` fuera de una petición lanza. No debería ocurrir —esto
      sólo se llama desde rutas— pero si ocurre, que se pierda el
      suceso y no la acción.
    */
    console.error('[MAPPEL] No se ha podido programar el suceso:', e)
  }
}

async function guardar(tipo: Suceso, donde: Apunte): Promise<void> {
  try {
    if (!donde.hogar && tipo !== SIN_ESPACIO) {
      /* Lo rechazaría la base de datos igual. Se corta antes para que
         el motivo salga escrito en el log en vez de un 23514 pelado. */
      console.error(`[MAPPEL] Suceso "${tipo}" sin espacio. No se apunta.`)
      return
    }

    /*
      `detalle` SE CONSTRUYE AQUÍ, clave a clave.

      No se copia un objeto que venga de fuera: copiándolo, cualquier
      propiedad de más viajaría hasta Postgres y allí la rechazaría el
      `check` —que es lo correcto, pero perdiendo también el suceso
      bueno—. Construido así, las claves de más no existen.
    */
    const detalle: Record<string, string> = {}
    if (donde.origen) detalle.origen = donde.origen
    if (donde.via) detalle.via = donde.via
    if (donde.rol) detalle.rol = donde.rol

    const supa = clienteServidor()
    const { error } = await supa.from('sucesos').insert({
      tipo,
      hogar_id: donde.hogar,
      perfil_id: donde.perfil ?? null,
      detalle,
    })

    if (error) console.error('[MAPPEL] No se ha podido apuntar el suceso:', error)
  } catch (e) {
    console.error('[MAPPEL] No se ha podido apuntar el suceso:', e)
  }
}
