'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import HubiInput, { type EstadoHubi } from './hubi-input'
import { esUnaOrden } from '@/lib/entender-voz'

/*
  ═══════════════════════════════════════════════════════════════
  LA CAJA DE HUBI, CONECTADA
  ═══════════════════════════════════════════════════════════════

  `hubi-input.tsx` era la pieza —los estados, el degradado, el
  medidor— definida en Fase 1 y sin usar. Esto es lo que la enchufa.

  ─────────────────────────────────────────────────────────────
  LO QUE ARREGLA

  En Papeles había un buscador —«¿Qué estás buscando?»— y en la barra
  un botón de voz. Dos cajas que hacen la MISMA pregunta con dos
  motores distintos, y la persona teniendo que saber a cuál acudir.
  Eso es exactamente lo contrario de «no busques, pregunta a HUBI».

  Ahora es una. Escribes lo que sea y HUBI decide qué era.

  ─────────────────────────────────────────────────────────────
  Y DECIDE AQUÍ, GRATIS, SIN LLAMAR A NADIE

  `esUnaOrden()` corre en el propio móvil: son expresiones regulares,
  no un modelo. Así que escribir «facturas agua 2026» busca al
  instante, igual que antes — no hay ni un viaje de más ni un céntimo
  de más por haber puesto a HUBI en medio.

  Solo cuando hay una señal de que es una ORDEN o una PREGUNTA se va a
  `/hablar`, que es donde vive la confirmación de siempre.

  ─────────────────────────────────────────────────────────────
  ANTE LA DUDA, SE BUSCA

  Y es la regla que hace que esto se pueda soltar en una pantalla que
  antes era un buscador: buscar es instantáneo, gratis y NO CAMBIA
  NADA. Apuntar sí. Si HUBI se equivoca hacia buscar, te salen unos
  papeles y vuelves a escribir; si se equivoca hacia apuntar, te deja
  una tarea inventada en la agenda que hay que ir a borrar.

  ═══════════════════════════════════════════════════════════════
  LO QUE SE CONTESTA AQUÍ Y LO QUE SE LLEVA LA PANTALLA
  ═══════════════════════════════════════════════════════════════

  Y la regla es una, fácil de decir y fácil de defender:

      PREGUNTAR se contesta aquí mismo.
      CAMBIAR ALGO se va a la pantalla de confirmación.

  Una pregunta —«¿cuánto llevamos gastado en luz?»— no toca nada: la
  peor consecuencia posible de equivocarse es una cifra que no era la
  que querías, y vuelves a preguntar. Sacarte de donde estabas para
  eso es cobrarte una pantalla entera por una frase.

  Apuntar un gasto, dejar un recado o borrar una cita SÍ tocan algo, y
  eso no se hace nunca sin que lo veas antes. Ahí está bien que se
  lleve la pantalla: es el sitio donde HUBI enseña lo que ha entendido
  y tú dices que sí.

  Dicho al revés: **desde esta caja HUBI no puede cambiar nada de tus
  cosas sin enseñártelo primero.**

  ─────────────────────────────────────────────────────────────
  Y NO CONTESTA EN VOZ ALTA

  La pantalla de voz sí lo hace, y con razón: cuando has preguntado
  hablando estás mirando para otro lado. Aquí has escrito, así que
  estás mirando la pantalla — y un móvil que se pone a hablar solo en
  mitad del salón cuando nadie le ha hablado asusta.
*/
export default function HubiCaja({
  donde,
  valor = '',
  /** A dónde va una búsqueda desde esta pantalla. */
  buscarEn = '/documentos',
  rotando,
}: {
  donde: string
  valor?: string
  buscarEn?: string
  /*
    Frases que se van turnando en el hueco del campo. Solo en el
    Inicio: es donde alguien mira sin saber todavía qué se puede
    pedir. Dentro de Papeles la sugerencia es fija, porque ahí ya
    sabes a qué has ido.
  */
  rotando?: string[]
}) {
  const router = useRouter()
  const [texto, setTexto] = useState(valor)
  const [estado, setEstado] = useState<EstadoHubi>('reposo')
  const [cual, setCual] = useState(0)
  const [respuesta, setRespuesta] = useState<string | null>(null)
  const [papel, setPapel] = useState<string | null>(null)

  /* Se para en cuanto hay algo escrito: una frase que cambia sola
     debajo de lo que estás escribiendo es de las cosas que más
     despistan, y aquí no hay ninguna prisa por enseñar la siguiente. */
  const quieto = texto.trim().length > 0
  useEffect(() => {
    if (!rotando || rotando.length < 2 || quieto) return
    const t = setTimeout(() => setCual((n) => (n + 1) % rotando.length), 4200)
    return () => clearTimeout(t)
  }, [rotando, cual, quieto])

  async function enviar() {
    const t = texto.trim()
    if (!t) return

    setRespuesta(null)
    setPapel(null)

    const orden = esUnaOrden(t)

    /* Palabras sueltas: se busca. Instantáneo y sin efectos. */
    if (!orden) {
      setEstado('pensando')
      router.push(`${buscarEn}?q=${encodeURIComponent(t)}`)
      return
    }

    /* Cambia algo: se va a confirmar. Nunca sin enseñarlo antes.
       `/hablar` ya sabe recibir una frase escrita — es el mismo camino
       que usa el Atajo de Siri— así que no hay un segundo intérprete
       ni una segunda pantalla de confirmación. */
    if (orden !== 'consulta') {
      setEstado('pensando')
      router.push(`/hablar?dicho=${encodeURIComponent(t)}`)
      return
    }

    // ── Una pregunta. Se contesta aquí. ──
    setEstado('pensando')
    try {
      const r = await fetch('/api/voz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: t, pista: 'consulta' }),
      })
      const d = (await r.json().catch(() => ({}))) as {
        respuesta?: string
        papel_id?: string | null
        error?: string
      }

      if (!r.ok || !d.respuesta) {
        if (d.error) console.error('[HUBI] La consulta no ha salido:', d.error)
        setEstado('no_entendido')
        return
      }

      setRespuesta(d.respuesta)
      setPapel(d.papel_id ?? null)
      setEstado('respondiendo')
    } catch {
      setEstado('no_entendido')
    }
  }

  return (
    <HubiInput
      donde={donde}
      sugerencia={rotando && !quieto ? rotando[cual] : undefined}
      estado={estado}
      valor={texto}
      respuesta={respuesta ?? undefined}
      alEscribir={(t) => {
        setTexto(t)
        /* Al volver a escribir, la respuesta anterior se va: dejarla
           debajo de una pregunta nueva es enseñar la contestación de
           otra cosa. */
        if (estado === 'respondiendo' || estado === 'no_entendido') {
          setEstado('reposo')
          setRespuesta(null)
        }
      }}
      alEnviar={enviar}
      acciones={
        estado === 'respondiendo' && papel ? (
          <Link
            href={`/documentos/${papel}`}
            className="r-campo flex h-[48px] items-center border border-borde px-4 text-[15px] font-extrabold text-tinta"
          >
            Ver el papel
          </Link>
        ) : estado === 'no_entendido' ? (
          <>
            <button
              onClick={() => router.push(`/hablar?dicho=${encodeURIComponent(texto.trim())}`)}
              className="r-campo flex h-[48px] items-center border border-borde px-4 text-[15px] font-extrabold text-tinta"
            >
              Que lo intente HUBI
            </button>
            <button
              onClick={() => router.push(`${buscarEn}?q=${encodeURIComponent(texto.trim())}`)}
              className="r-campo flex h-[48px] items-center border border-borde px-4 text-[15px] font-extrabold text-tinta"
            >
              Buscarlo
            </button>
          </>
        ) : undefined
      }
      /* Hablar SÍ se lleva la pantalla entera, y es lo correcto:
         mientras hablas hace falta un blanco grande y una respuesta
         clara de que te está oyendo. La caja es la presencia; hablar
         es el momento. */
      alHablar={() => router.push('/hablar')}
    />
  )
}
