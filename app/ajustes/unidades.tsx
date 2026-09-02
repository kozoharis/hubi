'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'

/*
  ═══════════════════════════════════════════════════════════════
  CREAR Y ORDENAR LAS UNIDADES DE UNA SECCIÓN
  ═══════════════════════════════════════════════════════════════

  «Helechos 2», «Piso abuela», «Obra Manuel».

  ─────────────────────────────────────────────────────────────
  LA PALABRA «UNIDAD» NO APARECE POR NINGÚN LADO

  Y no es un detalle de estilo. «Unidad» es una palabra nuestra, de
  la fontanería: describe cómo lo hemos construido, no lo que la
  persona tiene. Juan Miguel no tiene unidades, tiene APARTAMENTOS.
  Un reformista no tiene unidades, tiene OBRAS.

  Así que cada sección trae su palabra —guardada en la base de datos,
  con artículo, porque «el apartamento» y «la obra» no llevan el
  mismo— y todas las frases de esta pantalla se construyen con ella:

      «+ Nuevo apartamento»     «+ Nueva obra»
      «¿Cómo se llama?»          igual para todos

  Es el punto 29: la complejidad pertenece al sistema, no al usuario.

  ─────────────────────────────────────────────────────────────
  Y SE DICE LO DE LA CARPETA

  Al crear una, HUBI le hace su carpeta en el Drive de la casa. Eso
  se cuenta en una línea, en cristiano, porque es exactamente lo que
  hace que alguien entienda de una vez dónde vive todo esto. Y si la
  carpeta NO se ha podido crear, también se dice — callarlo sería
  dejar que se descubra dentro de tres semanas con una factura en la
  mano.
*/

export type UnidadDeLaLista = {
  id: string
  nombre: string
  referencia: string | null
  presupuesto: number | null
}

export default function Unidades({
  seccionId,
  seccionNombre,
  /** «el apartamento», «la obra». Con artículo. */
  palabra,
  unidades,
  /** Las obras llevan presupuesto; los apartamentos, no. */
  conPresupuesto = false,
}: {
  seccionId: string
  seccionNombre: string
  palabra: string
  unidades: UnidadDeLaLista[]
  conPresupuesto?: boolean
}) {
  const router = useRouter()

  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [presupuesto, setPresupuesto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState('')

  const { articulo, sustantivo, nueva } = descomponer(palabra)

  async function crear() {
    setFallo(null)
    setAviso(null)
    setOcupado(true)

    const r = await fetch('/api/unidades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seccion_id: seccionId,
        nombre: nombre.trim(),
        presupuesto: conPresupuesto ? presupuesto : null,
      }),
    })

    const d = (await r.json().catch(() => ({}))) as { error?: string; aviso?: string }
    setOcupado(false)

    if (!r.ok) {
      setFallo(d.error ?? 'No se ha podido crear.')
      return
    }

    if (d.aviso) setAviso(d.aviso)
    setNombre('')
    setPresupuesto('')
    setCreando(false)
    router.refresh()
  }

  async function renombrar(id: string) {
    if (nuevoNombre.trim().length < 2) return
    setOcupado(true)
    setFallo(null)

    const r = await fetch('/api/unidades', {
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

  async function retirar(id: string, comoSeLlama: string) {
    /*
      Se pregunta, y la pregunta dice lo que va a pasar DE VERDAD.

      «¿Seguro?» no es una pregunta: no informa de nada. Aquí se dice
      que lo apuntado no se pierde, porque ése es justo el miedo que
      frena a alguien delante de este botón.
    */
    const seguro = window.confirm(
      `¿Retirar «${comoSeLlama}»?\n\nDeja de salir al apuntar cosas nuevas. Lo que ya había apuntado NO se pierde y sus papeles siguen en Drive.`
    )
    if (!seguro) return

    setOcupado(true)
    const r = await fetch(`/api/unidades?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    setOcupado(false)

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setFallo(d.error ?? 'No se ha podido retirar.')
      return
    }
    router.refresh()
  }

  return (
    <section className="mt-4">
      <p className="rotulo">{seccionNombre}</p>

      {unidades.length === 0 ? (
        <p className="mt-2 text-[15.5px] font-semibold leading-snug text-tenue">
          Todavía no has creado {ninguna(articulo)} {sustantivo}.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {unidades.map((u) => (
            <li
              key={u.id}
              className="rounded-[18px] border border-borde bg-superficie px-4 py-3"
            >
              {editando === u.id ? (
                <div>
                  <input
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    className="entrada"
                    autoFocus
                    maxLength={60}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => renombrar(u.id)}
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
                    <p className="truncate text-[17px] font-bold">{u.nombre}</p>
                    {u.presupuesto != null && (
                      <p className="text-[14.5px] font-semibold text-tenue">
                        Presupuesto: {u.presupuesto.toLocaleString('es-ES')} €
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setEditando(u.id)
                        setNuevoNombre(u.nombre)
                      }}
                      aria-label={`Cambiar el nombre de ${u.nombre}`}
                      className="flex h-12 w-12 items-center justify-center rounded-[14px] text-tinta-suave"
                    >
                      <Ico nombre="lapiz" tam={19} grosor={2.2} />
                    </button>
                    <button
                      onClick={() => retirar(u.id, u.nombre)}
                      aria-label={`Retirar ${u.nombre}`}
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

      {/* ── Crear ── */}
      {creando ? (
        <div className="mt-3 rounded-[18px] border border-borde bg-superficie px-4 py-4">
          <p className="text-[16px] font-extrabold">¿Cómo se llama?</p>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={ejemplo(sustantivo)}
            className="entrada mt-2"
            autoFocus
            maxLength={60}
          />

          {conPresupuesto && (
            <>
              <p className="rotulo mt-4">Presupuesto (si lo hay)</p>
              <input
                value={presupuesto}
                onChange={(e) => setPresupuesto(e.target.value)}
                inputMode="decimal"
                placeholder="12000"
                className="entrada mt-2"
              />
            </>
          )}

          <p className="mt-3 text-[14.5px] font-semibold leading-snug text-tenue">
            Se le hará su propia carpeta en el Google Drive de la casa, y sus papeles
            se guardarán ahí solos.
          </p>

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
          {nueva} {sustantivo}
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

/*
  «el apartamento» → artículo «el», sustantivo «apartamento», y el
  «Nuevo/Nueva» que le corresponde.

  Se guarda el artículo en la base de datos en vez de adivinar el
  género por la terminación porque adivinarlo falla justo donde más
  se nota: «el garaje», «la nave», «el chalet», «la parcela». Una
  aplicación que escribe «Nueva apartamento» pierde toda la
  credibilidad en esa línea.
*/
function descomponer(palabra: string): {
  articulo: string
  sustantivo: string
  nueva: string
} {
  const partes = (palabra || 'la unidad').trim().split(/\s+/)
  const tieneArticulo = partes.length > 1 && /^(el|la|los|las)$/i.test(partes[0])

  const articulo = tieneArticulo ? partes[0].toLowerCase() : 'la'
  const sustantivo = (tieneArticulo ? partes.slice(1) : partes).join(' ')

  return {
    articulo,
    sustantivo,
    nueva: articulo === 'el' ? 'Nuevo' : 'Nueva',
  }
}

/** «el» → «ningún», «la» → «ninguna». */
function ninguna(articulo: string): string {
  return articulo === 'el' ? 'ningún' : 'ninguna'
}

/* Un ejemplo, no una instrucción. Enseñar cómo se ve un nombre bueno
   ahorra más que cualquier explicación encima del campo. */
function ejemplo(sustantivo: string): string {
  const s = sustantivo.toLowerCase()
  if (s.includes('obra')) return 'Obra Manuel'
  if (s.includes('apartamento') || s.includes('piso')) return 'Helechos 4'
  if (s.includes('coche') || s.includes('veh')) return 'La furgoneta'
  return 'Ponle un nombre'
}
