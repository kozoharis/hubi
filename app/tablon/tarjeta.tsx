'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cuando, atrasado, type Recordatorio } from '@/lib/tablon'
import { Ico, Pastilla, pintaDe } from '../iconos'

export default function Tarjeta({
  r,
  nombres,
  yo,
}: {
  r: Recordatorio
  nombres: Record<string, string>
  yo: string
}) {
  const router = useRouter()
  const [cambiando, setCambiando] = useState(false)

  const hecho = r.estado === 'hecho'
  const tarde = atrasado(r)
  const p = pintaDe(r.titulo)

  const de = nombres[r.creado_por] ?? ''
  const para = r.asignado_a ? (nombres[r.asignado_a] ?? '') : null
  const paraOtro = r.asignado_a && r.asignado_a !== r.creado_por

  async function cambiar() {
    setCambiando(true)
    await fetch(`/api/recordatorios/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: hecho ? 'pendiente' : 'hecho' }),
    })
    router.refresh()
    setCambiando(false)
  }

  return (
    <li
      className={`rounded-[20px] border bg-superficie px-3.5 py-3.5 ${
        tarde ? 'border-coral' : 'border-borde'
      } ${hecho ? 'opacity-55' : ''}`}
    >
      {/* De quién para quién */}
      {paraOtro ? (
        <p className="flex items-center gap-1.5 text-[12.5px] font-extrabold tracking-wider text-tenue">
          <span>{de.toUpperCase()}</span>
          <Ico nombre="flecha" tam={13} grosor={2.6} />
          <span>{para?.toUpperCase()}</span>
        </p>
      ) : !r.asignado_a ? (
        <p className="text-[12.5px] font-extrabold tracking-wider text-tenue">PARA LOS DOS</p>
      ) : (
        <p className="text-[12.5px] font-extrabold tracking-wider text-tenue">
          {(para ?? de).toUpperCase()}
        </p>
      )}

      <Link href={`/tablon/${r.id}`} className="mt-2 flex items-start gap-3">
        <Pastilla nombre={p.icono} color={p.color} fondo={p.fondo} tam={42} icono={21} />
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[17.5px] font-bold leading-snug ${
              hecho ? 'text-tinta-suave line-through' : ''
            }`}
          >
            {r.titulo}
          </span>
          <span
            className={`mt-0.5 block text-[14.5px] font-bold ${tarde ? 'text-coral' : 'text-tenue'}`}
          >
            {cuando(r.fecha, r.hora)}
            {tarde && ' · sin hacer'}
          </span>
          {r.nota && (
            <span className="mt-1.5 line-clamp-2 block text-[15px] font-medium leading-snug text-tenue">
              {r.nota}
            </span>
          )}
        </span>
      </Link>

      <div className="-mx-3.5 mt-3 h-px bg-borde" />

      <div className="flex items-center justify-between pt-3">
        <Link href={`/tablon/${r.id}`} className="text-[14.5px] font-bold text-verde">
          Ver todo
        </Link>
        <button
          onClick={cambiar}
          disabled={cambiando}
          className={`flex h-11 items-center rounded-full px-4 text-[13.5px] font-extrabold tracking-wide disabled:opacity-50 ${
            hecho
              ? 'border border-borde bg-fondo text-tinta-suave'
              : 'bg-boton text-boton-texto'
          }`}
        >
          {cambiando ? '…' : hecho ? 'DESHACER' : etiqueta(r, yo)}
        </button>
      </div>
    </li>
  )
}

/** Un recado que te dejan se "ve"; una tarea se "hace". */
function etiqueta(r: Recordatorio, yo: string): string {
  const esMensajeParaMi = r.tipo === 'tarea' && !r.fecha && r.asignado_a === yo
  return esMensajeParaMi ? 'VISTO' : 'HECHO'
}
