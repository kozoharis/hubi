/*
  ═══════════════════════════════════════════════════════════════
  LLAMAR AL API SIN SALIRSE DEL ESPACIO
  ═══════════════════════════════════════════════════════════════

  Una función de tres líneas que evita el peor fallo posible del paso
  3: leer de un espacio y guardar en otro.

  ─────────────────────────────────────────────────────────────
  EL PROBLEMA

  Cuando el espacio vive en la dirección —`/e/<espacio>/papeles`— la
  pantalla sabe de quién es lo que enseña. Pero el botón de guardar no
  llama a la pantalla: llama al API, y lo hacía así:

      fetch('/api/documentos', { method: 'POST', ... })

  Esa dirección no lleva espacio. El servidor tendría que adivinarlo, y
  volvería a adivinarlo como siempre: con `casa_activa`, el dato global.

  O sea: estarías mirando los papeles del cliente y guardando en tu
  casa. Sin error, sin aviso. Exactamente la avería que este trabajo
  entero existe para cerrar, pero peor — porque ahora la pantalla te
  estaría diciendo que estás en otro sitio.

  ─────────────────────────────────────────────────────────────
  LA SOLUCIÓN

      fetch(api('/api/documentos'), { ... })

  `api()` mira la dirección de la ventana. Si estás dentro de un
  espacio, antepone su trozo; si no, devuelve el camino tal cual.

  ─────────────────────────────────────────────────────────────
  POR QUÉ `window.location` Y NO UN HOOK DE REACT

  Porque un hook obliga a que quien llama sea un componente, y esto lo
  llaman también funciones sueltas, manejadores de eventos y algún
  `catch`. Una regla que solo se puede cumplir en la mitad de los
  sitios no es una regla.

  Y porque la dirección de la ventana es LA VERDAD: el proxy reescribe
  por dentro pero no toca lo que se ve en la barra, así que ahí sigue
  estando el espacio en el que la persona cree estar. Que es justo lo
  que tiene que coincidir con dónde se guarda.

  ─────────────────────────────────────────────────────────────
  MIENTRAS NO HAYA DIRECCIONES CON ESPACIO

  Devuelve el camino sin tocar, y todo se comporta como hoy. Esto se
  puede desplegar antes que nada de lo demás sin que cambie nada, que
  es como se han hecho los tres pasos.
*/

/** El trozo `/e/<espacio>` con el que empieza la dirección, si lo hay. */
export function elTrozoDelEspacio(camino: string): string | null {
  const m = camino.match(/^\/e\/([0-9a-fA-F-]{36})(?=\/|$)/)
  return m ? m[0] : null
}

/**
 * El camino del API, con el espacio delante si estamos dentro de uno.
 *
 * `npm run probar-espacio` comprueba que no queda ningún `fetch` a
 * `/api/...` escrito a pelo.
 */
export function api(camino: string): string {
  if (typeof window === 'undefined') return camino
  const trozo = elTrozoDelEspacio(window.location.pathname)
  return trozo ? trozo + camino : camino
}

/**
 * La puerta de un espacio: su Inicio.
 *
 * Es lo que hay que abrir para entrar en uno, y lo usan los dos sitios
 * desde los que se cambia de espacio: el selector y el escritorio.
 *
 * Va al Inicio y no a la pantalla donde estabas, a propósito. Media
 * aplicación tiene direcciones con un identificador dentro
 * —`/documentos/3f2a…`, `/seccion/9b1c…`— y ese identificador es del
 * espacio del que vienes. Llevártelo al nuevo sería enseñarte un
 * «esto ya no está» justo después de pedir un cambio que sí ha
 * funcionado.
 */
export function laPuertaDe(espacio: string): string {
  return `/e/${espacio}`
}
