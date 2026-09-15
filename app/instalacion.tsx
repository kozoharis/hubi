'use client'

import { useEffect, useSyncExternalStore } from 'react'

/*
  ═══════════════════════════════════════════════════════════════
  PONER MAPPEL EN LA PANTALLA DE INICIO, Y QUE EL TRABAJADOR EXISTA
  ═══════════════════════════════════════════════════════════════

  Dos cosas que iban sueltas y que en Android son la misma:

  ── 1. EL TRABAJADOR DE FONDO SE REGISTRABA DEMASIADO TARDE ──

  El único `navigator.serviceWorker.register('/sw.js')` de toda la
  aplicación estaba DENTRO del botón «Activar los avisos», en
  `app/avisos/activar.tsx`. O sea: mientras Juan Miguel no entrara en
  Ajustes → Avisos y pulsara ese botón, MAPPEL no tenía trabajador de
  fondo.

  En iPhone da igual, porque allí se instala a mano desde Compartir y
  Safari no pregunta nada.

  En Android NO da igual, porque Chrome decide si ofrece «Instalar
  aplicación» mirando si hay manifiesto Y trabajador con `fetch`. Sin
  trabajador registrado desde el principio, esa comprobación nunca
  llegaba a hacerse: el navegador no ofrecía instalarla, y lo más
  parecido que quedaba era «Añadir a pantalla de inicio» del menú de
  tres puntos, que crea un acceso directo que se abre DENTRO de
  Chrome, con su barra de direcciones y sin avisos.

  Ahora se registra al abrir MAPPEL, en todas las pantallas, sin que
  nadie tenga que pulsar nada.

  ── 2. ANDROID DEJA OFRECER LA INSTALACIÓN, Y NO LA OFRECÍAMOS ──

  Chrome avisa con `beforeinstallprompt` cuando la aplicación cumple
  los requisitos, y ahí se puede enseñar un botón propio y llamar a
  `prompt()`. Es UN toque: «Instalar» → «Instalar». Frente a los cinco
  pasos que hay que explicarle a un iPhone.

  Ese aviso llega PRONTO —a los pocos segundos de cargar— y sólo una
  vez. Si nadie lo estaba escuchando en ese momento, se pierde. Por
  eso se escucha aquí, en la plantilla, y se guarda en una variable de
  módulo: la pantalla de Avisos puede abrirse diez minutos después y
  encontrárselo esperando.
*/

/* El evento que manda Chrome. No está en los tipos del navegador
   porque no es estándar: sólo lo tienen Chrome y los suyos. */
type EventoInstalar = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/* ── El almacén, fuera de React ──

   Tiene que vivir fuera de cualquier componente porque el evento
   llega antes de que exista la pantalla que lo va a usar. */
let guardado: EventoInstalar | null = null
const oyentes = new Set<() => void>()

function avisar() {
  for (const o of oyentes) o()
}

function suscribir(o: () => void) {
  oyentes.add(o)
  return () => {
    oyentes.delete(o)
  }
}

const hayEnEsteEquipo = () => guardado !== null
/* En el servidor no hay navegador y no hay nada que instalar. Sin
   esto, React se queja de que el valor difiere entre servidor y
   navegador. */
const noEnElServidor = () => false

/**
 * ¿Puede este navegador instalar MAPPEL de un toque?
 *
 * Cierto sólo en Chrome y derivados (Android y escritorio), y sólo
 * cuando el navegador ya ha dicho que sí. En iPhone siempre es falso:
 * allí hay que explicar los pasos de Safari.
 */
export function useInstalable(): boolean {
  return useSyncExternalStore(suscribir, hayEnEsteEquipo, noEnElServidor)
}

/**
 * Enseña el diálogo del navegador. Devuelve si la persona aceptó.
 *
 * El evento se gasta al usarlo: Chrome no deja volver a llamarlo. Por
 * eso se suelta pase lo que pase — si dice que no, el botón desaparece
 * y se le explican los pasos a mano como en iPhone.
 */
export async function instalar(): Promise<boolean> {
  const evento = guardado
  if (!evento) return false

  guardado = null
  avisar()

  try {
    await evento.prompt()
    const { outcome } = await evento.userChoice
    return outcome === 'accepted'
  } catch {
    return false
  }
}

/**
 * Va una sola vez, en la plantilla. No pinta nada.
 */
export default function Instalacion() {
  useEffect(() => {
    /*
      ── EL REGISTRO ──

      Se espera a que la página termine de cargar. Registrar un
      trabajador de fondo dispara la descarga del propio `sw.js` y, la
      primera vez, la de la pantalla de sin conexión; hacerlo en medio
      del arranque le quita ancho de banda a lo que la persona está
      esperando ver. Unos milisegundos después no lo nota nadie.

      Si falla, no se dice nada: MAPPEL funciona entera sin trabajador
      de fondo. Lo único que se pierde son los avisos, y esa pantalla
      ya explica lo suyo cuando no puede activarlos.
    */
    if (!('serviceWorker' in navigator)) return

    const registrar = () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => {
        console.error('[MAPPEL] El trabajador de fondo no se ha podido registrar:', e)
      })
    }

    if (document.readyState === 'complete') registrar()
    else window.addEventListener('load', registrar, { once: true })

    /* ── El aviso de Chrome ── */
    const alPoder = (e: Event) => {
      /* Sin esto, Chrome enseña su propia barrita de instalar por
         debajo, que no se puede colocar ni traducir ni hacer grande.
         Preferimos un botón nuestro, donde toca y a nuestro tamaño. */
      e.preventDefault()
      guardado = e as EventoInstalar
      avisar()
    }

    /* Y cuando ya está instalada, que el botón se vaya solo — aunque
       se haya instalado desde el menú del navegador y no desde aquí. */
    const alInstalarse = () => {
      guardado = null
      avisar()
    }

    window.addEventListener('beforeinstallprompt', alPoder)
    window.addEventListener('appinstalled', alInstalarse)

    return () => {
      window.removeEventListener('load', registrar)
      window.removeEventListener('beforeinstallprompt', alPoder)
      window.removeEventListener('appinstalled', alInstalarse)
    }
  }, [])

  return null
}
