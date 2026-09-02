/*
  ═══════════════════════════════════════════════════════════════
  GRABAR LA VOZ. UN SOLO CAMINO, IGUAL EN TODOS LOS TELÉFONOS.
  ═══════════════════════════════════════════════════════════════

  POR QUÉ SE TIRA LO ANTERIOR.

  Hasta ahora HUBI usaba el reconocedor del propio navegador
  —`webkitSpeechRecognition`— para transcribir mientras se hablaba. Es
  gratis, es instantáneo y sobre el papel es lo mejor.

  En la práctica ha sido un lastre, y estas son las razones, todas
  vividas en este proyecto:

  · Android reentrega los mismos trozos una y otra vez. Salían frases
    repetidas veinte veces.
  · Safari entrega la frase entera y NUNCA la marca como definitiva.
    HUBI contestaba "no he oído nada" con la frase escrita en la
    pantalla.
  · Android puede tardar tres segundos en soltar el primer texto. HUBI
    lo tomaba por silencio y cortaba en mitad de la frase.
  · Cada arreglo para un teléfono rompía el otro.

  El fallo no era ninguno de esos. El fallo era la ARQUITECTURA: cada
  navegador implementa ese API a su manera, no hay dos iguales, y no
  hay forma de escribir heurísticas que valgan para todos. Se pierde
  más tiempo adivinando manías que construyendo.

  ─────────────────────────────────────────────────────────────
  LO QUE SE HACE AHORA: GRABAR Y MANDAR.

  Se graba el audio —eso sí funciona igual en todas partes— y se manda
  a transcribir. Un solo camino. Sin manías por teléfono.

  Lo que se pierde: el texto ya no aparece letra a letra mientras
  hablas. A cambio, en vez de un texto que a veces era basura, se ve
  una barra que se mueve con la voz: prueba de que te está oyendo, y
  además honesta —se mueve porque hay sonido, no porque haya entendido
  algo—.

  Lo que se gana, que es lo que importa: funciona igual en el móvil de
  Juan Miguel y en el de Conchita, y transcribe mucho mejor los
  nombres propios —"Los Helechos", "Conchita", "gofio"— que el
  reconocedor del teléfono.

  ─────────────────────────────────────────────────────────────
  Y EL SILENCIO SE MIDE DE VERDAD.

  Antes se daba por terminado cuando el reconocedor dejaba de mandar
  texto, que no es lo mismo que callarse. Ahora se mide el SONIDO que
  entra por el micrófono, con la propia señal. Eso no depende del
  navegador: es física.
*/

export type Grabando = {
  /** Termina y entrega lo grabado. */
  parar: () => void
  /** Se acabó sin usarlo: se suelta el micrófono y no se entrega nada. */
  cancelar: () => void
}

type Manejadores = {
  /** Cuánto sonido entra ahora, de 0 a 1. Para la barra. */
  alNivel: (nivel: number) => void
  /** Se ha callado un rato. No se cierra nada: se pregunta si hay más. */
  alPausar: () => void
  /** Ha vuelto a hablar. */
  alSeguir: () => void
  alTerminar: (audio: Blob, segundos: number) => void
  alFallar: (motivo: 'sin-permiso' | 'sin-micro' | 'vacio') => void
}

/* Lo que se espera callado antes de preguntar "¿algo más?". Dos
   segundos y medio: lo justo para coger aire sin que parezca que se
   ha colgado. */
const PAUSA = 2500

/* Desde la pausa, lo que se espera antes de darlo por terminado. */
const RENDIRSE = 5000

/* Nadie dicta más de esto de un tirón, y pasado ese punto el archivo
   empieza a pesar de más para subirlo desde un móvil. */
const TOPE = 45_000

/* Cada cuánto se mira el nivel de sonido. */
const LATIDO = 100

export function sePuedeGrabar(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  )
}

export async function grabarVoz(manejadores: Manejadores): Promise<Grabando | null> {
  if (!sePuedeGrabar()) {
    manejadores.alFallar('sin-micro')
    return null
  }

  let micro: MediaStream
  try {
    micro = await navigator.mediaDevices.getUserMedia({
      audio: {
        /* Los tres ayudan de verdad en una cocina o en la calle, y los
           traen todos los móviles de hoy. */
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
  } catch {
    manejadores.alFallar('sin-permiso')
    return null
  }

  // ── Lo que se graba ──
  const trozos: Blob[] = []
  let grabadora: MediaRecorder
  try {
    grabadora = new MediaRecorder(micro, elMejorFormato())
  } catch {
    grabadora = new MediaRecorder(micro)
  }
  grabadora.ondataavailable = (e) => {
    if (e.data.size > 0) trozos.push(e.data)
  }

  // ── Lo que se oye, para saber si hay alguien hablando ──
  const contexto = new AudioContext()
  const fuente = contexto.createMediaStreamSource(micro)
  const analizador = contexto.createAnalyser()
  analizador.fftSize = 1024
  analizador.smoothingTimeConstant = 0.4
  fuente.connect(analizador)
  const muestras = new Float32Array(analizador.fftSize)

  /*
    EL UMBRAL SE APRENDE, NO SE FIJA.

    Un número fijo no vale: en una cocina con la tele puesta el
    silencio "suena" mucho más alto que en un salón vacío, y un umbral
    de laboratorio daría por hablando a la nevera. Se escucha medio
    segundo antes de empezar a contar y el umbral se pone POR ENCIMA
    de ese ruido de fondo.
  */
  let fondo = 0
  let midiendoFondo = true
  let medidas = 0

  const arranque = Date.now()
  let ultimoSonido = Date.now()
  let pausado = false
  let cerrado = false
  let vigilante: ReturnType<typeof setInterval> | null = null

  function soltar() {
    if (vigilante) clearInterval(vigilante)
    vigilante = null
    micro.getTracks().forEach((t) => t.stop())
    contexto.close().catch(() => {})
  }

  function nivelAhora(): number {
    analizador.getFloatTimeDomainData(muestras)
    let suma = 0
    for (let i = 0; i < muestras.length; i++) suma += muestras[i] * muestras[i]
    return Math.sqrt(suma / muestras.length)
  }

  function terminar() {
    if (cerrado) return
    cerrado = true
    if (vigilante) clearInterval(vigilante)
    vigilante = null

    const segundos = Math.round((Date.now() - arranque) / 1000)

    grabadora.onstop = async () => {
      soltar()

      const bruto = new Blob(trozos, { type: grabadora.mimeType || 'audio/webm' })

      /* Menos de un segundo, o cuatro bytes: no se ha dicho nada. Se
         dice ahora y no después de un viaje al servidor. */
      if (segundos < 1 || bruto.size < 2000) {
        manejadores.alFallar('vacio')
        return
      }

      manejadores.alTerminar(bruto, segundos)
    }

    try {
      grabadora.stop()
    } catch {
      soltar()
      manejadores.alFallar('vacio')
    }
  }

  vigilante = setInterval(() => {
    if (cerrado) return

    const nivel = nivelAhora()

    // Medio segundo aprendiendo cuánto suena el silencio de esta casa.
    if (midiendoFondo) {
      fondo = (fondo * medidas + nivel) / (medidas + 1)
      medidas++
      if (medidas >= 5) midiendoFondo = false
      manejadores.alNivel(0)
      return
    }

    /* Por encima del ruido de fondo con margen, y nunca por debajo de
       un mínimo: si el micrófono está mudo del todo, `fondo` sería
       cero y cualquier chasquido contaría como voz. */
    const umbral = Math.max(fondo * 2.5, 0.012)
    const hayVoz = nivel > umbral

    /* Lo que se enseña en la barra: crece rápido y baja despacio, que
       es lo que parece natural. Y se normaliza para que hablar normal
       llene la barra sin gritar. */
    manejadores.alNivel(Math.min(1, nivel / 0.09))

    if (hayVoz) {
      ultimoSonido = Date.now()
      if (pausado) {
        pausado = false
        manejadores.alSeguir()
      }
    }

    const callado = Date.now() - ultimoSonido

    if (!pausado && callado > PAUSA) {
      pausado = true
      manejadores.alPausar()
    }
    if (pausado && callado > PAUSA + RENDIRSE) terminar()
    if (Date.now() - arranque > TOPE) terminar()
  }, LATIDO)

  grabadora.start(250)

  return {
    parar: terminar,
    cancelar: () => {
      if (cerrado) return
      cerrado = true
      try {
        grabadora.stop()
      } catch {
        /* ya estaba parada */
      }
      soltar()
    },
  }
}

/*
  El formato que mejor entienda este teléfono.

  Se prueban por orden y se coge el primero que acepte. No es
  cosmético: dejar que el navegador elija por su cuenta acaba dando
  formatos raros que luego no se pueden decodificar.
*/
function elMejorFormato(): MediaRecorderOptions {
  const candidatos = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]

  for (const mimeType of candidatos) {
    if (MediaRecorder.isTypeSupported?.(mimeType)) return { mimeType }
  }
  return {}
}
