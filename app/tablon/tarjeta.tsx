'use client'

import Link from '@/app/enlace'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAlDia } from '@/lib/al-dia'
import { cuando, atrasado, type Recordatorio } from '@/lib/tablon'
import { Ico, pintaDe } from '../iconos'
import { PastillaAmbito } from '../piezas'
import { api } from '@/lib/api'

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

  /*
    ═══════════════════════════════════════════════════════════
    SE PINTA YA, Y DESPUÉS SE CUENTA
    ═══════════════════════════════════════════════════════════

    Haris: *«cuando tocas un botón parece que no reacciona, y a veces
    le tienes que dar como dos veces»*. Éste era el peor ejemplo de
    todo mappel, y encima es el botón que más se toca.

    Lo que pasaba, en orden:

      1 · tocas HECHO
      2 · el botón se apaga al 50 % y pone «…»
      3 · sale la petición            ~200-800 ms en un móvil
      4 · vuelve, y se pide la pantalla ENTERA al servidor
          (`router.refresh()` sobre una página `force-dynamic`)
                                      ~300-1500 ms más
      5 · POR FIN la tarjeta se tacha

    O sea que entre el dedo y el resultado podía haber segundo y
    medio. Y durante todo ese rato el botón estaba **desactivado**: el
    segundo toque —el que uno da porque cree que no le han oído— no
    hacía absolutamente nada. La pantalla enseñaba «…» para decir «te
    he oído», pero «…» no es la respuesta: la respuesta es que la
    tarea se tache.

    ── AHORA ──

    Se tacha en el mismo momento del toque. La petición va por detrás,
    y si falla se destacha sola y se dice. Es exactamente lo que ya
    hacía la compra desde hace meses (`app/compra/lista.tsx`): esto no
    inventa nada, lo aplica donde faltaba.

    `useAlDia` para que la copia local vuelva a mirar al servidor
    cuando el servidor traiga algo distinto — si no, lo que tache el
    otro desde su móvil no se vería nunca aquí.

    Y `useTransition` para que refrescar la pantalla no bloquee: sin
    él, React trata la recarga como urgente y la interfaz se queda
    dura mientras llega.
  */
  const [estado, setEstado] = useAlDia(r.estado, `${r.id}:${r.estado}`)
  const [, empezar] = useTransition()

  const hecho = estado === 'hecho'
  const tarde = atrasado(r)
  const p = pintaDe(r.titulo)

  const de = nombres[r.creado_por] ?? ''
  const para = r.asignado_a ? (nombres[r.asignado_a] ?? '') : null
  const paraOtro = r.asignado_a && r.asignado_a !== r.creado_por

  async function cambiar() {
    const antes = estado
    const ahora = hecho ? 'pendiente' : 'hecho'

    /* Primero la pantalla. Siempre. */
    setEstado(ahora)

    try {
      const p = await fetch(api(`/api/recordatorios/${r.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: ahora }),
      })
      if (!p.ok) throw new Error()
      /* Y ahora sí, que el servidor y esto digan lo mismo — pero sin
         que nadie esté esperando a que termine. */
      empezar(() => router.refresh())
    } catch {
      /* Se vuelve a como estaba. Que una tarea se destache sola es
         raro, pero es MUCHO menos malo que creerse que está hecha
         cuando no se ha guardado. */
      setEstado(antes)
    }
  }

  return (
    <li
      className={`rounded-[20px] border bg-superficie px-3.5 py-3.5 ${
        tarde ? 'border-coral' : 'border-borde'
      } ${hecho ? 'opacity-55' : ''}`}
    >
      {/* De quién para quién */}
      {paraOtro ? (
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold tracking-wider text-tenue">
          <span>{de.toUpperCase()}</span>
          <Ico nombre="flecha" tam={13} grosor={2.6} />
          <span>{para?.toUpperCase()}</span>
        </p>
      ) : !r.asignado_a ? (
        <p className="text-[13px] font-extrabold tracking-wider text-tenue">PARA LOS DOS</p>
      ) : (
        <p className="text-[13px] font-extrabold tracking-wider text-tenue">
          {(para ?? de).toUpperCase()}
        </p>
      )}

      <Link href={`/tablon/${r.id}`} className="mt-2 flex items-start gap-3">
        <PastillaAmbito icono={p.icono} ambito={p.ambito} tam={44} />
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[17.5px] font-bold leading-snug ${
              hecho ? 'text-tinta-suave line-through' : ''
            }`}
          >
            {r.titulo}
          </span>
          <span
            className="t-apoyo mt-0.5 block"
            style={tarde ? { color: 'var(--t-alerta)' } : undefined}
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
        {/* «Ver todo» iba en `text-verde` —el verde de la Finca— y
            sin altura propia. Es un enlace de paso: terciario. */}
        <Link
          href={`/tablon/${r.id}`}
          className="flex h-[48px] items-center pr-2 text-[15px] font-extrabold text-tinta-suave"
        >
          Ver todo
        </Link>
        {/*
          Marcar algo hecho SÍ es la acción de esta tarjeta, así que
          va con el color de acción. Ya hecho, deja de serlo: se
          convierte en un «deshacer» de paso.

          Y sube de 44 a 48 px, que es el suelo.
        */}
        {/*
          Y SIN `disabled`.

          Estaba apagado mientras iba la petición, y eso era lo que
          convertía «parece que no reacciona» en «de verdad no
          reacciona»: el segundo toque caía en un botón muerto.

          Ya no hace falta para nada. El botón cambia en el acto, así
          que nadie vuelve a darle; y si alguien le da dos veces, lo
          que manda es «pendiente» y luego «hecho» —o al revés—, que es
          justo lo que ha pedido con los dedos.
        */}
        <button
          onClick={cambiar}
          className={`flex h-[48px] items-center rounded-full px-4 text-[13.5px] font-extrabold tracking-wide ${
            hecho
              ? 'border border-borde bg-fondo text-tinta-suave'
              : 'bg-accion text-accion-tinta'
          }`}
        >
          {hecho ? 'DESHACER' : etiqueta(r, yo)}
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
