'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../../../iconos'
import type { Categoria } from '@/lib/carpetas'

/*
  Corregir un papel.

  UNA PANTALLA, NO CUATRO. Se puede cambiar el título, el proveedor, la
  fecha, el importe y la carpeta, y se guarda todo de una vez con un
  solo botón. Repartirlo en pasos —"¿qué quieres cambiar?" y luego el
  campo— sería más "limpio" y bastante peor: cuando alguien viene a
  corregir algo ya sabe qué está mal, y lo que quiere es verlo y
  tocarlo.

  Y BORRAR ESTÁ ABAJO DEL TODO, SEPARADO Y EN DOS TOQUES. Ni junto a
  Guardar, ni del mismo tamaño, ni del mismo color. Es la única acción
  de esta pantalla que no se puede deshacer desde aquí.
*/

export type Papel = {
  id: string
  titulo: string
  proveedor: string | null
  fecha_documento: string
  importe: number | null
  categoria_id: string
}

export default function Corregir({
  papel,
  categorias,
}: {
  papel: Papel
  categorias: Categoria[]
}) {
  const router = useRouter()

  const [titulo, setTitulo] = useState(papel.titulo)
  const [proveedor, setProveedor] = useState(papel.proveedor ?? '')
  const [fecha, setFecha] = useState(papel.fecha_documento)
  const [importe, setImporte] = useState(
    papel.importe != null ? String(papel.importe).replace('.', ',') : ''
  )
  const [categoriaId, setCategoriaId] = useState(papel.categoria_id)

  const [eligiendo, setEligiendo] = useState(false)
  const [padre, setPadre] = useState<string | null>(null)

  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [seguro, setSeguro] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const porId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])

  const hijosDe = useMemo(() => {
    const mapa = new Map<string | null, Categoria[]>()
    for (const c of categorias) mapa.set(c.padre_id, [...(mapa.get(c.padre_id) ?? []), c])
    for (const lista of mapa.values()) lista.sort((a, b) => a.orden - b.orden)
    return mapa
  }, [categorias])

  /** "Finca › Gastos › Luz" — el camino entero, para no dudar. */
  const camino = useMemo(() => {
    const partes: string[] = []
    let actual = porId.get(categoriaId)
    while (actual) {
      partes.unshift(actual.nombre)
      actual = actual.padre_id ? porId.get(actual.padre_id) : undefined
    }
    return partes
  }, [categoriaId, porId])

  function elegir(c: Categoria) {
    const hijos = hijosDe.get(c.id) ?? []
    if (hijos.length > 0) {
      setPadre(c.id)
      return
    }
    setCategoriaId(c.id)
    setEligiendo(false)
    setPadre(null)
  }

  async function guardar() {
    if (titulo.trim().length < 2) {
      setAviso('El título no puede quedarse vacío.')
      return
    }
    setAviso(null)
    setGuardando(true)

    const r = await fetch(`/api/documentos/${papel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: titulo.trim(),
        proveedor: proveedor.trim(),
        fecha_documento: fecha,
        importe: importe.trim() === '' ? null : importe.trim(),
        categoria_id: categoriaId,
      }),
    })

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setAviso(d.error ?? 'No se ha podido guardar el cambio.')
      setGuardando(false)
      return
    }

    router.push(`/documentos/${papel.id}`)
    router.refresh()
  }

  async function borrar() {
    setAviso(null)
    setBorrando(true)

    const r = await fetch(`/api/documentos/${papel.id}`, { method: 'DELETE' })

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setAviso(d.error ?? 'No se ha podido borrar.')
      setBorrando(false)
      return
    }

    router.push('/documentos')
    router.refresh()
  }

  // ── Eligiendo carpeta ──────────────────────────────────────
  if (eligiendo) {
    const lista = hijosDe.get(padre) ?? []
    const dentroDe = padre ? porId.get(padre) : null

    return (
      <div>
        <button
          onClick={() => (padre ? setPadre(dentroDe?.padre_id ?? null) : setEligiendo(false))}
          className="flex h-12 items-center gap-1.5 text-[16px] font-extrabold text-tinta"
        >
          <Ico nombre="atras" tam={20} grosor={2.4} />
          {dentroDe ? 'Atrás' : 'Cancelar'}
        </button>

        <h2 className="mt-1 text-[22px] font-extrabold tracking-tight">
          {dentroDe ? dentroDe.nombre : '¿En qué carpeta va?'}
        </h2>

        <ul className="mt-3 space-y-2">
          {lista.map((c) => {
            const tieneHijos = (hijosDe.get(c.id) ?? []).length > 0
            return (
              <li key={c.id}>
                <button
                  onClick={() => elegir(c)}
                  className="flex w-full items-center gap-3 rounded-[18px] border border-borde bg-superficie px-4 py-4 text-left"
                >
                  <span className="min-w-0 flex-1 text-[17.5px] font-extrabold tracking-tight">
                    {c.nombre}
                  </span>
                  {tieneHijos && (
                    <Ico nombre="flecha" tam={19} grosor={2.2} className="shrink-0 text-borde" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  // ── El formulario ──────────────────────────────────────────
  return (
    <div>
      <Campo etiqueta="Qué es">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={160}
          className="entrada"
        />
      </Campo>

      <Campo etiqueta="De quién es (comercio, empresa…)">
        <input
          type="text"
          value={proveedor}
          onChange={(e) => setProveedor(e.target.value)}
          maxLength={120}
          placeholder="Sin poner"
          className="entrada"
        />
      </Campo>

      <Campo etiqueta="Fecha del papel">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="entrada"
        />
      </Campo>

      <Campo etiqueta="Importe">
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={importe}
            onChange={(e) => setImporte(e.target.value.replace(/[^\d,.]/g, ''))}
            placeholder="Sin importe"
            className="entrada flex-1"
          />
          <span className="text-[22px] font-extrabold text-tenue">€</span>
        </div>
      </Campo>

      {/* ── La carpeta ── */}
      <p className="rotulo mt-5">Dónde se guarda</p>
      <button
        onClick={() => {
          setEligiendo(true)
          setPadre(null)
        }}
        className="mt-2 flex w-full items-center gap-3 rounded-[18px] border border-borde bg-superficie px-4 py-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[17.5px] font-extrabold leading-snug tracking-tight">
            {camino.join(' › ') || 'Sin carpeta'}
          </span>
          <span className="mt-0.5 block text-[14.5px] font-bold text-tenue">
            Tocar para cambiarla
          </span>
        </span>
        <Ico nombre="flecha" tam={19} grosor={2.2} className="shrink-0 text-borde" />
      </button>

      <p className="mt-2 text-[14.5px] font-semibold leading-snug text-tenue">
        Al cambiar la carpeta o la fecha, el archivo se mueve también dentro de
        tu Google Drive. No se queda una cosa aquí y otra allí.
      </p>

      {aviso && (
        <p className="mt-4 rounded-[16px] bg-coral-suave px-4 py-3.5 text-[15.5px] font-semibold leading-snug text-coral">
          {aviso}
        </p>
      )}

      <button
        onClick={guardar}
        disabled={guardando || borrando}
        className="mt-5 flex h-[62px] w-full items-center justify-center gap-2.5 rounded-[18px] bg-boton text-[18px] font-extrabold text-boton-texto disabled:opacity-50"
      >
        {guardando ? 'Guardando…' : 'Guardar los cambios'}
      </button>

      {/* ── Borrar ── */}
      <div className="mt-10 border-t border-borde pt-6">
        {!seguro ? (
          <button
            onClick={() => setSeguro(true)}
            disabled={guardando}
            className="flex h-[56px] w-full items-center justify-center gap-2.5 rounded-[18px] border-2 border-coral text-[17px] font-extrabold text-coral disabled:opacity-50"
          >
            Borrar este papel
          </button>
        ) : (
          <div className="rounded-[20px] border-2 border-coral bg-coral-suave px-4 py-4">
            <p className="text-[18px] font-extrabold text-coral">
              ¿Seguro que quieres borrarlo?
            </p>
            {/*
              Se dice EXACTAMENTE qué va a pasar, sin adornos. Que el
              archivo va a la papelera de Drive no es un detalle
              técnico: es la diferencia entre "se puede recuperar" y
              "se ha perdido", y quien decide tiene derecho a saberlo
              ANTES de tocar el botón rojo.
            */}
            <ul className="mt-2 space-y-1 text-[15.5px] font-semibold leading-snug text-tinta-suave">
              <li>· Desaparece de HUBI.</li>
              <li>· El archivo va a la papelera de tu Google Drive, donde se puede recuperar durante 30 días.</li>
              <li>· Si contaba como gasto o ingreso, deja de contar.</li>
              <li>· Los avisos que salieron de él se quedan, no se borran.</li>
            </ul>

            <div className="mt-4 flex gap-2.5">
              <button
                onClick={borrar}
                disabled={borrando}
                className="h-[56px] flex-1 rounded-[16px] bg-coral text-[17px] font-extrabold text-white disabled:opacity-50"
              >
                {borrando ? 'Borrando…' : 'Sí, borrarlo'}
              </button>
              <button
                onClick={() => setSeguro(false)}
                disabled={borrando}
                className="h-[56px] flex-1 rounded-[16px] border border-borde bg-superficie text-[17px] font-extrabold text-tinta disabled:opacity-50"
              >
                No
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className="rotulo">{etiqueta}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  )
}
