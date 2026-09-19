'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { encoger } from '@/lib/encoger'
import { Ico } from '../iconos'

/*
  ═══════════════════════════════════════════════════════════════
  LA CÁMARA, DENTRO DE MAPPEL
  ═══════════════════════════════════════════════════════════════

  Haris: *«cuando quieres sacarte una foto desde la tableta funciona,
  eso está perfecto. Lo único, que debería tener como un marco o algo
  así, o un botón de salir o atrás, ya que no se ve, por si entras sin
  querer»*.

  Y el problema de fondo era más gordo que la falta de un botón.

  ─────────────────────────────────────────────────────────────
  LO QUE HABÍA, Y POR QUÉ NO PODÍA LLEVAR NINGÚN BOTÓN

  Un `<input type="file" capture>`. Eso no abre una pantalla nuestra:
  **abre la cámara de Android**, que es otra aplicación. Pedirle un
  marco o un «Salir» de mappel es imposible — ahí ya no mandamos
  nosotros.

  Y en una pared es peor que en un móvil, porque la pared va a pantalla
  completa y sin barras a propósito (`pantalla-completa.tsx`): al abrir
  la cámara del sistema, la tableta se sale de mappel y quien tocó sin
  querer se queda en otra aplicación, sin barra de atrás visible,
  delante de una pantalla que no reconoce.

  O sea que el botón de «Hacer una foto» era una puerta de salida de
  mappel disfrazada de función de mappel.

  ─────────────────────────────────────────────────────────────
  LO QUE HAY AHORA

  La cámara se abre DENTRO. `getUserMedia` pinta lo que ve el objetivo
  en un recuadro nuestro, con el papel de mappel alrededor, un título
  que dice qué está pasando y dos botones grandes:

      HACER LA FOTO            SALIR

  Nunca se sale de la aplicación, así que siempre hay un camino de
  vuelta a la vista. Es el punto 5 del planteamiento: *«botón volver
  siempre evidente»* y *«nada importante oculto»*.

  ─────────────────────────────────────────────────────────────
  Y NO SE GUARDA NADA SIN ENSEÑARLO

  Antes, la foto se subía en cuanto la cámara la devolvía. Ahora se ve
  primero, en el mismo marco, y hay que decir **Guardar**. Con
  «Repetir» al lado.

  Es el punto 8 del planteamiento aplicado a una foto: *«nunca guardar
  silenciosamente información dudosa»*. Una foto movida del techo de la
  cocina colgada en la pared de la casa es exactamente eso.

  ─────────────────────────────────────────────────────────────
  LA DE DELANTE, Y SE PUEDE GIRAR

  Haris: *«cuando quiero sacar una foto desde la tableta se me pierde
  la opción de cambiar de cámara, de atrás a la de delante; por defecto
  debería ir la de delante, y luego si quieres puedes cambiarla»*.

  Tiene razón en las dos cosas, y la primera es de bulto.

  Esto abría `facingMode: 'environment'` —la de atrás— por herencia del
  móvil, donde es lo correcto: en un teléfono se fotografía una factura.
  Pero **esta tableta está colgada en una pared**. La cámara de atrás
  apunta al azulejo. Todo lo que se puede fotografiar desde aquí está
  DELANTE de la pantalla: la familia, un dibujo que alguien enseña, los
  nietos al pasar por la cocina.

  O sea que no era una preferencia discutible: era la cámara que no
  sirve, puesta por defecto.

  ── Y EL ESPEJO ──

  Con la de delante, lo que se ve va al revés que un espejo si no se
  gira. Aquí se gira la vista Y la foto que sale, las dos. Podría
  guardarse sin girar —es lo que hacen algunos teléfonos— pero entonces
  la foto sale al revés de como se acaba de ver en la pantalla, y eso,
  delante de alguien que acaba de colocarse, parece un fallo.

  **Lo que ves al encuadrar es lo que se guarda.** Esa regla vale más
  que la exactitud del original.

  ── EL BOTÓN SOLO SALE SI HAY DOS ──

  Se cuentan las cámaras de verdad (`enumerateDevices`) después de
  abrir, que es cuando el navegador las deja ver. En una tableta con
  una sola cámara, un botón de girar sería un botón que no hace nada —
  y un botón que no hace nada, en una pared, se toca tres veces.

  ─────────────────────────────────────────────────────────────
  SI NO HAY CÁMARA, O SI NO DEJAN

  Un monitor con un miniPC detrás no tiene cámara; una tableta puede
  tener el permiso denegado. En los dos casos esto lo dice con palabras
  y ofrece el camino de antes —la cámara del sistema o los archivos—,
  que es peor pero funciona. El fallo va hacia «más incómodo», nunca
  hacia «no se puede».
*/

type Estado =
  | { que: 'abriendo' }
  | { que: 'mirando' }
  | { que: 'hecha'; foto: Blob; url: string }
  | { que: 'guardando'; url: string }
  | { que: 'sin-camara'; porque: string }

export default function Camara({
  alGuardar,
  cerrar,
  /** El camino de antes, por si esta tableta no deja abrir la cámara. */
  alUsarLaDelSistema,
}: {
  alGuardar: () => void
  cerrar: () => void
  alUsarLaDelSistema: () => void
}) {
  const video = useRef<HTMLVideoElement | null>(null)
  const senal = useRef<MediaStream | null>(null)
  const [estado, setEstado] = useState<Estado>({ que: 'abriendo' })
  const [fallo, setFallo] = useState<string | null>(null)

  /* Cuál está puesta. `user` es la de delante, y es la de por defecto:
     esta pantalla está colgada en una pared y lo que hay que retratar
     está delante de ella. */
  const [cual, setCual] = useState<'user' | 'environment'>('user')

  /* Cuántas cámaras tiene de verdad esta tableta. Cero mientras no se
     sabe: el botón de girar no aparece hasta que haya dos contadas. */
  const [cuantas, setCuantas] = useState(0)

  const espejo = cual === 'user'

  /* ── Abrir el objetivo, y cerrarlo SIEMPRE al salir ──────────

     Lo de cerrarlo no es limpieza: una cámara que se queda abierta deja
     el piloto encendido en una tableta colgada en una cocina, y eso, en
     una casa, es exactamente la clase de cosa que hace que alguien
     descuelgue la tableta. */
  useEffect(() => {
    let vivo = true

    async function abrir() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (vivo) {
          setEstado({
            que: 'sin-camara',
            porque: 'Esta pantalla no sabe abrir la cámara por su cuenta.',
          })
        }
        return
      }

      /*
        `facingMode` es una PREFERENCIA, no una exigencia: el navegador
        da la que más se parezca. Por eso se pide la elegida y, si esa
        petición falla del todo, se prueba con la otra antes de dar la
        cámara por perdida — una tableta que solo tenga la de atrás
        tiene que seguir haciendo fotos.
      */
      async function pedir(quien: 'user' | 'environment') {
        return navigator.mediaDevices.getUserMedia({
          video: { facingMode: quien, width: { ideal: 1920 } },
          audio: false,
        })
      }

      try {
        let flujo: MediaStream
        try {
          flujo = await pedir(cual)
        } catch (primera) {
          /* Si no hay permiso, no hay segunda oportunidad: volver a
             pedir sería otro aviso en la cara de quien ya ha dicho que
             no. */
          if (primera instanceof Error && primera.name === 'NotAllowedError') throw primera
          flujo = await pedir(cual === 'user' ? 'environment' : 'user')
        }

        if (!vivo) {
          flujo.getTracks().forEach((t) => t.stop())
          return
        }

        senal.current = flujo
        if (video.current) {
          video.current.srcObject = flujo
          await video.current.play().catch(() => {})
        }
        setEstado({ que: 'mirando' })

        /*
          Y ahora se cuentan. Antes de abrir, el navegador devuelve la
          lista sin nombres y a veces incompleta a propósito —es una
          huella digital del aparato—; después del permiso, la da
          entera. Por eso se cuenta aquí y no al montar.
        */
        try {
          const aparatos = await navigator.mediaDevices.enumerateDevices()
          if (vivo) setCuantas(aparatos.filter((a) => a.kind === 'videoinput').length)
        } catch {
          /* Sin la lista, el botón de girar no sale. Se pierde una
             comodidad, no la cámara. */
        }
      } catch (e) {
        if (!vivo) return
        const nombre = e instanceof Error ? e.name : ''
        setEstado({
          que: 'sin-camara',
          porque:
            nombre === 'NotAllowedError'
              ? 'Esta tableta no le ha dado permiso a mappel para usar la cámara.'
              : 'No se ha podido abrir la cámara de esta pantalla.',
        })
      }
    }

    abrir()

    return () => {
      vivo = false
      senal.current?.getTracks().forEach((t) => t.stop())
      senal.current = null
    }
    /*
      Con `cual` dentro: al girar la cámara, React deshace este efecto
      —y la limpieza de arriba APAGA la anterior— y lo vuelve a montar
      con la otra. Sin eso, girar dejaría las dos encendidas a la vez, y
      en una tableta eso es el piloto puesto para siempre.
    */
  }, [cual])

  /* Girar. Se pasa por «abriendo» a propósito: la otra cámara tarda su
     medio segundo, y una pantalla congelada sin decir nada se toca otra
     vez. */
  function girar() {
    setFallo(null)
    setEstado({ que: 'abriendo' })
    setCual((c) => (c === 'user' ? 'environment' : 'user'))
  }

  function hacerla() {
    const v = video.current
    if (!v || !v.videoWidth) return

    const lienzo = document.createElement('canvas')
    lienzo.width = v.videoWidth
    lienzo.height = v.videoHeight
    const pincel = lienzo.getContext('2d')
    if (!pincel) return

    /*
      La foto sale como se ha visto, no como la ve el sensor.

      Con la de delante, el recuadro va girado —si no, colocarse es un
      juego de espejos— así que la foto se gira igual. Guardarla sin
      girar dejaría la foto al revés de lo que se acaba de ver en la
      pantalla, y eso parece una avería.
    */
    if (espejo) {
      pincel.translate(lienzo.width, 0)
      pincel.scale(-1, 1)
    }
    pincel.drawImage(v, 0, 0, lienzo.width, lienzo.height)

    lienzo.toBlob(
      (foto) => {
        if (!foto) {
          setFallo('No se ha podido hacer la foto. Inténtalo otra vez.')
          return
        }
        setFallo(null)
        setEstado({ que: 'hecha', foto, url: URL.createObjectURL(foto) })
      },
      'image/jpeg',
      0.9
    )
  }

  function repetir() {
    if (estado.que === 'hecha') URL.revokeObjectURL(estado.url)
    setFallo(null)
    setEstado({ que: 'mirando' })
  }

  async function guardar() {
    if (estado.que !== 'hecha') return
    const { foto, url } = estado
    setEstado({ que: 'guardando', url })
    setFallo(null)

    try {
      const fichero = new File([foto], `pared-${Date.now()}.jpg`, { type: 'image/jpeg' })
      const lista = await encoger(fichero)

      const paquete = new FormData()
      paquete.append('foto', lista)

      const r = await fetch(api('/api/fotos'), { method: 'POST', body: paquete })
      const d = (await r.json().catch(() => null)) as { error?: string } | null

      if (!r.ok) {
        setFallo(d?.error ?? 'No se ha podido guardar la foto.')
        setEstado({ que: 'hecha', foto, url })
        return
      }

      URL.revokeObjectURL(url)
      alGuardar()
      cerrar()
    } catch {
      setFallo('No se ha podido guardar la foto.')
      setEstado({ que: 'hecha', foto, url })
    }
  }

  const laQueSeVe = estado.que === 'hecha' || estado.que === 'guardando' ? estado.url : null

  return (
    /*
      El mismo telón que `poner.tsx` y `comprobar.tsx`. Dos maneras
      distintas de abrir una ventana en la misma pared serían dos cosas
      que aprender donde solo hay una.

      Y NO se cierra al tocar el telón: con la cámara abierta, un roce
      al ir a encuadrar cerraría la pantalla a media foto. Se sale por
      el botón, que es lo que Haris pedía.
    */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-10 py-8"
      style={{ background: 'rgba(26,23,20,.72)' }}
    >
      <div className="flex max-h-full w-full max-w-[1100px] flex-col rounded-[36px] border border-borde bg-fondo px-10 py-8">
        <p className="shrink-0 text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">
          Una foto para la casa
        </p>

        {/* ── EL MARCO ──────────────────────────────────────── */}
        <div
          className="mt-5 min-h-0 flex-1 overflow-hidden rounded-[28px] border"
          style={{ borderColor: 'var(--t-borde)', background: '#01071B' }}
        >
          {estado.que === 'sin-camara' ? (
            <div className="flex h-full items-center justify-center px-10 py-12">
              <p className="text-center text-[25px] font-extrabold leading-snug text-fondo">
                {estado.porque}
              </p>
            </div>
          ) : laQueSeVe ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={laQueSeVe}
              alt="La foto que acabas de hacer"
              className="h-full w-full object-contain"
            />
          ) : (
            <video
              ref={video}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-contain"
              /* El espejo, sólo con la de delante. Con la de atrás
                 girar la imagen sería enseñar la cocina al revés. */
              style={espejo ? { transform: 'scaleX(-1)' } : undefined}
            />
          )}
        </div>

        {fallo && (
          <p className="mt-4 shrink-0 text-[21px] font-bold" style={{ color: 'var(--t-alerta)' }}>
            {fallo}
          </p>
        )}

        {/* ── LOS BOTONES, SIEMPRE LOS MISMOS SITIOS ────────── */}
        <div className="mt-6 flex shrink-0 flex-wrap items-center gap-3">
          {estado.que === 'sin-camara' ? (
            <Boton principal onClick={alUsarLaDelSistema}>
              <Ico nombre="foto" tam={26} grosor={2.2} />
              Usar la cámara de la tableta
            </Boton>
          ) : estado.que === 'hecha' || estado.que === 'guardando' ? (
            <>
              <Boton
                principal
                onClick={guardar}
                desactivado={estado.que === 'guardando'}
              >
                <Ico nombre="check" tam={26} grosor={2.6} />
                {estado.que === 'guardando' ? 'Guardando…' : 'Guardar'}
              </Boton>
              <Boton onClick={repetir} desactivado={estado.que === 'guardando'}>
                <Ico nombre="refrescar" tam={24} grosor={2.4} />
                Repetir
              </Boton>
            </>
          ) : (
            <>
              <Boton principal onClick={hacerla} desactivado={estado.que === 'abriendo'}>
                <Ico nombre="foto" tam={26} grosor={2.2} />
                {estado.que === 'abriendo' ? 'Abriendo la cámara…' : 'Hacer la foto'}
              </Boton>

              {/*
                Y girar, sólo si de verdad hay dos. Con nombre, no con
                un icono suelto: el punto 5 del planteamiento dice
                iconos SIEMPRE acompañados de texto, y «girar» a secas
                no distingue entre cambiar de cámara y voltear la foto.
              */}
              {cuantas > 1 && (
                <Boton onClick={girar} desactivado={estado.que === 'abriendo'}>
                  <Ico nombre="refrescar" tam={24} grosor={2.4} />
                  {espejo ? 'Usar la de atrás' : 'Usar la de delante'}
                </Boton>
              )}
            </>
          )}

          {/*
            SALIR, SIEMPRE, Y A LA DERECHA DEL TODO.

            Es lo que faltaba. Está en los cinco estados —abriendo,
            mirando, hecha, guardando y sin cámara— porque el momento en
            que alguien quiere salir es justamente el que no se puede
            prever: casi siempre es el primero, el de «he tocado esto
            sin querer».
          */}
          <span className="ml-auto">
            <Boton onClick={cerrar}>
              <Ico nombre="atras" tam={24} grosor={2.6} />
              Salir
            </Boton>
          </span>
        </div>
      </div>
    </div>
  )
}

/*
  Los botones de la pared. Los mismos que `poner.tsx` y `comprobar.tsx`,
  y por lo mismo: las piezas del sistema miden 60 px porque son las del
  teléfono, y aquí harían botones de móvil en una pantalla de 27
  pulgadas.
*/
function Boton({
  children,
  onClick,
  principal = false,
  desactivado = false,
}: {
  children: React.ReactNode
  onClick: () => void
  principal?: boolean
  desactivado?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivado}
      className="tocable flex items-center justify-center gap-3 rounded-full border px-9 text-[22px] font-extrabold disabled:opacity-45"
      style={{
        minHeight: 72,
        background: principal ? 'var(--t-boton)' : 'var(--t-superficie)',
        color: principal ? 'var(--t-boton-texto)' : 'var(--t-tinta)',
        borderColor: principal ? 'transparent' : 'var(--t-borde)',
      }}
    >
      {children}
    </button>
  )
}
