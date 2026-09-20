import type { ReactNode } from 'react'
import Link from './enlace'
import { BotonPrincipal, PastillaAmbito } from './piezas'
import { Ico } from './iconos'
import type { Ambito } from '@/lib/ambitos'
import type { Icono } from './iconos'

/*
  ═══════════════════════════════════════════════════════════════
  EL ENCABEZADO DE ESCRITORIO
  ═══════════════════════════════════════════════════════════════

  La misma banda en TODAS las pantallas, y siempre con las piezas en
  el mismo sitio:

      ┌──────────────────────────────────────────────────────────┐
      │ ⬤ Título                    [ caja de MAPPEL ] [ ACCIÓN ]  │
      │                                                          │
      │ [ Mes · Trimestre · Año ]                                │
      └──────────────────────────────────────────────────────────┘

  ─────────────────────────────────────────────────────────────
  POR QUÉ HACÍA FALTA

  Al ensanchar las pantallas, cada una quedó con su propia manera de
  empezar: en Papeles el buscador ocupaba mil cien píxeles, en Cuentas
  «Mes · Trimestre · Año» eran tres botones de trescientos cada uno, y
  el botón de la acción principal estaba abajo del todo, después de
  toda la lista, con el ancho de la pantalla entera.

  O sea: parecía un móvil estirado. Y lo parecía porque lo era — el
  ancho había cambiado, pero la COLOCACIÓN seguía siendo la del móvil,
  donde todo va en una columna y lo importante va al final porque es
  donde llega el pulgar.

  ─────────────────────────────────────────────────────────────
  LA REGLA: LAS ACCIONES, ARRIBA A LA DERECHA

  En un ordenador no hay pulgar. La vista empieza arriba a la
  izquierda y termina arriba a la derecha, y ahí es donde se buscan
  las cosas que se HACEN. A la izquierda, dónde estás; a la derecha,
  qué puedes hacer.

  Es exactamente lo que ya hace el Inicio —el saludo a la izquierda,
  la caja de MAPPEL y «Guardar documento» a la derecha—, así que esto no
  inventa una regla: extiende a las demás la que ya estaba aprobada.

  Y de paso resuelve un problema de verdad: «Apuntar un movimiento»
  estaba después de la lista de movimientos. En un móvil eso está bien
  —se llega al terminar de mirar—, pero en una pantalla donde la lista
  entera se ve de golpe, el botón queda flotando en mitad del papel
  blanco, a media pantalla de lo que se estaba leyendo.

  ─────────────────────────────────────────────────────────────
  MEDIDAS FIJAS, Y A PROPÓSITO

  La caja mide 420 px y el botón lo que mida su palabra. Nada se
  estira con la pantalla.

  Un campo de texto de mil cien píxeles no se lee mejor: se lee peor,
  porque el ojo pierde el principio de la línea. Y un botón que crece
  hasta el borde deja de parecer un botón y parece una franja de
  color. El sitio que sobra se deja sobrar — eso es tener espacio.

  ─────────────────────────────────────────────────────────────
  ESTO NO EXISTE EN EL MÓVIL

  Se pinta a partir de 1024 px y por debajo no se pinta siquiera. Cada
  pantalla conserva su cabecera de siempre dentro de un `lg:hidden`, y
  así el móvil —que es el producto— no se toca ni un píxel.
*/

export type AccionDeEncabezado = {
  texto: string
  href: string
  icono?: Icono
  /** Abre en otra pestaña. El papel de un documento, por ejemplo. */
  externo?: boolean
}

export default function Encabezado({
  icono,
  ambito = 'pizarra',
  marca,
  titulo,
  pie,
  volver,
  controles,
  caja,
  accion,
  extra,
}: {
  icono?: Icono
  ambito?: Ambito
  /*
    En vez de la pastilla de ámbito, una marca cualquiera: la foto de
    una persona, casi siempre.

    «La casa» y «El asesor» no van de un ámbito sino de ALGUIEN, y ahí
    la pastilla de color diría menos que la cara. Si vienen las dos,
    manda ésta.
  */
  marca?: ReactNode
  titulo: string
  /** Una línea debajo del título. El nombre de la casa, el periodo… */
  pie?: string
  /*
    A dónde se vuelve, en las pantallas de segundo nivel.

    En las cinco pestañas no hace falta —el rail de la izquierda ES la
    navegación—, pero una carpeta, los pagos o los menús cuelgan de otra
    pantalla y sin esto la única salida sería el botón del navegador.

    Va DENTRO de la banda y no encima, para que el título siga
    empezando donde empieza en todas las demás.
  */
  volver?: string
  /** Los segmentos de la pantalla: Mes/Trimestre/Año, Semana/Mes. */
  controles?: ReactNode
  /** La caja de MAPPEL de esta pantalla, si la tiene. */
  caja?: ReactNode
  /** Lo que se viene a hacer aquí. Uno solo. */
  accion?: AccionDeEncabezado
  /** Algo suelto a la derecha del todo: el lápiz de editar, por ejemplo. */
  extra?: ReactNode
  /*
    ── AQUÍ HABÍA UN `pegajosa`, Y SE HA IDO ──

    Lo puse en el primer paso del escritorio para que la banda se
    quedara arriba al desplazar en las pantallas de lista larga. Al
    ir a enchufarlo en Papeles, Cuentas y el escritorio, resultó que
    ya lo hacía: `.cabecera` —el contenedor que envuelve esto en
    TODAS las pantallas— es `position: sticky; top: 0` desde hace
    meses.

    O sea que era un interruptor para encender una luz que ya estaba
    encendida. Ninguna pantalla llegó a pasarlo, así que quitarlo no
    cambia un píxel — pero dejarlo puesto sí habría costado algo: el
    día que alguien quiera la banda pegajosa, lo pasaría, no vería
    ningún cambio, y se pondría a buscar el fallo en el sitio
    equivocado.
  */
}) {
  return (
    <div className="hidden lg:block">
      {/*
        ── POR QUÉ ESTA FILA SE PUEDE PARTIR ──

        `flex-wrap` con `gap-y-0` no cambia nada mientras todo quepa, y
        es lo que deja que los segmentos vivan en la MISMA fila que el
        título sin duplicarlos en el documento.

        Hasta 1439 llevan `w-full`, que los echa a una segunda línea —
        exactamente donde estaban—. A partir de 1440 pierden el ancho
        completo y se colocan entre la caja y la acción, que es donde
        hay sitio. Así se ahorra una franja entera de altura justo en
        las pantallas que más lista tienen.

        Un solo nodo y no dos con `hidden`: duplicar un control parte el
        foco del teclado y obliga a repetir su identificador.
      */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-0 pb-0.5 pt-1">
        <div className="flex min-w-0 flex-1 items-center gap-3 ancha:order-1">
          {volver && (
            <Link
              href={volver}
              aria-label="Volver"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-borde bg-superficie text-tinta"
            >
              <Ico nombre="atras" tam={22} grosor={2.4} />
            </Link>
          )}
          {marca ? (
            <span className="shrink-0">{marca}</span>
          ) : (
            icono && <PastillaAmbito icono={icono} ambito={ambito} tam={44} />
          )}
          <div className="min-w-0">
            <h1 className="t-titulo truncate">{titulo}</h1>
            {pie && <p className="t-apoyo mt-0.5 truncate">{pie}</p>}
          </div>
        </div>

        {/*
          La caja, con su medida. No se estira.

          ── Y `max-w-full`, QUE FALTABA ──

          Salió midiendo el armazón de espera contra esta cabecera: a
          390 px —un móvil normal— la página entera medía 440. Los
          420 px de la caja más `shrink-0` significan «cuatrocientos
          veinte pase lo que pase», y en un móvil de 390 eso son 50 px
          que se salen por la derecha. La página se podía mover de
          lado, y las cinco pestañas llevan caja.

          Un dedo que arrastra para bajar y mueve la pantalla de lado
          se lee como que la aplicación está rota. Y no se ve en un
          ordenador: ahí sobra sitio y la caja mide sus 420 limpios.

          `max-w-full` no le quita nada a nadie: donde cabe, sigue
          midiendo 420; donde no cabe, mide lo que hay. */}
        {caja && <div className="w-[420px] max-w-full shrink-0 ancha:order-2">{caja}</div>}

        {/* Los segmentos. Hasta 1439, `w-full` los echa a la segunda
            línea con su medida de siempre; de 1440 en adelante entran
            en la fila, entre la caja y la acción.

            Y en las dos posturas con su tamaño: estirados a lo ancho de
            la pantalla dejan de leerse como «elige una de tres» y
            parecen tres botones distintos. */}
        {/*
          ── Y `shrink-0`, QUE FALTABA ──

          Sin él, este bloque era un elemento flexible más de la fila y
          se encogía cuando la caja y el botón pedían sitio. Dentro, los
          segmentos llevan `flex-1`, así que al encogerse el envoltorio
          se colapsaban y salía **«Se…»** donde pone «Semana».

          Un control que no se puede leer no es un control. Aquí manda
          la palabra: este bloque mide lo que midan sus palabras y no se
          encoge nunca. Si algún día no cabe, lo que se parte es la
          fila —para eso está `flex-wrap`—, no la palabra.
        */}
        {controles && (
          <div className="order-last mt-3 w-full ancha:order-3 ancha:mt-0 ancha:w-auto ancha:shrink-0">
            {controles}
          </div>
        )}

        {accion && (
          <div className="shrink-0 ancha:order-4">
            <BotonPrincipal
              href={accion.href}
              icono={accion.icono}
              externo={accion.externo}
              ancho="auto"
            >
              {accion.texto}
            </BotonPrincipal>
          </div>
        )}

        {extra && <div className="shrink-0 ancha:order-5">{extra}</div>}
      </div>
    </div>
  )
}
