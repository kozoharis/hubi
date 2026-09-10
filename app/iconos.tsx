import Link from '@/app/enlace'
import type { Ambito } from '@/lib/ambitos'
/*
  Los iconos de HUBI.

  Son de línea, dibujados a mano, y toman el color del texto que los
  rodea. Sustituyen a los emojis: un emoji se ve distinto en cada
  teléfono y no se puede recolorear.
*/

export type Icono =
  | 'casa' | 'carpeta' | 'check' | 'calendario' | 'hoja'
  | 'micro' | 'onda' | 'foto' | 'lupa' | 'flecha' | 'atras'
  | 'campana' | 'escudo' | 'corazon' | 'coche' | 'papel'
  | 'pastilla' | 'reloj' | 'euro' | 'mas' | 'chincheta'
  | 'ojo' | 'lapiz' | 'gente' | 'candado' | 'bolsa' | 'aviso' | 'llave'
  | 'refrescar' | 'casco' | 'maleta' | 'herramienta' | 'barco' | 'mascota'
  | 'taza' | 'mandos'
  | 'sol' | 'luna' | 'contraste'

const TRAZOS: Record<Icono, string> = {
  /*
    ── EL TEMA ──

    Aquí no había nada, y el selector de «Cómo se ve» tiraba de lo que
    hubiera: un OJO para «Claro», un RELOJ para «Oscuro» y dos
    PERSONAS para «El del teléfono». Ninguno de los tres significa
    nada de lo que dice el botón, y el de las personas llegaba a
    sugerir que aquello iba de quién usa el móvil.

    Un sol, una luna y un círculo medio sombreado. Son los tres que
    usa todo el mundo, y por eso no hay que explicarlos.
  */
  sol:       'M12 5.4V2.5M12 21.5v-2.9M5.4 12H2.5M21.5 12h-2.9M7.3 7.3 5.2 5.2M18.8 18.8l-2.1-2.1M16.7 7.3l2.1-2.1M5.2 18.8l2.1-2.1M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z',
  luna:      'M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z',
  /* El círculo entero, y dentro tres rayas que van llenando media
     esfera: es «a veces uno y a veces el otro» sin tener que rellenar
     nada, que estos iconos son solo de línea. */
  contraste: 'M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2ZM12 3.6v16.8M14.6 5.4v13.2M17.2 8.1v7.8',
  casa:      'M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5',
  /* Un casco de obra. Media cúpula, la visera que sobresale por
     delante y la cinta de la base — que es lo que hace que se lea
     como casco y no como una seta. Un ladrillo, que era lo que había,
     se confunde con una caja a tamaño de pestaña. */
  casco:     'M4 15.5a8 8 0 0 1 16 0M9.2 15.2V8.4a2.8 2.8 0 0 1 5.6 0v6.8M2.5 15.5h19a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-19a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1Z',
  maleta:    'M3.5 8.5h17a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1ZM9 8.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2.5M2.5 13h19',
  herramienta: 'M14.7 6.3a3.8 3.8 0 0 0 5 5l-8.4 8.4a2.1 2.1 0 0 1-3-3ZM14.7 6.3 17.2 3.8M6 18h.01',
  barco:      'M3 15.5h18l-2.4 4.2a1 1 0 0 1-.9.5H6.3a1 1 0 0 1-.9-.5ZM5.5 15.5V8.2l6.5-4 6.5 4v7.3M12 4.2v11.3',
  mascota:    'M5.5 11.5a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6ZM18.5 11.5a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6ZM9 7.6a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6ZM15 7.6a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6ZM12 11.5c2.6 0 4.6 2.2 4.6 4.4 0 2-1.6 3.1-3.2 3.1-.7 0-1 .3-1.4.3s-.7-.3-1.4-.3c-1.6 0-3.2-1.1-3.2-3.1 0-2.2 2-4.4 4.6-4.4Z',
  /* Los Helechos es una casa de alquiler: una llave lo dice mejor que
     otro tejado, que ya lo usa Inicio. Anillo arriba y paletón abajo. */
  llave:     'M15.5 3.5a5.5 5.5 0 1 1-3.9 9.4L4 20.5v-3h-1.5v-3H6l5.6-5.6A5.5 5.5 0 0 1 15.5 3.5M17 8.2h.01',
  carpeta:   'M3 7.5a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.5.7l1.1 1.3H19a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  check:     'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M8.3 12.2l2.6 2.6 4.8-5.2',
  calendario:'M6.2 5h11.6a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6.2a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3M3.2 10h17.6M8 3v4M16 3v4',
  hoja:      'M20 4C10 4 4 9 4 16.5c0 1.5.3 2.5.3 2.5S9 8.5 19.5 8.5C15 11 12 14 10 20M4.5 20.5C8 13 13 9.5 19.5 8.5',
  micro:     'M12 2.5a3 3 0 0 1 3 3v5.5a3 3 0 0 1-6 0V5.5a3 3 0 0 1 3-3M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.2',
  onda:      'M3.5 10.6v2.8M7.6 7.4v9.2M11.8 3.6v16.8M16 7.4v9.2M20.1 10.6v2.8',
  foto:      'M3 8.6a2 2 0 0 1 2-2h2.2l1.3-2.1h6.8L16.8 6.6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM15.6 13a3.6 3.6 0 1 1-7.2 0 3.6 3.6 0 0 1 7.2 0',
  lupa:      'M17.6 10.8a6.8 6.8 0 1 1-13.6 0 6.8 6.8 0 0 1 13.6 0M15.8 15.8 21 21',
  flecha:    'M9 5.5 15.5 12 9 18.5',
  atras:     'M15 5.5 8.5 12 15 18.5',
  campana:   'M18.5 16.5V11a6.5 6.5 0 1 0-13 0v5.5L4 18.5h16zM9.8 21.5a2.6 2.6 0 0 0 4.4 0',
  escudo:    'M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z',
  corazon:   'M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z',
  coche:     'M4.5 16.5h15M6 16.5v2a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-5l2-5.2a1.6 1.6 0 0 1 1.5-1h10a1.6 1.6 0 0 1 1.5 1l2 5.2v5a1 1 0 0 1-1 1H19a1 1 0 0 1-1-1v-2M3.7 12.5h16.6',
  papel:     'M6 3h7.5L19 8.5V21H6zM13.5 3v5.5H19M9 13h7M9 16.5h5',
  pastilla:  'M20.8 12a3.4 3.4 0 0 1-3.4 3.4H6.6a3.4 3.4 0 0 1 0-6.8h10.8A3.4 3.4 0 0 1 20.8 12M12 8.6v6.8',
  reloj:     'M20.6 12a8.6 8.6 0 1 1-17.2 0 8.6 8.6 0 0 1 17.2 0M12 7.2V12l3.2 2',
  euro:      'M17.5 6.5A6.5 6.5 0 0 0 7 12a6.5 6.5 0 0 0 10.5 5.5M4.5 10.5h8M4.5 13.8h8',
  mas:       'M12 5.5v13M5.5 12h13',
  chincheta: 'M9 3h6l-.8 5.6 3.3 3.2H6.5l3.3-3.2zM12 11.8V21',
  ojo:       'M2.6 12S6.6 5.5 12 5.5 21.4 12 21.4 12 17.4 18.5 12 18.5 2.6 12 2.6 12M15.1 12a3.1 3.1 0 1 1-6.2 0 3.1 3.1 0 0 1 6.2 0',
  lapiz:     'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z',
  gente:     'M12.4 8.5a3.4 3.4 0 1 1-6.8 0 3.4 3.4 0 0 1 6.8 0M3 20a6 6 0 0 1 12 0M16.5 5.6a3.4 3.4 0 0 1 0 5.8M17 14.6a6 6 0 0 1 4 5.4',
  candado:   'M4.5 13.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3zM8 10.5V7.6a4 4 0 0 1 8 0v2.9',
  bolsa:     'M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8zM8.6 8V6.4a3.4 3.4 0 0 1 6.8 0V8',
  aviso:     'M12 3.6 21.4 20H2.6zM12 10v4.4M12 17.2v.1',
  refrescar: 'M20.5 12a8.5 8.5 0 1 1-2.5-6M20.5 4.5V10h-5.5',
  /*
    ── EL ICONO DE «EL DÍA A DÍA» ──

    Una taza con su vapor. Se buscó entre los que ya había y ninguno
    servía: la bolsa ES La compra, la chincheta ES las Notas y la casa
    ES el Inicio — usar cualquiera de los tres para el cajón que los
    contiene es decir que el cajón es una de las cosas de dentro.

    Y el sol, que sería lo literal para «el día», ya significa «modo
    claro» en Ajustes.

    Una taza no es ninguna de las cosas de dentro y sin embargo son
    todas: es la mesa de la cocina, que es donde se hablan la compra,
    la cena y los recados.
  */
  taza:      'M4.5 9.5h11.5v6a4 4 0 0 1-4 4h-3.5a4 4 0 0 1-4-4zM16 11h1.6a2.5 2.5 0 0 1 0 5H16M8.5 3v2.4M12 3v2.4',

  /*
    ── LOS MANDOS ──

    El dibujo de Ajustes, ahora trazado aquí. Tres carriles y tres
    mandos a distinta altura: exactamente el dibujo que mandó Haris,
    porque la idea es suya y es la correcta —en Ajustes no se engrasa
    una máquina, se abren y se cierran cosas—.

    Lo que cambia es de dónde sale. Venía de un PNG en cian eléctrico
    y ahora se traza como los otros treinta y tantos iconos: hereda la
    tinta del tema, se ve nítido a cualquier tamaño y funciona igual en
    claro que en oscuro sin un segundo archivo.
  */
  mandos:    'M4 7h9M17.5 7H20M4 12h3.5M12 12h8M4 17h9M17.5 17H20M15 4.6v4.8M9.5 9.6v4.8M15 14.6v4.8',
}

export function Ico({
  nombre,
  tam = 24,
  grosor = 1.9,
  className,
}: {
  nombre: Icono
  tam?: number
  grosor?: number
  className?: string
}) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  )
}

/*
  ── AQUÍ ESTABA `Pastilla` ──

  La sustituye `PastillaAmbito` en `piezas.tsx`: la misma pieza, pero
  pidiendo un ÁMBITO por su nombre en vez de dos hexadecimales
  sueltos. Mientras las dos convivieron, cada pantalla elegía —y por
  ahí se colaban colores fuera de paleta uno detrás de otro.
*/


/*
  ═══════════════════════════════════════════════════════════════
  EL BOTÓN DE AJUSTES
  ═══════════════════════════════════════════════════════════════

  Éste no lo dibujé yo: lo diseñó Haris y llegó como imagen. Lo que
  hay aquí es su botón, no una versión mía de su botón.

  ─────────────────────────────────────────────────────────────
  PEQUEÑO DE VER, GRANDE DE TOCAR

  La píldora mide 30 px de alto. Lo que responde al dedo son 48: el
  enlace que la envuelve lleva un margen invisible arriba y abajo.

  No es un truco — es la única manera de tener las dos cosas. Un botón
  que se toca una vez al mes no debe pesar en la pantalla, y ninguna
  pantalla de HUBI puede tener algo pulsable por debajo de 48 px.

  ─────────────────────────────────────────────────────────────
  EL DIBUJO ES SUYO · EL ARCHIVO YA NO

  Los mandos los diseñó él y se quedan tal cual: tres carriles, tres
  mandos a distinta altura. Lo que ya no se usa es su PNG.

  `public/ajustes-mando.png` está hecho de cian eléctrico —#00D8F0,
  #00C0F0, #00F0F0— derivando a violeta #7848F0. Son los MISMOS
  colores del degradado que quitamos del borde justamente por no ser
  de HUBI. Quitamos el degradado y dejamos el icono hecho de él, así
  que el cian se quedó igual, y con la cabecera vacía que dejó la
  Fase 2 pasó a ser lo único con color de toda la pantalla, a un
  centímetro del logotipo.

  Ahora el dibujo se traza en código (`mandos`, arriba, con los otros
  treinta y tantos). Hereda la tinta del tema, se ve nítido a
  cualquier tamaño y no necesita una segunda versión para el modo
  oscuro. El archivo se queda en `public/` sin usar, por si algún día
  hace falta el original.

  ─────────────────────────────────────────────────────────────
  Y EL BOTÓN ENTERO TAMBIÉN LLEGÓ COMO IMAGEN

  No se usa, y el motivo es que una imagen no se estira: el ancho de
  esta píldora lo decide la palabra que lleva dentro, y en cuanto se
  estirase un PNG los extremos redondeados se deformarían. Dibujado,
  se adapta y se ve nítido en cualquier pantalla.

  ─────────────────────────────────────────────────────────────
  SIN RESPLANDOR, Y SIN FLECHA

  Tenía las dos cosas y las dos sobraban.

  El halo —dos sombras de color alrededor— hacía que el botón
  PARECIERA ENCENDIDO, como si estuviera avisando de algo. Y no avisa
  de nada: es un sitio al que se va. En una pantalla donde lo único
  que de verdad reclama la mirada es una nota que te han dejado o algo
  que vence mañana, un botón que brilla por decoración está robando
  esa atención.

  La flecha sobraba por otra razón: la ponen las filas de las listas
  para decir «esto se abre», y aquí ya lo dice la propia píldora. Con
  una flecha dentro, el botón mide 34 px de alto y pide su sitio; sin
  ella baja a 30 y se queda donde le toca —arriba a la derecha, a
  mano, sin competir con nada.

  Se fueron las dos, y detrás se fue también la línea del degradado.
  Lo que queda es el chip de velo, el dibujo y la palabra.

  ─────────────────────────────────────────────────────────────
  POR QUÉ MANDOS Y NO UNA RUEDA

  Porque es lo que se hace ahí dentro. En Ajustes no se engrasa una
  máquina: se abre y se cierra el acceso de la gente, se encienden y
  se apagan carpetas, se conecta o se desconecta Google. Cosas que se
  mueven de un lado a otro — que es lo que dibuja un mando, no un
  engranaje. Y la chispa dice la otra mitad: que ahí dentro hay cosas
  que HUBI hace solo.

  ─────────────────────────────────────────────────────────────
  DE UN BORDE QUE NO SE VEÍA A UN RELLENO QUE SÍ

  Hubo un apaño largo aquí: degradado de fondo, una máscara para
  recortarle el centro y dejar solo la línea, desenfoque por detrás.
  Todo eso se fue con el degradado, y detrás quedó el borde de las
  tarjetas, que sobre el papel cálido no se ve (1,13:1).

  Lo que hay ahora es lo contrario de lo que hubo: nada de línea y un
  relleno de verdad, 8% de tinta. El porqué —y los números en los dos
  modos— está justo debajo, dentro del propio botón.

  ─────────────────────────────────────────────────────────────
  Y LA PALABRA, MÁS FINA

  Estaba en 800, el peso de los títulos, y eso hacía que compitiera
  con «Buenos días, Haris» —que es lo que se tiene que leer primero—.
  En 500 se sigue leyendo perfectamente y deja de gritar. El punto 5
  pide que los iconos lleven texto; no pide que ese texto pese como un
  titular.
*/
export function BotonAjustes() {
  return (
    <span className="velo-chip relative flex h-[30px] items-center gap-1.5 rounded-full px-2.5">
      {/*
        ═══════════════════════════════════════════════════════
        AQUÍ HUBO UN DEGRADADO, Y DESPUÉS UNA RAYA INVISIBLE
        ═══════════════════════════════════════════════════════

        El degradado era `#00F4FC → #628BFC → #AE62F7`: un cian
        eléctrico que pasaba a violeta. Tres colores que NO APARECÍAN
        EN NINGUNA OTRA PARTE del producto — ni en la paleta declarada,
        ni en el logo, ni en el aro del micrófono. Y estaba en el peor
        sitio posible para un color ajeno a la marca: la esquina
        superior derecha del Inicio, pegado al logotipo. Quien miraba
        esa pantalla veía dos identidades a la vez.

        Se quitó, y en su sitio quedó el borde de siempre —el de las
        tarjetas—. Ahí empezó el segundo problema.

        Con el papel cálido de la Fase 3 ese borde es `#EAE7E3` sobre
        `#F7F5F1`: 1,13:1. El mínimo para que se vea una caja son 3:1.
        La píldora dejó de existir literalmente, pero su hueco no —los
        30 px de alto y el aire de los lados seguían ahí—, así que lo
        que se veía era una palabra y un dibujo flotando con espacio
        raro alrededor. «Bastante raro» fue exactamente el diagnóstico.

        ── LO QUE HAY AHORA ──

        Relleno en vez de raya. Un campo de 8% de tinta da 1,18:1 en
        claro y 1,20:1 en oscuro contra su fondo: un número parecido al
        de la raya, y sin embargo se ve, porque lo que decide si algo
        de tan poco contraste se percibe es el ÁREA. Una superficie de
        30 px de alto se lee; una línea de 1 px, no. Es el mismo motivo
        por el que las tarjetas blancas sobre crema (1,09:1) se leen
        perfectamente.

        Y el chip no es lo que identifica el botón —eso lo hace la
        palabra «Ajustes», a 13,9:1 encima de él—, así que no le
        corresponde el listón de 3:1: refuerza, no informa.

        El relleno se declara en `globals.css` (`.velo-chip`) y no
        aquí, porque lleva dos valores: `--t-velo` para quien no
        entienda `color-mix`, y el 8% para todos los demás.
      */}
      <Ico nombre="mandos" tam={16} grosor={2} className="shrink-0 text-tinta-suave" />
      <span className="text-[13.5px] font-medium tracking-tight text-tinta">Ajustes</span>
    </span>
  )
}

/* ── El logotipo ─────────────────────────────────────────
   Es el archivo de verdad: la H con el degradado de HUBI —turquesa,
   verde azulado y azul— y nada más.

   El anterior llevaba dentro rojo, naranja y rosa, tres de las siete
   familias que la Fase 1 retiró de la paleta. O sea que el símbolo
   anunciaba unos colores que dentro no existían.

   `oscuro` pide la variante crema. Hace falta menos que antes —el
   degradado nuevo acaba en azul vivo y aguanta sobre el marino—, pero
   sobre la puerta, que ya lleva manchas turquesa y azules por detrás,
   dos degradados se pelean y el crema queda limpio. */
export function Logo({ tam = 30, oscuro = false }: { tam?: number; oscuro?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={oscuro ? '/logo-hubi-oscuro.png' : '/logo-hubi.png'}
      alt=""
      width={tam}
      height={tam}
      style={{ width: tam, height: tam, objectFit: 'contain' }}
    />
  )
}

/* ── El icono de una tarea, deducido de lo que se escribió ──
   Nadie tiene que elegir categoría al apuntar algo: eso sería
   exactamente la complejidad que no queremos trasladarles. */
/*
  ── Y AQUÍ SE PINTABAN DE COLORES VIVOS ──

  El médico y la farmacia iban en `#FF6B6B`, un coral que en la
  paleta significa ALERTA. O sea: cada cita médica de la agenda salía
  del color de las cosas que van mal — y una revisión rutinaria del
  dentista no va mal, es un martes a las diez.

  El resto era igual: naranja para la compra, morado para el taller,
  ninguno de la paleta. Y lo que hacen estos colores es IDENTIFICAR de
  qué va cada cosa, que es exactamente el trabajo de los apagados.

  Ahora cada pista devuelve su ámbito, el mismo con el que esa sección
  sale en Papeles: la farmacia rosa como Salud, el taller violeta como
  Vehículos, los papeles azul como Seguros.
*/
const PISTAS: [RegExp, Icono, Ambito][] = [
  [/farmac|medicaci|medicament|receta|pastill/i, 'pastilla', 'rosa'],
  [/m[eé]dic|doctor|consulta|an[aá]lisis|hospital|dentista|revisi[oó]n/i, 'corazon', 'rosa'],
  [/coche|taller|itv|gasolin|mec[aá]nic|neum[aá]tic/i, 'coche', 'violeta'],
  [/papel|documento|contrato|p[oó]liza|seguro|banco|gestor|notar/i, 'papel', 'azul'],
  [/vence|caduca|renov/i, 'reloj', 'arena'],
  [/compr|super|mercad|tienda|traer|llevar|recoger|dejar/i, 'bolsa', 'arena'],
  [/cita|llamar|tel[eé]fono/i, 'reloj', 'ciruela'],
]

/**
 * El icono y el ámbito de una tarea, deducidos de lo que se escribió.
 *
 * Lo que NO se reconoce cae en pizarra con un tic: es el gris de «una
 * cosa que hay que hacer», sin más. Antes caía en el turquesa, que
 * ahora es el color de acción.
 */
export function pintaDe(titulo: string): { icono: Icono; ambito: Ambito } {
  for (const [patron, icono, ambito] of PISTAS) {
    if (patron.test(titulo)) return { icono, ambito }
  }
  return { icono: 'check', ambito: 'pizarra' }
}


/*
  ── AQUÍ HABÍA UNA SEGUNDA PALETA, Y SE HA IDO ──

  `SECCIONES` y `seccionDe()` daban el icono y el color de cada sección
  con hexadecimales de la paleta vieja: la Finca en `#14B8A6` —el
  turquesa que ahora significa ACCIÓN—, Salud en el coral de alerta,
  Personal en rosa fuerte.

  Eran dos tablas leyendo el mismo `segmento_drive` y había que
  mantener las dos. Desde hoy solo queda `seccionPintada()` en
  `piezas.tsx`, que devuelve icono y ÁMBITO.

  (Se dio por borrada en la Fase 2 y no lo estaba: el borrado no llegó
  a aplicarse y el comentario de `piezas.tsx` afirmaba algo que no era
  verdad. Ahora sí.)
*/


/* ── Qué color de texto va encima de un color ────────────
   Los colores de la paleta son de tono medio: el blanco encima de
   ellos se lee mal a tamaño pequeño. Esta función elige azul marino
   o blanco según lo oscuro que sea el fondo, para que un rótulo
   seleccionado nunca pierda legibilidad. */
export function tintaSobre(color: string): string {
  const h = color.replace('#', '')
  const canal = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  const luz = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4)
  /* El negro cálido, no el azulado: encima de un color de ámbito
     sobre fondo crema, el azul-negro se nota. */
  return luz > 0.28 ? '#1A1714' : '#FFFFFF'
}

/* Aquí estaba `MORADO_CLARO = '#A78BFA'`, del manual antiguo. No lo
   usaba ya nadie y el morado no existe en la paleta: los ámbitos
   tienen su violeta apagado en `lib/ambitos.ts`. */

/* ── El botón de volver ──────────────────────────────────
   Un chip con borde y con la palabra al lado de la flecha. Una
   flecha suelta se puede fallar al tocarla y no se ve que sea un
   botón; esto se ve, se lee y ocupa 48 px de alto. */
/*
  ═══════════════════════════════════════════════════════════════
  EL BOTÓN DE ATRÁS DICE SIEMPRE «VOLVER»
  ═══════════════════════════════════════════════════════════════

  Decía cosas distintas en cada pantalla: «Volver» en Ajustes,
  «Inicio» en Actividades, «Documentos» en una carpeta, el nombre de
  la sección en sus ajustes. Cada una tenía su razón — decir a dónde
  vas parece más informativo que decir que vuelves.

  Y es peor. El punto 5 pide «botón volver siempre evidente», y un
  botón evidente es uno que se reconoce SIN LEERLO: misma flecha,
  mismo sitio, misma palabra. Cuando el rótulo cambia, hay que leerlo
  cada vez para confirmar que es el de atrás — y a los 75 años eso es
  una pausa en cada pantalla.

  El `texto` sigue aceptándose para no romper las llamadas que ya lo
  pasan, pero no se usa. Es a propósito: si mañana alguien vuelve a
  ponerle un rótulo distinto, no pasa nada.
*/
/*
  ═══════════════════════════════════════════════════════════════
  VOLVER
  ═══════════════════════════════════════════════════════════════

  Uno solo, y en todas las pantallas igual: una pastilla con borde, el
  icono de la flecha, y la palabra **Volver**. Siempre la misma.

  ─────────────────────────────────────────────────────────────
  SIEMPRE «VOLVER», Y NUNCA «VOLVER A DONDE SEA»

  Había de todo: «← Volver al tablón», «← Volver al inicio», «← Volver
  al papel», «← Volver a la semana». Suena más informativo y es peor
  por dos razones.

  La primera: cambia de sitio y de largo en cada pantalla, así que el
  ojo tiene que buscarlo cada vez en vez de encontrarlo donde estaba.
  Para una persona mayor eso no es un detalle de estilo: es tener que
  releer la esquina de arriba en cada pantalla.

  La segunda: se queda mentiroso solo. Basta con que a esa pantalla se
  llegue desde dos sitios —y a «Guardar documento» se llega desde el
  Inicio, desde una carpeta y desde la compra— para que «Volver al
  inicio» sea falso la mitad de las veces.

  El punto 5 lo pide entero: *botón volver siempre evidente*. Evidente
  quiere decir el mismo, en el mismo sitio, con la misma palabra.

  ─────────────────────────────────────────────────────────────
  Y POR QUÉ ES UNA PASTILLA Y NO UN «←» SUELTO

  Las que quedaban por ahí eran texto pelado en gris. Contra el fondo
  oscuro casi no se ven, y sobre todo no parecen tocables: un texto
  gris de dieciséis puntos no dice «púlsame». La pastilla ocupa 48
  puntos de alto —lo que hay que poder tocar con el pulgar sin
  apuntar— y se lee como un botón porque lo es.
*/
export function Volver({
  href,
  alPulsar,
  oscuro = false,
}: {
  /** A dónde vuelve. Uno de los dos: `href` o `alPulsar`. */
  href?: string
  /** Para volver un paso DENTRO de una pantalla, sin cambiar de página. */
  alPulsar?: () => void
  /** Sobre fondo oscuro propio —la pantalla de hablar—, no el tema. */
  oscuro?: boolean
}) {
  const pinta = 'mb-3 inline-flex h-12 max-w-full items-center gap-1.5 rounded-full py-0 pl-3 pr-5 text-[16.5px] font-extrabold'

  const traje = oscuro
    ? { background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.18)', color: '#fff' }
    : {
        background: 'var(--t-superficie)',
        border: '1px solid var(--t-borde)',
        color: 'var(--t-tinta)',
      }

  const dentro = (
    <>
      <Ico nombre="atras" tam={21} grosor={2.6} />
      <span className="truncate">Volver</span>
    </>
  )

  /* Sin `href` es un paso atrás dentro de la misma pantalla —el
     formulario de guardar—, y eso es un botón, no un enlace. Se ve
     idéntico a propósito: quien lo pulsa no tiene por qué saber si
     cambia de página o no. */
  if (!href) {
    return (
      <button type="button" onClick={alPulsar} className={pinta} style={traje}>
        {dentro}
      </button>
    )
  }

  return (
    <Link href={href} className={pinta} style={traje}>
      {dentro}
    </Link>
  )
}

/*
  El emoji de una sección, traducido al icono de línea que usa HUBI.

  Las secciones guardan su icono como emoji porque es lo que se puede
  elegir desde una pantalla sin programar nada. Pero en la barra de
  abajo y en las cabeceras se pintan iconos de línea: un emoji entre
  ellos se ve como un pegote de otra aplicación.

  Lo que no tenga equivalente cae en la carpeta. Es honesto —dice «una
  sección»— y no promete nada que no sea.
*/
const POR_EMOJI: Record<string, Icono> = {
  '🌿': 'hoja',
  '🔑': 'llave',
  '🏠': 'casa',
  '🚗': 'coche',
  '❤️': 'corazon',
  '🩺': 'corazon',
  '🛡': 'escudo',
  '📄': 'papel',
  '💊': 'pastilla',
  '📁': 'carpeta',
  '💰': 'euro',
  '👷': 'casco',
  '🧱': 'casco',
  '🧰': 'herramienta',
  '💼': 'maleta',
  '⛵': 'barco',
  '🐾': 'mascota',
  '🎓': 'maleta',
  '🍽': 'bolsa',
  '🛒': 'bolsa',
  '⏰': 'reloj',
  '👥': 'gente',
  '🔒': 'candado',
  '📌': 'chincheta',
}

export function iconoDeEmoji(emoji: string | null | undefined): Icono {
  return POR_EMOJI[(emoji ?? '').trim()] ?? 'carpeta'
}
