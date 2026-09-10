'use client'

import { useEffect, useState } from 'react'
import Barra from '../barra'
import Cabecera from '../cabecera'
import { Volver } from '../iconos'
import { Aviso, BotonPrincipal, BotonSecundario, PastillaAmbito } from '../piezas'
import { api } from '@/lib/api'

type Estado = 'mirando' | 'instalar' | 'apagados' | 'encendidos' | 'bloqueados' | 'imposible'

export default function Activar({ clavePublica }: { clavePublica: string }) {
  const [estado, setEstado] = useState<Estado>('mirando')
  const [esIphone, setEsIphone] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  /*
    Antes esto era UNA caja gris que servía igual para «enviado» que
    para «no se ha podido activar». La buena noticia y el fallo se
    pintaban del mismo color y con las mismas palabras alrededor, así
    que había que leerlas enteras para saber cuál era cuál.
  */
  const [aviso, setAviso] = useState<string | null>(null)
  const [bien, setBien] = useState<string | null>(null)

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
        setAviso('Los avisos todavía no están configurados en el servidor.')
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

      const r = await fetch(api('/api/push/suscribir'), {
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
        await fetch(api('/api/push/suscribir'), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setEstado('apagados')
      setBien(null)
    } catch {
      setAviso('No se ha podido desactivar. Los avisos siguen llegando a este teléfono.')
    }
    setOcupado(false)
  }

  async function probar() {
    setAviso(null)
    setBien(null)
    setOcupado(true)

    const r = await fetch(api('/api/push/probar'), { method: 'POST' })
    const datos = (await r.json().catch(() => ({}))) as { error?: string }

    /* El motivo técnico va al registro, no a la pantalla: aquí solo
       hace ruido. Es la misma regla del P0 de los mensajes de SQL. */
    if (r.ok) {
      setBien('Enviado. Debería llegarte en unos segundos.')
    } else {
      if (datos.error) console.error('[HUBI] El aviso de prueba no ha salido:', datos.error)
      setAviso('No ha salido el aviso de prueba. Los avisos siguen activados.')
    }
    setOcupado(false)
  }

  return (
    <main className="min-h-screen pb-40">
      {/* El título va en la cabecera, como en el resto (decisión D6).
          Y el emoji sale: los iconos de HUBI son de trazo, y un emoji
          de campana se pinta distinto en cada teléfono. */}
      <Cabecera>
        <Volver href="/" />
        <div className="flex h-14 items-center gap-3">
          <PastillaAmbito icono="campana" ambito="azul" tam={44} />
          <h1 className="t-titulo">Avisos</h1>
        </div>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-1">
        {estado === 'mirando' && <p className="t-cuerpo mt-4 text-tenue">Comprobando…</p>}

        {/* ── Hay que instalarla primero (iPhone) ── */}
        {estado === 'instalar' && (
          <>
            <p className="t-cuerpo mt-4">
              Para que los avisos lleguen a este iPhone, HUBI tiene que estar
              en la pantalla de inicio. Es cosa de Apple: dentro de Safari los avisos
              no existen.
            </p>

            <p className="t-cuerpo mt-3">
              Se hace una vez y además queda con su icono, como cualquier otra app.
            </p>

            <ol className="mt-6 space-y-3.5">
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
            <p className="t-cuerpo mt-4">
              Con los avisos activados, este teléfono sonará cuando la otra persona
              te deje algo, cuando toque algo del día, y cuando se acerque un
              vencimiento.
            </p>

            {/* Iba de `bg-verde` a 24 px de letra y 96 px de alto: el
                verde ya no es acento sino ámbito, y la acción se dice
                con el color de acción y con la altura de siempre. */}
            <div className="mt-6">
              <BotonPrincipal onClick={encender} desactivado={ocupado} icono="campana">
                {ocupado ? 'Activando…' : 'Activar los avisos'}
              </BotonPrincipal>
            </div>

            <p className="t-apoyo mt-3">
              El teléfono te preguntará si permites las notificaciones. Hay que
              responder que sí.
            </p>
          </>
        )}

        {/* ── Ya funcionan ── */}
        {estado === 'encendidos' && (
          <>
            <div className="mt-4">
              <Aviso tono="bien" titulo="Los avisos están activados en este teléfono." />
            </div>

            <div className="mt-6">
              <BotonPrincipal onClick={probar} desactivado={ocupado}>
                {ocupado ? 'Enviando…' : 'Enviarme un aviso de prueba'}
              </BotonPrincipal>
            </div>

            <div className="mt-2.5">
              <BotonSecundario onClick={apagar} desactivado={ocupado}>
                Desactivar en este teléfono
              </BotonSecundario>
            </div>

            <p className="t-apoyo mt-4">
              Cada teléfono se activa por separado. Si usas también una tablet,
              tendrás que activarla ahí.
            </p>
          </>
        )}

        {/* ── El navegador los tiene bloqueados ── */}
        {estado === 'bloqueados' && (
          <>
            <div className="mt-4">
              <Aviso
                titulo="Este teléfono tiene los avisos bloqueados para HUBI"
                explicacion={
                  esIphone
                    ? 'Entra en Ajustes → Notificaciones → HUBI y permite las notificaciones. Después vuelve aquí.'
                    : 'Abre los ajustes del navegador para esta página y permite las notificaciones. Después vuelve aquí.'
                }
              />
            </div>
          </>
        )}

        {estado === 'imposible' && (
          <p className="t-cuerpo mt-4">
            Este navegador no admite avisos. Prueba desde el móvil, con HUBI
            añadida a la pantalla de inicio.
          </p>
        )}

        {bien && (
          <div className="mt-4">
            <Aviso tono="bien" titulo={bien} />
          </div>
        )}

        {aviso && (
          <div className="mt-4">
            <Aviso titulo="No ha podido ser" explicacion={aviso} />
          </div>
        )}
      </div>
      <Barra activa={null} />
    </main>
  )
}

function Paso({ n, texto }: { n: number; texto: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="t-apoyo flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fondo font-extrabold text-tinta-suave">
        {n}
      </span>
      <span className="t-cuerpo min-w-0 flex-1">{texto}</span>
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
