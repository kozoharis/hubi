'use client'

import { useEffect } from 'react'

/*
  ═══════════════════════════════════════════════════════════════
  QUE LA PANTALLA DE LA COCINA NO SE APAGUE
  ═══════════════════════════════════════════════════════════════

  ESTO NO EXISTÍA, Y HACÍA INÚTIL MEDIA PARED.

  Una tableta Android apaga la pantalla sola al minuto o a los dos
  minutos de no tocarla. Es lo que hace cualquier tableta y no hay
  ajuste de MAPPEL que lo cambie… salvo éste, que es la forma que dan
  los navegadores de pedir «no la apagues mientras esto esté delante».

  Sin esto, la pared colgada en la cocina estaba NEGRA el 99 % del
  tiempo. Había que ir, tocarla, esperar a que encendiera y a que
  volviera a cargar. O sea: exactamente lo contrario de un calendario
  de pared, que es lo que se mira al pasar.

  Y arrastraba otra cosa: `descanso.tsx` enseña las fotos de la casa a
  los tres minutos de quietud. Tres minutos. La tableta apagaba a los
  dos. **El descanso nunca llegó a verse.** Estaba construido, probado
  en el ordenador, y en la cocina no se vio jamás.

  ─────────────────────────────────────────────────────────────
  LO QUE HAY QUE SABER DE ESTE PERMISO

  · Sólo lo dan si la pestaña está VISIBLE. Al cambiar de aplicación
    se suelta solo, y hay que volver a pedirlo al volver. De ahí el
    `visibilitychange`.
  · Lo tienen Chrome, Edge y Safari (16.4 en adelante). En el resto no
    pasa nada: no hay permiso y la tableta se apaga como antes.
  · Si el sistema decide apagar igual —batería muy baja, ahorro de
    energía—, suelta el permiso y no hay forma de insistir. Se vuelve
    a pedir la próxima vez que la pantalla se encienda.

  · NO mantiene la tableta encendida cuando MAPPEL no está delante.
    Eso no lo puede hacer una página web, y no hay que prometerlo: la
    pantalla de la cocina hay que dejarla con MAPPEL abierto y
    enchufada.

  Sólo va en `app/casa/**`. En el teléfono sería un abuso: nadie
  quiere que una aplicación le impida apagar la pantalla.
*/

/* No está en los tipos de TypeScript de todos los navegadores. */
type Permiso = { released: boolean; release: () => Promise<void> }
type ConPermiso = Navigator & {
  wakeLock?: { request: (tipo: 'screen') => Promise<Permiso> }
}

export default function Despierta() {
  useEffect(() => {
    const navegador = navigator as ConPermiso
    if (!navegador.wakeLock) return

    let permiso: Permiso | null = null
    let vivo = true

    async function pedir() {
      if (!vivo || document.visibilityState !== 'visible') return
      if (permiso && !permiso.released) return

      try {
        const dado = await navegador.wakeLock!.request('screen')
        /* Si mientras se pedía ya nos hemos ido de la pared, se suelta
           en vez de quedárselo. Sin esto, salir rápido de la pantalla
           deja la tableta encendida para siempre. */
        if (!vivo) {
          void dado.release().catch(() => {})
          return
        }
        permiso = dado
      } catch {
        /* Lo normal es que falle porque la pestaña acaba de dejar de
           estar visible. No se dice nada: la tableta se apagará como
           se apagaba antes, y no hay nada que la persona pueda hacer
           al respecto. */
        permiso = null
      }
    }

    /* Al volver a la pared después de estar en otra aplicación, el
       permiso ya no vale. Se vuelve a pedir. */
    const alVolver = () => {
      if (document.visibilityState === 'visible') void pedir()
    }

    void pedir()
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', alVolver)
      permiso?.release().catch(() => {})
      permiso = null
    }
  }, [])

  return null
}
