/*
  ═══════════════════════════════════════════════════════════════
  LOS COLORES DE LA VOZ
  ═══════════════════════════════════════════════════════════════

  HUBI tiene dos lenguajes visuales y conviene no confundirlos.

  **El papel.** Crema, tarjetas blancas, tinta casi negra, un color por
  ámbito usado con cuentagotas. Es todo lo demás: la agenda, la compra,
  los papeles, las cuentas. Es una casa ordenada.

  **La voz.** Azul de noche `#01071B` y un degradado de turquesa a
  azul. Es la parte que ESCUCHA y ENTIENDE, y se distingue a propósito:
  cuando algo se pone de este color, HUBI no está enseñando lo que hay
  guardado — está interpretando lo que acabas de decir.

  Haris, viéndolo en la pared: *«usa los colores de la voz (la parte
  inteligente) de HUBI como en el móvil… queda muy bien»*.

  ─────────────────────────────────────────────────────────────
  POR QUÉ ESTO ES UN ARCHIVO Y NO UNA CADENA COPIADA

  Porque estaba copiada a mano en seis sitios: la pantalla de Hablar,
  el arranque, la barra de abajo, el raíl del escritorio, la caja de
  escribir y la puerta de entrar. Seis copias del mismo degradado es
  una identidad que se deshace sola en cuanto alguien retoque una.

  Lo que se añada a partir de ahora tira de aquí.
*/

/** El azul de noche. El fondo de todo lo que escucha. */
export const NOCHE = '#01071B'

/** Turquesa → azul. La marca de que HUBI está entendiendo algo. */
export const DEGRADADO = 'linear-gradient(140deg,#2DD4BF,#14B8A6 45%,#3B82F6)'

/** El turquesa suelto, para una raya, un punto o un icono. */
export const TURQUESA = '#2DD4BF'

/** El azul del final del degradado. */
export const AZUL = '#3B82F6'

/*
  Y el degradado al revés, para las barras que crecen de izquierda a
  derecha: con el de 140 grados, una barra corta sale toda turquesa y
  no se distingue de la larga.
*/
export const DEGRADADO_TUMBADO = `linear-gradient(90deg,${TURQUESA},#14B8A6 45%,${AZUL})`
