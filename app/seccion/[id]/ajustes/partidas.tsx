'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../../../iconos'

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

  async function retirar(p: Partida) {
    /*
      La pregunta dice lo que va a pasar DE VERDAD, y dice cuánto hay
      dentro. No es lo mismo retirar una partida vacía que una con
      cuarenta facturas: quien está a punto de pulsar tiene derecho a
      saberlo ANTES, no a descubrirlo después.
    */
    const cuantas =
      p.apuntes === 0
        ? esPapel
          ? 'No tiene ningún papel dentro.'
          : 'No tiene nada apuntado.'
        : esPapel
          ? `Tiene ${p.apuntes} ${p.apuntes === 1 ? 'papel' : 'papeles'}, y NO se pierden: siguen guardados y se siguen viendo.`
          : `Tiene ${p.apuntes} ${p.apuntes === 1 ? 'apunte' : 'apuntes'}, y NO se pierden: siguen contando en las cuentas de siempre.`

    const luego = esPapel
      ? 'Deja de salir al guardar papeles nuevos.'
      : 'Deja de salir al apuntar cosas nuevas.'

    if (!window.confirm(`¿Retirar «${p.nombre}»?\n\n${cuantas}\n\n${luego}`)) {
      return
    }

    setOcupado(true)
    const r = await fetch(`/api/categorias?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' })
    setOcupado(false)

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setFallo(d.error ?? 'No se ha podido retirar.')
      return
    }
    router.refresh()
  }

  return (
    <section className="mt-6">
      <h2 className="rotulo">{titulo}</h2>
      <p className="mt-1 text-[15px] font-semibold leading-snug text-tenue">{pie}</p>

      {partidas.length > 0 && (
        <ul className="mt-3 space-y-2">
          {partidas.map((p) => (
            <li key={p.id} className="rounded-[18px] border border-borde bg-superficie px-4 py-3">
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
                      className="h-12 flex-1 rounded-[14px] bg-boton text-[16px] font-extrabold text-boton-texto disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditando(null)}
                      className="h-12 flex-1 rounded-[14px] border border-borde text-[16px] font-extrabold text-tinta-suave"
                    >
                      Dejarlo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-bold">{p.nombre}</p>
                    {p.apuntes > 0 && (
                      <p className="text-[14.5px] font-semibold text-tenue">
                        {p.apuntes} {p.apuntes === 1 ? cosa.uno : cosa.varios}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setEditando(p.id)
                        setNuevoNombre(p.nombre)
                      }}
                      aria-label={`Cambiar el nombre de ${p.nombre}`}
                      className="flex h-12 w-12 items-center justify-center rounded-[14px] text-tinta-suave"
                    >
                      <Ico nombre="lapiz" tam={19} grosor={2.2} />
                    </button>
                    <button
                      onClick={() => retirar(p)}
                      aria-label={`Retirar ${p.nombre}`}
                      className="flex h-12 w-12 items-center justify-center rounded-[14px] text-tinta-suave"
                    >
                      <Ico nombre="aviso" tam={19} grosor={2.2} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {creando ? (
        <div className="mt-3 rounded-[18px] border border-borde bg-superficie px-4 py-4">
          <p className="text-[16px] font-extrabold">¿Cómo se llama?</p>
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
              className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-boton text-[17px] font-extrabold text-boton-texto disabled:opacity-50"
            >
              <Ico nombre="check" tam={19} grosor={2.3} />
              {ocupado ? 'Creando…' : 'Crear'}
            </button>
            <button
              onClick={() => {
                setCreando(false)
                setFallo(null)
              }}
              disabled={ocupado}
              className="h-[56px] flex-1 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave disabled:opacity-50"
            >
              Ahora no
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setCreando(true)
            setAviso(null)
          }}
          className="mt-3 flex h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border border-borde text-[17px] font-extrabold text-tinta-suave"
        >
          <Ico nombre="mas" tam={20} grosor={2.4} />
          {cosa.nueva}
        </button>
      )}

      {fallo && (
        <p className="mt-3 rounded-[16px] bg-coral-suave px-4 py-3 text-[15.5px] font-semibold text-coral">
          {fallo}
        </p>
      )}
      {aviso && (
        <p className="mt-3 rounded-[16px] border border-borde px-4 py-3 text-[15.5px] font-semibold text-tinta-suave">
          {aviso}
        </p>
      )}
    </section>
  )
}
