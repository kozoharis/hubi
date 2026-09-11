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

export default function Rail() {
  const { rol } = useCasa()
  const ruta = usePathname() ?? '/'
  const activa = cualEsta(ruta)
  const pestanas = pestanasDe(rol)

  return (
    <nav
      aria-label="Secciones"
      className="hidden w-[248px] shrink-0 flex-col border-r border-borde bg-superficie px-3 py-5 lg:flex"
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
