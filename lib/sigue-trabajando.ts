/*
  ═══════════════════════════════════════════════════════════════
  EL BOTÓN QUE SIGUE TRABAJANDO
  ═══════════════════════════════════════════════════════════════

  Haris: *«cuando tocas un botón parece que no reaccionan y a veces le
  tienes que dar como dos veces… les pasa a todos»*.

  ── LO QUE YA ESTABA BIEN ──

  El toque se ve: desde hace semanas TODO botón se hunde un pelo al
  pulsarlo, sin que nadie tenga que acordarse de ponerlo, y con
  `touch-action: manipulation` para que no haya que esperar por si
  viene un segundo toque. Eso está resuelto.

  Y las listas que se tocan a diario —la compra, las rutinas, lo del
  día, el tablón— ya se pintan ANTES de que el servidor conteste.

  ── LO QUE FALTABA ──

  El hueco está en medio: el dedo se va, el botón vuelve a su sitio, y
  **a partir de ahí la pantalla no dice nada** durante el medio segundo
  largo que tarda el servidor. Ese silencio es el que se lee como «no
  ha hecho nada», y la reacción natural de cualquiera es volver a dar.

  Para los ENLACES esto ya estaba resuelto en `en-camino.tsx`: la
  tarjeta que se ha tocado se queda con un velo encima mientras el
  enlace está en marcha. Se lee como que sigue pulsada, que es
  exactamente lo que está pasando.

  Esto es lo mismo para los BOTONES, que son los que hablan con el
  servidor. Mismo velo, mismo retraso de 140 ms, ningún símbolo nuevo
  que aprender.

  ─────────────────────────────────────────────────────────────
  POR QUÉ EN UN SOLO SITIO Y NO EN CADA BOTÓN

  Porque son cuarenta y seis pantallas. Hacerlo botón a botón
  significa cuarenta y seis maneras distintas de hacer lo mismo, y que
  el que se ponga el mes que viene no lo lleve. La regla de la casa
  desde el principio: **la complejidad pertenece al sistema, no al
  usuario** — y aquí «el usuario» también es quien escribe la pantalla
  siguiente.

  ─────────────────────────────────────────────────────────────
  ⚠️  CÓMO SABE QUÉ BOTÓN ES · Y POR QUÉ ES UNA APUESTA

  Esto hay que decirlo claro porque es lo único de este archivo que no
  es exacto.

  No hay manera de que el navegador diga «esta petición la ha
  provocado este botón»: nadie se lo cuenta a nadie. Así que se deduce
  por el tiempo:

      1. Se apunta el último botón que se ha tocado.
      2. Si sale una petición dentro de los 300 ms siguientes, se da
         por suya.
      3. Y si sale otra dentro de los 300 ms siguientes al final de la
         anterior, también — porque así es como encadenan estas
         pantallas: primero el `fetch` que guarda, y después el
         refresco que vuelve a pedir la pantalla.
      4. Cuando no queda ninguna en vuelo, se le quita el velo.

  Lo que puede fallar, y lo que pasa si falla:

      · Una petición de otra cosa que caiga justo en esa ventana haría
        que el velo durara un poco de más. Se ve como que tarda; no
        rompe nada.
      · Un botón que no dispare ninguna petición no se vela. Se queda
        como estaba hoy, que es lo que hay.

  Ninguno de los dos casos toca los datos, bloquea el dedo ni impide
  pulsar otra cosa: el velo NO recibe toques (`pointer-events: none`) y
  se cae solo a los diez segundos pase lo que pase. Es una apuesta
  sobre lo que se ENSEÑA, nunca sobre lo que se hace.

  La alternativa exacta —pasarle a cada `fetch` cuál es su botón—
  obliga a tocar las cuarenta y seis pantallas y a acordarse en la
  cuarenta y siete. Esto acierta casi siempre y no hay nada que
  recordar.
*/

/** Desde el toque (o desde que acaba lo anterior) para dar una petición por suya. */
const CERCA = 300

/** Nada se queda velado más de esto, pase lo que pase. */
const TOPE = 10_000

type Ventana = Window & { __mappelSigueTrabajando?: boolean }

/**
 * Enciende el velo para toda la aplicación. Devuelve la función que
 * lo apaga y lo deja todo como estaba.
 */
export function montarSigueTrabajando(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {}
  }

  const w = window as Ventana
  /* Dos veces no: en desarrollo React monta, desmonta y vuelve a
     montar, y sin esto el segundo montaje envolvería el `fetch` ya
     envuelto — y entonces el original no vuelve nunca. */
  if (w.__mappelSigueTrabajando) return () => {}
  w.__mappelSigueTrabajando = true

  let elemento: HTMLElement | null = null
  let tocadoEn = 0
  let acabadoEn = 0
  let enVuelo = 0
  let corte: ReturnType<typeof setTimeout> | null = null
  let respiro: ReturnType<typeof setTimeout> | null = null

  /* Si el botón no tenía posición propia hay que dársela para que el
     velo se coloque encima — y hay que quitársela después. Con
     `position` ya puesta no se toca: hay botones que son `absolute`
     encima de otra cosa, y cambiarlos los movería de sitio. */
  let leDiPosicion = false

  function velar(el: HTMLElement) {
    if (elemento === el && el.hasAttribute('data-trabajando')) return
    quitarVelo()
    elemento = el

    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative'
      leDiPosicion = true
    }
    el.setAttribute('data-trabajando', '')
  }

  function quitarVelo() {
    if (!elemento) return
    elemento.removeAttribute('data-trabajando')
    if (leDiPosicion) elemento.style.position = ''
    leDiPosicion = false
    elemento = null
  }

  function soltarDespues() {
    if (respiro) clearTimeout(respiro)
    /* Un respiro antes de quitarlo: entre el `fetch` que guarda y el
       refresco que viene detrás hay un hueco de unos milisegundos, y
       sin esto el velo parpadearía en medio. */
    respiro = setTimeout(() => {
      if (enVuelo === 0) quitarVelo()
    }, CERCA)
  }

  function alTocar(e: Event) {
    const destino = e.target as HTMLElement | null
    const boton = destino?.closest?.('button,[role="button"]') as HTMLElement | null
    if (!boton) return
    /* Un botón nuevo cancela lo del anterior: lo que importa es lo
       último que ha tocado el dedo. */
    if (boton !== elemento) quitarVelo()
    elemento = boton
    tocadoEn = Date.now()
    acabadoEn = 0
  }

  document.addEventListener('pointerdown', alTocar, true)

  const original = window.fetch

  window.fetch = function envuelto(
    this: unknown,
    ...args: Parameters<typeof fetch>
  ): Promise<Response> {
    const ahora = Date.now()
    const suyo =
      elemento &&
      elemento.isConnected &&
      (ahora - tocadoEn < CERCA || (acabadoEn > 0 && ahora - acabadoEn < CERCA))
        ? elemento
        : null

    if (!suyo) return original.apply(this, args)

    enVuelo++
    velar(suyo)

    if (respiro) {
      clearTimeout(respiro)
      respiro = null
    }
    if (corte) clearTimeout(corte)
    corte = setTimeout(() => {
      enVuelo = 0
      quitarVelo()
    }, TOPE)

    return original.apply(this, args).finally(() => {
      enVuelo = Math.max(0, enVuelo - 1)
      acabadoEn = Date.now()
      if (enVuelo === 0) soltarDespues()
    })
  } as typeof fetch

  return () => {
    document.removeEventListener('pointerdown', alTocar, true)
    window.fetch = original
    if (corte) clearTimeout(corte)
    if (respiro) clearTimeout(respiro)
    quitarVelo()
    w.__mappelSigueTrabajando = false
  }
}
