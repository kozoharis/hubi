'use client'

import { Ico } from '../iconos'
import { Aviso, BotonPrincipal, BotonSecundario, BotonTerciario } from '../piezas'
import { comoSeLlamaElDia } from '@/lib/menus'
import {
  useComprobacion,
  type ListaDeCompra,
  type MenuQueSeComprueba,
} from '@/lib/comprobar-menu'

export type { ListaDeCompra }

/*
  ═══════════════════════════════════════════════════════════════
  «¿TIENES TODO ESTO?»
  ═══════════════════════════════════════════════════════════════

  Haris: *«al ponerle los ingredientes estos automáticamente se vinculan
  a la comida o cena y se pregunta… ¿tienes esos ingredientes para
  hacerlo? Si dices que sí, perfecto; si no, los seleccionas y se van a
  la lista de la compra… y con un aviso de fecha, ya que el menú tiene
  fecha límite para hacerse»*.

  ─────────────────────────────────────────────────────────────
  POR QUÉ UNA PREGUNTA ANTES Y NO UNA LISTA DIRECTA

  Se eligió entre tres formas y ésta es la que gana el día normal.

  Con una lista de casillas —todas marcadas, destildas lo que falta—
  el día que tienes todo hay que leer nueve renglones y tocar nada, y
  aun así hay que decidir que no hay nada que decidir. Con la pregunta,
  ese día son **dos toques**: abrir y SÍ.

  El día que falta algo cuesta un paso más. Pero ese día ya ibas a
  tener trabajo de todos modos.

  ─────────────────────────────────────────────────────────────
  Y LO QUE FALTA SE MARCA, NO SE DESMARCA

  Las casillas nacen VACÍAS y se señala lo que hay que comprar. Es lo
  que se acaba de decir en voz alta —«no tengo harina ni huevos»— y
  además falla del lado bueno: si alguien se raja a la mitad y cierra,
  se habrá apuntado de menos, no de más. Una lista de la compra con
  cosas que ya están en la despensa se deja de mirar en dos semanas.
*/

export default function Comprobar({
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
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="mt-2.5 rounded-[20px] border border-borde bg-fondo px-4 py-4">
      <p className="rotulo">
        {menu.momento === 'cena' ? 'Cena' : 'Comida'} del {comoSeLlamaElDia(menu.fecha)}
      </p>
      <p className="t-tarjeta mt-0.5">{menu.que}</p>

      {/* ── 1 · LA PREGUNTA ── */}
      {paso === 'pregunta' && (
        <>
          <p className="t-cuerpo mt-3 leading-snug">¿Tienes todo esto?</p>

          <ul className="mt-2 space-y-1">
            {ingredientes.map((i) => (
              <li key={i} className="t-apoyo flex items-start gap-2 leading-snug">
                <span aria-hidden className="mt-[9px] h-[6px] w-[6px] shrink-0 rounded-full bg-tenue" />
                <span>{i}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-2.5">
            <BotonPrincipal onClick={() => mandar([])} desactivado={trabajando} icono="check">
              {trabajando ? 'Un momento…' : 'Sí, está todo'}
            </BotonPrincipal>
            <BotonSecundario onClick={() => setPaso('marcar')} desactivado={trabajando}>
              No, falta algo
            </BotonSecundario>
            <BotonTerciario onClick={cerrar}>Ahora no</BotonTerciario>
          </div>
        </>
      )}

      {/* ── 2 · QUÉ FALTA ── */}
      {paso === 'marcar' && (
        <>
          <p className="t-cuerpo mt-3 leading-snug">Toca lo que hay que comprar.</p>

          <ul className="mt-2 space-y-1.5">
            {ingredientes.map((i) => {
              const puesto = marcados.includes(i)
              return (
                <li key={i}>
                  <button
                    onClick={() => alternar(i)}
                    aria-pressed={puesto}
                    className="tocable flex w-full items-center gap-3 rounded-[16px] border px-3 text-left"
                    style={{
                      minHeight: 56,
                      background: puesto ? 'var(--t-tinta)' : 'var(--t-superficie)',
                      color: puesto ? 'var(--t-fondo)' : 'var(--t-tinta)',
                      borderColor: puesto ? 'var(--t-tinta)' : 'var(--t-borde)',
                    }}
                  >
                    <span
                      aria-hidden
                      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] border-2"
                      style={{ borderColor: puesto ? 'var(--t-fondo)' : 'var(--t-borde)' }}
                    >
                      {puesto && <Ico nombre="check" tam={18} grosor={3} />}
                    </span>
                    <span className="t-cuerpo min-w-0 font-extrabold">{i}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* ── A qué lista ── */}
          {listas.length === 0 ? (
            <div className="mt-3">
              <Aviso
                tono="atencion"
                titulo="No hay ninguna lista de la compra"
                explicacion="Crea una en la Compra y vuelve. Lo que falte se apuntará allí."
              />
            </div>
          ) : (
            <label className="mt-4 block">
              <span className="rotulo">¿A qué lista van?</span>
              <select
                value={lista}
                onChange={(e) => setLista(e.target.value)}
                className="entrada mt-2"
              >
                {listas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                    {l.fecha ? ` · ${comoSeLlamaElDia(l.fecha)}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-4 space-y-2.5">
            <BotonPrincipal
              onClick={() => mandar(marcados)}
              desactivado={trabajando || marcados.length === 0 || listas.length === 0}
              porQue={
                marcados.length === 0
                  ? 'Toca lo que falta para poder apuntarlo.'
                  : listas.length === 0
                    ? 'Hace falta una lista de la compra.'
                    : undefined
              }
            >
              {trabajando
                ? 'Apuntando…'
                : `Apuntar ${marcados.length} ${marcados.length === 1 ? 'cosa' : 'cosas'}`}
            </BotonPrincipal>
            <BotonSecundario onClick={() => setPaso('pregunta')} desactivado={trabajando}>
              Atrás
            </BotonSecundario>
          </div>
        </>
      )}

      {/* ── 3 · Y EL AVISO DE FECHA ── */}
      {paso === 'hecho' && (
        <>
          <p className="t-cuerpo mt-3 leading-snug">
            Apuntado. {apuntados} {apuntados === 1 ? 'cosa' : 'cosas'} en{' '}
            <strong className="text-tinta">{laLista?.nombre ?? 'la compra'}</strong>.
          </p>

          {/*
            Y AQUÍ ESTÁ LA FECHA LÍMITE.

            No se le cambia el día a la lista sin preguntar: una lista
            de la compra es de los dos, y su día ya está en la Agenda de
            alguien. Se dice lo que pasa y se ofrece arreglarlo de un
            toque.
          */}
          {diaPuesto ? (
            <div className="mt-3">
              <Aviso
                tono="bien"
                titulo={`La compra queda para el ${comoSeLlamaElDia(tope)}`}
                explicacion="Ya está en la Agenda, así que os avisará."
              />
            </div>
          ) : avisaATiempo ? (
            <p className="t-apoyo mt-2 leading-snug">
              Esa compra ya está puesta para el {comoSeLlamaElDia(laLista!.fecha!)}, o sea que
              llega a tiempo.
            </p>
          ) : (
            <>
              <div className="mt-3">
                <Aviso
                  tono="atencion"
                  titulo={
                    laLista?.fecha
                      ? 'Esa compra es después del menú'
                      : 'Esa compra no tiene día'
                  }
                  explicacion={`Para poder hacerlo el ${comoSeLlamaElDia(menu.fecha)}, tendría que estar comprado el ${comoSeLlamaElDia(tope)}.`}
                />
              </div>
              <div className="mt-2.5">
                <BotonPrincipal onClick={ponerleDia} desactivado={trabajando}>
                  {trabajando ? 'Un momento…' : `Ponerla para el ${comoSeLlamaElDia(tope)}`}
                </BotonPrincipal>
              </div>
            </>
          )}

          <div className="mt-2.5">
            <BotonSecundario onClick={cerrar}>Listo</BotonSecundario>
          </div>
        </>
      )}

      {aviso && (
        <div className="mt-3">
          <Aviso titulo="No se ha podido" explicacion={aviso} />
        </div>
      )}
    </div>
  )
}
