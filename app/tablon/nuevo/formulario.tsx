'use client'

import { useState } from 'react'
import Repetir, { type Repeticion } from '../../repetir'
import { Ico, Volver } from '../../iconos'
import { hoyAqui } from '@/lib/tablon'
import {
  Aviso,
  BotonPrincipal,
  BotonSecundario,
  BotonTerciario,
  Campo,
  Hecho,
} from '../../piezas'

type Perfil = { id: string; nombre: string }

/*
  ═══════════════════════════════════════════════════════════════
  «HOY» ERA AYER ENTRE MEDIANOCHE Y LA UNA, EN VERANO
  ═══════════════════════════════════════════════════════════════

  Esto usaba `new Date().toISOString()`, que da la fecha en UTC.
  Canarias va a UTC+0 en invierno pero a UTC+1 en verano, así que entre
  las 00:00 y la 01:00 de una noche de verano allí ya es un día y en
  UTC todavía es el anterior.

  Consecuencia real: quien apuntaba algo «para hoy» a las doce y media
  de la noche se lo encontraba puesto para AYER — es decir, vencido
  desde el primer momento, en rojo, en la pestaña de atrasados.

  Comprobado: el 1 de julio de 2026 a las 00:30 en Canarias,
  `toISOString()` devuelve 2026-06-30 y `hoyAqui()` devuelve
  2026-07-01.

  El resto de la aplicación ya lo hacía bien con `hoyAqui()`, que
  pregunta la fecha en la zona de la familia. Aquí se había quedado sin
  arreglar.

  Y `enDias` se calcula sobre las DOCE DEL MEDIODÍA de ese día. Sumar
  días a medianoche se rompe la noche que cambia la hora: 24 horas
  después de las 00:00 pueden ser las 23:00 del mismo día. A mediodía
  hay doce horas de margen por cada lado y no falla nunca.
*/
const HOY = () => hoyAqui()

function enDias(n: number): string {
  const d = new Date(`${hoyAqui()}T12:00:00`)
  d.setDate(d.getDate() + n)
  const dos = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

/*
  ¿CON CUÁNTA ANTELACIÓN AVISAMOS?

  Este campo existía en la base de datos, se enseñaba en la ficha… y no
  había manera de ponerlo desde ningún sitio. Estaba escrito en el
  planteamiento —«¿quieres que te avisemos? un mes / una semana / un
  día antes»— y era, literalmente, un dato de solo lectura.

  «30 minutos antes» solo aparece si hay hora: media hora antes de un
  día entero no quiere decir nada.
*/
const AVISOS: { valor: string; texto: string; necesitaHora?: boolean }[] = [
  { valor: 'sin_aviso', texto: 'Sin aviso' },
  { valor: '30_min', texto: '30 minutos antes', necesitaHora: true },
  { valor: '1_dia', texto: 'Un día antes' },
  { valor: '1_semana', texto: 'Una semana antes' },
  { valor: '1_mes', texto: 'Un mes antes' },
]

export default function Nuevo({ perfiles, yo }: { perfiles: Perfil[]; yo: string }) {
  const [titulo, setTitulo] = useState('')
  const [para, setPara] = useState<string | null>(yo)
  const [fecha, setFecha] = useState<string | null>(HOY())
  const [hora, setHora] = useState('')
  const [nota, setNota] = useState('')
  const [repite, setRepite] = useState<Repeticion>(null)
  const [hasta, setHasta] = useState('')
  const [avisoPrevio, setAvisoPrevio] = useState('sin_aviso')
  const [verMas, setVerMas] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(false)

  const otros = perfiles.filter((p) => p.id !== yo)

  async function guardar() {
    setAviso(null)
    setGuardando(true)
    try {
      const r = await fetch('/api/recordatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          asignado_a: para,
          fecha,
          hora: hora || null,
          nota,
          repite,
          repite_hasta: hasta || null,
          /* Sin día no hay desde cuándo contar la antelación, así que
             tampoco hay aviso que dar. */
          aviso_previo: fecha ? avisoPrevio : 'sin_aviso',
        }),
      })
      const datos = await r.json()
      if (!r.ok) {
        setAviso(datos.error ?? 'No se ha podido guardar.')
        setGuardando(false)
        return
      }
      setHecho(true)
    } catch {
      setAviso('No hay conexión. Inténtalo otra vez.')
    }
    setGuardando(false)
  }

  if (hecho) {
    return (
      <main className="flex min-h-screen flex-col justify-center px-5 py-16">
        <div className="mx-auto w-full max-w-md">
          <Hecho titulo="Apuntado" explicacion={titulo}>
            {/* Decía «Ver el tablón» y llevaba a una pantalla titulada
                «Agenda»: el tablón dejó de existir hace tiempo y el
                botón se quedó con su nombre. */}
            <BotonPrincipal href="/agenda">Ver la Agenda</BotonPrincipal>
            <BotonSecundario href="/tablon/nuevo">Apuntar otra cosa</BotonSecundario>
          </Hecho>
        </div>
      </main>
    )
  }

  return (
    <main className="techo-holgado min-h-screen px-5 pb-10">
      <div className="mx-auto w-full max-w-md">
        <Volver href="/agenda" />

        {/* Era `font-titulo text-[2.5rem]` — 40 px, y la única
            pantalla del producto que usaba esa familia. El título de
            pantalla es 27 en todas partes. */}
        <h1 className="t-titulo mt-6">Apuntar algo</h1>

        <div className="mt-8">
          <Campo etiqueta="¿Qué hay que recordar?">
            <textarea
              id="titulo"
              rows={2}
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Recoger la medicación en la farmacia"
              className="entrada resize-none py-4 leading-snug"
              style={{ height: 'auto', minHeight: 92 }}
            />
          </Campo>
        </div>

        {/*
          ═══════════════════════════════════════════════════════
          SI VIVE SOLO, ESTA PREGUNTA NO EXISTE
          ═══════════════════════════════════════════════════════

          Antes salía siempre, con «Para mí» y «Para los dos» — y en
          una casa de una sola persona, «los dos» son ella y nadie.
          Preguntar a alguien a cuál de dos personas asigna algo
          cuando solo hay una es hacerle descartar una opción cada vez
          que apunta algo, y encima sembrarle la duda de si hay
          alguien más ahí dentro que no conoce.

          Con una sola persona, se apunta para ella y punto: es la
          única respuesta posible, y una pregunta con una sola
          respuesta no es una pregunta.
        */}
        {otros.length > 0 && (
          <>
            <p className="rotulo mt-7">¿Para quién?</p>
            <div className="mt-2.5 space-y-2.5">
              <Opcion activa={para === yo} onClick={() => setPara(yo)} texto="Para mí" />
              {otros.map((p) => (
                <Opcion
                  key={p.id}
                  activa={para === p.id}
                  onClick={() => setPara(p.id)}
                  texto={`Para ${p.nombre.split(' ')[0]}`}
                />
              ))}
              {/* «Los dos» solo cuando son dos. Con cuatro personas en
                  casa esa frase es sencillamente falsa. */}
              <Opcion
                activa={para === null}
                onClick={() => setPara(null)}
                texto={otros.length === 1 ? 'Para los dos' : 'Para todos'}
              />
            </div>
          </>
        )}

        <p className="rotulo mt-7">¿Cuándo?</p>
        <div className="mt-2.5 space-y-2.5">
          <Opcion activa={fecha === HOY()} onClick={() => setFecha(HOY())} texto="Hoy" />
          <Opcion activa={fecha === enDias(1)} onClick={() => setFecha(enDias(1))} texto="Mañana" />
          <Opcion
            activa={fecha === null}
            onClick={() => setFecha(null)}
            texto="Cuando se pueda"
          />
        </div>

        <div className="mt-4">
          <Campo etiqueta="O elige un día">
            <input
              id="fecha"
              type="date"
              value={fecha ?? ''}
              onChange={(e) => setFecha(e.target.value || null)}
              className="entrada"
            />
          </Campo>
        </div>

        {!verMas ? (
          <div className="mt-6">
            <BotonTerciario onClick={() => setVerMas(true)} icono="mas">
              Añadir hora, aviso, nota o repetirlo
            </BotonTerciario>
          </div>
        ) : (
          <>
            <div className="mt-7">
              <Campo etiqueta="¿A qué hora?" ayuda="Opcional.">
                <input
                  id="hora"
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="entrada"
                />
              </Campo>
            </div>

            {/* Avisar solo tiene sentido si hay día: sin fecha no hay
                desde cuándo contar la antelación. */}
            {fecha && (
              <>
                <p className="rotulo mt-7">¿Os avisamos antes?</p>
                <div className="mt-2.5 space-y-2.5">
                  {AVISOS.filter((a) => !a.necesitaHora || hora).map((a) => (
                    <Opcion
                      key={a.valor}
                      activa={avisoPrevio === a.valor}
                      onClick={() => setAvisoPrevio(a.valor)}
                      texto={a.texto}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="mt-7">
              <Campo etiqueta="Nota" ayuda="Opcional.">
                <textarea
                  id="nota"
                  rows={2}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  className="entrada resize-none py-4 leading-snug"
                  style={{ height: 'auto', minHeight: 92 }}
                />
              </Campo>
            </div>

            {/* Repetir solo tiene sentido si la tarea tiene día: algo
                "cuando se pueda" no puede repetirse cada semana. */}
            {fecha && (
              <Repetir
                repite={repite}
                hasta={hasta}
                desde={fecha}
                cambiar={(r, h) => {
                  setRepite(r)
                  setHasta(h)
                }}
              />
            )}
          </>
        )}

        {/*
          Era `bg-verde` a 24 px de letra y con relleno de 24 px arriba
          y abajo — el botón más grande del producto, en una pantalla
          que no es más importante que las demás. Y apagarse al 40 % de
          opacidad sin decir nada es lo que hace pensar que la
          aplicación está rota: ahora dice qué falta.
        */}
        <div className="mt-9">
          <BotonPrincipal
            onClick={guardar}
            desactivado={guardando || titulo.trim().length === 0}
            porQue={
              titulo.trim().length === 0 ? 'Escribe primero qué hay que recordar.' : undefined
            }
          >
            {guardando ? 'Guardando…' : 'Apuntar'}
          </BotonPrincipal>
        </div>

        {aviso && (
          <div className="mt-5">
            <Aviso titulo="No se ha podido apuntar" explicacion={aviso} />
          </div>
        )}
      </div>
    </main>
  )
}

function Opcion({
  activa,
  onClick,
  texto,
}: {
  activa: boolean
  onClick: () => void
  texto: string
}) {
  /*
    El «✓ » iba pegado al texto, así que la etiqueta se desplazaba dos
    caracteres al elegirla y toda la lista bailaba. Ahora la marca
    ocupa su sitio siempre, elegida o no.

    Y el borde de 2 px pasa a 1: dos píxeles de borde en una lista de
    cinco opciones es mucha línea para lo poco que separa.
  */
  return (
    <button
      onClick={onClick}
      aria-pressed={activa}
      className="flex min-h-[60px] w-full items-center gap-2.5 rounded-[16px] border px-4 py-3 text-left"
      style={{
        borderColor: activa ? 'var(--color-accion)' : 'var(--t-borde)',
        background: activa ? 'var(--t-bien-velo)' : 'var(--t-superficie)',
        color: 'var(--t-tinta)',
      }}
    >
      <span
        aria-hidden
        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
        style={{
          border: activa ? 'none' : '2px solid var(--t-borde)',
          background: activa ? 'var(--color-accion)' : 'transparent',
          color: 'var(--color-accion-tinta)',
        }}
      >
        {activa && <Ico nombre="check" tam={14} grosor={3} />}
      </span>
      <span className="t-cuerpo font-extrabold">{texto}</span>
    </button>
  )
}
