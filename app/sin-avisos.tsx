'use client'

import Link from '@/app/enlace'
import { useEffect, useState } from 'react'
import { Ico } from './iconos'

/*
  ═══════════════════════════════════════════════════════════════
  CUANDO HUBI NO PUEDE AVISAR, HAY QUE DECIRLO
  ═══════════════════════════════════════════════════════════════

  Éste era el agujero más serio que tenía la aplicación, y no daba
  ningún error.

  En el iPhone los avisos SOLO existen si HUBI está añadida a la
  pantalla de inicio. Abierta desde Safari como una página normal, la
  función de avisar ni siquiera está disponible. Así que alguien podía
  usar HUBI durante meses —dejar tareas, poner recordatorios, esperar
  que sonara el teléfono— y no recibir absolutamente nada, sin que
  nada se lo dijera nunca.

  Para una aplicación cuyo valor entero es acordarse por ti, ese
  silencio es el peor fallo posible. Es peor que un error: un error se
  ve y se arregla; esto se descubre el día que a alguien no le llega
  el aviso de la medicación.

  La pantalla de Avisos ya lo detectaba desde hace tiempo. El problema
  era que a esa pantalla no entra nadie: quien no sabe que los avisos
  están rotos no va a buscar la pantalla de los avisos.

  ─────────────────────────────────────────────────────────────
  DOS SILENCIOS DISTINTOS, LA MISMA CONSECUENCIA

  · No está en la pantalla de inicio → en iPhone no puede avisar.
  · Está, pero nunca se encendieron  → tampoco avisa.

  Los dos se viven igual —«HUBI no me avisa»— así que los dos salen
  aquí, cada uno con su frase.

  ─────────────────────────────────────────────────────────────
  Y SE PUEDE QUITAR, PERO VUELVE

  Sin poder quitarlo sería un cartel fijo en la puerta de casa, y un
  cartel fijo se deja de leer en tres días. Se puede apartar, y vuelve
  al mes: quien de verdad no quiere avisos lo aparta cuatro veces al
  año, y a quien se le olvidó se le recuerda.
*/

type Falta = 'instalar' | 'encender' | null

const APARTADO = 'hubi:avisos-apartados'
const UN_MES = 30 * 24 * 60 * 60 * 1000

export default function SinAvisos() {
  const [falta, setFalta] = useState<Falta>(null)
  const [esIphone, setEsIphone] = useState(false)

  useEffect(() => {
    let vivo = true

    async function mirar() {
      /* En el ordenador no se dice nada. Los avisos que importan son
         los del teléfono que se lleva encima, y avisar de esto en un
         portátil es ruido sobre algo que allí no se usa. */
      const enElMovil = /iPad|iPhone|iPod|Android/.test(navigator.userAgent)
      if (!enElMovil) return

      /* Apartado hace menos de un mes: se respeta. Envuelto en
         try/catch porque en una ventana privada leer esto lanza. */
      try {
        const cuando = Number(window.localStorage.getItem(APARTADO) ?? 0)
        if (cuando && Date.now() - cuando < UN_MES) return
      } catch {
        /* Sin memoria del navegador se enseña igual. Molestar de más
           es mejor que callar cuando no se avisa. */
      }

      const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (vivo) setEsIphone(iphone)

      const puesta =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true

      if (!puesta) {
        /* En Android los avisos SÍ funcionan desde el navegador, así
           que allí no se pide instalar nada: se mira si están
           encendidos, que es lo que de verdad falta. */
        if (iphone) {
          if (vivo) setFalta('instalar')
          return
        }
      }

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      if (typeof Notification === 'undefined') return

      try {
        const registro = await navigator.serviceWorker.getRegistration()
        const suscripcion = await registro?.pushManager.getSubscription()
        if (vivo && !suscripcion) setFalta('encender')
      } catch {
        /* Si no se puede comprobar, no se dice nada: un cartel que
           sale por un fallo de lectura es peor que no salir. */
      }
    }

    mirar()
    return () => {
      vivo = false
    }
  }, [])

  if (!falta) return null

  function apartar() {
    try {
      window.localStorage.setItem(APARTADO, String(Date.now()))
    } catch {
      /* Da igual: se cierra igualmente hasta la próxima visita. */
    }
    setFalta(null)
  }

  return (
    <section
      className="mt-4 rounded-[20px] border px-4 py-4"
      /* Iba con `#F59E0B`, el ámbar que salió de la paleta en la
         Fase 1. Y lo que dice esta caja —«ahora mismo HUBI no puede
         avisarte»— es literalmente el estado ATENCIÓN: no está roto,
         falta un paso. Ahora lleva su token, que además está medido
         para leerse en claro y en oscuro. */
      style={{
        borderColor: 'color-mix(in srgb, var(--t-atencion) 45%, transparent)',
        background: 'var(--t-atencion-velo)',
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0" style={{ color: 'var(--t-atencion)' }}>
          <Ico nombre="campana" tam={22} grosor={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[17.5px] font-extrabold leading-snug">
            Ahora mismo HUBI no puede avisarte
          </p>
          <p className="mt-1.5 text-[15.5px] font-semibold leading-snug text-tinta-suave">
            {falta === 'instalar'
              ? esIphone
                ? 'Falta ponerla en la pantalla de inicio. Hasta entonces el teléfono no sonará cuando te dejen algo. Se hace una vez.'
                : 'Falta ponerla en la pantalla de inicio.'
              : 'Los avisos están apagados en este teléfono. No sonará cuando te dejen algo ni cuando se acerque un vencimiento.'}
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex gap-2">
        {/*
          Iba relleno del ámbar `#F59E0B`. Dos cosas mal: ese color ya
          no existe en la paleta, y un botón relleno de color de AVISO
          confunde el problema con la salida — parece que el botón es
          la alarma.

          Encender los avisos es una ACCIÓN, y las acciones llevan el
          color de acción. El aviso ya está dicho arriba, con su color.
        */}
        <Link
          href="/avisos"
          className="r-campo flex h-[52px] flex-1 items-center justify-center bg-accion text-[16.5px] font-extrabold text-accion-tinta"
        >
          {falta === 'instalar' ? 'Cómo se hace' : 'Encenderlos'}
        </Link>
        <button
          onClick={apartar}
          className="h-[52px] shrink-0 rounded-[14px] border border-borde px-4 text-[16.5px] font-extrabold text-tinta-suave"
        >
          Ahora no
        </button>
      </div>
    </section>
  )
}
