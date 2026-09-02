import Link from 'next/link'
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
  | 'refrescar'

const TRAZOS: Record<Icono, string> = {
  casa:      'M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5',
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
  El icono dentro de su cuadrado de color.

  El fondo NO se pasa: se calcula del propio color del icono con un
  15% de opacidad. Así el mismo componente vale en claro y en oscuro
  sin dos juegos de tintes, y el icono conserva su color de marca en
  los dos modos. El parámetro `fondo` se mantiene solo para no tener
  que tocar todas las llamadas; sirve de red si el navegador fuese
  tan viejo que no entendiera color-mix.
*/
export function Pastilla({
  nombre,
  color,
  fondo,
  tam = 44,
  icono,
  redondez = 14,
}: {
  nombre: Icono
  color: string
  fondo?: string
  tam?: number
  icono?: number
  redondez?: number
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: tam,
        height: tam,
        background: fondo ?? 'transparent',
        color,
        borderRadius: redondez,
      }}
    >
      <span
        className="flex h-full w-full items-center justify-center"
        style={{
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
          borderRadius: redondez,
        }}
      >
        <Ico nombre={nombre} tam={icono ?? Math.round(tam * 0.5)} />
      </span>
    </span>
  )
}

/* ── El logotipo ─────────────────────────────────────────
   Es el archivo de verdad, con su degradado y su onda. Sobre fondo
   oscuro hay que usar la variante clara: en la otra, el trazo derecho
   termina en azul marino y se perdería. */
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
const PISTAS: [RegExp, Icono, string, string][] = [
  [/farmac|medicaci|medicament|receta|pastill/i, 'pastilla', '#FF6B6B', '#FFE7E7'],
  [/m[eé]dic|doctor|consulta|an[aá]lisis|hospital|dentista|revisi[oó]n/i, 'corazon', '#FF6B6B', '#FFE7E7'],
  [/coche|taller|itv|gasolin|mec[aá]nic|neum[aá]tic/i, 'coche', '#8B5CF6', '#EEE8FE'],
  [/papel|documento|contrato|p[oó]liza|seguro|banco|gestor|notar/i, 'papel', '#3B82F6', '#E4EEFE'],
  [/vence|caduca|renov/i, 'reloj', '#FF6B6B', '#FFE7E7'],
  [/compr|super|mercad|tienda|traer|llevar|recoger|dejar/i, 'bolsa', '#F59E0B', '#FEF1DC'],
  [/cita|llamar|tel[eé]fono/i, 'reloj', '#F59E0B', '#FEF1DC'],
]

export function pintaDe(titulo: string): { icono: Icono; color: string; fondo: string } {
  for (const [patron, icono, color, fondo] of PISTAS) {
    if (patron.test(titulo)) return { icono, color, fondo }
  }
  return { icono: 'check', color: '#14B8A6', fondo: '#DFF7F3' }
}


/* ── Los colores de cada sección ─────────────────────────
   La categoría se reconoce por el nombre de su carpeta en Drive,
   que es lo único estable: los nombres visibles se pueden cambiar. */
export const SECCIONES: Record<string, { icono: Icono; color: string; fondo: string }> = {
  FINCA:       { icono: 'hoja',    color: '#14B8A6', fondo: '#DFF7F3' },
  SEGUROS:     { icono: 'escudo',  color: '#3B82F6', fondo: '#E4EEFE' },
  SALUD:       { icono: 'corazon', color: '#FF6B6B', fondo: '#FFE7E7' },
  CASA:        { icono: 'casa',    color: '#F59E0B', fondo: '#FEF1DC' },
  VEHICULOS:   { icono: 'coche',   color: '#8B5CF6', fondo: '#EEE8FE' },
  PERSONAL:    { icono: 'gente',   color: '#EC4899', fondo: '#FCE7F3' },
  /* Los Helechos llevaba desde que se creó saliendo con la tarjeta
     gris de "documentos", porque nadie le puso color aquí. */
  HELECHOS:    { icono: 'llave',   color: '#F59E0B', fondo: '#FEF1DC' },
  DOCUMENTOS:  { icono: 'papel',   color: '#64748B', fondo: '#EEF2F7' },
}

export function seccionDe(segmento: string | null | undefined) {
  const clave = (segmento ?? '').toUpperCase()
  for (const nombre of Object.keys(SECCIONES)) {
    if (clave.startsWith(nombre)) return SECCIONES[nombre]
  }
  return SECCIONES.DOCUMENTOS
}

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
  return luz > 0.28 ? '#0F172A' : '#FFFFFF'
}

/** El morado del manual es demasiado oscuro para llevar texto encima. */
export const MORADO_CLARO = '#A78BFA'

/* ── El botón de volver ──────────────────────────────────
   Un chip con borde y con la palabra al lado de la flecha. Una
   flecha suelta se puede fallar al tocarla y no se ve que sea un
   botón; esto se ve, se lee y ocupa 48 px de alto. */
export function Volver({
  href,
  texto = 'Volver',
  oscuro = false,
}: {
  href: string
  texto?: string
  oscuro?: boolean
}) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex h-12 max-w-full items-center gap-1.5 rounded-full py-0 pl-3 pr-5 text-[16.5px] font-extrabold"
      style={
        oscuro
          ? { background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.18)', color: '#fff' }
          : {
              background: 'var(--t-superficie)',
              border: '1px solid var(--t-borde)',
              color: 'var(--t-tinta)',
            }
      }
    >
      <Ico nombre="atras" tam={21} grosor={2.6} />
      <span className="truncate">{texto}</span>
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
  '🧱': 'carpeta',
}

export function iconoDeEmoji(emoji: string | null | undefined): Icono {
  return POR_EMOJI[(emoji ?? '').trim()] ?? 'carpeta'
}
