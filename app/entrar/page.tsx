'use client'


import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteNavegador } from '@/lib/supabase/navegador'
import { Ico, Logo } from '../iconos'
import ColorDeBarra from '../color-barra'

/*
  Tres pasos, no dos.

  El de en medio —'alta'— solo lo ve quien viene invitado: escribe su
  correo y la palabra que le han dado, y a partir de ahí sigue por el
  mismo camino de siempre, el del número por correo. Se separa a
  propósito de «Entrar»: quien ya tiene cuenta no debería ver jamás un
  campo que le pida una palabra de invitación que no tiene.
*/
type Paso = 'correo' | 'alta' | 'codigo'

export default function Entrar() {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>('correo')
  const [correo, setCorreo] = useState('')
  const [palabra, setPalabra] = useState('')
  const [codigo, setCodigo] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [espera, setEspera] = useState(0)

  // Cuenta atrás para poder pedir otro código
  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  async function pedirCodigo(e: React.FormEvent) {
    e.preventDefault()
    setAviso(null)
    setOcupado(true)

    const supabase = clienteNavegador()
    const { error } = await supabase.auth.signInWithOtp({
      email: correo.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    })

    setOcupado(false)

    if (error) {
      const segundos = segundosDeEspera(error.message)
      if (segundos) setEspera(segundos)
      setAviso(mensajeClaro(error.message, 'correo'))
      // Si el problema es solo la espera, el código anterior sigue
      // valiendo: le dejamos pasar a escribirlo.
      if (segundos) setPaso('codigo')
      return
    }

    setEspera(60)
    setPaso('codigo')
  }

  /*
    Crear la cuenta y, acto seguido, pedir el número.

    Son dos pasos para HUBI y uno solo para quien se apunta: escribe su
    correo y su palabra, y lo siguiente que ve es la pantalla del
    número, igual que quien ya tenía cuenta. Cuantas menos pantallas
    distintas, menos sitios donde perderse.

    La palabra la comprueba el SERVIDOR. Aquí no está escrita en
    ninguna parte — si lo estuviera, la tendría cualquiera que abriera
    las herramientas del navegador.
  */
  async function crearCuenta(e: React.FormEvent) {
    e.preventDefault()
    setAviso(null)
    setOcupado(true)

    const email = correo.trim().toLowerCase()

    const r = await fetch('/api/alta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: email, palabra }),
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      error?: string
      detalle?: string
    } | null

    /*
      NO BASTA CON QUE LA RESPUESTA SEA «CORRECTA».

      Aquí sólo se miraba `r.ok`, y eso escondió el fallo una tarde
      entera: el proxy redirigía esta llamada a `/entrar`, el navegador
      seguía la redirección sin avisar, y lo que volvía era la PÁGINA
      DE ENTRAR con un 200 impecable. `r.ok` decía que sí sobre una
      cuenta que nadie había creado.

      Un 200 sólo dice que algo contestó. Lo que hay que exigir es que
      conteste LO QUE SE ESPERABA — y esta ruta contesta `bien: true`.
      Si viene otra cosa, es que no ha contestado ella.
    */
    if (!r.ok || d?.bien !== true) {
      setOcupado(false)
      setAviso(
        d
          ? [d.error ?? 'No se ha podido crear la cuenta.', d.detalle]
              .filter(Boolean)
              .join(' · ')
          : 'HUBI no ha llegado a intentar crear la cuenta. No es cosa tuya: avisa a quien lo mantiene.'
      )
      return
    }

    const supabase = clienteNavegador()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })

    setOcupado(false)

    if (error) {
      const segundos = segundosDeEspera(error.message)
      if (segundos) setEspera(segundos)
      setAviso(mensajeClaro(error.message, 'alta'))
      if (segundos) setPaso('codigo')
      return
    }

    setEspera(60)
    setPaso('codigo')
  }

  async function comprobarCodigo(e: React.FormEvent) {
    e.preventDefault()
    setAviso(null)
    setOcupado(true)

    const supabase = clienteNavegador()
    const { error } = await supabase.auth.verifyOtp({
      email: correo.trim().toLowerCase(),
      token: codigo.trim(),
      type: 'email',
    })

    setOcupado(false)

    if (error) {
      setAviso(mensajeClaro(error.message, 'codigo'))
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main
      className="techo relative flex min-h-screen flex-col justify-center overflow-hidden px-6 pb-16"
      style={{ background: '#01071B' }}
    >
      {/* El color que va a la deriva por detrás */}
      <ColorDeBarra color="#01071B" />

      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="mancha deriva-1" style={{ width: 330, height: 330, left: -130, top: -100, background: 'rgba(20,184,166,.40)' }} />
        <span className="mancha deriva-3" style={{ width: 320, height: 320, right: -135, top: 0, background: 'rgba(249,115,22,.34)' }} />
        <span className="mancha deriva-2" style={{ width: 360, height: 360, right: -120, bottom: -130, background: 'rgba(236,72,110,.30)' }} />
        <span className="mancha deriva-4" style={{ width: 320, height: 320, left: -120, bottom: -110, background: 'rgba(59,130,246,.30)' }} />
        <span
          className="absolute inset-0"
          style={{ background: 'radial-gradient(74% 46% at 50% 40%, rgba(1,7,27,.94) 0%, rgba(1,7,27,.55) 55%, transparent 100%)' }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-md">
        <div className="flex justify-center">
          <span
            className="flex h-[106px] w-[106px] items-center justify-center rounded-[32px]"
            style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)' }}
          >
            <Logo tam={66} oscuro />
          </span>
        </div>
        <h1 className="mt-5 text-center text-[34px] font-extrabold tracking-[0.09em] text-white">
          HUBI
        </h1>
        <p className="mt-1.5 text-center text-[16.5px] font-semibold text-apagado">
          Todo lo importante, en un mismo lugar.
        </p>

        <div
          className="mt-10 rounded-[24px] p-6"
          style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.13)' }}
        >
          {paso === 'correo' ? (
            <form onSubmit={pedirCodigo}>
              <label htmlFor="correo" className="block text-[17px] font-bold text-white">
                Escribe tu correo
              </label>

              <input
                id="correo"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                autoFocus
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="nombre@gmail.com"
                className="mt-3 h-[62px] w-full rounded-[16px] px-4 font-semibold text-white placeholder:text-apagado focus:outline-none" style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)' }}
              />

              <button
                type="submit"
                disabled={ocupado || correo.length < 5}
                className="mt-4 flex h-[62px] w-full items-center justify-center rounded-[16px] bg-verde text-[18px] font-extrabold text-white transition disabled:opacity-40"
              >
                {ocupado ? 'Enviando…' : 'Continuar'}
              </button>

              <p className="mt-4 text-center text-[15px] font-semibold leading-relaxed text-apagado">
                Te enviaremos un número por correo.
                <br />
                No hace falta recordar ninguna contraseña.
              </p>

              <button
                type="button"
                onClick={() => {
                  if (correo.trim().length < 5) {
                    setAviso('Escribe primero tu correo.')
                    return
                  }
                  setAviso(null)
                  setPaso('codigo')
                }}
                className="mt-2 w-full py-3 text-[15px] font-bold text-apagado underline underline-offset-4"
              >
                Ya tengo un código
              </button>

              <button
                type="button"
                onClick={() => {
                  setAviso(null)
                  setPaso('alta')
                }}
                className="mt-1 w-full py-3 text-[15px] font-bold text-apagado underline underline-offset-4"
              >
                Todavía no tengo cuenta
              </button>
            </form>
          ) : paso === 'alta' ? (
            <form onSubmit={crearCuenta}>
              <p className="text-[16.5px] font-semibold leading-snug text-apagado">
                HUBI todavía no está abierto a todo el mundo. Para crear tu casa hace
                falta la palabra que te haya dado quien te invitó.
              </p>

              <label htmlFor="correo-alta" className="mt-6 block text-[17px] font-bold text-white">
                Tu correo
              </label>
              <input
                id="correo-alta"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                autoFocus
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="nombre@gmail.com"
                className="mt-3 h-[62px] w-full rounded-[16px] px-4 font-semibold text-white placeholder:text-apagado focus:outline-none"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)' }}
              />

              <label htmlFor="palabra" className="mt-5 block text-[17px] font-bold text-white">
                La palabra de invitación
              </label>
              <input
                id="palabra"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                required
                value={palabra}
                onChange={(e) => setPalabra(e.target.value)}
                placeholder="la que te han dado"
                className="mt-3 h-[62px] w-full rounded-[16px] px-4 font-semibold text-white placeholder:text-apagado focus:outline-none"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)' }}
              />

              <button
                type="submit"
                disabled={ocupado || correo.trim().length < 5 || palabra.trim().length < 2}
                className="mt-5 flex h-[62px] w-full items-center justify-center rounded-[16px] bg-verde text-[18px] font-extrabold text-white transition disabled:opacity-40"
              >
                {ocupado ? 'Creando…' : 'Crear mi cuenta'}
              </button>

              <p className="mt-4 text-center text-[15px] font-semibold leading-relaxed text-apagado">
                Después te enviaremos un número por correo.
                <br />
                No hace falta inventarse ninguna contraseña.
              </p>

              <button
                type="button"
                onClick={() => {
                  setAviso(null)
                  setPalabra('')
                  setPaso('correo')
                }}
                className="mt-2 w-full py-3 text-[15px] font-bold text-apagado underline underline-offset-4"
              >
                Ya tengo cuenta
              </button>
            </form>
          ) : (
            <form onSubmit={comprobarCodigo}>
              <p className="text-[16.5px] font-semibold text-apagado">Hemos enviado un número a</p>
              <p className="mt-0.5 break-all text-[17px] font-extrabold text-white">{correo}</p>

              <label htmlFor="codigo" className="mt-6 block text-[17px] font-bold text-white">
                Escríbelo aquí
              </label>

              <input
                id="codigo"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                required
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="mt-3 h-[68px] w-full rounded-[16px] px-4 text-center text-[30px] font-extrabold tracking-[0.25em] text-white placeholder:text-apagado focus:outline-none" style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)' }}
              />

              <button
                type="submit"
                disabled={ocupado || codigo.length < 6}
                className="mt-4 flex h-[62px] w-full items-center justify-center rounded-[16px] bg-verde text-[18px] font-extrabold text-white transition disabled:opacity-40"
              >
                {ocupado ? 'Comprobando…' : 'Entrar'}
              </button>

              <button
                type="button"
                disabled={espera > 0 || ocupado}
                onClick={() => {
                  setAviso(null)
                  setCodigo('')
                  setPalabra('')
                  setPaso('correo')
                }}
                className="mt-3 w-full py-3 text-[16px] font-bold text-apagado underline underline-offset-4 disabled:no-underline disabled:opacity-50"
              >
                {espera > 0
                  ? `Puedes pedir otro código en ${espera} s`
                  : 'Pedir otro código'}
              </button>
            </form>
          )}

          {aviso && (
            <p className="mt-5 rounded-[16px] px-4 py-3.5 text-[16px] font-semibold leading-snug text-coral" style={{ background: 'rgba(255,107,107,.14)' }}>
              {aviso}
            </p>
          )}
        </div>

        {/* Ya no dice «Solo Juan Miguel y Conchita»: era verdad hasta
            hoy y ahora sería mentira, y a quien acaba de recibir una
            invitación le diría que se ha equivocado de sitio. */}
        <p className="mt-8 flex items-center justify-center gap-2 text-[14px] font-bold text-tenue">
          <Ico nombre="candado" tam={18} grosor={2} />
          Cada casa ve solo lo suyo
        </p>
      </div>
    </main>
  )
}

/** Si Supabase pide esperar, devuelve cuántos segundos. */
function segundosDeEspera(original: string): number | null {
  const m = original.match(/after (\d+) seconds?/i)
  if (m) return parseInt(m[1], 10)
  if (/security purposes|rate limit|too many/i.test(original)) return 60
  return null
}

/** Traduce los errores técnicos de Supabase a algo comprensible. */
/*
  ═══════════════════════════════════════════════════════════════
  TRADUCIR EL ERROR SIN INVENTARSE LA CAUSA
  ═══════════════════════════════════════════════════════════════

  Aquí había un fallo que engañaba, y de los caros: la regla
  «si el error contiene "invalid", di que el número está mal» se
  tragaba también el «Invalid API key» que devuelve Supabase cuando la
  aplicación está mal configurada.

  Resultado: alguien escribía su correo, pulsaba Continuar, y HUBI le
  contestaba «ese número no es correcto» — hablándole de un código que
  aún no había escrito. Con eso, la persona se pone a mirar su bandeja
  de entrada y a copiar números durante media hora, buscando un fallo
  que estaba en otro sitio.

  Un mensaje que señala mal es peor que uno genérico: manda a buscar
  donde no hay nada. Así que ahora:

  · Se mira PRIMERO lo concreto (la clave mal puesta, el correo sin
    acceso, el código caducado).
  · Y sobre todo, se le dice EN QUÉ PASO estamos. Estando en el
    correo, esta función no puede decir nada sobre el número: no ha
    habido ninguno.
*/
function mensajeClaro(original: string, paso: Paso): string {
  const e = original.toLowerCase()

  const segundos = segundosDeEspera(original)
  if (segundos) {
    return `Acabas de pedir un código. Si ya te ha llegado uno, escríbelo aquí abajo. Para pedir otro nuevo, espera ${segundos} segundos.`
  }

  /* Esto NO es culpa de quien entra: es la aplicación, que no está
     bien configurada. Decirlo así evita que alguien se pase la tarde
     probando códigos buenos. */
  if (e.includes('api key') || e.includes('anon key') || e.includes('jwt')) {
    return 'HUBI no está bien conectado con su base de datos. No es cosa tuya: avisa a quien lo mantiene.'
  }
  /*
    «Signups not allowed for otp» significa UNA cosa: Supabase no
    encuentra ese usuario. Pero significa cosas muy distintas según
    dónde estemos, y decir siempre lo mismo mandó a buscar un fallo
    donde no lo había.

    · Entrando: es verdad, ese correo no está dado de alta.
    · Recién creada la cuenta: es imposible que sea el correo — se
      acaba de crear. Es la aplicación, y hay que decirlo así.
  */
  if (e.includes('signups not allowed') || e.includes('not authorized')) {
    return paso === 'alta'
      ? 'La cuenta se ha creado pero HUBI no ha podido mandarte el número. No es cosa tuya: hay que mirar los ajustes de registro en Supabase.'
      : 'Este correo no tiene acceso a HUBI. Revisa que esté bien escrito, o crea tu cuenta ahí abajo.'
  }
  if (e.includes('rate limit') || e.includes('too many')) {
    return 'Se han pedido demasiados códigos en poco rato. Espera unos minutos y vuelve a intentarlo.'
  }
  if (e.includes('sending') || e.includes('smtp') || e.includes('mail')) {
    return 'No se ha podido enviar el correo con el código. Inténtalo dentro de un rato.'
  }
  if (e.includes('fetch') || e.includes('network')) {
    return 'No hay conexión con el servidor. Comprueba tu internet.'
  }
  if (e.includes('expired')) {
    return 'Ese código ya ha caducado. Pide uno nuevo.'
  }

  /* Solo AQUÍ se puede hablar del número, y solo si de verdad se ha
     escrito uno. En el paso del correo, hablar del código es mandar a
     alguien a buscar donde no hay nada. */
  if (paso === 'codigo' && (e.includes('invalid') || e.includes('token'))) {
    return 'Ese número no es correcto. Cópialo del correo tal cual, sin espacios.'
  }

  return 'Algo no ha funcionado. Inténtalo de nuevo en un momento.'
}
