'use client'

/*
  Que HUBI hable.

  El navegador lleva un sintetizador de voz dentro. No hay que instalar
  nada ni pagar nada.

  DÓNDE SE USA Y DÓNDE NO, que es lo importante:

  Habla cuando ha TERMINADO de escuchar — al responder una pregunta de
  las cuentas, y al confirmar que ha guardado. Son los dos momentos en
  los que uno está mirando para otro lado: has preguntado cuánto se ha
  gastado en agua mientras haces otra cosa, y la respuesta te llega al
  oído sin tener que volver a la pantalla.

  NO habla mientras escucha. Con el micrófono abierto, cualquier cosa
  que diga por el altavoz se la oye a sí mismo y la transcribe como si
  la hubieras dicho tú. Una frase tuya acabaría mezclada con una suya y
  nadie entendería de dónde salió. Por eso el "¿algo más?" es solo
  visual: pedir que hable justo ahí es pedir el único momento en que no
  puede.

  Y si el teléfono no sabe hablar, no pasa nada: en la pantalla está
  todo escrito igual. Esto añade, nunca sustituye.
*/

export function puedeHablar(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function decir(frase: string) {
  if (!puedeHablar() || !frase.trim()) return

  try {
    // Si estaba diciendo algo de antes, se calla: lo último manda.
    window.speechSynthesis.cancel()

    const voz = new SpeechSynthesisUtterance(frase)
    voz.lang = 'es-ES'
    // Un pelín más despacio de lo normal. No es una locución: es
    // alguien diciéndote una cosa desde la cocina.
    voz.rate = 0.95
    voz.pitch = 1

    window.speechSynthesis.speak(voz)
  } catch {
    // Que HUBI no hable nunca es motivo para romper nada.
  }
}

export function callar() {
  if (!puedeHablar()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* da igual */
  }
}
