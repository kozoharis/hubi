'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Aviso, BotonPrincipal, BotonSecundario } from '../../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  COLGAR UNA PANTALLA
  ═══════════════════════════════════════════════════════════════

  Dos campos y un botón. Y después, lo único que de verdad hay que
  saber: **qué se hace con la tableta en la mano**.

  Ésa es la parte que casi siempre falta en estas pantallas. Dar de
  alta el aparato es fácil; lo que nadie cuenta es que luego hay que ir
  a la tableta, abrir HUBI, escribir ese correo y teclear un código de
  seis cifras que llega al buzón. Si eso no está escrito aquí, hay que
  acordarse — y no se acuerda nadie.
*/
export default function AnadirPantalla({ cuantas }: { cuantas: number }) {
  const router = useRouter()

  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('La cocina')
  const [correo, setCorreo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<{ que: string; porque?: string } | null>(null)
  const [lista, setLista] = useState<string | null>(null)

  async function crear() {
    setOcupado(true)
    setFallo(null)

    try {
      const r = await fetch(api('/api/pantallas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), correo: correo.trim() }),
      })
      const d = (await r.json().catch(() => null)) as {
        bien?: boolean
        error?: string
        detalle?: string
        correo?: string
      } | null

      if (!r.ok || d?.bien !== true) {
        setFallo({ que: d?.error ?? 'No se ha podido.', porque: d?.detalle })
        return
      }

      setLista(d.correo ?? correo.trim().toLowerCase())
      setAbierto(false)
      router.refresh()
    } catch {
      setFallo({ que: 'No hay conexión. Inténtalo otra vez.' })
    } finally {
      setOcupado(false)
    }
  }

  /* ── Recién creada: lo que hay que hacer AHORA, con la tableta ── */
  if (lista) {
    return (
      <div className="rounded-[24px] bg-superficie px-6 py-5">
        <p className="t-cuerpo font-extrabold text-verde">La pantalla ya está dada de alta</p>

        <p className="t-apoyo mt-2 leading-relaxed">Ahora, en la tableta:</p>

        <ol className="mt-3 space-y-2.5">
          {[
            'Abre HUBI en su navegador.',
            <>
              Escribe este correo: <strong className="text-tinta">{lista}</strong>
            </>,
            'Le llegará un código de seis cifras. Ábrelo en tu buzón y tecléalo en la tableta.',
            'Y ya está. Esa sesión se queda puesta: no hay que volver a entrar.',
          ].map((paso, i) => (
            <li key={i} className="flex gap-3">
              <span className="t-cuerpo shrink-0 font-extrabold tabular-nums text-tenue">
                {i + 1}
              </span>
              <span className="t-apoyo leading-relaxed">{paso}</span>
            </li>
          ))}
        </ol>

        <p className="t-apoyo mt-4 leading-relaxed">
          Lo que verá es lo que has decidido aquí arriba. Puedes cambiarlo cuando quieras y la
          pantalla se entera sola.
        </p>
      </div>
    )
  }

  /* ── El formulario ── */
  if (abierto) {
    return (
      <div className="rounded-[24px] bg-superficie px-6 py-5">
        <p className="t-cuerpo font-extrabold">Una pantalla nueva</p>

        <label className="mt-4 block">
          <span className="t-apoyo">¿Dónde va a estar?</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="La cocina"
            className="r-campo mt-1.5 w-full border border-borde bg-fondo px-4 py-3.5 text-[17px]"
          />
        </label>

        <label className="mt-3.5 block">
          <span className="t-apoyo">Un correo nuevo, solo para ella</span>
          <input
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            inputMode="email"
            autoComplete="off"
            placeholder="tunombre+cocina@gmail.com"
            className="r-campo mt-1.5 w-full border border-borde bg-fondo px-4 py-3.5 text-[17px]"
          />
        </label>

        {/*
          Esto no es un consejo: es la única parte del formulario que
          se puede hacer mal de una manera que no tiene arreglo. Si se
          pone el correo de una persona, su cuenta se convertiría en la
          pantalla, y `clase` no se cambia después ni a mano.

          Por eso el servidor lo rechaza — pero se dice ANTES, que es
          cuando sirve.
        */}
        <p className="t-apoyo mt-3 leading-relaxed">
          Tiene que ser una dirección que no use ninguna persona. Si tu correo es
          <strong className="text-tinta"> nombre@gmail.com</strong>, vale
          <strong className="text-tinta"> nombre+cocina@gmail.com</strong>: es otra dirección
          para HUBI y las cartas te llegan a ti igual.
        </p>

        {fallo && (
          <div className="mt-4">
            <Aviso titulo={fallo.que} explicacion={fallo.porque} />
          </div>
        )}

        {/* Los del sistema (`app/piezas.tsx`), no dos botones pintados
            a mano aquí: es lo que ese archivo existe para evitar, y lo
            dice él mismo en su comentario. */}
        <div className="mt-4 space-y-2.5">
          <BotonPrincipal
            onClick={crear}
            desactivado={ocupado || correo.trim().length < 5}
            porQue={correo.trim().length < 5 ? 'Falta el correo de la pantalla.' : undefined}
          >
            {ocupado ? 'Dándola de alta…' : 'Dar de alta la pantalla'}
          </BotonPrincipal>

          <BotonSecundario
            onClick={() => {
              setAbierto(false)
              setFallo(null)
            }}
          >
            Dejarlo
          </BotonSecundario>
        </div>
      </div>
    )
  }

  /* ── El botón ── */
  return (
    <div className="rounded-[24px] bg-superficie px-6 py-5">
      <p className="t-cuerpo font-extrabold">
        {cuantas === 0
          ? 'Colgar una pantalla en casa'
          : cuantas === 1
            ? 'Hay una pantalla dada de alta'
            : `Hay ${cuantas} pantallas dadas de alta`}
      </p>
      <p className="t-apoyo mt-1.5 leading-relaxed">
        Una tableta vieja en la pared de la cocina, encendida todo el día, con lo que hay que
        recordar. No hace falta instalar nada: se abre HUBI en su navegador y se queda.
      </p>
      <div className="mt-4">
        <BotonSecundario onClick={() => setAbierto(true)} icono="mas">
          {cuantas === 0 ? 'Añadir una pantalla' : 'Añadir otra'}
        </BotonSecundario>
      </div>
    </div>
  )
}
