import Link from '@/app/enlace'
import type { ReactNode } from 'react'
import { Ico, type Icono } from './iconos'
import { AMBITO, ambitoDeColor, type Ambito } from '@/lib/ambitos'
import EnCamino from './en-camino'

/*
  ═══════════════════════════════════════════════════════════════
  LAS PIEZAS DE HUBI · Design System v1
  ═══════════════════════════════════════════════════════════════

  POR QUÉ EXISTE ESTE FICHERO.

  Hasta hoy lo único compartido en toda la aplicación eran `Cabecera`
  —diecinueve líneas que solo envuelven—, `Ico`, `Pastilla` y `Volver`.
  La tarjeta, el renglón, el botón, el vacío y el aviso estaban
  escritos a mano en cada una de las cuarenta y cuatro pantallas.

  Y lo que salió de ahí es medible:

      17 tamaños de letra solo en la pantalla de Inicio
      11 radios de esquina para el mismo objeto «tarjeta»
      10 alturas distintas del botón principal
       5 palabras para decir «cancelar»
       5 maneras de decir «aquí no hay nada»
       2 colores para el mismo botón «Guardar»

  Nada de eso es una decisión: son los restos de escribir la misma
  pieza cuarenta y cuatro veces. Y por eso ninguna limpieza sobrevive a
  la pantalla siguiente mientras no haya un sitio donde la tarjeta esté
  definida UNA VEZ.

  Esto es ese sitio.

  ─────────────────────────────────────────────────────────────
  CÓMO SE USA

  No hay que migrar nada de golpe. Una pantalla puede empezar
  cambiando solo su botón principal y dejar el resto para otro día:
  las piezas nuevas y el código viejo conviven sin estorbarse.

  ─────────────────────────────────────────────────────────────
  LO QUE ESTAS PIEZAS DAN POR SENTADO

  · Un botón principal, un color, la misma altura. 60 px.
  · Tres radios: 20 tarjeta · 16 campo y botón · redondo píldora.
  · Dos pesos: 600 para leer, 800 para titular.
  · Una tarjeta es superficie y borde. No lleva sombra ni se rellena
    de color: el color entra por la pastilla del icono.
  · La sombra es solo del botón de HUBI. Es la única pieza que flota,
    y por eso significa algo.
  · Nada por debajo de 48 px de alto si hay que pulsarlo.
*/

// ═══════════════════════════════════════════════════════════════
// COLOR
// ═══════════════════════════════════════════════════════════════

/*
  La paleta de ámbito y su tipo viven en `lib/ambitos.ts` porque
  `iconos.tsx` también los necesita, y `piezas` importa de `iconos`.
  Se vuelven a exportar aquí para que ninguna pantalla tenga que
  cambiar de sitio de dónde los pide.
*/
export { AMBITO, ambitoDeColor, type Ambito }

/*
  ═══════════════════════════════════════════════════════════════
  UNA SOLA TABLA: EL ICONO Y EL COLOR DE CADA SECCIÓN
  ═══════════════════════════════════════════════════════════════

  Al migrar las tres primeras pantallas apareció que el icono salía de
  `SECCIONES` (en iconos.tsx) y el color de otra tabla aquí — dos
  sitios leyendo el mismo `segmento_drive` y dos listas que mantener
  en paralelo. Ahora es una.

  Y ya es la única: al vaciar el Inicio en Fase 2 dejó de quedar
  ninguna pantalla leyendo `SECCIONES`, así que esa tabla y la pieza
  `Pastilla` que la acompañaba se han borrado de iconos.tsx.

  ─────────────────────────────────────────────────────────────
  Y AQUÍ SE CUMPLE LA DECISIÓN D2: LA FINCA DEJA DE SER TEAL.

  El teal es ahora el color de acción. Si la Finca lo conserva,
  «pulsa esto» y «esto es de la Finca» se dicen con el mismo color.
  Pasa al verde apagado, que es lo que le corresponde como ámbito, y
  la regla vale para cualquier actividad que se cree después: ninguna
  se queda con el color de acción.

  ─────────────────────────────────────────────────────────────
  OCHO SECCIONES, OCHO COLORES.

  Con seis colores había dos choques: Casa compartía el azul con
  Seguros y Personal el rosa con Salud. Dos secciones del mismo color
  en la misma lista de Papeles no identifican nada — que es lo único
  que un color de ámbito tiene que hacer.

  Se añadieron dos tonos apagados en los huecos que quedaban de la
  rueda: la ciruela entre el violeta y el rosa, y el oliva entre el
  verde y la arena.
*/
/*
  La rueda de la que salen los colores de las actividades que cree
  cada familia. Se reparten en orden y se da la vuelta al llegar al
  final, así dos seguidas nunca salen del mismo color sin que nadie
  tenga que elegir nada.

  La pizarra queda fuera del reparto: es el color de «sin asignar» y
  dárselo a una actividad de verdad sería decir que no se sabe qué es.
*/
const RUEDA: Ambito[] = ['verde', 'azul', 'violeta', 'arena', 'rosa', 'oliva', 'ciruela']

export function ambitoPorOrden(i: number): Ambito {
  return RUEDA[((i % RUEDA.length) + RUEDA.length) % RUEDA.length]
}

const SECCION: Record<string, { icono: Icono; ambito: Ambito }> = {
  FINCA:      { icono: 'hoja',    ambito: 'verde' },
  HELECHOS:   { icono: 'llave',   ambito: 'oliva' },
  CASA:       { icono: 'casa',    ambito: 'arena' },
  SEGUROS:    { icono: 'escudo',  ambito: 'azul' },
  SALUD:      { icono: 'corazon', ambito: 'rosa' },
  VEHICULOS:  { icono: 'coche',   ambito: 'violeta' },
  PERSONAL:   { icono: 'gente',   ambito: 'ciruela' },
  DOCUMENTOS: { icono: 'papel',   ambito: 'pizarra' },
}

/** El icono y el color de una sección, por su carpeta en Drive. */
export function seccionPintada(segmento: string | null | undefined): {
  icono: Icono
  ambito: Ambito
} {
  const clave = (segmento ?? '').toUpperCase()
  if (!clave) return SECCION.DOCUMENTOS

  for (const nombre of Object.keys(SECCION)) {
    if (clave.startsWith(nombre)) return SECCION[nombre]
  }

  /*
    Una actividad que se ha creado esta familia y no está en la tabla:
    un taller, unos pisos, una obra. Antes caía en la pizarra, que es
    el gris de «no sé qué es esto» — y darle ese color a la actividad
    principal de alguien es decirle que no cuenta.

    Se le da uno de la rueda a partir de su nombre, siempre el mismo:
    así la Finca de una casa y la de otra pueden salir de distinto
    color, pero dentro de una casa cada actividad tiene el suyo y no
    cambia nunca.
  */
  let n = 0
  for (let i = 0; i < clave.length; i++) n = (n * 31 + clave.charCodeAt(i)) % 100000
  return { icono: 'papel', ambito: ambitoPorOrden(n) }
}

/** Solo el color, cuando el icono viene de otro sitio. */
export function ambitoDe(segmento: string | null | undefined): Ambito {
  return seccionPintada(segmento).ambito
}

/** Los tres colores de estado. Vivos, y solo cuando dicen algo. */
export type Estado = 'bien' | 'atencion' | 'alerta'

const TINTA_ESTADO: Record<Estado, string> = {
  bien: 'var(--t-bien)',
  atencion: 'var(--t-atencion)',
  alerta: 'var(--t-alerta)',
}

const VELO_ESTADO: Record<Estado, string> = {
  bien: 'var(--t-bien-velo)',
  atencion: 'var(--t-atencion-velo)',
  alerta: 'var(--t-alerta-velo)',
}

/**
 * El velo de ámbito: la excepción controlada.
 *
 * La regla general es que una tarjeta NO se rellena de color. Pero hay
 * sitios —sobre todo en Inicio— donde un tinte muy leve ayuda a
 * separar bloques sin convertir la pantalla en un semáforo.
 *
 * Por eso el tope es 5 %, y no es negociable hacia arriba: a partir de
 * ahí deja de ser un matiz y empieza a competir con el botón de
 * acción, que es lo único que debería llamar de verdad.
 */
function veloAmbito(color: string, fuerza: 3 | 4 | 5 = 4): string {
  return `color-mix(in srgb, ${color} ${fuerza}%, var(--t-superficie))`
}

// ═══════════════════════════════════════════════════════════════
// BOTONES
// ═══════════════════════════════════════════════════════════════

/*
  Cinco tipos, una altura, un radio.

  El principal es teal sólido con tinta oscura encima, y es el MISMO
  en claro y en oscuro. Que sea siempre igual es lo que hace que se
  encuentre sin buscarlo: antes era marino de día, verde de noche, y
  además media aplicación se lo saltaba escribiendo `bg-verde` a mano.

  El destructivo NO se rellena de rojo. Un botón rojo grande invita a
  pulsarlo tanto como cualquier otro botón grande; lo que hace falta es
  que se distinga y que cueste un poco más. Borde y texto de alerta.
*/

const BASE_BOTON =
  'flex items-center justify-center gap-2.5 rounded-[16px] ' +
  'text-[19px] font-extrabold tracking-[-0.01em] tocable ' +
  'disabled:cursor-not-allowed'

type PropsBoton = {
  children: ReactNode
  icono?: Icono
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  desactivado?: boolean
  /** Por qué está apagado. Un botón gris y mudo se lee como avería. */
  porQue?: string
  /*
    ANCHO. De serie ocupa la línea entera, que es lo que hace falta en
    el noventa por ciento de los sitios: un botón a lo ancho es más
    fácil de acertar con el pulgar.

    Pero en un estado vacío centrado tiene que encogerse, y al migrar
    Papeles acabé forzándolo con un `!w-auto` por encima — un parche
    que, si se repite, deshace el sistema. Mejor decirlo aquí.
  */
  ancho?: 'completo' | 'auto'
  /*
    ENLACE EXTERNO. `Link` de Next sirve para navegar DENTRO de HUBI;
    «Ver el papel» abre el archivo en otra pestaña y necesita un <a>
    de verdad, con su `target` y su `rel`.

    Al migrar la ficha tuve que repetir a mano los estilos del botón
    principal por esto — justo lo que este fichero viene a evitar.
  */
  externo?: boolean
  className?: string
}

function Cuerpo({ icono, children }: { icono?: Icono; children: ReactNode }) {
  return (
    <>
      {icono && <Ico nombre={icono} tam={22} grosor={2.2} />}
      {children}
    </>
  )
}

function Envoltura({
  estilo,
  alto,
  href,
  onClick,
  type = 'button',
  desactivado,
  porQue,
  icono,
  ancho = 'completo',
  externo = false,
  children,
  className = '',
}: PropsBoton & { estilo: string; alto: number }) {
  const clase =
    `${BASE_BOTON} ${ancho === 'auto' ? 'inline-flex px-7' : 'w-full'} ${estilo} ${className}`
  const altura = { height: `${alto}px` }

  /*
    APAGADO SIN DECIR POR QUÉ: eso es lo que había y es lo peor que
    puede hacer un botón. Pasaba al guardar un papel — si el lector no
    acertaba la carpeta, «Guardar» salía gris y mudo, y eso se lee como
    que la aplicación está rota, no como que falta un dato.
  */
  if (desactivado || !href) {
    return (
      <>
        <button
          type={type}
          onClick={onClick}
          disabled={desactivado}
          style={altura}
          className={clase}
        >
          <Cuerpo icono={icono}>{children}</Cuerpo>
        </button>
        {desactivado && porQue && (
          <p className="mt-2 text-[15px] font-semibold leading-snug text-tenue">{porQue}</p>
        )}
      </>
    )
  }

  if (externo) {
    return (
      <a href={href} target="_blank" rel="noreferrer" style={altura} className={clase}>
        <Cuerpo icono={icono}>{children}</Cuerpo>
      </a>
    )
  }

  return (
    <Link href={href} style={altura} className={clase}>
      <Cuerpo icono={icono}>{children}</Cuerpo>
    </Link>
  )
}

/** La acción de la pantalla. Una por pantalla, y siempre igual. */
export function BotonPrincipal(props: PropsBoton) {
  return (
    <Envoltura
      {...props}
      alto={60}
      estilo="bg-accion text-accion-tinta disabled:bg-superficie disabled:border disabled:border-borde disabled:text-apagado"
    />
  )
}

/** Lo otro que se puede hacer: dejarlo, volver, ahora no. */
export function BotonSecundario(props: PropsBoton) {
  return (
    <Envoltura
      {...props}
      alto={60}
      estilo="border border-borde bg-superficie text-tinta disabled:text-apagado"
    />
  )
}

/** De paso, sin peso: «ver todo», «más adelante». */
export function BotonTerciario(props: PropsBoton) {
  return (
    <Envoltura {...props} alto={48} estilo="text-tinta disabled:text-apagado" className="!text-[17px]" />
  )
}

/** Borrar, quitar, retirar. Nunca relleno de rojo. */
export function BotonDestructivo(props: PropsBoton) {
  return (
    <Envoltura
      {...props}
      alto={60}
      estilo="border bg-superficie disabled:text-apagado"
      className="!border-[color:var(--t-alerta)] !text-[color:var(--t-alerta)]"
    />
  )
}

// ═══════════════════════════════════════════════════════════════
// TARJETAS Y FILAS
// ═══════════════════════════════════════════════════════════════

/**
 * La tarjeta: superficie, borde de 1 px, radio 20. Sin sombra.
 *
 * `ambito` la tiñe muy levemente cuando hay una razón real para
 * separarla de sus vecinas. `estado` la tiñe cuando reclama atención
 * hoy — un papel que falta, algo que vence. Las dos cosas a la vez, no.
 */
export function Tarjeta({
  children,
  ambito,
  estado,
  relleno = 'normal',
  className = '',
}: {
  children: ReactNode
  ambito?: Ambito
  estado?: Estado
  /*
    Tal como estaba, esta pieza solo ponía el borde y el redondeo: el
    relleno había que acordarse de escribirlo fuera. Y eso es
    exactamente el problema que este fichero viene a resolver — al
    migrar tres pantallas salieron `px-4 py-4`, `px-5 py-5` y `px-4
    py-3.5` para la misma tarjeta.

    Ahora el relleno viene puesto. `ninguno` es para cuando dentro hay
    una lista que tiene que llegar hasta el borde.
  */
  relleno?: 'normal' | 'ninguno'
  className?: string
}) {
  const estilo = estado
    ? {
        background: VELO_ESTADO[estado],
        borderColor: `color-mix(in srgb, ${TINTA_ESTADO[estado]} 42%, transparent)`,
      }
    : ambito
      ? { background: veloAmbito(AMBITO[ambito]), borderColor: 'var(--t-borde)' }
      : { background: 'var(--t-superficie)', borderColor: 'var(--t-borde)' }

  return (
    <div
      style={estilo}
      className={`rounded-[20px] border ${relleno === 'normal' ? 'px-4 py-4' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * La pastilla del icono. Es por donde entra el color en una tarjeta.
 *
 * 48 px en una tarjeta de acción, 44 en una fila. Radio de campo,
 * porque es un cuadrado pequeño y no una tarjeta.
 */
const PASTILLA: Record<number, { radio: number; icono: number }> = {
  24: { radio: 8, icono: 14 },
  40: { radio: 13, icono: 20 },
  44: { radio: 14, icono: 22 },
  48: { radio: 16, icono: 24 },
}

export function PastillaAmbito({
  icono,
  ambito = 'pizarra',
  tam = 48,
}: {
  icono: Icono
  ambito?: Ambito
  tam?: 24 | 40 | 44 | 48
}) {
  const color = AMBITO[ambito]
  const m = PASTILLA[tam]
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: tam,
        height: tam,
        borderRadius: m.radio,
        background: `color-mix(in srgb, ${color} 16%, var(--t-superficie))`,
        color,
      }}
    >
      <Ico nombre={icono} tam={m.icono} grosor={2.1} />
    </span>
  )
}

/**
 * La tarjeta que lleva a algún sitio. 76 px, pastilla, título, pie y
 * flecha — siempre en ese orden y siempre del mismo tamaño.
 */
export function TarjetaAccion({
  href,
  icono,
  ambito = 'pizarra',
  titulo,
  pie,
  estado,
}: {
  href: string
  icono: Icono
  ambito?: Ambito
  titulo: string
  pie?: string
  /** Cuando reclama atención hoy. Con moderación. */
  estado?: Estado
}) {
  const tenido = estado
    ? {
        background: VELO_ESTADO[estado],
        borderColor: `color-mix(in srgb, ${TINTA_ESTADO[estado]} 42%, transparent)`,
      }
    : { background: 'var(--t-superficie)', borderColor: 'var(--t-borde)' }

  return (
    <Link
      href={href}
      style={tenido}
      className="tocable relative flex h-[76px] items-center gap-3.5 rounded-[20px] border px-3.5"
    >
      <EnCamino />
      {estado ? (
        <span
          className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[16px]"
          style={{ background: TINTA_ESTADO[estado], color: 'var(--t-superficie)' }}
        >
          <Ico nombre={icono} tam={24} grosor={2.1} />
        </span>
      ) : (
        <PastillaAmbito icono={icono} ambito={ambito} />
      )}

      <span className="min-w-0 flex-1">
        <span className="t-tarjeta block truncate">{titulo}</span>
        {pie && <span className="t-apoyo mt-0.5 block truncate">{pie}</span>}
      </span>

      <Ico nombre="flecha" tam={22} grosor={2.2} />
    </Link>
  )
}

/**
 * La fila de una lista. Más compacta que la tarjeta de acción, y con
 * la marca de ámbito al BORDE en vez de una barra suelta dentro: así
 * se recupera anchura para el texto, que a 360 px es lo que falta.
 */
export function Fila({
  href,
  onClick,
  desactivada = false,
  children,
  ambito,
  atenuada = false,
  /*
    Dos alturas y no una.

    Un papel dentro de una lista pide 64 px; una SECCIÓN entera —Finca,
    Salud— pide 76, porque es un destino y no un elemento. Al migrar
    Papeles lo forcé con un `!min-h-[76px]`, que otra vez es un parche
    que si se repite deshace el sistema.

    Dos, y ni una más: en cuanto haya tres alturas de fila volvemos a
    donde estábamos.
  */
  alto = 'normal',
  /*
    LA EXCEPCIÓN CONTROLADA (decisión D3).

    De serie una fila es papel liso. `tinte` la tiñe del color de su
    ámbito al 5 %, y solo debe usarse cuando hay una razón real: la
    opción que queremos que se elija entre varias, o algo que está
    esperando a alguien hoy.

    Cinco por ciento y no más. A partir de ahí deja de ser un matiz y
    empieza a competir con el botón de acción, que es lo único que
    debería llamar de verdad.
  */
  tinte = false,
  className = '',
}: {
  href?: string
  /*
    Una fila que no navega sino que HACE algo — elegir una actividad
    al empezar, por ejemplo. Estaba envolviendo la fila en un `<button>`
    por fuera, y eso mete un `<div>` dentro de un botón: funciona, pero
    es html que no se sostiene y acaba dando problemas de hidratación.
    Mejor que la fila sepa ser botón.
  */
  onClick?: () => void
  desactivada?: boolean
  children: ReactNode
  ambito?: Ambito
  /** Lo hecho. Se atenúa, pero nunca es la ÚNICA señal. */
  atenuada?: boolean
  alto?: 'normal' | 'alta'
  tinte?: boolean
  className?: string
}) {
  /*
    El ámbito puede aparecer de dos maneras y son excluyentes:

      sin `tinte`  ·  una marca de 3 px en el borde izquierdo
      con `tinte`  ·  el papel entero teñido al 5 %

    La marca al borde es la de serie —cuesta tres píxeles y no le quita
    anchura al texto, que a 360 px es lo que falta—. El tinte se
    reserva para lo que de verdad tiene que destacar entre sus vecinas.
  */
  const estilo = {
    background: tinte && ambito ? veloAmbito(AMBITO[ambito], 5) : 'var(--t-superficie)',
    borderColor:
      tinte && ambito
        ? `color-mix(in srgb, ${AMBITO[ambito]} 35%, transparent)`
        : 'var(--t-borde)',
    ...(ambito && !tinte ? { borderLeft: `3px solid ${AMBITO[ambito]}` } : {}),
  }

  const clase =
    `flex ${alto === 'alta' ? 'min-h-[76px]' : 'min-h-[64px]'} items-center gap-3 ` +
    `rounded-[20px] border px-3.5 py-2.5 ${atenuada ? 'opacity-60' : ''} ${className}`

  /* La respuesta al dedo va SOLO en las dos ramas que hacen algo. Una
     fila que no navega ni ejecuta nada es papel, no un botón, y darle
     respuesta al tacto sería prometer algo que no ocurre. */
  if (href) {
    return (
      <Link href={href} style={estilo} className={`tocable relative ${clase}`}>
        <EnCamino />
        {children}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button
        onClick={onClick}
        disabled={desactivada}
        style={estilo}
        className={`tocable ${clase} w-full text-left disabled:opacity-50`}
      >
        {children}
      </button>
    )
  }

  return (
    <div style={estilo} className={clase}>
      {children}
    </div>
  )
}

/**
 * Una fila de dato: etiqueta a la izquierda, valor a la derecha.
 *
 * Había TRES componentes llamados `Dato` en tres ficheros, con tres
 * diseños: la ficha de un papel (`py-3`, 16,5 px), la de una tarea
 * (`py-5`, `text-xl`) y la pantalla de guardar (`py-5`, 18 px). El
 * mismo nombre, el mismo trabajo y tres pintas distintas.
 *
 * Un valor vacío no pinta la fila: una etiqueta con un hueco al lado
 * es peor que no decir nada, porque parece que falta un dato en vez de
 * que ese papel no lo tiene.
 */
export function Dato({
  etiqueta,
  valor,
  fuerte = false,
  tono,
  ultimo = false,
}: {
  etiqueta: string
  valor: ReactNode
  /** Para el dato por el que se entra a esta pantalla. */
  fuerte?: boolean
  /** Solo cuando el color dice algo: un vencimiento, un descubierto. */
  tono?: Estado
  /** El último de un bloque no lleva raya debajo. */
  ultimo?: boolean
}) {
  if (valor === null || valor === undefined || valor === '') return null
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-3 ${
        ultimo ? '' : 'border-b border-borde'
      }`}
    >
      <span className="t-apoyo shrink-0">{etiqueta}</span>
      <span
        className={`text-right ${fuerte ? 't-tarjeta' : 't-cuerpo font-extrabold'}`}
        style={tono ? { color: TINTA_ESTADO[tono] } : undefined}
      >
        {valor}
      </span>
    </div>
  )
}

/**
 * Una persona: su foto si la tiene, y si no su inicial sobre su color.
 *
 * ─────────────────────────────────────────────────────────────
 * ESTO ESTABA ESCRITO A MANO EN CINCO PANTALLAS
 *
 * Y en las cinco igual: la inicial en BLANCO sobre el color entero.
 * Con los colores de antes —turquesa, ámbar, cian— una letra blanca
 * encima se lee mal en cualquiera de los dos modos, y con los
 * apagados de ahora se leería peor.
 *
 * Aquí la letra va en TINTA, no en el color. Es la diferencia con
 * `PastillaAmbito`: un icono aguanta ir del color de su ámbito porque
 * su forma ya se reconoce, pero una letra sobre un velo de su propio
 * color se queda en 2:1 y hay que acercarse a leerla. El color sigue
 * identificando —el relleno y el aro— y la letra se lee.
 *
 * Y redondo, siempre: lo redondo es una persona y lo cuadrado es una
 * sección. Sin esa diferencia, compartir paleta sí confundiría.
 */
export function Persona({
  nombre,
  color,
  foto,
  tam = 44,
}: {
  nombre: string
  color: string
  foto?: string | null
  tam?: number
}) {
  if (foto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={foto}
        alt={nombre}
        width={tam}
        height={tam}
        className="shrink-0 rounded-full object-cover"
        style={{ width: tam, height: tam, border: '1px solid var(--t-borde)' }}
      />
    )
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold"
      style={{
        width: tam,
        height: tam,
        fontSize: Math.round(tam * 0.4),
        background: `color-mix(in srgb, ${color} 26%, var(--t-superficie))`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${color} 70%, transparent)`,
        color: 'var(--t-tinta)',
      }}
    >
      {(nombre.trim().charAt(0) || '·').toUpperCase()}
    </span>
  )
}

/**
 * Una cifra con su rótulo. La cifra es TINTA salvo que el color sea el
 * signo: un balance, un ingreso frente a un gasto.
 *
 * Antes el número más grande de toda la aplicación era un contador de
 * notas, a 44 px, por encima del balance de la finca. Aquí solo hay
 * dos tamaños y el grande se lo gana quien es el asunto de la
 * pantalla.
 */
export function Cifra({
  rotulo,
  valor,
  pie,
  signo,
  grande = true,
}: {
  rotulo: string
  valor: string
  pie?: string
  /** Solo cuando el color ES el signo. */
  signo?: Estado
  grande?: boolean
}) {
  return (
    <div>
      <p className="rotulo">{rotulo}</p>
      <p
        className={`${grande ? 't-cifra' : 't-cifra-2'} mt-2`}
        style={signo ? { color: TINTA_ESTADO[signo] } : undefined}
      >
        {valor}
      </p>
      {pie && <p className="t-apoyo mt-1.5">{pie}</p>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PÍLDORAS
// ═══════════════════════════════════════════════════════════════

/*
  Un solo lenguaje para Semana/Mes/Día, Por hacer/Hechas, los filtros y
  las categorías. Antes había cuatro alturas —44, 46, 48 y 52— y tres
  tratamientos distintos para lo mismo.

  La activa se rellena de TINTA, no del color de la sección: así la
  misma píldora vale en cualquier pantalla sin repintarse.

  Y el tope es TRES POR FILA a 360 px. Con tres, cada una tiene 86 px
  útiles — «Por hacer · 6» ya se corta hoy con ese ancho.
*/
export function Pildora({
  children,
  href,
  onClick,
  puesta = false,
  cuantas,
  color,
  className = '',
}: {
  children: ReactNode
  href?: string
  onClick?: () => void
  puesta?: boolean
  cuantas?: number | null
  /** Punto de ámbito a la izquierda, para las de categoría. */
  color?: string
  className?: string
}) {
  const clase =
    `tocable inline-flex h-[48px] min-w-0 items-center justify-center gap-2 rounded-full ` +
    `px-4 text-[15px] font-extrabold ${className}`

  const estilo = puesta
    ? { background: 'var(--t-tinta)', color: 'var(--t-fondo)', border: '1px solid var(--t-tinta)' }
    : {
        background: 'var(--t-superficie)',
        color: 'var(--t-tinta-suave)',
        border: `1px solid ${color ?? 'var(--t-borde)'}`,
      }

  const dentro = (
    <>
      {color && !puesta && (
        <span
          aria-hidden
          className="h-[9px] w-[9px] shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      <span className="truncate">{children}</span>
      {cuantas !== null && cuantas !== undefined && (
        <span className="shrink-0 tabular-nums opacity-75">· {cuantas}</span>
      )}
    </>
  )

  if (href) {
    return (
      <Link href={href} aria-current={puesta ? 'page' : undefined} style={estilo} className={clase}>
        {dentro}
      </Link>
    )
  }
  return (
    <button onClick={onClick} aria-pressed={puesta} style={estilo} className={clase}>
      {dentro}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════
// CAMPOS
// ═══════════════════════════════════════════════════════════════

/*
  La clase `.entrada` que ya existía es correcta —58 px de alto y letra
  de 19— y se queda como base. Lo que faltaba era que la usaran todos:
  hoy hay pantallas con `rounded-2xl border-2` y `font-titulo text-4xl`
  para pedir exactamente el mismo dato.

  La etiqueta va ENCIMA, siempre, en rótulo. Nunca dentro del campo:
  un marcador de posición que hace de etiqueta desaparece justo cuando
  hace falta, que es mientras se escribe.
*/
export function Campo({
  etiqueta,
  children,
  ayuda,
  error,
  htmlFor,
  className = '',
}: {
  etiqueta: string
  children: ReactNode
  ayuda?: string
  error?: string | null
  /*
    Cuando dentro hay UN campo con su `id`, la etiqueta tiene que
    apuntarle: así se enfoca al tocar el texto —que es un blanco mucho
    más grande que el campo— y así la lee un lector de pantalla.

    Sin esto, migrar un `<label htmlFor>` a esta pieza era perder algo
    que la pantalla anterior sí hacía bien.
  */
  htmlFor?: string
  className?: string
}) {
  const Etiqueta = htmlFor ? 'label' : 'p'
  return (
    <div className={className}>
      <Etiqueta className="rotulo mb-2 block" htmlFor={htmlFor}>
        {etiqueta}
      </Etiqueta>
      {children}
      {error ? (
        <p className="mt-2 text-[15px] font-semibold leading-snug" style={{ color: 'var(--t-alerta)' }}>
          {error}
        </p>
      ) : (
        ayuda && <p className="t-apoyo mt-2">{ayuda}</p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ESTADOS
// ═══════════════════════════════════════════════════════════════

/**
 * «Aquí no hay nada.»
 *
 * Antes había cinco versiones de esto en seis pantallas, con tres
 * rellenos, dos radios y tres pesos distintos — y unas llevaban salida
 * y otras no. El esqueleto es siempre el mismo: qué falta, por qué, y
 * qué se puede hacer. Cambia el texto, nunca la forma.
 */
export function Vacio({
  titulo,
  explicacion,
  accion,
}: {
  titulo: string
  explicacion?: string
  accion?: { texto: string; href: string; icono?: Icono }
}) {
  return (
    <div className="rounded-[20px] border border-borde bg-superficie px-6 py-8 text-center">
      <p className="t-tarjeta">{titulo}</p>
      {explicacion && <p className="t-apoyo mx-auto mt-2 max-w-[34ch]">{explicacion}</p>}
      {accion && (
        <div className="mt-5 flex justify-center">
          <BotonPrincipal href={accion.href} icono={accion.icono} ancho="auto">
            {accion.texto}
          </BotonPrincipal>
        </div>
      )}
    </div>
  )
}

/**
 * Un aviso: algo ha fallado, algo reclama, algo ha salido bien.
 *
 * REGLA, y es la que más ha costado aprender en este proyecto: cuando
 * algo se degrada, se dice Y SE DICE POR QUÉ. Una línea explicando el
 * motivo resolvió en un paso lo que tres rondas de conjeturas no
 * consiguieron.
 *
 * Y la otra mitad de la regla: se dice qué SIGUE funcionando. «No se
 * han podido leer los papeles» a secas hace pensar que se han perdido;
 * «siguen guardados» convierte una avería en una espera.
 */
export function Aviso({
  tono = 'alerta',
  titulo,
  explicacion,
  detalle,
}: {
  tono?: Estado
  titulo: string
  explicacion?: string
  /** El motivo técnico, cuando ayuda. Nunca el mensaje crudo de la
      base de datos: eso va al registro del servidor. */
  detalle?: string | null
}) {
  return (
    <div
      className="rounded-[20px] border px-4 py-3.5"
      style={{
        background: VELO_ESTADO[tono],
        borderColor: `color-mix(in srgb, ${TINTA_ESTADO[tono]} 45%, transparent)`,
      }}
    >
      {/*
        La buena noticia lleva tic. Es la única de las tres que se
        reconoce sin leer, y `tono="bien"` se usa justo donde antes
        había una caja gris que servía igual para «enviado» que para
        «no ha podido ser»: sin el tic, hay que leerla entera para
        saber cuál de las dos es.

        Alerta y atención NO lo llevan. Un icono de alarma en un aviso
        de error es decorar un disgusto.
      */}
      <p
        className="t-cuerpo flex items-start gap-2 font-extrabold"
        style={{ color: TINTA_ESTADO[tono] }}
      >
        {tono === 'bien' && (
          <Ico nombre="check" tam={20} grosor={2.4} className="mt-0.5 shrink-0" />
        )}
        <span className="min-w-0">{titulo}</span>
      </p>
      {explicacion && (
        <p className="mt-1 text-[15px] font-semibold leading-snug text-tinta-suave">
          {explicacion}
        </p>
      )}
      {detalle && (
        <p className="mt-2 text-[14px] font-semibold leading-snug text-tenue">{detalle}</p>
      )}
    </div>
  )
}

/** Se ha guardado. El único sitio donde el círculo lleno tiene sentido. */
export function Hecho({
  titulo,
  explicacion,
  children,
}: {
  titulo: string
  explicacion?: string
  children?: ReactNode
}) {
  return (
    <div className="text-center">
      <div
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: 'var(--t-bien)', color: 'var(--t-superficie)' }}
      >
        <Ico nombre="check" tam={40} grosor={2.6} />
      </div>
      <h1 className="t-titulo mt-7">{titulo}</h1>
      {explicacion && <p className="t-cuerpo mt-3 text-tinta-suave">{explicacion}</p>}
      {children && <div className="mt-9 space-y-3 text-left">{children}</div>}
    </div>
  )
}
