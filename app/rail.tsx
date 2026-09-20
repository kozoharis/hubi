'use client'

import { usePathname } from 'next/navigation'
import Link from './enlace'
import { Ico, Logo, Palabra } from './iconos'
import { useCasa } from './actividades-contexto'
import { cualEsta, hayNavegacion, pestanasDe, puedeHablar } from './pestanas'
import { DEGRADADO } from '@/lib/voz-mappel'

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

/*
  ── DE QUÉ PESTAÑA ES CADA DIRECCIÓN, Y DÓNDE NO HAY NAVEGACIÓN ──

  Las dos reglas vivían aquí, y ahora están en `pestanas.ts` porque
  desde hoy la barra de abajo también las necesita: vive en el armazón,
  igual que el rail, y tampoco tiene a nadie que le diga dónde está.

  Lo que decía el comentario que había aquí —que el rail vive en
  `layout.tsx` y la barra la pinta cada pantalla— ya no es verdad. Era
  la causa de que en el móvil parpadeara la pantalla entera al cambiar
  de pestaña, y se arregló subiendo la barra aquí arriba.
*/

export default function Rail() {
  const { rol, esPantalla } = useCasa()
  const ruta = usePathname() ?? '/'
  const activa = cualEsta(ruta)
  const pestanas = pestanasDe(rol)

  if (!hayNavegacion(ruta)) return null

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
      {/*
        ── LA MARCA, LA DE VERDAD ──

        Aquí vivió hasta septiembre de 2026 la H de HUBI, dibujada a
        mano en SVG, con el nombre escrito al lado en Plus Jakarta Sans
        y un espaciado de 0,3em. O sea que el único sitio de toda la
        aplicación donde la marca no era la marca era el rail — y como
        sólo sale en pantallas grandes, el cambio de logotipo pasó por
        encima sin tocarlo.

        Ahora son las dos piezas de siempre, `Logo` y `Palabra`, que ya
        van por el alto y ya se recolorean solas con el modo.
      */}
      <div className="flex items-center gap-3 px-3 pb-5">
        <Logo tam={26} />
        <Palabra alto={16} />
      </div>

      {/*
        ── HABLAR, AQUÍ Y EN TODAS ──

        La caja de «Pregunta a mappel» hace dos trabajos distintos:
        BUSCAR dentro de una pantalla y MANDARLE algo a MAPPEL. El
        primero sólo tiene sentido donde hay mucho de lo mismo y no cabe
        todo a la vista —Papeles, la Agenda, las Cuentas—; el segundo lo
        tiene siempre, porque no busca dentro de nada: crea algo.

        Ponerla entera en las trece cabeceras resolvía el segundo
        pagando el precio del primero: en los Menús, una caja de 420 px
        que dice «busca algo» al lado de una semana que ya está entera a
        la vista es ruido, y encima promete algo que ahí no existe.

        Así que se separan. La caja se queda en las cinco pantallas
        donde buscar significa algo, y HABLAR baja al rail, que es donde
        vive lo que es del producto y no de la pantalla. Una línea, y
        está en todas.

        ── A QUIEN NO ──

        Al asesor y a quien sólo mira, no: la voz sirve para apuntar y
        para preguntar, y a quien no puede escribir nada le daría un
        botón grande que falla en cuanto lo use. Es la misma regla que
        ya aplica la barra del móvil, y por eso se llama a la misma
        función y no a otra escrita aquí.
      */}
      {puedeHablar(rol) && (
        <Link
          href="/hablar"
          className="tocable objetivo mb-4 flex items-center gap-3 rounded-[14px] border border-borde bg-fondo px-3 text-[16px] font-extrabold text-tinta roza"
        >
          <span
            aria-hidden
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: DEGRADADO }}
          >
            <Ico nombre="onda" tam={15} grosor={2.6} />
          </span>
          <span>Hablar</span>
        </Link>
      )}

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
                   ya usa el resto de MAPPEL, y está calculado sobre la
                   tinta del tema para que funcione en claro y oscuro. */
                (aqui
                  ? 'velo-chip text-tinta'
                  : 'text-tinta-suave roza')
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
          className="tocable flex items-center gap-3 rounded-[14px] border border-borde bg-fondo px-3 py-2.5 text-[16px] font-extrabold text-tinta roza"
        >
          <Ico nombre="mandos" tam={21} />
          <span>Ajustes</span>
        </Link>
      </div>
    </nav>
  )
}

/* Aquí estaba `Marca()`: la H de HUBI dibujada en SVG, con su propia
   copia del degradado escrita a mano. Se ha ido entera. El símbolo es
   un archivo entregado y `Logo` es quien lo pone. */
