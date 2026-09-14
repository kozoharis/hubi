'use client'

import { Ico } from '../../iconos'
import { comoSeLlamaElDia } from '@/lib/menus'
import {
  useComprobacion,
  type ListaDeCompra,
  type MenuQueSeComprueba,
} from '@/lib/comprobar-menu'

/*
  ═══════════════════════════════════════════════════════════════
  «¿TIENES TODO ESTO?» EN LA COCINA
  ═══════════════════════════════════════════════════════════════

  Haris: *«con respecto a la 7, sí, desde luego tiene que estar en la
  cocina como en el móvil»*.

  Y es el sitio donde más sentido tiene de los dos. La pregunta «¿tienes
  harina?» se contesta abriendo el armario que está a un metro. En el
  teléfono, en el sofá, se contesta de memoria — y la memoria es
  justamente lo que falla con la harina.

  ─────────────────────────────────────────────────────────────
  LA MISMA CONVERSACIÓN, OTRA TALLA

  Las reglas no se repiten aquí: viven en `lib/comprobar-menu.ts` y las
  usan las dos pantallas. Lo único que cambia es el tamaño, y cambia por
  la regla de `escala.ts` — **una pared es la misma casa ×1,45**:

      móvil   17 / 19 / 60 px de alto
      pared   25 / 28 / 72

  Los 72 no salen del ×1,45 sino del suelo de tocar de la pared, que es
  60. Un botón de SÍ o NO que se pulsa de pie, de lado y con una mano
  ocupada no puede ir justo en el suelo.

  ─────────────────────────────────────────────────────────────
  Y NO USA `BotonPrincipal`

  A propósito, y es la única libertad que se toma. Las piezas del
  sistema miden 60 px y 19 px de letra porque son las del teléfono; aquí
  harían dos botones de aspecto correcto y tamaño de móvil en una
  pantalla de 27 pulgadas. Se pintan a mano con los colores del sistema
  —`t-boton`, `t-superficie`, `t-borde`— y ni uno inventado.
*/

export default function ComprobarEnLaPared({
  menu,
  ingredientes,
  listas,
  alGuardar,
  cerrar,
}: {
  menu: MenuQueSeComprueba
  ingredientes: string[]
  listas: ListaDeCompra[]
  alGuardar: (faltan: string[]) => void
  cerrar: () => void
}) {
  const {
    paso,
    setPaso,
    marcados,
    alternar,
    lista,
    setLista,
    laLista,
    trabajando,
    aviso,
    apuntados,
    diaPuesto,
    tope,
    avisaATiempo,
    mandar,
    ponerleDia,
  } = useComprobacion({ menu, listas, alGuardar, cerrar })

  return (
    /*
      Un telón a pantalla completa y no un panel dentro de la fila.

      En el teléfono el panel se abre debajo del día y se lee; aquí la
      semana entera mide media pared, y un panel metido en una fila
      dejaría los otros seis días compitiendo por la atención mientras
      alguien cuenta huevos.
    */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-12 py-12"
      style={{ background: 'rgba(26,23,20,.55)' }}
      onClick={cerrar}
    >
      <div
        className="max-h-full w-full max-w-[860px] overflow-y-auto rounded-[36px] border border-borde bg-fondo px-12 py-10"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">
          {menu.momento === 'cena' ? 'Cena' : 'Comida'} del {comoSeLlamaElDia(menu.fecha)}
        </p>
        <p className="mt-1 text-[39px] font-extrabold leading-tight text-tinta">{menu.que}</p>

        {/* ── 1 · LA PREGUNTA ── */}
        {paso === 'pregunta' && (
          <>
            <p className="mt-7 text-[28px] font-extrabold text-tinta">¿Tienes todo esto?</p>

            <ul className="mt-4 grid grid-cols-2 gap-x-10 gap-y-2">
              {ingredientes.map((i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-[13px] h-[8px] w-[8px] shrink-0 rounded-full bg-tenue"
                  />
                  <span className="text-[25px] font-semibold leading-snug text-tinta-suave">{i}</span>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex gap-4">
              <Boton principal ancho onClick={() => mandar([])} desactivado={trabajando}>
                <Ico nombre="check" tam={28} grosor={2.6} />
                {trabajando ? 'Un momento…' : 'Sí, está todo'}
              </Boton>
              <Boton ancho onClick={() => setPaso('marcar')} desactivado={trabajando}>
                No, falta algo
              </Boton>
            </div>
            <div className="mt-3">
              <Boton onClick={cerrar}>Ahora no</Boton>
            </div>
          </>
        )}

        {/* ── 2 · QUÉ FALTA ── */}
        {paso === 'marcar' && (
          <>
            <p className="mt-7 text-[28px] font-extrabold text-tinta">
              Toca lo que hay que comprar.
            </p>

            <ul className="mt-4 grid grid-cols-2 gap-3">
              {ingredientes.map((i) => {
                const puesto = marcados.includes(i)
                return (
                  <li key={i}>
                    <button
                      onClick={() => alternar(i)}
                      aria-pressed={puesto}
                      className="tocable flex w-full items-center gap-4 rounded-[22px] border px-5 text-left"
                      style={{
                        minHeight: 72,
                        background: puesto ? 'var(--t-tinta)' : 'var(--t-superficie)',
                        color: puesto ? 'var(--t-fondo)' : 'var(--t-tinta)',
                        borderColor: puesto ? 'var(--t-tinta)' : 'var(--t-borde)',
                      }}
                    >
                      <span
                        aria-hidden
                        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] border-2"
                        style={{ borderColor: puesto ? 'var(--t-fondo)' : 'var(--t-borde)' }}
                      >
                        {puesto && <Ico nombre="check" tam={22} grosor={3} />}
                      </span>
                      <span className="text-[25px] font-extrabold leading-tight">{i}</span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {listas.length === 0 ? (
              <p className="mt-6 text-[25px] font-semibold leading-snug text-tinta-suave">
                No hay ninguna lista de la compra en esta casa. Se crea desde el móvil, en La
                compra.
              </p>
            ) : (
              <>
                <p className="mt-8 text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">
                  ¿A qué lista van?
                </p>
                {/*
                  Pastillas y no un desplegable. En el teléfono el
                  desplegable abre la rueda del sistema, que es cómoda;
                  en una tableta colgada de una pared abre una lista
                  diminuta pegada al borde y hay que apuntar. Una casa
                  tiene dos o tres listas: caben.
                */}
                <div className="mt-3 flex flex-wrap gap-3">
                  {listas.map((l) => {
                    const puesta = l.id === lista
                    return (
                      <button
                        key={l.id}
                        onClick={() => setLista(l.id)}
                        aria-pressed={puesta}
                        className="tocable rounded-full border px-7 text-[22px] font-extrabold"
                        style={{
                          minHeight: 64,
                          background: puesta ? 'var(--t-tinta)' : 'var(--t-superficie)',
                          color: puesta ? 'var(--t-fondo)' : 'var(--t-tinta-suave)',
                          borderColor: puesta ? 'var(--t-tinta)' : 'var(--t-borde)',
                        }}
                      >
                        {l.nombre}
                        {l.fecha && (
                          <span className="ml-2 opacity-70">· {comoSeLlamaElDia(l.fecha)}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <div className="mt-9 flex gap-4">
              <Boton
                principal
                ancho
                onClick={() => mandar(marcados)}
                desactivado={trabajando || marcados.length === 0 || listas.length === 0}
              >
                {trabajando
                  ? 'Apuntando…'
                  : `Apuntar ${marcados.length} ${marcados.length === 1 ? 'cosa' : 'cosas'}`}
              </Boton>
              <Boton ancho onClick={() => setPaso('pregunta')} desactivado={trabajando}>
                Atrás
              </Boton>
            </div>
            {marcados.length === 0 && (
              <p className="mt-3 text-[22px] font-semibold text-tenue">
                Toca lo que falta para poder apuntarlo.
              </p>
            )}
          </>
        )}

        {/* ── 3 · Y EL AVISO DE FECHA ── */}
        {paso === 'hecho' && (
          <>
            <p className="mt-7 text-[28px] font-extrabold leading-snug text-tinta">
              Apuntado. {apuntados} {apuntados === 1 ? 'cosa' : 'cosas'} en{' '}
              {laLista?.nombre ?? 'la compra'}.
            </p>

            {diaPuesto ? (
              <p
                className="mt-5 flex items-center gap-3 text-[25px] font-extrabold"
                style={{ color: 'var(--t-bien)' }}
              >
                <Ico nombre="check" tam={26} grosor={2.4} />
                La compra queda para el {comoSeLlamaElDia(tope)}. Ya está en la Agenda.
              </p>
            ) : avisaATiempo ? (
              <p className="mt-5 text-[25px] font-semibold leading-snug text-tinta-suave">
                Esa compra ya está puesta para el {comoSeLlamaElDia(laLista!.fecha!)}, o sea que
                llega a tiempo.
              </p>
            ) : (
              <>
                {/*
                  No se le cambia el día a la lista sin preguntar: es de
                  los dos y su día ya está en la Agenda de alguien. Se
                  dice lo que pasa y se ofrece arreglarlo de un toque.
                */}
                <p className="mt-5 text-[25px] font-semibold leading-snug text-tinta-suave">
                  {laLista?.fecha ? 'Esa compra es después del menú.' : 'Esa compra no tiene día.'}{' '}
                  Para poder hacerlo el {comoSeLlamaElDia(menu.fecha)}, tendría que estar comprado
                  el {comoSeLlamaElDia(tope)}.
                </p>
                <div className="mt-6">
                  <Boton principal onClick={ponerleDia} desactivado={trabajando}>
                    {trabajando ? 'Un momento…' : `Ponerla para el ${comoSeLlamaElDia(tope)}`}
                  </Boton>
                </div>
              </>
            )}

            <div className="mt-4">
              <Boton onClick={cerrar}>Listo</Boton>
            </div>
          </>
        )}

        {aviso && (
          <p className="mt-5 text-[22px] font-extrabold" style={{ color: 'var(--t-alerta)' }}>
            {aviso}
          </p>
        )}
      </div>
    </div>
  )
}

/* El botón de la pared: 72 px, letra de 25. Los colores son los del
   sistema; lo único propio es el tamaño, que es lo único que una pared
   puede tener distinto. */
function Boton({
  children,
  onClick,
  principal = false,
  ancho = false,
  desactivado = false,
}: {
  children: React.ReactNode
  onClick: () => void
  principal?: boolean
  ancho?: boolean
  desactivado?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={desactivado}
      className={`tocable flex items-center justify-center gap-3 rounded-[22px] px-9 text-[25px] font-extrabold ${
        ancho ? 'flex-1' : ''
      }`}
      style={{
        minHeight: 72,
        background: principal ? 'var(--t-boton)' : 'var(--t-superficie)',
        color: desactivado
          ? 'var(--t-apagado)'
          : principal
            ? 'var(--t-boton-texto)'
            : 'var(--t-tinta)',
        border: principal ? 'none' : '1px solid var(--t-borde)',
        opacity: desactivado ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}
