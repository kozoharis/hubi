'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import Barra from '../barra'

type Estado = 'mirando' | 'instalar' | 'apagados' | 'encendidos' | 'bloqueados' | 'imposible'

export default function Activar({ clavePublica }: { clavePublica: string }) {
  const [estado, setEstado] = useState<Estado>('mirando')
  const [esIphone, setEsIphone] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setEsIphone(iphone)

    const instalada =
      window.matchMedia('(display-mode: standalone)').matches ||
      // Safari en iOS usa su propia bandera
      (navigator as unknown as { standalone?: boolean }).standalone === true

    // En iPhone los avisos SOLO existen si la app está en la pantalla
    // de inicio. Dentro de Safari, la función ni siquiera está disponible.
    if (iphone && !instalada) {
      setEstado('instalar')
      return
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado('imposible')
      return
    }

    if (Notification.permission === 'denied') {
      setEstado('bloqueados')
      return
    }

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setEstado(sub ? 'encendidos' : 'apagados'))
      .catch(() => setEstado('apagados'))
  }, [])

  async function encender() {
    setAviso(null)
    setOcupado(true)

    try {
      if (!clavePublica) {
        setAviso('Los avisos todavía no están configurados.')
        setOcupado(false)
        return
      }

      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'bloqueados' : 'apagados')
        setOcupado(false)
        return
      }

      const registro = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: aBytes(clavePublica),
      })

      const r = await fetch('/api/push/suscribir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...suscripcion.toJSON(),
          dispositivo: navigator.userAgent,
        }),
      })

      if (!r.ok) {
        const datos = await r.json()
        setAviso(datos.error ?? 'No se ha podido activar.')
        setOcupado(false)
        return
      }

      setEstado('encendidos')
    } catch (e) {
      console.error(e)
      setAviso('No se ha podido activar en este dispositivo.')
    }
    setOcupado(false)
  }

  async function apagar() {
    setOcupado(true)
    try {
      const registro = await navigator.serviceWorker.getRegistration()
      const sub = await registro?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/suscribir', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setEstado('apagados')
    } catch {
      setAviso('No se ha podido desactivar.')
    }
    setOcupado(false)
  }

  async function probar() {
    setAviso(null)
    setOcupado(true)
    const r = await fetch('/api/push/probar', { method: 'POST' })
    const datos = await r.json()
    setAviso(r.ok ? 'Enviado. Debería llegarte en unos segundos.' : datos.error)
    setOcupado(false)
  }

  return (
    <main className="techo-holgado min-h-screen px-6 pb-40">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="flex h-11 items-center gap-2 text-[16px] font-bold text-tinta-suave">
          ← Volver
        </Link>

        <h1 className="mt-8 text-[27px] font-extrabold leading-tight tracking-tight text-tinta">
          🔔 Avisos
        </h1>

        {estado === 'mirando' && (
          <p className="mt-8 text-lg text-tinta-suave">Comprobando…</p>
        )}

        {/* ── Hay que instalarla primero (iPhone) ── */}
        {estado === 'instalar' && (
          <>
            <p className="mt-6 text-lg leading-relaxed text-tinta-suave">
              Para que los avisos lleguen a este iPhone, HUBI tiene que estar
              en la pantalla de inicio. Es cosa de Apple: dentro de Safari los avisos
              no existen.
            </p>

            <p className="mt-4 text-lg leading-relaxed text-tinta-suave">
              Se hace una vez y además queda con su icono, como cualquier otra app.
            </p>

            <ol className="mt-8 space-y-4">
              <Paso n={1} texto="Toca el botón de compartir, abajo en el centro de Safari: un cuadrado con una flecha hacia arriba." />
              <Paso n={2} texto="Desliza la lista hacia abajo hasta ver «Añadir a pantalla de inicio»." />
              <Paso n={3} texto="Toca «Añadir», arriba a la derecha." />
              <Paso n={4} texto="Cierra Safari y abre HUBI desde el icono nuevo." />
              <Paso n={5} texto="Vuelve a esta pantalla y activa los avisos." />
            </ol>
          </>
        )}

        {/* ── Todo listo para activarlos ── */}
        {estado === 'apagados' && (
          <>
            <p className="mt-6 text-lg leading-relaxed text-tinta-suave">
              Con los avisos activados, este teléfono sonará cuando la otra persona
              te deje algo, cuando toque algo del día, y cuando se acerque un
              vencimiento.
            </p>

            <button
              onClick={encender}
              disabled={ocupado}
              className="mt-10 w-full rounded-2xl bg-verde px-6 py-6 text-2xl font-semibold text-white disabled:opacity-40"
            >
              {ocupado ? 'Activando…' : 'Activar los avisos'}
            </button>

            <p className="mt-5 text-base leading-relaxed text-tenue">
              El teléfono te preguntará si permites las notificaciones. Hay que
              responder que sí.
            </p>
          </>
        )}

        {/* ── Ya funcionan ── */}
        {estado === 'encendidos' && (
          <>
            <p className="mt-6 rounded-2xl bg-verde-suave px-5 py-4 text-lg leading-snug text-verde">
              ✓ Los avisos están activados en este teléfono.
            </p>

            <button
              onClick={probar}
              disabled={ocupado}
              className="mt-8 w-full rounded-2xl bg-verde px-6 py-6 text-xl font-semibold text-white disabled:opacity-40"
            >
              {ocupado ? 'Enviando…' : 'Enviarme un aviso de prueba'}
            </button>

            <button
              onClick={apagar}
              disabled={ocupado}
              className="mt-4 w-full rounded-2xl border-2 border-borde px-6 py-5 text-lg font-medium text-tinta-suave disabled:opacity-40"
            >
              Desactivar en este teléfono
            </button>

            <p className="mt-6 text-base leading-relaxed text-tenue">
              Cada teléfono se activa por separado. Si usas también una tablet,
              tendrás que activarla ahí.
            </p>
          </>
        )}

        {/* ── El navegador los tiene bloqueados ── */}
        {estado === 'bloqueados' && (
          <>
            <p className="mt-6 rounded-2xl bg-coral-suave px-5 py-4 text-lg leading-snug text-coral">
              Este teléfono tiene los avisos bloqueados para HUBI.
            </p>
            <p className="mt-6 text-lg leading-relaxed text-tinta-suave">
              {esIphone
                ? 'Entra en Ajustes → Notificaciones → HUBI y permite las notificaciones. Después vuelve aquí.'
                : 'Abre los ajustes del navegador para esta página y permite las notificaciones. Después vuelve aquí.'}
            </p>
          </>
        )}

        {estado === 'imposible' && (
          <p className="mt-6 text-lg leading-relaxed text-tinta-suave">
            Este navegador no admite avisos. Prueba desde el móvil, con HUBI
            añadida a la pantalla de inicio.
          </p>
        )}

        {aviso && (
          <p className="mt-6 rounded-2xl bg-superficie px-5 py-4 text-lg leading-snug text-tinta">
            {aviso}
          </p>
        )}
      </div>
      <Barra activa={null} />
    </main>
  )
}

function Paso({ n, texto }: { n: number; texto: string }) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-verde text-lg font-semibold text-white">
        {n}
      </span>
      <span className="pt-1 text-lg leading-snug text-tinta">{texto}</span>
    </li>
  )
}

/**
 * La clave pública viaja en base64 para URLs; el navegador la quiere en bytes.
 *
 * Se reserva el espacio con `new ArrayBuffer` en vez de dejar que lo elija
 * `Uint8Array`: así TypeScript sabe con certeza que es memoria normal y no
 * memoria compartida entre hilos, que es lo único que aquí no valdría.
 */
function aBytes(base64: string): ArrayBuffer {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const limpio = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const bruto = atob(limpio)

  const espacio = new ArrayBuffer(bruto.length)
  const bytes = new Uint8Array(espacio)
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i)

  return espacio
}
