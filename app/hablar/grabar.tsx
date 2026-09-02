'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Ico, Volver } from '../iconos'
import ColorDeBarra from '../color-barra'
import { grabarVoz, sePuedeGrabar, type Grabando } from './grabadora'
import { decir, callar } from './decir'

type Estado = 'listo' | 'grabando' | 'pensando' | 'buscando' | 'entendido' | 'guardando' | 'hecho'

type TareaOida = {
  titulo: string
  nota: string | null
  fecha: string | null
  hora: string | null
  repite: 'diaria' | 'semanal' | 'mensual' | 'anual' | null
  para_id: string | null
  para_nombre: string | null
  para_dicho: boolean
  repite_hasta?: string | null
}

type Oido = {
  transcripcion: string | null
  tareas: TareaOida[]
  accion:
    | 'recordatorio' | 'gasto' | 'ingreso' | 'buscar'
    | 'consulta' | 'cambiar' | 'borrar' | 'compra' | 'nada'
  papel_id?: string | null
  ir_a?: string | null
  compra?: { que: string; cantidad: string | null }[]
  compra_seccion?: string | null
  compra_seccion_nombre?: string | null
  /* Las tareas que encajan con lo que ha dicho. Una sola: se enseña y
     se confirma. Varias: elige. Ninguna: se dice. */
  candidatas?: {
    id: string
    titulo: string
    fecha: string | null
    hora: string | null
    para_nombre: string
  }[]
  /* Qué se cambiaría. Solo lo que se ha dicho: lo que no viene, no se
     toca. */
  cambios?: Record<string, string | null> | null
  titulo: string | null
  nota: string | null
  para_id: string | null
  para_nombre: string | null
  para_dicho?: boolean
  fecha: string | null
  hora: string | null
  importe: number | null
  concepto: string | null
  categoria_id: string | null
  categoria_nombre: string | null
  busqueda: string | null
  respuesta?: string
  confianza: 'alta' | 'media' | 'baja'
}

/* Los pesos de las barritas: más altas en el centro, como cualquier
   medidor de sonido. Solo es forma. */
const BARRAS = [0.35, 0.6, 0.85, 1, 0.85, 0.6, 0.35]

export default function Grabar() {
  const [estado, setEstado] = useState<Estado>('listo')
  const [segundos, setSegundos] = useState(0)
  const [oido, setOido] = useState<Oido | null>(null)
  /* Cuál de las candidatas. Con una sola, se elige sola; con varias,
     la elige la persona. Nunca se aplica nada sin que esté puesta. */
  const [elegida, setElegida] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [, setDetalle] = useState<string | null>(null)
  const [creado, setCreado] = useState<string | null>(null)

  /*
    LA BARRA QUE SE MUEVE CON LA VOZ.

    Antes aquí iba el texto apareciendo palabra por palabra. Se ha
    quitado con el reconocedor del navegador —el motivo entero está en
    `grabadora.ts`— y en su sitio va el nivel de sonido.

    No es un consuelo: es MÁS honesto. El texto en directo mentía la
    mitad de las veces —salía repetido, o cortado, o no salía— y la
    barra dice exactamente lo que sabemos con certeza: que el
    micrófono te está oyendo. Lo que has dicho se enseña dos segundos
    después, escrito y entero, en la pantalla de confirmar.
  */
  const [nivel, setNivel] = useState(0)

  /* Se ha callado pero el micrófono sigue abierto. No es "he
     terminado": es "sigo aquí por si quieres seguir". */
  const [enPausa, setEnPausa] = useState(false)

  const grabando = useRef<Grabando | null>(null)
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (reloj.current) clearInterval(reloj.current)
      /* Si alguien sale de la pantalla a media frase, el micrófono se
         suelta. Dejarlo abierto es lo que hace que un móvil enseñe el
         punto rojo de "te están grabando" durante horas. */
      grabando.current?.cancelar()
    }
  }, [])

  /* La escucha del teléfono puede terminarse sola —al callarse— sin
     pasar por el botón de parar. Si el reloj no se para también ahí,
     se queda contando segundos de una grabación que ya no existe. */
  function pararReloj() {
    if (reloj.current) clearInterval(reloj.current)
    reloj.current = null
  }

  async function empezar() {
    setAviso(null)
    setDetalle(null)
    setOido(null)
    setElegida(null)
    setNivel(0)
    setEnPausa(false)

    if (!sePuedeGrabar()) {
      setAviso('Este navegador no puede grabar. Prueba con Chrome o con Safari.')
      return
    }

    const g = await grabarVoz({
      alNivel: setNivel,
      alPausar: () => setEnPausa(true),
      alSeguir: () => setEnPausa(false),

      alTerminar: async (audio, cuantos) => {
        grabando.current = null
        pararReloj()
        setEnPausa(false)
        setNivel(0)
        setEstado('pensando')
        setSegundos(cuantos)
        await enviar(audio)
      },

      alFallar: (motivo) => {
        grabando.current = null
        pararReloj()
        setEnPausa(false)
        setNivel(0)
        setEstado('listo')

        setAviso(
          motivo === 'sin-permiso'
            ? 'HUBI necesita el micrófono para escucharte. Dale permiso cuando el teléfono lo pida.'
            : motivo === 'sin-micro'
              ? 'Este navegador no puede grabar. Prueba con Chrome o con Safari.'
              : 'No he oído nada. Prueba a acercarte un poco al teléfono.'
        )
      },
    })

    if (!g) return

    grabando.current = g
    setSegundos(0)
    setEstado('grabando')
    reloj.current = setInterval(() => setSegundos((x) => x + 1), 1000)
  }

  function parar() {
    pararReloj()
    /* Que lo cierre la grabadora: así entrega lo grabado en vez de
       tirarlo. Cortar por nuestra cuenta perdía el último trozo. */
    grabando.current?.parar()
    setEstado('pensando')
  }

  /**
   * Manda la frase ya escrita. Es lo único que viaja: un renglón.
   *
   * `pista` va cuando la persona ha tocado una de las opciones porque
   * no estaba claro qué quería.
   */
  async function interpretar(texto: string, pista?: string) {
    setAviso(null)
    setEstado('pensando')

    try {
      const r = await fetch('/api/voz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, pista }),
      })
      const datos = (await r.json()) as Oido & { error?: string }

      if (!r.ok) {
        setAviso(datos.error ?? 'No se ha entendido.')
        setEstado('listo')
        return
      }

      if (datos.accion === 'buscar') {
        irABuscar(datos)
        return
      }

      /* Has preguntado por las cuentas: la respuesta se dice en voz
         alta. Es justo el momento en que uno está mirando para otro
         lado. */
      if (datos.accion === 'consulta' && datos.respuesta) decir(datos.respuesta)

      /* Con una sola candidata, se elige sola: preguntar "¿cuál?"
         cuando solo hay una es hacer trabajar a alguien para nada. Con
         varias, no se elige por nadie. */
      setElegida(datos.candidatas?.length === 1 ? datos.candidatas[0].id : null)
      setOido(loQueSePuedaEnsenar(datos))
      setEstado('entendido')
    } catch {
      setAviso('No hay conexión. Inténtalo otra vez.')
      setEstado('listo')
    }
  }

  async function enviar(bruto: Blob) {
    try {
      const wav = await aWav(bruto)

      const cuerpo = new FormData()
      cuerpo.append('audio', new File([wav], 'voz.wav', { type: 'audio/wav' }))

      const r = await fetch('/api/voz', { method: 'POST', body: cuerpo })
      const datos = (await r.json()) as Oido & { error?: string; detalle?: string }

      if (!r.ok) {
        setAviso(datos.error ?? 'No se ha entendido.')
        setDetalle(datos.detalle ?? `HTTP ${r.status} · audio ${Math.round(wav.size / 1024)} KB`)
        setEstado('listo')
        return
      }

      // Buscar no cambia nada: se va directo al resultado.
      if (datos.accion === 'buscar') {
        irABuscar(datos)
        return
      }

      /* Con una sola candidata, se elige sola: preguntar "¿cuál?"
         cuando solo hay una es hacer trabajar a alguien para nada. Con
         varias, no se elige por nadie. */
      setElegida(datos.candidatas?.length === 1 ? datos.candidatas[0].id : null)
      setOido(loQueSePuedaEnsenar(datos))
      setEstado('entendido')
    } catch {
      setAviso('No se ha podido enviar la grabación.')
      setEstado('listo')
    }
  }

  /*
    NINGUNA PANTALLA EN BLANCO, NUNCA.

    La pantalla de "esto he entendido" solo sabe pintar unas acciones
    concretas. Si llega otra —hoy o el día que añadamos una nueva— no
    pinta nada: ni texto, ni botón, ni salida. Fue exactamente lo que
    pasó con "buscar".

    Así que cualquier acción que esta pantalla no sepa enseñar se trata
    como "nada", que sí tiene su pantalla: enseña lo que se ha dicho y
    pregunta para qué era. Un "no te he entendido" con salida es
    infinitamente mejor que una pantalla muda.
  */
  const ENSEÑABLES = [
    'recordatorio', 'gasto', 'ingreso', 'consulta',
    'cambiar', 'borrar', 'compra', 'nada',
  ]

  function loQueSePuedaEnsenar(datos: Oido): Oido {
    return ENSEÑABLES.includes(datos.accion) ? datos : { ...datos, accion: 'nada' }
  }

  /*
    IR A LOS RESULTADOS.

    AQUÍ ESTABA EL BLOQUEO, y eran dos fallos encadenados.

    1 · Se pedía `busqueda || categoria_id` para saltar. Si el modelo
        decía "esto es una búsqueda" pero no rellenaba ninguno de los
        dos —pasa, y bastante—, no se saltaba… y se caía al final de
        la función, que enseña la pantalla de "esto he entendido". Esa
        pantalla no tiene NINGÚN caso para "buscar": se quedaba en
        blanco, sin texto y sin botón. Bloqueado.

        Ahora, si no hay términos, se busca CON LO QUE SE HA DICHO. Lo
        tenemos: es la transcripción. Buscar de más y no encontrar es
        molesto; quedarse mirando una pantalla muerta es otra cosa.

    2 · Se cambiaba `window.location.href` sin tocar el estado, que se
        quedaba en "pensando". Si la navegación tarda o no llega, la
        pantalla se queda pensando para siempre. Ahora dice "Buscando…"
        y, si en seis segundos no ha pasado nada, vuelve sola.
  */
  function irABuscar(datos: Oido) {
    const consulta = enlaceBusqueda(datos)
    const términos = consulta || `q=${encodeURIComponent(datos.transcripcion ?? '')}`

    if (!consulta && !datos.transcripcion) {
      setAviso('No he entendido qué hay que buscar.')
      setEstado('listo')
      return
    }

    setEstado('buscando')
    /* La red: si el navegador no se mueve, esto devuelve el control.
       Nunca se deja a nadie delante de una pantalla que no responde. */
    setTimeout(() => {
      setAviso('No se ha podido abrir la búsqueda. Inténtalo otra vez.')
      setEstado('listo')
    }, 6000)
    window.location.href = `/documentos?${términos}`
  }

  async function guardar() {
    if (!oido) return
    setEstado('guardando')
    setAviso(null)

    try {
      /*
        Cambiar y borrar.

        Solo llega aquí con una tarea elegida y después de que se haya
        visto en pantalla cuál es. Si la respuesta no dice que se ha
        borrado o cambiado de verdad, se enseña el motivo: el silencio
        que decía "hecho" sin hacer nada nos costó una tarde entera.
      */
      if (oido.accion === 'borrar' || oido.accion === 'cambiar') {
        if (!elegida) throw new Error('Elige primero cuál.')

        const r = await fetch(`/api/recordatorios/${elegida}`, {
          method: oido.accion === 'borrar' ? 'DELETE' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: oido.accion === 'borrar' ? undefined : JSON.stringify(oido.cambios ?? {}),
        })
        if (!r.ok) throw new Error((await r.json()).error)

        decir(oido.accion === 'borrar' ? 'Borrado.' : 'Cambiado.')
        setEstado('hecho')
        return
      }

      /* La compra: todas de una vez, como las tareas múltiples. */
      if (oido.accion === 'compra') {
        const r = await fetch('/api/compra', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cosas: oido.compra ?? [],
            seccion_id: oido.compra_seccion ?? null,
          }),
        })
        const respuesta = await r.json()
        if (!r.ok) throw new Error(respuesta.error)

        /* Si algo se ha caído por no ser un producto, SE DICE. Que
           alguien dicte cinco cosas, se apunten tres y no se entere es
           peor que apuntar las cinco: se fía, y le faltan dos en el
           súper. */
        if (respuesta.descartadas > 0) {
          setAviso(
            respuesta.descartadas === 1
              ? 'Una de las cosas que has dicho no parecía un producto y no la he apuntado.'
              : `${respuesta.descartadas} de las cosas que has dicho no parecían productos y no las he apuntado.`
          )
        }

        /*
          Y SI ADEMÁS HA DICHO CUÁNDO VA, SE PONE EN LA AGENDA.

          "Apunta leche, pan y huevos y recuérdame ir el sábado a las
          diez" son dos cosas en una frase, que es como habla la gente.
          Antes había que decirlo en dos veces: primero la compra y
          luego, en otra frase, el recordatorio.

          La ida se guarda DESPUÉS de la compra y sin poder tumbarla:
          si esto fallara, los artículos ya están apuntados —que es lo
          que no se puede perder— y solo se queda sin la fecha.
        */
        let conFecha = false

        /*
          AQUÍ SE PERDÍA LA FECHA DE LA COMPRA.

          Se leía de `tareas[0]`, pero en una compra el modelo NO
          rellena tareas: pone la fecha arriba del todo, en el campo
          `fecha` de la frase entera —que es lo correcto, porque la
          fecha es de la ida al súper, no de cada artículo—. Resultado:
          "apunta leche y pan y voy el sábado" apuntaba la compra y se
          comía el sábado sin decir nada.

          Se miran los dos sitios, empezando por el bueno.
        */
        const deArriba = oido.tareas?.[0] ?? null
        const cuando = {
          fecha: oido.fecha ?? deArriba?.fecha ?? null,
          hora: oido.hora ?? deArriba?.hora ?? null,
          para_id: deArriba?.para_id ?? null,
        }

        if (cuando.fecha && respuesta.lista_id) {
          try {
            /*
              LA FECHA SE GUARDA EN LA LISTA, NO SUELTA EN LA AGENDA.

              Antes se creaba una tarea a secas. La tarea salía en la
              Agenda, sí — pero la pantalla de la compra seguía diciendo
              "Poner día a esta compra", como si no se hubiera dicho
              nada. De ahí lo de "no refleja una fecha de la compra".

              Guardándola en la lista se ven las dos cosas: el día en la
              propia compra Y la tarea en la Agenda, que la crea esa
              misma ruta. Una sola verdad en dos sitios.
            */
            const f = await fetch('/api/compra/listas', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: respuesta.lista_id,
                fecha: cuando.fecha,
                hora: cuando.hora,
                asignado_a: cuando.para_id ?? null,
                aviso_previo: cuando.hora ? '1h' : 'ninguno',
              }),
            })
            conFecha = f.ok
          } catch {
            /* La compra está guardada. Que falle la fecha no puede
               deshacerla ni callarse: se dice abajo. */
          }
        }

        decir(
          (respuesta.cuantas === 1
            ? 'Apuntado en la compra.'
            : `Apuntadas ${respuesta.cuantas} cosas en la compra.`) +
            (conFecha ? ' Y la ida, en la Agenda.' : '')
        )
        if (cuando.fecha && !conFecha) {
          setAviso('La compra está apuntada, pero no he podido poner la fecha en la Agenda.')
        }
        setEstado('hecho')
        return
      }

      if (oido.accion === 'recordatorio') {
        /* Todas de una vez. El servidor las mete juntas: o entran
           todas o no entra ninguna. Guardar dos de tres y no decirlo
           sería peor que no guardar nada. */
        const r = await fetch('/api/recordatorios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tareas: (oido.tareas ?? []).map((t) => ({
              titulo: t.titulo,
              asignado_a: t.para_id,
              fecha: t.fecha,
              hora: t.hora,
              nota: t.nota,
              repite: t.repite,
              repite_hasta: t.repite_hasta,
            })),
          }),
        })
        const respuesta = await r.json()
        if (!r.ok) throw new Error(respuesta.error)

        /* Si algo se ha caído por no ser un producto, SE DICE. Que
           alguien dicte cinco cosas, se apunten tres y no se entere es
           peor que apuntar las cinco: se fía, y le faltan dos en el
           súper. */
        if (respuesta.descartadas > 0) {
          setAviso(
            respuesta.descartadas === 1
              ? 'Una de las cosas que has dicho no parecía un producto y no la he apuntado.'
              : `${respuesta.descartadas} de las cosas que has dicho no parecían productos y no las he apuntado.`
          )
        }
        setCreado(respuesta.id ?? null)
      } else {
        const r = await fetch('/api/movimientos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: oido.accion,
            concepto: oido.concepto || oido.titulo || 'Sin concepto',
            importe: String(oido.importe ?? ''),
            categoria_id: oido.categoria_id,
            fecha: oido.fecha ?? new Date().toISOString().slice(0, 10),
            nota: oido.nota,
          }),
        })
        if (!r.ok) throw new Error((await r.json()).error)
      }
      decir(
        oido.accion === 'recordatorio'
          ? (oido.tareas?.length ?? 0) > 1
            ? `Apuntadas las ${oido.tareas.length} cosas.`
            : 'Apuntado.'
          : 'Apuntado en la finca.'
      )
      setEstado('hecho')
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se ha podido guardar.')
      setEstado('entendido')
    }
  }

  const puedeGuardar =
    oido?.accion === 'compra'
      ? (oido.compra?.length ?? 0) > 0
      : oido?.accion === 'borrar' || oido?.accion === 'cambiar'
      ? Boolean(elegida)
      : oido?.accion === 'recordatorio'
        ? (oido.tareas?.length ?? 0) > 0
        : (oido?.accion === 'gasto' || oido?.accion === 'ingreso') &&
          Boolean(oido.importe && oido.categoria_id)

  return (
    <main
      className="techo relative min-h-screen overflow-hidden px-6 pb-8"
      style={{ background: '#01071B', color: '#fff' }}
    >
      <ColorDeBarra color="#01071B" />

      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="mancha deriva-1" style={{ width: 330, height: 330, left: -130, top: -100, background: 'rgba(20,184,166,.34)' }} />
        <span className="mancha deriva-3" style={{ width: 320, height: 320, right: -135, top: 0, background: 'rgba(59,130,246,.30)' }} />
        <span className="mancha deriva-2" style={{ width: 360, height: 360, right: -120, bottom: -130, background: 'rgba(139,92,246,.26)' }} />
        <span
          className="absolute inset-0"
          style={{ background: 'radial-gradient(80% 50% at 50% 42%, rgba(1,7,27,.92) 0%, rgba(1,7,27,.6) 55%, transparent 100%)' }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-md">
        <Volver href="/" oscuro />

        {/* ── Escuchando o en espera ── */}
        {(estado === 'listo' || estado === 'grabando' || estado === 'pensando' || estado === 'buscando') && (
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
            {estado === 'pensando' || estado === 'buscando' ? (
              <>
                {/* El mismo aro, girando: sigue siendo HUBI pensando,
                    no una ruedecita cualquiera de navegador. */}
                <div className="relative h-20 w-20">
                  <span aria-hidden className="orbita" />
                  <span aria-hidden className="orbita orbita-b" />
                </div>
                <h1 className="mt-12 text-[24px] font-extrabold text-white">
                  {estado === 'buscando' ? 'Buscando…' : 'Un momento…'}
                </h1>
                <p className="mt-6 text-[17px] font-semibold leading-snug text-slate-300">
                  {estado === 'buscando' ? '' : `${segundos} segundos de grabación`}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-white">
                  {estado !== 'grabando'
                    ? '¿Qué necesitas?'
                    : enPausa
                      ? '¿Algo más?'
                      : 'Te escucho'}
                </h1>

                <button
                  onClick={estado === 'grabando' ? parar : empezar}
                  className="relative mt-10 flex h-40 w-40 items-center justify-center"
                  aria-label={estado === 'grabando' ? 'Terminar' : 'Empezar a hablar'}
                >
                  {/*
                    Los aros de HUBI.

                    Quietos y apagados en reposo: están ahí, no piden
                    nada. En cuanto escucha, se encienden y giran — el
                    de fuera al revés y más despacio. Mientras gira,
                    te está oyendo, y eso se entiende sin leer nada.
                  */}
                  <span
                    aria-hidden
                    className={`orbita ${estado === 'grabando' ? '' : 'orbita-quieta'}`}
                  />
                  <span
                    aria-hidden
                    className={`orbita orbita-b ${estado === 'grabando' ? '' : 'orbita-quieta'}`}
                  />

                  {estado === 'grabando' && (
                    <>
                      <span className="pulso" />
                      <span className="pulso pulso-b" />
                    </>
                  )}
                  <span
                    className="relative flex h-32 w-32 items-center justify-center rounded-full text-white"
                    style={{
                      background:
                        estado === 'grabando'
                          ? 'linear-gradient(140deg,#2DD4BF,#14B8A6 40%,#8B5CF6)'
                          : 'linear-gradient(140deg,#2DD4BF,#14B8A6 45%,#3B82F6)',
                      boxShadow: '0 14px 44px rgba(20,184,166,.42)',
                    }}
                  >
                    <Ico nombre={estado === 'grabando' ? 'onda' : 'micro'} tam={54} grosor={1.9} />
                  </span>
                </button>

                <p className="mt-6 text-[18px] font-bold text-white">
                  {estado !== 'grabando'
                    ? 'Toca y habla'
                    : enPausa
                      ? 'Sigo escuchando. Habla cuando quieras.'
                      : `Te escucho · ${segundos}s`}
                </p>

                {/*
                  El botón de terminar solo aparece en la pausa.

                  Antes se cerraba al primer silencio y cortaba a mitad
                  de idea. Ahora, al callarse, HUBI no da nada por
                  terminado: pregunta. Si sigue hablando, sigue
                  escuchando; si toca aquí, se acabó; y si no hace ni
                  una cosa ni otra, se cierra solo a los pocos
                  segundos. Nadie se queda a medias y nadie se queda
                  esperando.
                */}
                {estado === 'grabando' && enPausa && (
                  <button
                    onClick={parar}
                    className="mt-5 flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[16px] bg-verde text-[18px] font-extrabold text-white"
                  >
                    <Ico nombre="check" tam={22} grosor={2.3} />
                    Ya está, eso es todo
                  </button>
                )}

                {/*
                  LA BARRA QUE SE MUEVE CON TU VOZ.

                  Aquí iba el texto apareciendo palabra por palabra. Se
                  quitó con el reconocedor del navegador, y no lo echo
                  de menos: aquel texto mentía la mitad de las veces
                  —salía repetido, cortado, o no salía— y a quien lo
                  leía le hacía dudar de si le estaban oyendo.

                  Esto dice solo lo que sabemos con certeza: que el
                  micrófono te oye. Lo que has dicho aparece dos
                  segundos después, escrito y entero, en la pantalla de
                  confirmar. Y una barra que se mueve cuando hablas y se
                  queda quieta cuando callas es una prueba mucho más
                  clara que un círculo dando vueltas.
                */}
                {estado === 'grabando' && (
                  <div
                    className="mt-8 flex h-16 w-full items-center justify-center gap-[5px]"
                    aria-hidden
                  >
                    {BARRAS.map((peso, i) => (
                      <span
                        key={i}
                        className="w-[6px] rounded-full transition-all duration-100"
                        style={{
                          height: `${Math.max(6, nivel * peso * 60)}px`,
                          background: enPausa
                            ? 'rgba(255,255,255,.22)'
                            : `rgba(45,212,191,${0.35 + nivel * 0.65})`,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/*
                  Cuatro ejemplos, uno por cada cosa que sabe hacer.

                  Antes eran cuatro renglones seguidos, en gris, con el
                  mismo peso: un párrafo que nadie lee. Ahora cada uno
                  lleva delante lo que ES —Apuntar, Gastar, Preguntar,
                  Buscar— porque lo que hace falta saber al mirar esta
                  pantalla no es qué frase exacta decir, sino QUÉ SE
                  PUEDE PEDIR. La frase es el ejemplo, no la orden.
                */}
                {estado === 'listo' && (
                  <ul className="mt-11 w-full space-y-2.5 text-left">
                    <Ejemplo que="Apuntar" frase="Recuérdale a Conchita que mañana llame al médico" />
                    <Ejemplo que="Gastar" frase="Un gasto de 85 euros de productos" />
                    <Ejemplo que="Preguntar" frase="¿Cuánto hemos gastado este trimestre en agua?" />
                    <Ejemplo que="Buscar" frase="Enséñame las facturas de la finca" />
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Lo que ha entendido ── */}
        {(estado === 'entendido' || estado === 'guardando') && oido && (
          <>
            {oido.transcripcion && (
              <p className="mt-8 rounded-[20px] bg-white/[.07] px-5 py-4 text-[18px] font-semibold leading-snug text-slate-200">
                «{oido.transcripcion}»
              </p>
            )}

            {oido.accion === 'consulta' && (
              <>
                <h1 className="mt-10 text-[24px] font-extrabold leading-snug text-white">
                  {oido.respuesta}
                </h1>
                <div className="mt-12 space-y-4">
                  {/* Si la pregunta era por un papel, el botón lleva AL
                      PAPEL. Contarle a alguien cuál fue la última
                      factura y luego mandarle a la pantalla de la Finca
                      es hacerle buscar lo que acaba de encontrar. */}
                  {/* El botón lleva A LO QUE SE HA PREGUNTADO. Contarle
                      a alguien qué hay en la compra y mandarle luego a
                      la Finca es hacerle buscar lo que acaba de
                      encontrar. */}
                  <Link
                    href={
                      oido.papel_id
                        ? `/documentos/${oido.papel_id}`
                        : (oido.ir_a ?? '/finca')
                    }
                    className="block flex h-[62px] items-center justify-center rounded-[16px] bg-verde text-[18px] font-extrabold text-white"
                  >
                    {oido.papel_id
                      ? 'Ver el papel'
                      : oido.ir_a === '/compra'
                        ? 'Ver la compra'
                        : oido.ir_a === '/agenda'
                          ? 'Ver la Agenda'
                          : 'Ver la Finca'}
                  </Link>
                  <button onClick={() => setEstado('listo')} className="w-full flex h-[62px] items-center justify-center rounded-[16px] border border-white/20 text-[18px] font-bold text-slate-200">
                    Preguntar otra cosa
                  </button>
                </div>
              </>
            )}

            {/*
              ── CAMBIAR O BORRAR ──

              Aquí nunca se aplica nada solo. Se enseña QUÉ tarea es,
              con su día y su hora, y hace falta un toque más.

              Es la regla de siempre, pero aquí pesa el doble: apuntar
              algo de más se arregla borrándolo; borrar lo que no era no
              se arregla. Una palabra mal oída no puede tener permiso
              para quitar la cita del médico.
            */}
            {(oido.accion === 'borrar' || oido.accion === 'cambiar') && (
              <>
                <h1 className="mt-10 text-[26px] font-extrabold leading-snug text-white">
                  {(oido.candidatas?.length ?? 0) === 0
                    ? 'No encuentro esa tarea'
                    : (oido.candidatas?.length ?? 0) > 1
                      ? '¿Cuál de estas?'
                      : oido.accion === 'borrar'
                        ? '¿Borro esto?'
                        : '¿Cambio esto?'}
                </h1>

                {(oido.candidatas?.length ?? 0) === 0 ? (
                  <>
                    <p className="mt-4 text-[17px] font-medium leading-relaxed text-slate-300">
                      No hay nada pendiente que diga eso. Prueba con otra palabra de
                      la tarea, o míralo en la Agenda.
                    </p>
                    <Link
                      href="/agenda"
                      className="mt-8 block flex h-[62px] items-center justify-center rounded-[16px] bg-verde text-[18px] font-extrabold text-white"
                    >
                      Ver la Agenda
                    </Link>
                  </>
                ) : (
                  <ul className="mt-6 space-y-3">
                    {oido.candidatas!.map((c) => {
                      const esta = elegida === c.id
                      const sola = oido.candidatas!.length === 1
                      return (
                        <li key={c.id}>
                          <button
                            onClick={() => setElegida(esta && !sola ? null : c.id)}
                            aria-pressed={esta}
                            className={`w-full rounded-[18px] border-2 px-4 py-4 text-left ${
                              esta ? 'border-verde bg-verde/15' : 'border-white/20'
                            }`}
                          >
                            <span className="flex items-start gap-3">
                              {!sola && (
                                <span
                                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                                    esta ? 'border-verde bg-verde text-white' : 'border-white/35'
                                  }`}
                                >
                                  {esta && <Ico nombre="check" tam={14} grosor={3} />}
                                </span>
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block text-[18px] font-extrabold leading-snug text-white">
                                  {c.titulo}
                                </span>
                                <span className="mt-0.5 block text-[15px] font-bold text-slate-400">
                                  {c.fecha ? enDia(c.fecha) : 'Sin día'}
                                  {c.hora ? ` · ${c.hora}` : ''} · {c.para_nombre}
                                </span>
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* Qué se cambiaría, dicho en cristiano. Sin esto,
                    "cambiar" es un botón que hace algo sin decir qué. */}
                {oido.accion === 'cambiar' && elegida && (
                  <div className="mt-6 rounded-[18px] bg-white/[.07] px-5 py-4">
                    <p className="text-[13px] font-extrabold tracking-widest text-slate-400">
                      QUEDARÁ ASÍ
                    </p>
                    <p className="mt-1.5 text-[18px] font-bold leading-snug text-white">
                      {loQueCambia(oido.cambios, oido.para_nombre)}
                    </p>
                  </div>
                )}

                {(oido.candidatas?.length ?? 0) > 0 && (
                  <div className="mt-8 space-y-4">
                    <button
                      onClick={guardar}
                      disabled={estado === 'guardando' || !puedeGuardar}
                      className={`w-full flex h-[64px] items-center justify-center rounded-[16px] text-[19px] font-extrabold text-white disabled:opacity-40 ${
                        oido.accion === 'borrar' ? 'bg-coral' : 'bg-verde'
                      }`}
                    >
                      {estado === 'guardando'
                        ? 'Un momento…'
                        : oido.accion === 'borrar'
                          ? 'Sí, borrarla'
                          : 'Sí, cambiarlo'}
                    </button>
                    <button
                      onClick={() => setEstado('listo')}
                      className="w-full flex h-[64px] items-center justify-center rounded-[16px] border border-white/20 text-[19px] font-bold text-white"
                    >
                      Dejarlo como está
                    </button>
                  </div>
                )}
              </>
            )}

            {oido.accion === 'compra' && (
              <>
                <h1 className="mt-10 text-[26px] font-extrabold leading-snug text-white">
                  {(oido.compra?.length ?? 0) === 1
                    ? '¿Lo apunto en la compra?'
                    : `¿Apunto estas ${oido.compra?.length} cosas?`}
                </h1>

                {/* Para qué es. Se dice, porque apuntar la compra de la
                    finca en la de casa se descubre en el súper. */}
                {oido.compra_seccion_nombre && (
                  <p className="mt-3 text-[18px] font-bold text-slate-300">
                    Para {oido.compra_seccion_nombre}
                  </p>
                )}

                <ul className="mt-6 space-y-2.5">
                  {(oido.compra ?? []).map((c, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 rounded-[18px] border border-white/20 px-4 py-4"
                    >
                      <Ico nombre="bolsa" tam={21} grosor={2.1} />
                      <span className="text-[19px] font-extrabold text-white">
                        {c.que}
                        {c.cantidad && (
                          <span className="font-bold text-slate-400"> · {c.cantidad}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 space-y-4">
                  <button
                    onClick={guardar}
                    disabled={estado === 'guardando' || !puedeGuardar}
                    className="w-full flex h-[64px] items-center justify-center rounded-[16px] bg-verde text-[19px] font-extrabold text-white disabled:opacity-40"
                  >
                    {estado === 'guardando' ? 'Apuntando…' : 'Sí, apúntalo'}
                  </button>
                  <button
                    onClick={() => setEstado('listo')}
                    className="w-full flex h-[64px] items-center justify-center rounded-[16px] border border-white/20 text-[19px] font-bold text-white"
                  >
                    Decirlo otra vez
                  </button>
                </div>
              </>
            )}

            {oido.accion === 'nada' && (
              <>
                {/*
                  Antes esto era un callejón: "no te he entendido" y a
                  empezar de cero. Pero la frase SÍ está — se ve ahí
                  arriba, escrita. Lo único que falta es saber para qué
                  era, y eso se pregunta en vez de adivinarlo.

                  Repetir más despacio la misma frase que ya se
                  entendió palabra por palabra no arregla nada. Tocar
                  un botón, sí.
                */}
                <h1 className="mt-10 text-[24px] font-extrabold leading-snug text-white">
                  {oido.transcripcion ? '¿Qué quieres que haga con esto?' : 'No te he oído'}
                </h1>

                {oido.transcripcion ? (
                  <div className="mt-8 space-y-3">
                    <Opcion texto="Apuntar una tarea o un aviso" icono="check"
                      onClick={() => interpretar(oido.transcripcion!, 'recordatorio')} />
                    <Opcion texto="Apuntar un gasto" icono="euro"
                      onClick={() => interpretar(oido.transcripcion!, 'gasto')} />
                    <Opcion texto="Apuntar un ingreso" icono="euro"
                      onClick={() => interpretar(oido.transcripcion!, 'ingreso')} />
                    <Opcion texto="Apuntar en la compra" icono="bolsa"
                      onClick={() => interpretar(oido.transcripcion!, 'compra')} />
                    <Opcion texto="Buscar un papel" icono="carpeta"
                      onClick={() => interpretar(oido.transcripcion!, 'buscar')} />
                    <Opcion texto="Preguntar por las cuentas" icono="hoja"
                      onClick={() => interpretar(oido.transcripcion!, 'consulta')} />
                    <Opcion texto="Cambiar algo ya apuntado" icono="lapiz"
                      onClick={() => interpretar(oido.transcripcion!, 'cambiar')} />
                    <Opcion texto="Borrar algo ya apuntado" icono="aviso"
                      onClick={() => interpretar(oido.transcripcion!, 'borrar')} />
                  </div>
                ) : (
                  <p className="mt-3 text-[16.5px] font-medium leading-relaxed text-slate-300">
                    Prueba a decirlo otra vez, un poco más cerca del teléfono.
                  </p>
                )}

                <button onClick={() => setEstado('listo')} className="mt-6 w-full flex h-[62px] items-center justify-center rounded-[16px] border border-white/20 text-[18px] font-bold text-slate-200">
                  Decirlo otra vez
                </button>
              </>
            )}

            {(oido.accion === 'recordatorio' || oido.accion === 'gasto' || oido.accion === 'ingreso') && (
              <>
                <h1 className="mt-10 text-[26px] font-extrabold leading-tight tracking-tight text-white">
                  {oido.accion === 'recordatorio' && (oido.tareas?.length ?? 0) > 1
                    ? `${oido.tareas.length} cosas para apuntar`
                    : oido.accion === 'recordatorio'
                      ? 'Esto voy a apuntar'
                      : oido.accion === 'gasto'
                        ? 'Este gasto voy a apuntar'
                        : 'Este ingreso voy a apuntar'}
                </h1>

                {oido.confianza === 'baja' && (
                  <p className="mt-5 rounded-[16px] bg-coral/15 px-4 py-3.5 text-[16px] font-semibold leading-snug text-coral">
                    De esto no estoy seguro. Míralo antes de guardar.
                  </p>
                )}

                {/* Una tarjeta por tarea. Cuando son varias, cada una
                    con su número: así se ve de un vistazo que no se ha
                    perdido ninguna de las que se dijeron. */}
                {oido.accion === 'recordatorio' &&
                  (oido.tareas ?? []).map((t, i) => (
                    <div
                      key={i}
                      className="mt-6 divide-y divide-white/10 rounded-[22px] bg-white/[.07] px-5"
                    >
                      {oido.tareas.length > 1 && (
                        <p className="pt-4 text-[13.5px] font-extrabold tracking-wider text-verde">
                          {i + 1} DE {oido.tareas.length}
                        </p>
                      )}
                      <Dato etiqueta="Qué" valor={t.titulo} />
                      <Dato
                        etiqueta="Para quién"
                        valor={
                          t.para_nombre
                            ? t.para_dicho === false
                              ? `${t.para_nombre} · no lo has dicho`
                              : t.para_nombre
                            : null
                        }
                      />
                      <Dato etiqueta="Cuándo" valor={t.fecha ? enPalabras(t.fecha) : 'Sin fecha'} />
                      <Dato etiqueta="Hora" valor={t.hora} />
                      <Dato etiqueta="Se repite" valor={cadaCuanto(t.repite)} />
                      {/*
                        ESTA LÍNEA FALTABA, Y HACÍA PARECER QUE NO SE
                        ENTENDÍA LA MITAD DE LA FRASE.

                        "Una cita diaria solo durante una semana" se
                        entendía entera —el final estaba guardado— pero
                        aquí solo salía "Se repite: Todos los días".
                        Quien lo lee da por hecho que se ha perdido el
                        "solo una semana" y vuelve a decirlo, o peor:
                        deja de fiarse de la voz.

                        Una confirmación que enseña la mitad de lo
                        entendido es peor que no confirmar nada.
                      */}
                      {t.repite && (
                        <Dato
                          etiqueta="Hasta"
                          valor={t.repite_hasta ? enPalabras(t.repite_hasta) : 'Sin fecha de fin'}
                        />
                      )}
                      <Dato etiqueta="Nota" valor={t.nota} />
                    </div>
                  ))}

                <div className="mt-6 divide-y divide-white/10 rounded-[22px] bg-white/[.07] px-5">
                  {oido.accion === 'recordatorio' ? null : (
                    <>
                      <Dato etiqueta="Tipo" valor={oido.accion === 'gasto' ? 'Un gasto' : 'Un ingreso'} />
                      <Dato
                        etiqueta="Cuánto"
                        valor={oido.importe != null ? `${String(oido.importe).replace('.', ',')} €` : null}
                      />
                      <Dato etiqueta="De qué" valor={oido.concepto} />
                      <Dato etiqueta="Categoría" valor={oido.categoria_nombre} />
                    </>
                  )}
                </div>

                {!puedeGuardar && (
                  <p className="mt-6 rounded-[16px] bg-coral/15 px-4 py-3.5 text-[16px] font-semibold leading-snug text-coral">
                    Falta algo importante. Dilo otra vez incluyendo{' '}
                    {oido.accion === 'recordatorio' ? 'qué hay que recordar' : 'la cantidad y de qué es'}.
                  </p>
                )}

                <div className="mt-8 space-y-4">
                  <button
                    onClick={guardar}
                    disabled={estado === 'guardando' || !puedeGuardar}
                    className="w-full flex h-[64px] items-center justify-center rounded-[16px] bg-verde text-[19px] font-extrabold text-white disabled:opacity-40"
                  >
                    {estado === 'guardando' ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => setEstado('listo')}
                    className="w-full flex h-[64px] items-center justify-center rounded-[16px] border border-white/20 text-[19px] font-bold text-white"
                  >
                    Decirlo otra vez
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Guardado ── */}
        {estado === 'hecho' && oido && (
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-verde text-white">
              <Ico nombre="check" tam={40} grosor={2.2} />
            </div>
            <h1 className="mt-8 text-[30px] font-extrabold leading-tight text-white">Guardado</h1>
            <p className="mt-3 text-[16.5px] font-semibold text-slate-300">
              {oido.titulo || oido.concepto}
            </p>

            <div className="mt-12 w-full space-y-4">
              <a
                href={
                  oido.accion === 'compra'
                    ? '/compra'
                    : oido.accion === 'recordatorio' && creado
                    ? `/tablon/${creado}`
                    : oido.accion === 'recordatorio'
                      ? '/tablon'
                      : '/finca'
                }
                className="block flex h-[62px] items-center justify-center rounded-[16px] bg-verde text-[18px] font-extrabold text-white"
              >
                {oido.accion === 'compra'
                  ? 'Ver la compra'
                  : oido.accion === 'recordatorio'
                    ? 'Ver lo apuntado'
                    : 'Ver la Finca'}
              </a>
              <button
                onClick={() => {
                  setOido(null)
                  setEstado('listo')
                }}
                className="w-full flex h-[62px] items-center justify-center rounded-[16px] border border-white/20 text-[18px] font-bold text-slate-200"
              >
                Decir otra cosa
              </button>
            </div>
          </div>
        )}

        {aviso && (
          <>
            <p className="mt-8 rounded-[16px] bg-coral/15 px-4 py-3.5 text-[16px] font-semibold leading-snug text-coral">
              {aviso}
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="py-3.5">
      <p className="text-[13px] font-extrabold tracking-widest text-apagado">{etiqueta}</p>
      <p className={`mt-0.5 text-[18px] font-bold leading-snug ${valor ? 'text-white' : 'text-apagado'}`}>
        {valor || 'No lo has dicho'}
      </p>
    </div>
  )
}

function enPalabras(iso: string): string {
  const [a, m, d] = iso.split('-')
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${Number(d)} de ${meses[Number(m) - 1]} de ${a}`
}

/**
 * Convierte la grabación a WAV de 16 kHz en mono.
 *
 * Cada navegador graba en un formato distinto: Chrome en webm, Safari en
 * mp4. En vez de confiar en que el otro lado entienda los dos, el propio
 * navegador descodifica lo que acaba de grabar y lo vuelve a escribir en
 * WAV, que es el formato más simple que existe y lo entiende todo el mundo.
 *
 * Y de paso baja a 16 kHz mono: para voz sobra, y reduce el envío a la
 * cuarta parte. Con datos móviles se nota.
 */
async function aWav(grabacion: Blob): Promise<Blob> {
  const contexto = new AudioContext()
  const decodificado = await contexto.decodeAudioData(await grabacion.arrayBuffer())

  const canal = decodificado.getChannelData(0)
  const destino = 16_000
  const muestras = remuestrear(canal, decodificado.sampleRate, destino)

  await contexto.close()
  return escribirWav(muestras, destino)
}

function remuestrear(datos: Float32Array, origen: number, destino: number): Float32Array {
  if (origen === destino) return datos

  const proporcion = origen / destino
  const largo = Math.floor(datos.length / proporcion)
  const salida = new Float32Array(largo)

  for (let i = 0; i < largo; i++) {
    const punto = i * proporcion
    const antes = Math.floor(punto)
    const despues = Math.min(antes + 1, datos.length - 1)
    const peso = punto - antes
    salida[i] = datos[antes] * (1 - peso) + datos[despues] * peso
  }
  return salida
}

function escribirWav(muestras: Float32Array, frecuencia: number): Blob {
  const buffer = new ArrayBuffer(44 + muestras.length * 2)
  const vista = new DataView(buffer)

  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) vista.setUint8(pos + i, s.charCodeAt(i))
  }

  texto(0, 'RIFF')
  vista.setUint32(4, 36 + muestras.length * 2, true)
  texto(8, 'WAVE')
  texto(12, 'fmt ')
  vista.setUint32(16, 16, true)
  vista.setUint16(20, 1, true) // PCM
  vista.setUint16(22, 1, true) // mono
  vista.setUint32(24, frecuencia, true)
  vista.setUint32(28, frecuencia * 2, true)
  vista.setUint16(32, 2, true)
  vista.setUint16(34, 16, true)
  texto(36, 'data')
  vista.setUint32(40, muestras.length * 2, true)

  let pos = 44
  for (let i = 0; i < muestras.length; i++) {
    const v = Math.max(-1, Math.min(1, muestras[i]))
    vista.setInt16(pos, v < 0 ? v * 0x8000 : v * 0x7fff, true)
    pos += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/* Una opción grande, con su icono y su texto. Nunca solo el icono:
   un dibujo sin palabra al lado obliga a adivinar. */
const MESES_DIA = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/* "12 de noviembre" en vez de "2026-11-12". Quien confirma un borrado
   tiene que reconocer la tarea de un vistazo, no descifrar una fecha. */
function enDia(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} de ${MESES_DIA[Number(m) - 1]}`
}

/*
  Qué va a quedar cambiado, en una frase.

  Un botón que dice "cambiar" sin decir QUÉ cambia es un botón que
  nadie debería pulsar. Aquí se enumera solo lo que se ha dicho — lo
  demás se queda como estaba.
*/
function loQueCambia(
  cambios: Record<string, string | null> | null | undefined,
  paraNombre: string | null
): string {
  if (!cambios) return 'Sin cambios.'

  const partes: string[] = []
  if (cambios.fecha) partes.push(`el ${enDia(cambios.fecha)}`)
  if (cambios.hora) partes.push(`a las ${cambios.hora}`)
  if (cambios.asignado_a !== undefined && paraNombre) partes.push(`para ${paraNombre}`)
  if (cambios.repite) {
    const cada = { diaria: 'cada día', semanal: 'cada semana', mensual: 'cada mes', anual: 'cada año' }
    partes.push(cada[cambios.repite as keyof typeof cada] ?? 'repetida')
  }
  if (cambios.repite_hasta) partes.push(`hasta el ${enDia(cambios.repite_hasta)}`)

  return partes.length > 0 ? partes.join(', ') : 'Sin cambios.'
}

function Opcion({
  texto,
  icono,
  onClick,
}: {
  texto: string
  icono: Parameters<typeof Ico>[0]['nombre']
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-[66px] w-full items-center gap-3.5 rounded-[18px] border border-white/15 bg-white/[.07] px-5 text-left text-[18px] font-bold text-white"
    >
      <Ico nombre={icono} tam={24} grosor={2.1} />
      {texto}
    </button>
  )
}

/* Si ha reconocido una carpeta, se va a la carpeta: eso enseña TODO
   lo que hay dentro. Las palabras sueltas solo hacen falta cuando no
   hay carpeta que abrir. */
function enlaceBusqueda(d: Oido): string {
  const partes: string[] = []
  if (d.categoria_id) partes.push(`cat=${encodeURIComponent(d.categoria_id)}`)
  else if (d.busqueda) partes.push(`q=${encodeURIComponent(d.busqueda)}`)
  return partes.join('&')
}

/* Cada cuánto vuelve, dicho como lo diría cualquiera. */
function cadaCuanto(r: string | null): string | null {
  if (r === 'diaria') return 'Todos los días'
  if (r === 'semanal') return 'Todas las semanas'
  if (r === 'mensual') return 'Todos los meses'
  if (r === 'anual') return 'Todos los años'
  return null
}

/* Un ejemplo de lo que se puede pedir. Lo primero es QUÉ hace; la
   frase va debajo, de muestra. Así se lee la lista de un vistazo sin
   tener que leerse las cuatro frases enteras. */
function Ejemplo({ que, frase }: { que: string; frase: string }) {
  return (
    <li className="rounded-[16px] px-4 py-3" style={{ background: 'rgba(255,255,255,.05)' }}>
      <p className="text-[13px] font-extrabold tracking-widest text-verde">
        {que.toUpperCase()}
      </p>
      <p className="mt-0.5 text-[16.5px] font-semibold leading-snug text-slate-300">
        «{frase}»
      </p>
    </li>
  )
}
