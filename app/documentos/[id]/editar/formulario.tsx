'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico, Volver } from '../../../iconos'
import { Aviso, BotonPrincipal, BotonSecundario, BotonDestructivo } from '../../../piezas'
import type { Categoria } from '@/lib/carpetas'
import { avisosDe, enPalabras, esAviso, type Vencimiento } from '@/lib/vencimientos'
import { hoyAqui } from '@/lib/tablon'

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
  /* Del SQL 43. Pueden no venir: la pantalla tiene que funcionar igual
     el día antes de ejecutarlo. */
  fecha_vencimiento?: string | null
  se_renueva?: boolean | null
  preaviso_dias?: number | null
  avisar_con?: string | null
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

  // ── Lo que caduca ──
  const [vence, setVence] = useState(papel.fecha_vencimiento ?? '')
  const [seRenueva, setSeRenueva] = useState(Boolean(papel.se_renueva))
  const [preaviso, setPreaviso] = useState<number>(papel.preaviso_dias ?? 30)
  const [avisarCon, setAvisarCon] = useState<Vencimiento['avisar_con']>(
    esAviso(papel.avisar_con) ? papel.avisar_con : '1_semana'
  )

  /*
    LO QUE VA A PASAR, ESCRITO ANTES DE GUARDAR.

    Esto es lo único de este bloque que no se puede quitar. Cuatro
    controles —fecha, si se renueva, el preaviso, el aviso— son cuatro
    cosas que no significan nada por separado; juntos significan «te
    avisaremos el 8 de agosto». La frase es la función; los controles
    solo son la forma de llegar a ella.
  */
  const loQueSaldra = useMemo(
    () =>
      avisosDe(
        {
          fecha_vencimiento: vence || null,
          se_renueva: seRenueva,
          preaviso_dias: seRenueva ? preaviso : null,
          avisar_con: avisarCon,
        },
        titulo,
        hoyAqui()
      ),
    [vence, seRenueva, preaviso, avisarCon, titulo]
  )

  /* Se renueva, hay preaviso… y ya no llegas. Es el caso que hay que
     decir en voz alta: el aviso no se va a crear porque no serviría, y
     lo que toca es llamar hoy, no dentro de once meses. */
  const yaNoLlegas =
    Boolean(vence) && seRenueva && !loQueSaldra.some((a) => a.motivo === 'preaviso')

  const [eligiendo, setEligiendo] = useState(false)
  const [padre, setPadre] = useState<string | null>(null)

  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [seguro, setSeguro] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  /* Lo que ha contestado la base de datos, cuando contesta algo. No es
     para Juan Miguel ni para Conchita —a ellos no les dice nada— pero
     mientras esto se está montando, ver el motivo exacto en el móvil
     ahorra una tarde de probar a ciegas. */
  const [porQue, setPorQue] = useState<string | null>(null)

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
        /* `fecha_vencimiento` va siempre —aunque esté vacío— porque su presencia
           es lo que le dice al servidor «esta pantalla sí gobierna el
           vencimiento». Sin él, mandar la cadena vacía no se
           distinguiría de no haber preguntado. */
        fecha_vencimiento: vence || null,
        se_renueva: Boolean(vence) && seRenueva,
        preaviso_dias: Boolean(vence) && seRenueva ? preaviso : null,
        avisar_con: vence ? avisarCon : 'sin_aviso',
      }),
    })

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setAviso(d.error ?? 'No se ha podido guardar el cambio.')
      setGuardando(false)
      return
    }

    /* El papel se ha guardado pero el aviso no. Se queda aquí y se
       dice: mandarle a la ficha con un «listo» sería dejarle creyendo
       que le avisaremos de la ITV. */
    const d = (await r.json().catch(() => ({}))) as {
      aviso?: string | null
      detalle?: string | null
    }
    if (d.aviso) {
      setAviso(d.aviso)
      setPorQue(d.detalle ?? null)
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
        {/* Es el mismo botón de volver que en cualquier otra pantalla:
            antes era uno casero de 48 px sin caja, la cuarta manera
            distinta de volver que había en la aplicación. */}
        <Volver alPulsar={() => (padre ? setPadre(dentroDe?.padre_id ?? null) : setEligiendo(false))} />

        <h2 className="t-seccion mt-3">
          {dentroDe ? dentroDe.nombre : '¿En qué carpeta va?'}
        </h2>

        <ul className="mt-3 space-y-2">
          {lista.map((c) => {
            const tieneHijos = (hijosDe.get(c.id) ?? []).length > 0
            return (
              <li key={c.id}>
                <button
                  onClick={() => elegir(c)}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-[20px] border border-borde bg-superficie px-4 py-3 text-left"
                >
                  <span className="t-cuerpo min-w-0 flex-1 font-extrabold">{c.nombre}</span>
                  {tieneHijos && (
                    <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
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
          <span className="t-cifra-2 text-tenue">€</span>
        </div>
      </Campo>

      {/* ── La carpeta ── */}
      <p className="rotulo mt-5">Dónde se guarda</p>
      <button
        onClick={() => {
          setEligiendo(true)
          setPadre(null)
        }}
        className="mt-2 flex min-h-[76px] w-full items-center gap-3 rounded-[20px] border border-borde bg-superficie px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="t-cuerpo block font-extrabold leading-snug">
            {camino.join(' › ') || 'Sin carpeta'}
          </span>
          <span className="t-apoyo mt-0.5 block">Tocar para cambiarla</span>
        </span>
        <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
      </button>

      <p className="t-apoyo mt-2">
        Al cambiar la carpeta o la fecha, el archivo se mueve también dentro de
        tu Google Drive. No se queda una cosa aquí y otra allí.
      </p>

      {/*
        ── ¿CADUCA? ──

        Se va abriendo solo. Sin fecha no hay nada más que preguntar, y
        preguntar por el preaviso de un papel que no caduca es hacer
        pensar a alguien en algo que no existe. Cada respuesta destapa la
        siguiente, y nunca hay más de una decisión a la vista.
      */}
      <div className="mt-8 rounded-[20px] border border-borde bg-superficie px-4 py-4">
        <p className="t-tarjeta">¿Caduca este papel?</p>
        <p className="t-apoyo mt-1">
          Un seguro, la ITV, un contrato, una garantía. Déjalo vacío si no caduca.
        </p>

        <label className="mt-3.5 block">
          <span className="rotulo">Vence el</span>
          <span className="mt-2 block">
            <input
              type="date"
              value={vence}
              onChange={(e) => setVence(e.target.value)}
              className="entrada"
            />
          </span>
        </label>

        {vence && (
          <>
            <p className="rotulo mt-5">Si no haces nada, ¿qué pasa?</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <Elegir texto="Se acaba" puesto={!seRenueva} alPulsar={() => setSeRenueva(false)} />
              <Elegir
                texto="Se renueva solo"
                puesto={seRenueva}
                alPulsar={() => setSeRenueva(true)}
              />
            </div>

            {seRenueva && (
              <>
                <p className="rotulo mt-5">Para cancelarlo hay que avisar con</p>
                <div className="mt-2 grid grid-cols-3 gap-2.5">
                  {[
                    [30, 'Un mes'],
                    [15, '15 días'],
                    [7, 'Una semana'],
                  ].map(([dias, texto]) => (
                    <Elegir
                      key={dias}
                      texto={texto as string}
                      puesto={preaviso === dias}
                      alPulsar={() => setPreaviso(dias as number)}
                    />
                  ))}
                </div>
              </>
            )}

            <p className="rotulo mt-5">¿Os avisamos?</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {[
                ['1_mes', 'Un mes antes'],
                ['1_semana', 'Una semana antes'],
                ['1_dia', 'Un día antes'],
                ['sin_aviso', 'Solo en el calendario'],
              ].map(([valor, texto]) => (
                <Elegir
                  key={valor}
                  texto={texto}
                  puesto={avisarCon === valor}
                  alPulsar={() => setAvisarCon(valor as Vencimiento['avisar_con'])}
                />
              ))}
            </div>

            {/* Y AQUÍ, LO QUE DE VERDAD VA A PASAR. */}
            <div
              className="mt-5 rounded-[16px] px-4 py-3.5"
              style={{ background: 'var(--t-bien-velo)' }}
            >
              <p className="rotulo" style={{ color: 'var(--t-bien)' }}>
                Quedará así
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {loQueSaldra.map((a) => (
                  <li key={a.motivo} className="t-apoyo font-extrabold text-tinta">
                    · {a.titulo} — {enPalabras(a.fecha)}
                  </li>
                ))}
              </ul>
            </div>

            {yaNoLlegas && (
              <div className="mt-3">
                <Aviso
                  tono="atencion"
                  titulo="Ese aviso llegaría tarde"
                  explicacion="El plazo para cancelarlo ya ha pasado, así que no lo ponemos: no serviría de nada. Si quieres cancelarlo, hay que llamar hoy."
                />
              </div>
            )}
          </>
        )}
      </div>

      {aviso && (
        <div className="mt-4">
          {/* `porQue` es el motivo que devuelve la base de datos, y aquí
              SÍ se enseña: fue la línea gris que resolvió en un paso lo
              que tres rondas de conjeturas no consiguieron. Lo que no se
              enseña nunca es un mensaje crudo de Postgres sin traducir. */}
          <Aviso titulo="No se ha podido guardar" explicacion={aviso} detalle={porQue} />
        </div>
      )}

      <div className="mt-5">
        <BotonPrincipal onClick={guardar} desactivado={guardando || borrando}>
          {guardando ? 'Guardando…' : 'Guardar los cambios'}
        </BotonPrincipal>
      </div>

      {/* ── Borrar ── */}
      <div className="mt-10 border-t border-borde pt-6">
        {!seguro ? (
          <BotonDestructivo onClick={() => setSeguro(true)} desactivado={guardando}>
            Borrar este papel
          </BotonDestructivo>
        ) : (
          <div
            className="rounded-[20px] border px-4 py-4"
            style={{
              background: 'var(--t-alerta-velo)',
              borderColor: 'color-mix(in srgb, var(--t-alerta) 45%, transparent)',
            }}
          >
            <p className="t-tarjeta" style={{ color: 'var(--t-alerta)' }}>
              ¿Seguro que quieres borrarlo?
            </p>
            {/*
              Se dice EXACTAMENTE qué va a pasar, sin adornos. Que el
              archivo va a la papelera de Drive no es un detalle
              técnico: es la diferencia entre "se puede recuperar" y
              "se ha perdido", y quien decide tiene derecho a saberlo
              ANTES de tocar el botón rojo.
            */}
            <ul className="t-apoyo mt-2 space-y-1 text-tinta-suave">
              <li>· Desaparece de HUBI.</li>
              <li>· El archivo va a la papelera de tu Google Drive, donde se puede recuperar durante 30 días.</li>
              <li>· Si contaba como gasto o ingreso, deja de contar.</li>
              <li>· Los avisos que salieron de él se quedan, no se borran.</li>
            </ul>

            {/*
              «Sí, borrarlo» iba relleno de rojo y «No» al lado, los dos
              del mismo tamaño. Un botón rojo grande invita a pulsarlo
              tanto como cualquier otro botón grande. Ahora el que borra
              es el destructivo del sistema —borde y texto, sin relleno—
              y el de quedarse como está va debajo, entero.
            */}
            <div className="mt-4 space-y-2.5">
              <BotonDestructivo onClick={borrar} desactivado={borrando}>
                {borrando ? 'Borrando…' : 'Sí, borrarlo'}
              </BotonDestructivo>
              <BotonSecundario onClick={() => setSeguro(false)} desactivado={borrando}>
                Dejarlo como está
              </BotonSecundario>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/*
  Una opción de las de elegir una entre pocas.

  Con borde de dos píxeles siempre, puesto o no. Si el borde apareciera
  solo al elegirla, todos los botones se moverían un pelo al tocar uno
  — y ese salto, en una pantalla llena de opciones, se lee como que algo
  ha fallado.
*/
function Elegir({
  texto,
  puesto,
  alPulsar,
}: {
  texto: string
  puesto: boolean
  alPulsar: () => void
}) {
  return (
    <button
      onClick={alPulsar}
      aria-pressed={puesto}
      className="t-apoyo flex h-[60px] items-center justify-center rounded-[16px] border px-2 text-center font-extrabold leading-tight"
      style={{
        borderColor: puesto ? 'var(--color-accion)' : 'var(--t-borde)',
        background: puesto ? 'var(--t-bien-velo)' : 'var(--t-superficie)',
        color: 'var(--t-tinta)',
      }}
    >
      {texto}
    </button>
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

/*
  Este `Campo` local se queda de momento: es un <label> que envuelve al
  campo, y el del sistema es un <div> con el rótulo aparte. Cambiarlo
  aquí obligaría a repasar el foco de cada uno de los cuatro campos, y
  eso es trabajo de la tanda siguiente. Queda anotado.
*/
