'use client'


import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteNavegador } from '@/lib/supabase/navegador'
import { Ico, Logo } from '../iconos'
import ColorDeBarra from '../color-barra'

type Paso = 'correo' | 'codigo'

export default function Entrar() {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>('correo')
  const [correo, setCorreo] = useState('')
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
      setAviso(mensajeClaro(error.message))
      // Si el problema es solo la espera, el código anterior sigue
      // valiendo: le dejamos pasar a escribirlo.
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
      setAviso(mensajeClaro(error.message))
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

        <p className="mt-8 flex items-center justify-center gap-2 text-[14px] font-bold text-tenue">
          <Ico nombre="candado" tam={18} grosor={2} />
          Solo Juan Miguel y Conchita
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
function mensajeClaro(original: string): string {
  const e = original.toLowerCase()

  const segundos = segundosDeEspera(original)
  if (segundos) {
    return `Acabas de pedir un código. Si ya te ha llegado uno, escríbelo aquí abajo. Para pedir otro nuevo, espera ${segundos} segundos.`
  }
  if (e.includes('signups not allowed') || e.includes('not authorized')) {
    return 'Este correo no tiene acceso a HUBI. Revisa que esté bien escrito.'
  }
  if (e.includes('expired')) {
    return 'Ese código ya ha caducado. Pide uno nuevo.'
  }
  if (e.includes('invalid') || e.includes('token')) {
    return 'Ese número no es correcto. Cópialo del correo tal cual, sin espacios.'
  }
  if (e.includes('fetch') || e.includes('network')) {
    return 'No hay conexión con el servidor. Comprueba tu internet.'
  }
  return 'Algo no ha funcionado. Inténtalo de nuevo en un momento.'
}
