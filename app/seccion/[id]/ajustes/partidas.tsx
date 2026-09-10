'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../../../iconos'
import { Aviso } from '../../../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  LAS PARTIDAS DE UNA ACTIVIDAD
  ═══════════════════════════════════════════════════════════════

  Albañilería · Instalaciones · Carpintería · Luz · Agua · Productos

  Es el punto 11 del planteamiento, que llevaba sin hacerse desde el
  primer día: las categorías siempre estuvieron en la base de datos,
  pero no había ningún botón para tocarlas. Para apuntar que ahora
  también se gasta en carpintería había que llamar a un programador.

  ─────────────────────────────────────────────────────────────
  «PARTIDA», NO «CATEGORÍA»

  «Categoría» es la palabra del programa. «Partida» es la que usa
  quien lleva una obra, y también se entiende en una finca. Y sobre
  todo NO se confunde con la unidad, que es el otro eje:

      La OBRA es de quién es el gasto.
      La PARTIDA es de qué es.

  ─────────────────────────────────────────────────────────────
  GASTOS E INGRESOS, SEPARADOS Y A LA VISTA

  Podrían mezclarse en una lista con una etiqueta al lado. Se separan
  a propósito: al crear una, la pregunta «¿esto es un gasto o un
  ingreso?» desaparece —ya la contestó el botón que pulsó— y una
  partida en el lado equivocado dejaría el balance al revés sin que se
  vea por qué.
*/

export type Partida = {
  id: string
  nombre: string
  /**
   * Cuántas cosas cuelgan de ella, para avisar antes de retirarla.
   *
   * En las de dinero son movimientos; en las de papel —Contratos,
   * Seguros— son documentos, porque ahí no hay ni un movimiento. La
   * pantalla lo llama de una u otra manera según cuál sea.
   */
  apuntes: number
}

export default function Partidas({
  seccionId,
  gastos,
  ingresos,
  papeles,
}: {
  seccionId: string
  gastos: Partida[]
  ingresos: Partida[]
  papeles: Partida[]
}) {
  return (
    <>
      <Lista
        seccionId={seccionId}
        naturaleza="gasto"
        titulo="En qué se gasta"
        pie="Albañilería, luz, materiales… lo que compras o pagas."
        partidas={gastos}
      />
      <Lista
        seccionId={seccionId}
        naturaleza="ingreso"
        titulo="De dónde entra"
        pie="Lo que cobras: certificaciones, ventas, alquileres…"
        partidas={ingresos}
      />
      {/*
        ── Y LA TERCERA, QUE NO ES DINERO ──

        El contrato del piso, la póliza, la licencia de obra. Tienen
        fecha y muchas veces tienen un importe escrito dentro, y aun
        así no se gasta ni se cobra nada el día que los firmas.

        Por eso son carpetas aparte y de naturaleza 'neutro': si el
        contrato de alquiler viviera en Ingresos, un piso de 750 € al
        mes tendría 9.000 € de más el día del alta.
      */}
      <Lista
        seccionId={seccionId}
        naturaleza="neutro"
        titulo="Qué papeles guardas"
        pie="Contratos, pólizas, licencias… lo que hay que tener aunque no sea dinero."
        partidas={papeles}
      />
    </>
  )
}

function Lista({
  seccionId,
  naturaleza,
  titulo,
  pie,
  partidas,
}: {
  seccionId: string
  naturaleza: 'gasto' | 'ingreso' | 'neutro'
  titulo: string
  pie: string
  partidas: Partida[]
}) {
  const router = useRouter()

  /*
    LAS PALABRAS CAMBIAN, LA PANTALLA NO.

    En una carpeta de papeles no hay apuntes: hay papeles. Decir «no
    tiene nada apuntado» sobre Contratos —con el contrato dentro— es
    falso, y quien lee eso retira la carpeta creyendo que está vacía.
  */
  const esPapel = naturaleza === 'neutro'
  const cosa = esPapel
    ? { uno: 'papel', varios: 'papeles', nueva: 'Nueva carpeta', ejemplo: 'Licencias' }
    : {
        uno: 'apunte',
        varios: 'apuntes',
        nueva: 'Nueva partida',
        ejemplo: naturaleza === 'gasto' ? 'Carpintería' : 'Certificaciones',
      }

  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  /* Cuál se está preguntando si se retira. Antes esto lo hacía el
     diálogo del navegador y no había que guardar nada. */
  const [retirando, setRetirando] = useState<Partida | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function crear() {
    setFallo(null)
    setAviso(null)
    setOcupado(true)

    const r = await fetch('/api/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seccion_id: seccionId, nombre: nombre.trim(), naturaleza }),
    })

    const d = (await r.json().catch(() => ({}))) as { error?: string; aviso?: string }
    setOcupado(false)

    if (!r.ok) {
      setFallo(d.error ?? 'No se ha podido crear.')
      return
    }

    if (d.aviso) setAviso(d.aviso)
    setNombre('')
    setCreando(false)
    router.refresh()
  }

  async function renombrar(id: string) {
    if (nuevoNombre.trim().length < 2) return
    setOcupado(true)
    setFallo(null)

    const r = await fetch('/api/categorias', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, nombre: nuevoNombre.trim() }),
    })

    setOcupado(false)
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setFallo(d.error ?? 'No se ha podido cambiar el nombre.')
      return
    }
    setEditando(null)
    router.refresh()
  }

  /*
    ═══════════════════════════════════════════════════════════
    AQUÍ HABÍA UN `window.confirm()`
    ═══════════════════════════════════════════════════════════

    El diálogo gris del navegador: letra pequeña, botones diminutos, en
    inglés en algunos teléfonos, y encima con los saltos de línea
    escritos a mano con `\n\n` porque no admite otra cosa.

    Justo en el momento de más riesgo, la aplicación dejaba de ser la
    aplicación. Ahora la pregunta se hace dentro, con las mismas
    palabras y con los botones del sistema — y el que borra no va
    relleno de rojo: borde y texto, que se distingue y cuesta un poco
    más de pulsar a propósito.
  */
  function loQueHayDentro(p: Partida): string {
    if (p.apuntes === 0) {
      return esPapel ? 'No tiene ningún papel dentro.' : 'No tiene nada apuntado.'
    }
    return esPapel
      ? `Tiene ${p.apuntes} ${p.apuntes === 1 ? 'papel' : 'papeles'}, y no se pierden: siguen guardados y se siguen viendo.`
      : `Tiene ${p.apuntes} ${p.apuntes === 1 ? 'apunte' : 'apuntes'}, y no se pierden: siguen contando en las cuentas de siempre.`
  }

  const loQuePasaLuego = esPapel
    ? 'Deja de salir al guardar papeles nuevos.'
    : 'Deja de salir al apuntar cosas nuevas.'

  async function retirar(p: Partida) {
    setOcupado(true)
    const r = await fetch(`/api/categorias?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' })
    setOcupado(false)

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setFallo(d.error ?? 'No se ha podido retirar.')
      return
    }
    setRetirando(null)
    router.refresh()
  }

  return (
    <section className="mt-6">
      <h2 className="rotulo">{titulo}</h2>
      <p className="t-apoyo mt-1">{pie}</p>

      {partidas.length > 0 && (
        <ul className="mt-3 space-y-2">
          {partidas.map((p) => (
            <li key={p.id} className="rounded-[20px] border border-borde bg-superficie px-4 py-3">
              {editando === p.id ? (
                <div>
                  <input
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    className="entrada"
                    autoFocus
                    maxLength={40}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => renombrar(p.id)}
                      disabled={ocupado}
                      className="t-cuerpo h-[60px] flex-1 rounded-[16px] font-extrabold disabled:opacity-50"
                      style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditando(null)}
                      className="t-cuerpo h-[60px] flex-1 rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta"
                    >
                      Dejarlo
                    </button>
                  </div>
                </div>
              ) : (
                <>
                <div className="flex min-h-[52px] items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="t-cuerpo truncate font-extrabold">{p.nombre}</p>
                    {p.apuntes > 0 && (
                      <p className="t-apoyo">
                        {p.apuntes} {p.apuntes === 1 ? cosa.uno : cosa.varios}
                      </p>
                    )}
                  </div>
                  {/*
                    EL BOTÓN DE RETIRAR LLEVABA UN TRIÁNGULO DE AVISO.

                    Un icono de advertencia haciendo de papelera, sin
                    texto, en 48×48. Nadie puede adivinar que eso borra
                    — y contradice la regla del planteamiento: los
                    iconos van siempre acompañados de texto.

                    Ahora los dos llevan su palabra.
                  */}
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => {
                        setEditando(p.id)
                        setNuevoNombre(p.nombre)
                      }}
                      className="t-apoyo flex h-12 items-center gap-1.5 rounded-[16px] border border-borde bg-superficie px-3 font-extrabold text-tinta"
                    >
                      <Ico nombre="lapiz" tam={18} grosor={2.2} />
                      Cambiar
                    </button>
                    <button
                      onClick={() => setRetirando(p)}
                      className="t-apoyo flex h-12 items-center rounded-[16px] border bg-superficie px-3 font-extrabold"
                      style={{ borderColor: 'var(--t-borde)', color: 'var(--t-alerta)' }}
                    >
                      Retirar
                    </button>
                  </div>
                </div>

                {/* La pregunta, dentro de la aplicación y en el sitio. */}
                {retirando?.id === p.id && (
                  <div
                    className="mt-3 rounded-[16px] border px-4 py-3.5"
                    style={{
                      background: 'var(--t-alerta-velo)',
                      borderColor: 'color-mix(in srgb, var(--t-alerta) 45%, transparent)',
                    }}
                  >
                    <p className="t-cuerpo font-extrabold" style={{ color: 'var(--t-alerta)' }}>
                      ¿Retirar «{p.nombre}»?
                    </p>
                    <p className="t-apoyo mt-1.5 text-tinta-suave">{loQueHayDentro(p)}</p>
                    <p className="t-apoyo mt-1 text-tinta-suave">{loQuePasaLuego}</p>
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={() => retirar(p)}
                        disabled={ocupado}
                        className="t-cuerpo h-[60px] w-full rounded-[16px] border bg-superficie font-extrabold disabled:opacity-50"
                        style={{ borderColor: 'var(--t-alerta)', color: 'var(--t-alerta)' }}
                      >
                        {ocupado ? 'Retirando…' : 'Sí, retirarla'}
                      </button>
                      <button
                        onClick={() => setRetirando(null)}
                        disabled={ocupado}
                        className="t-cuerpo h-[60px] w-full rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta disabled:opacity-50"
                      >
                        Dejarlo como está
                      </button>
                    </div>
                  </div>
                )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {creando ? (
        <div className="mt-3 rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <p className="t-tarjeta">¿Cómo se llama?</p>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={cosa.ejemplo}
            className="entrada mt-2"
            autoFocus
            maxLength={40}
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={crear}
              disabled={ocupado || nombre.trim().length < 2}
              className="t-cuerpo flex h-[60px] flex-1 items-center justify-center gap-2 rounded-[16px] font-extrabold disabled:opacity-50"
              style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
            >
              <Ico nombre="check" tam={20} grosor={2.3} />
              {ocupado ? 'Creando…' : 'Crear'}
            </button>
            <button
              onClick={() => {
                setCreando(false)
                setFallo(null)
              }}
              disabled={ocupado}
              className="t-cuerpo h-[60px] flex-1 rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta disabled:opacity-50"
            >
              Dejarlo
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setCreando(true)
            setAviso(null)
          }}
          className="t-cuerpo mt-3 flex h-[60px] w-full items-center justify-center gap-2 rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta"
        >
          <Ico nombre="mas" tam={22} grosor={2.4} />
          {cosa.nueva}
        </button>
      )}

      {fallo && (
        <div className="mt-3">
          <Aviso titulo="No se ha podido" explicacion={fallo} />
        </div>
      )}
      {aviso && (
        <p className="t-apoyo mt-3 rounded-[16px] border border-borde px-4 py-3 text-tinta-suave">
          {aviso}
        </p>
      )}
    </section>
  )
}
