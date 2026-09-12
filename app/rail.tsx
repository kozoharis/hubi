'use client'

import { usePathname } from 'next/navigation'
import Link from './enlace'
import { Ico } from './iconos'
import { useCasa } from './actividades-contexto'
import { pestanasDe } from './pestanas'

/*
  ═══════════════════════════════════════════════════════════════
  EL RAIL · la misma navegación, de pie
  ═══════════════════════════════════════════════════════════════

  En el móvil las cinco pestañas van abajo, donde llega el pulgar. En
  una tableta o un ordenador van a la izquierda, de pie, con el nombre
  entero al lado del icono.

  No es otra navegación: son LAS MISMAS cinco, de `pestanas.ts`. Lo
  único que cambia es la postura.

  ─────────────────────────────────────────────────────────────
  POR QUÉ DE PIE Y NO ABAJO TAMBIÉN EN GRANDE

  Porque en un ordenador la barra de abajo está a treinta centímetros
  de donde está mirando la persona, y hay que recorrer la pantalla
  entera para cambiar de sitio. A la izquierda está donde empieza la
  lectura.

  Y porque en grande sobra sitio a lo ancho: poner el nombre al lado
  del icono —no debajo, ni recortado a «Día a día»— quita la única
  ambigüedad que le queda a la navegación.

  ─────────────────────────────────────────────────────────────
  QUIÉN LO VE

  Nadie en el móvil: sale a partir de `lg` (1024 px) y por debajo no
  se pinta siquiera. La barra de abajo hace lo contrario. Así cada
  superficie tiene la suya y ninguna estorba a la otra.
*/

/* De qué pestaña es cada dirección. Se mira el camino de dentro —el
   que queda después del espacio— porque `/e/<casa>/documentos` es
   Papeles igual que `/documentos`. */
function cualEsta(ruta: string): string {
  const dentro = ruta.replace(/^\/e\/[0-9a-fA-F-]{36}/, '') || '/'
  if (dentro === '/') return 'inicio'
  if (dentro.startsWith('/documentos')) return 'documentos'
  if (dentro.startsWith('/agenda') || dentro.startsWith('/tablon')) return 'agenda'
  if (dentro.startsWith('/cuentas') || dentro.startsWith('/finca') ||
      dentro.startsWith('/seccion') || dentro.startsWith('/gastos')) return 'cuentas'
  if (dentro.startsWith('/dia') || dentro.startsWith('/compra') ||
      dentro.startsWith('/menus') || dentro.startsWith('/lacasa')) return 'dia'
  return ''
}

/*
  DONDE TODAVÍA NO HAY NADIE DENTRO, NO HAY RAIL.

  El rail vive en `layout.tsx`, o sea en TODAS las pantallas, y la
  barra de abajo la pinta cada pantalla por su cuenta. Esa diferencia
  tenía una consecuencia que no se veía en el móvil: en un ordenador,
  quien abría HUBI sin haber entrado se encontraba las cinco pestañas
  de la casa a la izquierda —Papeles, Cuentas, Ajustes— antes de
  escribir su correo.

  No abría nada, porque cada una de esas pantallas manda a `/entrar` al
  no encontrar sesión. Pero enseñaba el interior de una casa a quien
  todavía está en la puerta, y dejaba el formulario de entrar
  encajonado en el hueco de la derecha.

  Son también las únicas pantallas que se ven a pantalla completa, y
  por eso son las únicas que siguen CENTRADAS: sin rail delante, no hay
  pasillo vacío que corregir.
*/
const SIN_RAIL = ['/entrar', '/empezar', '/privacidad', '/terminos']

export default function Rail() {
  const { rol, esPantalla } = useCasa()
  const ruta = usePathname() ?? '/'
  const activa = cualEsta(ruta)
  const pestanas = pestanasDe(rol)

  const dentro = ruta.replace(/^\/e\/[0-9a-fA-F-]{36}/, '') || '/'
  if (SIN_RAIL.some((r) => dentro === r || dentro.startsWith(r + '/'))) return null

  /* Una pantalla colgada en la pared no se navega, se mira. */
  if (esPantalla) return null

  return (
    <nav
      aria-label="Secciones"
      /*
        `relative z-10` NO ES DECORACIÓN: sin eso, el Inicio borra el
        rail. Y solo el Inicio.

        El Inicio pinta un telón —las manchas de color y el degradado
        que las apaga hacia abajo— que es `position: fixed; inset: 0`,
        o sea LA VENTANA ENTERA, rail incluido. Y al estar colocado
        con `position`, se pinta por encima de todo lo que no lo está.

        El contenido se salvaba de casualidad: vive dentro del mismo
        `<main>` que el telón y va después en el documento. El rail
        está fuera y no estaba colocado, así que se comía el degradado
        entero: Papeles algo apagado, Día a día casi invisible y
        Ajustes, que es el de más abajo, borrado del todo.

        Se ve como un desvanecido bonito, y por eso puede pasar meses
        sin que nadie lo llame fallo.
      */
      className="relative z-10 hidden w-[248px] shrink-0 flex-col border-r border-borde bg-superficie px-3 py-5 lg:flex"
    >
      <div className="flex items-center gap-2.5 px-3 pb-6">
        <Marca />
        <span className="text-[15px] font-extrabold tracking-[.3em] text-tinta">HUBI</span>
      </div>

      <div className="flex flex-col gap-1">
        {pestanas.map((p) => {
          const aqui = p.clave === activa
          return (
            <Link
              key={p.clave}
              href={p.href}
              aria-current={aqui ? 'page' : undefined}
              className={
                'tocable flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[17px] font-extrabold transition-colors ' +
                /* `velo-chip` y no un `bg-` inventado: es el gris que
                   ya usa el resto de HUBI, y está calculado sobre la
                   tinta del tema para que funcione en claro y oscuro. */
                (aqui
                  ? 'velo-chip text-tinta'
                  : 'text-tinta-suave hover:velo-chip')
              }
            >
              <Ico nombre={p.icono} tam={22} />
              {/* El nombre entero, no el recortado de la barra: aquí
                  sobra sitio a lo ancho y «Día a día» cabe. */}
              <span>{p.texto}</span>
            </Link>
          )
        })}
      </div>

      <div className="grow" />

      {/*
        ── AJUSTES, AL PIE ──

        Estaba arriba a la derecha, que es donde va en un móvil: junto
        al pulgar y lejos de lo que se toca por error. En un ordenador
        no hay pulgar, y arriba a la derecha es donde la gente busca su
        cuenta, no los ajustes de la aplicación.

        Al pie del rail es donde se buscan en todo lo demás que se use
        en un ordenador, y de paso queda separado de las cinco
        secciones por una línea: no es una sexta pestaña, es otra cosa.

        ── Y SE VE, QUE ES LO QUE FALLABA ──

        Estaba en gris suave y sin fondo, colgando debajo de una línea
        y a un palmo de la última pestaña. Parecía apagado: no un
        botón, sino el rastro de uno.

        Y en el Inicio era peor que en el resto, porque el Inicio es la
        única pantalla que en grande no tiene cabecera —el logo y la
        rueda de arriba se esconden para no salir dos veces—, así que
        éste era el ÚNICO Ajustes que quedaba en toda la pantalla.

        Ahora es una pieza con su fondo, su borde y la tinta entera. Lo
        de arriba son las secciones de la casa; esto es la casa por
        dentro. Que se distinga está bien; que se apague, no.
      */}
      <div className="mt-3 border-t border-borde pt-3">
        <Link
          href="/ajustes"
          aria-current={ruta.replace(/^\/e\/[0-9a-fA-F-]{36}/, '').startsWith('/ajustes')
            ? 'page'
            : undefined}
          className="tocable flex items-center gap-3 rounded-[14px] border border-borde bg-fondo px-3 py-2.5 text-[16px] font-extrabold text-tinta hover:velo-chip"
        >
          <Ico nombre="mandos" tam={21} />
          <span>Ajustes</span>
        </Link>
      </div>
    </nav>
  )
}

/* La H, dibujada. No es el PNG: a este tamaño y sobre los dos fondos,
   el trazo vectorial es lo único que no se emborrona. */
function Marca() {
  return (
    <svg width="24" height="26" viewBox="0 0 1024 1111" aria-hidden="true">
      <defs>
        <linearGradient id="rail-h" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2DD4BF" />
          <stop offset=".45" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <path d="M135 760A376 376 0 0 1 887 760" fill="none" stroke="url(#rail-h)" strokeWidth="250" />
      <rect x="10" y="10" width="250" height="1090" rx="125" fill="url(#rail-h)" />
      <rect x="762" y="10" width="250" height="1090" rx="125" fill="url(#rail-h)" />
    </svg>
  )
}
