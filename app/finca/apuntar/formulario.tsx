'use client'

import { useMemo, useState } from 'react'
import type { Categoria } from '@/lib/rutas'
import { Ico, Volver } from '../../iconos'
import {
  Aviso,
  BotonPrincipal,
  BotonSecundario,
  Fila,
  Hecho,
  PastillaAmbito,
} from '../../piezas'
import CamposEstancia, { ESTANCIA_VACIA, type Estancia } from '../../estancia'
import { TIPOS, desglose, comoSeLlama, tipoHabitual, type Impuesto } from '@/lib/impuesto'

type Paso = 'tipo' | 'datos' | 'hecho'

export default function Apuntar({
  categorias,
  nombre = 'Finca',
  volver = '/finca',
  /* Los Helechos pregunta además por el apartamento, y en los
     ingresos por las noches y las personas. La Finca no: no tiene
     apartamentos que separar. */
  conApartamentos = false,
  /*
    QUÉ SECCIÓN ES ÉSTA, para poder volver a ella.

    Antes, «Apuntar otro» llevaba a `?seccion=HELECHOS` siempre que la
    sección tuviera unidades. En la casa de Juan Miguel funcionaba; en
    cualquier otra, apuntar el segundo gasto de unas obras acababa en
    las categorías de Los Helechos. Ahora se devuelve el mismo
    parámetro con el que se entró, sea el que sea.
  */
  seccion = null,
  /* IGIC, IVA o nada. Apagado de serie: en una casa que no factura,
     esto no aparece por ningún lado. */
  impuesto = 'ninguno',
}: {
  categorias: Categoria[]
  /* De qué sección se está apuntando, para decirlo en pantalla. */
  nombre?: string
  volver?: string
  conApartamentos?: boolean
  seccion?: string | null
  impuesto?: Impuesto
}) {
  const [paso, setPaso] = useState<Paso>('tipo')
  const [tipo, setTipo] = useState<'gasto' | 'ingreso'>('gasto')
  const [importe, setImporte] = useState('')
  const [concepto, setConcepto] = useState('')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [estancia, setEstancia] = useState<Estancia>(ESTANCIA_VACIA)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  /* El tipo de IGIC/IVA de este apunte. Arranca en el general, que es
     el que se usa nueve de cada diez veces. */
  const [tipoImpuesto, setTipoImpuesto] = useState<number>(tipoHabitual(impuesto) ?? 0)

  /*
    EL DESGLOSE, MIENTRAS SE ESCRIBE.

    Aquí está el valor entero de esto: se teclea 127,43 —lo que pone la
    factura— y debajo aparece «Base 119,09 · IGIC 8,34» sin pedir nada
    más. Nadie divide por 1,07 de cabeza, y pedir la base en un campo
    aparte convertiría apuntar un gasto en hacer contabilidad.
  */
  const desgloseAhora = useMemo(() => {
    const total = Number(importe.replace(',', '.'))
    if (!Number.isFinite(total) || total <= 0) return null
    return desglose(total, tipoImpuesto)
  }, [importe, tipoImpuesto])

  const opciones = useMemo(
    () => categorias.filter((c) => c.naturaleza === tipo),
    [categorias, tipo]
  )

  function empezar(t: 'gasto' | 'ingreso') {
    setTipo(t)
    setCategoriaId(null)
    setPaso('datos')
  }

  async function guardar() {
    setAviso(null)
    setGuardando(true)

    try {
      const r = await fetch('/api/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          concepto,
          importe,
          impuesto_tipo: impuesto === 'ninguno' ? null : tipoImpuesto,
          fecha,
          categoria_id: categoriaId,
          ...(conApartamentos
            ? {
                apartamento: estancia.apartamento,
                personas: tipo === 'ingreso' ? estancia.personas : null,
                noches: tipo === 'ingreso' ? estancia.noches : null,
                huesped: tipo === 'ingreso' ? estancia.huesped : '',
                referencia: tipo === 'ingreso' ? estancia.referencia : '',
              }
            : {}),
        }),
      })
      const datos = await r.json()

      if (!r.ok) {
        setAviso(datos.error ?? 'No se ha podido apuntar.')
        setGuardando(false)
        return
      }
      setPaso('hecho')
    } catch {
      setAviso('No hay conexión. Inténtalo otra vez.')
    }
    setGuardando(false)
  }

  if (paso === 'hecho') {
    return (
      <main className="flex min-h-screen flex-col justify-center px-5 py-16">
        <div className="mx-auto w-full max-w-md">
          <Hecho
            titulo="Apuntado"
            explicacion={`${tipo === 'gasto' ? 'Gasto' : 'Ingreso'} de ${importe.replace('.', ',')} € · ${concepto}`}
          >
            <BotonPrincipal href={volver}>Ver {nombre}</BotonPrincipal>
            <BotonSecundario
              href={seccion ? `/finca/apuntar?seccion=${encodeURIComponent(seccion)}` : '/finca/apuntar'}
            >
              Apuntar otro
            </BotonSecundario>
          </Hecho>
        </div>
      </main>
    )
  }

  return (
    <main className="techo-holgado min-h-screen px-5 pb-10">
      <div className="mx-auto w-full max-w-md">
        {/*
          El botón de volver del sistema.

          Era uno casero, y además el de «datos → tipo» usaba
          `window.location.href`, que RECARGA LA APLICACIÓN ENTERA en
          vez de navegar: medio segundo de pantalla en blanco para
          retroceder un paso dentro de la misma pantalla.
        */}
        {paso === 'datos' ? (
          <Volver alPulsar={() => setPaso('tipo')} />
        ) : (
          <Volver href={volver} />
        )}

        {paso === 'tipo' && (
          <>
            <h1 className="t-titulo mt-4">¿Qué quieres apuntar?</h1>

            {/* Lo primero, porque es lo que menos trabajo da */}
            {/*
              Ésta SÍ se tiñe, y es la excepción controlada: es la
              opción que queremos que se elija —una foto y HUBI hace lo
              demás— y el tinte es lo que la separa de las dos de
              abajo. Al 12 % era relleno; al 5 % es un matiz.
            */}
            <div className="mt-5">
              <Fila href="/guardar" alto="alta" ambito="verde" tinte className="!min-h-[80px]">
                <PastillaAmbito icono="foto" ambito="verde" />
                <span className="min-w-0 flex-1">
                  <span className="t-tarjeta block">Tengo el papel</span>
                  <span className="t-apoyo block leading-snug">
                    Hazle una foto: leo el importe y lo apunto solo
                  </span>
                </span>
                <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
              </Fila>
            </div>

            <p className="rotulo mt-6">O apúntalo a mano</p>
            <div className="mt-3 space-y-2.5">
              {/* Gasto y ingreso son ESTADO, no ámbito: sale dinero o
                  entra. Por eso llevan coral y verde vivos, que es lo
                  único que los distingue además del texto. */}
              <button
                onClick={() => empezar('gasto')}
                className="flex min-h-[76px] w-full items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-4 text-left"
              >
                <span
                  className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px]"
                  style={{ background: 'var(--t-alerta-velo)', color: 'var(--t-alerta)' }}
                >
                  <Ico nombre="euro" tam={22} grosor={2.1} />
                </span>
                <span className="t-tarjeta flex-1">Un gasto</span>
                <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
              </button>
              <button
                onClick={() => empezar('ingreso')}
                className="flex min-h-[76px] w-full items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-4 text-left"
              >
                <span
                  className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px]"
                  style={{ background: 'var(--t-bien-velo)', color: 'var(--t-bien)' }}
                >
                  <Ico nombre="euro" tam={22} grosor={2.1} />
                </span>
                <span className="t-tarjeta flex-1">Un ingreso</span>
                <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
              </button>
            </div>

            <p className="t-apoyo mt-5 text-center">
              También puedes decírmelo: «apunta 40 € de productos».
            </p>
          </>
        )}

        {paso === 'datos' && (
          <>
            <h1 className="mt-8 text-[27px] font-extrabold leading-tight tracking-tight text-tinta">
              {tipo === 'gasto' ? 'Un gasto' : 'Un ingreso'}
            </h1>

            <label htmlFor="importe" className="rotulo mt-8 block">
              ¿Cuánto?
            </label>
            <div className="mt-2 flex items-center rounded-[16px] border border-borde bg-superficie px-4">
              <input
                id="importe"
                inputMode="decimal"
                autoFocus
                value={importe}
                onChange={(e) => setImporte(e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0,00"
                className="t-cifra w-full bg-transparent py-4 text-tinta placeholder:text-apagado focus:outline-none"
              />
              <span className="t-cifra text-tenue">€</span>
            </div>

            {/*
              ── EL IGIC O EL IVA ──

              Debajo del importe y no encima, porque el orden importa:
              primero se teclea lo que pone la factura —que es lo que
              uno tiene delante— y después se dice de qué tipo es. Al
              revés obligaría a decidir algo antes de escribir el número
              que ya se sabe.

              Y la frase del desglose se actualiza mientras se escribe:
              es la prueba de que HUBI ha entendido, sin tener que
              guardar para comprobarlo.
            */}
            {impuesto !== 'ninguno' && (
              <>
                <p className="rotulo mt-6">
                  ¿Qué {comoSeLlama(impuesto)} lleva?
                </p>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {TIPOS[impuesto].map((t) => {
                    const esta = tipoImpuesto === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipoImpuesto(t)}
                        aria-pressed={esta}
                        className="t-cuerpo flex h-[48px] min-w-[74px] items-center justify-center rounded-[16px] border px-3 font-extrabold"
                        style={{
                          borderColor: esta ? 'var(--color-accion)' : 'var(--t-borde)',
                          background: esta ? 'var(--t-bien-velo)' : 'var(--t-superficie)',
                          color: 'var(--t-tinta)',
                        }}
                      >
                        {String(t).replace('.', ',')}%
                      </button>
                    )
                  })}
                </div>

                {desgloseAhora && (
                  <p className="mt-3 rounded-[16px] bg-superficie px-4 py-3 text-[16px] font-bold leading-snug text-tinta-suave">
                    Base {desgloseAhora.base.toFixed(2).replace('.', ',')} €
                    {' · '}
                    {comoSeLlama(impuesto)}{' '}
                    <span className="text-tinta">
                      {desgloseAhora.cuota.toFixed(2).replace('.', ',')} €
                    </span>
                  </p>
                )}
              </>
            )}

            <label htmlFor="concepto" className="rotulo mt-7 block">
              ¿De qué?
            </label>
            <input
              id="concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Productos, abono, jornal…"
              className="entrada mt-2"
            />

            <p className="rotulo mt-7">Categoría</p>
            <div className="mt-3 space-y-3">
              {opciones.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoriaId(c.id)}
                  className="t-cuerpo flex min-h-[60px] w-full items-center rounded-[16px] border px-4 py-3 text-left font-extrabold"
                  style={{
                    borderColor: categoriaId === c.id ? 'var(--color-accion)' : 'var(--t-borde)',
                    background:
                      categoriaId === c.id ? 'var(--t-bien-velo)' : 'var(--t-superficie)',
                    color: 'var(--t-tinta)',
                  }}
                >
                  {categoriaId === c.id ? '✓ ' : ''}
                  {c.nombre}
                </button>
              ))}
            </div>

            {conApartamentos && (
              <CamposEstancia
                valor={estancia}
                cambiar={setEstancia}
                conEstancia={tipo === 'ingreso'}
              />
            )}

            <label htmlFor="fecha" className="rotulo mt-7 block">
              ¿Cuándo?
            </label>
            <input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="entrada mt-2"
            />

            {/*
              Era `bg-verde` con 24 px de letra y 24 de relleno arriba y
              abajo — el botón más grande de la aplicación. Y se apagaba
              al 40 % sin decir qué faltaba: con tres campos obligatorios,
              adivinar cuál es el que falla es trabajo del usuario.
            */}
            <div className="mt-8">
              <BotonPrincipal
                onClick={guardar}
                desactivado={guardando || !importe || !concepto || !categoriaId}
                porQue={
                  !importe
                    ? 'Falta cuánto es.'
                    : !concepto
                      ? 'Falta de qué es.'
                      : !categoriaId
                        ? 'Elige una categoría.'
                        : undefined
                }
              >
                {guardando ? 'Apuntando…' : 'Apuntar'}
              </BotonPrincipal>
            </div>
          </>
        )}

        {aviso && (
          <div className="mt-5">
            <Aviso titulo="No se ha podido apuntar" explicacion={aviso} />
          </div>
        )}
      </div>
    </main>
  )
}
