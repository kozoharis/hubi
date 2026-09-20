import Cabecera from '../cabecera'
import { Logo, Palabra, BotonAjustes } from '../iconos'
import { Hueco } from '../espera'

/*
  ═══════════════════════════════════════════════════════════════
  INICIO MIENTRAS LLEGA
  ═══════════════════════════════════════════════════════════════

  Esta es la razón de la carpeta `(inicio)`.

  Inicio es la pantalla de `app/page.tsx`, o sea que su armazón de
  espera era `app/loading.tsx` — el genérico, el que sirve para
  cualquier sitio y por eso no puede pintar nada. Y siendo la primera
  pestaña, la que más se pulsa y la que más consultas hace, era
  justamente la que peor se veía: Haris lo dijo después de arreglar
  las otras cuatro, *«está más ágil pero sigue haciéndolo»*.

  No hay forma de darle a `/` un armazón propio sin meterlo en una
  carpeta. Los paréntesis son de Next: **`(inicio)` no sale en la
  dirección** —la pantalla sigue siendo `/`, no `/inicio`— pero sí
  existe como carpeta, y por eso puede tener su `loading.tsx` sin que
  las demás pantallas hereden esta cara. Lo único que cambió al mover
  `page.tsx` aquí dentro son los `./` de sus importaciones, que ahora
  son `../`.

  ─────────────────────────────────────────────────────────────
  Y AQUÍ NO HAY NADA GRIS ARRIBA

  Las otras cuatro pestañas pintan su cabecera de verdad y sólo el
  contenido va en bloques. En Inicio se puede ir más lejos: su
  cabecera no depende de NINGÚN dato. Es el logotipo, la palabra
  MAPPEL y el botón de Ajustes — los tres exactamente iguales estés
  como estés. Así que se pintan de verdad, y cuando llega la pantalla
  ya estaban puestos.

  También va el telón de color, que es lo primero que se ve de Inicio
  y lo que la distingue de todas las demás. Sin él, la espera de
  Inicio sería un papel blanco y la llegada un fogonazo de color.

  Lo único que espera es lo de abajo: el saludo, lo de hoy y las
  tarjetas, que sí salen de la base de datos.
*/
export default function Cargando() {
  return (
    <main className="relative min-h-dvh pb-40 lg:pb-16" aria-hidden>
      {/* El mismo telón que la pantalla de verdad. Si esto cambia en
          `(inicio)/page.tsx`, cambia aquí. */}
      <div aria-hidden className="telon">
        <span className="mancha deriva-1" style={{ width: 300, height: 300, left: -110, top: -130, background: 'rgba(20,184,166,.30)' }} />
        <span className="mancha deriva-3" style={{ width: 280, height: 280, right: -110, top: -140, background: 'rgba(59,130,246,.26)' }} />
        <span className="mancha deriva-2" style={{ width: 260, height: 260, left: 110, top: -40, background: 'rgba(139,92,246,.18)' }} />
        <span className="mancha deriva-4" style={{ width: 300, height: 300, right: -130, bottom: -140, background: 'rgba(255,107,107,.12)' }} />
      </div>

      <Cabecera>
        <div className="flex h-14 items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Logo tam={36} />
            <Palabra alto={22} />
          </span>
          <span className="-mr-1 shrink-0 py-[9px] pl-2">
            <BotonAjustes />
          </span>
        </div>
      </Cabecera>

      <div className="espera mx-auto w-full max-w-md px-5 pt-2">
        {/* El saludo y el día */}
        <Hueco ancho={150} alto={15} />
        <div className="mt-2.5">
          <Hueco ancho={230} alto={30} />
        </div>

        {/* Las dos acciones grandes */}
        <div className="mt-6 space-y-3">
          <Hueco alto={76} redondez={22} />
          <Hueco alto={76} redondez={22} />
        </div>

        {/* Lo de hoy */}
        <div className="mt-8 space-y-2.5">
          <Hueco ancho={110} alto={15} />
          <Hueco alto={74} redondez={20} />
          <Hueco alto={74} redondez={20} />
        </div>
      </div>
    </main>
  )
}
