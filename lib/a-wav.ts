/*
  ═══════════════════════════════════════════════════════════════
  DE LO QUE GRABA EL NAVEGADOR A LO QUE ENTIENDE EL SERVIDOR
  ═══════════════════════════════════════════════════════════════

  ESTO VIVÍA DENTRO DE `app/hablar/grabar.tsx`, Y ÉSE ERA EL FALLO.

  Había DOS micrófonos en MAPPEL: el del teléfono (`/hablar`) y el de
  la pantalla de la cocina (`app/casa/microfono.tsx`). Los dos graban
  con la misma `grabadora.ts`, o sea que los dos acaban con un archivo
  en el formato que le dé la gana al navegador — webm/opus en Chrome,
  mp4 en Safari.

  El del teléfono pasaba por esta conversión antes de enviar. El de la
  cocina mandaba el archivo TAL CUAL, con el nombre `hablar.webm`.

  Y el modelo que transcribe NO ADMITE webm. Así que en la tableta de
  la cocina —que es un Android— pasaba esto, todas las veces: se
  pulsaba el micrófono, la barra se movía con la voz, se soltaba… y
  salía «No se ha entendido. Prueba otra vez.» Nunca funcionó. No
  daba error de red, no daba error de permiso: daba el mensaje que uno
  lee como «he hablado mal».

  En un iPhone no se habría notado tanto, porque Safari graba en mp4 y
  eso sí se admite. La pantalla de la cocina es justamente la que
  nunca es un iPhone.

  No se arregla acordándose de convertir en los dos sitios. Se arregla
  sacando la conversión de la pantalla del teléfono y poniéndola donde
  la vea todo el que grabe: aquí.
*/

/**
 * Convierte la grabación a WAV de 16 kHz en mono.
 *
 * Cada navegador graba en un formato distinto: Chrome en webm, Safari en
 * mp4. En vez de confiar en que el otro lado entienda los dos, el propio
 * navegador descodifica lo que acaba de grabar y lo vuelve a escribir en
 * WAV, que es el formato más simple que existe y lo entiende todo el mundo.
 *
 * Y de paso baja a 16 kHz mono: para voz sobra, y reduce el envío a la
 * cuarta parte. Con datos móviles se nota.
 */
export async function aWav(grabacion: Blob): Promise<Blob> {
  const decodificado = await descodificar(await grabacion.arrayBuffer())

  const canal = decodificado.getChannelData(0)
  const destino = 16_000
  const muestras = remuestrear(canal, decodificado.sampleRate, destino)

  return escribirWav(muestras, destino)
}

/*
  ═══════════════════════════════════════════════════════════════
  POR QUÉ EL MICRÓFONO DEJABA DE FUNCIONAR DEL TODO
  ═══════════════════════════════════════════════════════════════

  Aquí se abría un `AudioContext` nuevo en CADA grabación para
  descodificar el audio, y se cerraba en la última línea. Si algo
  fallaba antes de esa línea —un audio que no se puede descodificar,
  que pasa— el contexto se quedaba abierto para siempre.

  Un iPhone permite cuatro contextos de audio a la vez. Al quinto, el
  navegador se niega. Y como el que se abre para GRABAR es de los
  mismos, a la quinta vez el micrófono simplemente ya no abría: el
  botón se pulsaba y no pasaba nada. No era el micrófono ni el permiso
  ni Safari. Éramos nosotros, gastándolos de cuatro en cuatro.

  Se arregla de dos maneras a la vez:

  1 · Se descodifica en un contexto QUE NO SUENA (`OfflineAudioContext`).
      No toca el altavoz ni el micrófono, no consume de esa cuenta, y
      además descodifica directamente a 16 kHz, con lo que remuestrear
      luego no tiene ni trabajo.

  2 · Es uno solo para toda la sesión, no uno por grabación. Lo que no
      se abre no hace falta acordarse de cerrarlo.

  Y si un navegador viejo no sabe descodificar así, se cae al de
  siempre — pero ese sí se cierra pase lo que pase.
*/
let cocina: OfflineAudioContext | null = null

async function descodificar(bytes: ArrayBuffer): Promise<AudioBuffer> {
  try {
    if (!cocina) cocina = new OfflineAudioContext(1, 1, 16_000)
    /* `decodeAudioData` se queda con los bytes que le das —los deja
       vacíos—, así que cada intento necesita su propia copia. */
    return await cocina.decodeAudioData(bytes.slice(0))
  } catch {
    const suelto = new AudioContext()
    try {
      return await suelto.decodeAudioData(bytes.slice(0))
    } finally {
      suelto.close().catch(() => {})
    }
  }
}

function remuestrear(datos: Float32Array, origen: number, destino: number): Float32Array {
  if (origen === destino) return datos

  const proporcion = origen / destino
  const largo = Math.floor(datos.length / proporcion)
  const salida = new Float32Array(largo)

  for (let i = 0; i < largo; i++) {
    const punto = i * proporcion
    const antes = Math.floor(punto)
    const despues = Math.min(antes + 1, datos.length - 1)
    const peso = punto - antes
    salida[i] = datos[antes] * (1 - peso) + datos[despues] * peso
  }
  return salida
}

function escribirWav(muestras: Float32Array, frecuencia: number): Blob {
  const buffer = new ArrayBuffer(44 + muestras.length * 2)
  const vista = new DataView(buffer)

  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) vista.setUint8(pos + i, s.charCodeAt(i))
  }

  texto(0, 'RIFF')
  vista.setUint32(4, 36 + muestras.length * 2, true)
  texto(8, 'WAVE')
  texto(12, 'fmt ')
  vista.setUint32(16, 16, true)
  vista.setUint16(20, 1, true) // PCM
  vista.setUint16(22, 1, true) // mono
  vista.setUint32(24, frecuencia, true)
  vista.setUint32(28, frecuencia * 2, true)
  vista.setUint16(32, 2, true)
  vista.setUint16(34, 16, true)
  texto(36, 'data')
  vista.setUint32(40, muestras.length * 2, true)

  let pos = 44
  for (let i = 0; i < muestras.length; i++) {
    const v = Math.max(-1, Math.min(1, muestras[i]))
    vista.setInt16(pos, v < 0 ? v * 0x8000 : v * 0x7fff, true)
    pos += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}
