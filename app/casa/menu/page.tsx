import Link from '@/app/enlace'
import { hoyAqui } from '@/lib/tablon'
import {
  elLunesDe,
  laSemanaDe,
  comoSeLlamaLaSemana,
  otraSemana,
  laSemanaEnPalabras,
} from '@/lib/menus'
import { laPared, lasListasDeCompra, losMenus } from '@/lib/pared'
import { Ico, type Icono } from '../../iconos'
import { AMBITO } from '../../piezas'
import { Nada, Rotulo } from '../rotulo'
import Recetas, { type Receta } from './recetas'
import Comida from './plato'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  EL MENÚ · qué se come esta semana
  ═══════════════════════════════════════════════════════════════

  Siete filas, comida y cena. La pregunta que contesta es la que se hace
  a las siete de la tarde delante de la nevera.

  ─────────────────────────────────────────────────────────────
  ⚠️  Y AQUÍ PONÍA QUE ESTO NO SE ESCRIBÍA

  Decía, literalmente: *«se mira, no se escribe. Y es una decisión, no
  una falta»*. El argumento era que teclear «lentejas con chorizo» de
  pie, con las manos mojadas, es peor que hacerlo sentado en el móvil.

  Haris: *«no se puede editar el tema del menú, y eso es importante»*.

  Lo curioso es que la salida ya estaba escrita en este mismo párrafo,
  tres líneas más abajo: *«elegir de un cajón de recetas ya escritas,
  que son tres toques y ninguna letra»*. O sea que el problema nunca
  fue escribir en una pared: era haber supuesto que poner la cena
  significaba escribir.

  Ahora el nombre del plato es un botón y abre `poner.tsx`. Sin SQL:
  `menus_escribir` pide `puedo_escribir(casa)`, y una pantalla de
  cocina no es `lector`. El permiso llevaba meses dado.

  ─────────────────────────────────────────────────────────────
  Y LOS DÍAS PASADOS NO SE ESCONDEN

  Se atenúan. Esconderlos dejaría la semana empezando el jueves, y
  entonces habría que leer los rótulos para saber dónde está uno. Es lo
  mismo que hace la pestaña de la Semana y por el mismo motivo.

  ─────────────────────────────────────────────────────────────
  Y AHORA TAMBIÉN LAS SEMANAS QUE VIENEN

  Haris: *«sería bueno que en la cocina para organizar las comidas se
  vieran también las semanas siguientes, y así poder organizarlo desde
  ese espacio»*.

  Enseñaba una sola semana, la de hoy, y eso dejaba la pared sirviendo
  para MIRAR lo que ya estaba decidido pero no para DECIDIRLO. Y el
  menú de la semana que viene no se piensa un lunes por la mañana: se
  piensa el domingo por la tarde, de pie en la cocina, que es
  exactamente cuando se está delante de esta pantalla y no del móvil.

  Va igual que el Calendario de la pared —`?lunes=` en la dirección,
  flechas de 60 px y un botón de vuelta— y a propósito: dos maneras
  distintas de cambiar de semana en la misma pared obligarían a
  aprender dos.

  ── Y por qué en la dirección y no en un estado ──

  Por lo mismo que las cinco pestañas: la vuelta automática a Hoy
  —`vuelve-a-hoy.tsx`, a los tres minutos sin tocarla— se lleva por
  delante también la semana en la que alguien dejó la pantalla. Si la
  semana viviera en un `useState`, habría que acordarse de reiniciarla
  aparte, y el día que alguien se olvidara la cocina amanecería
  enseñando el menú de dentro de un mes.

  ── Y hacia atrás también ──

  Podría parecer que las semanas pasadas no sirven para planificar.
  Sirven: la pregunta de verdad delante de la nevera es «¿qué pusimos
  la semana pasada?», que es como no repetir lentejas tres lunes
  seguidos.
*/

export default async function Menu({
  searchParams,
}: {
  searchParams: Promise<{ lunes?: string }>
}) {
  const { supabase, casa } = await laPared()

  const hoy = hoyAqui()

  /*
    Se valida la forma antes de usarla. Una fecha torcida —escrita a
    mano, o un enlace viejo— se ignora y se enseña esta semana, que es
    lo único que nunca está mal. Igual que en el Calendario.
  */
  const pedida = (await searchParams).lunes ?? ''
  const lunes = /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? elLunesDe(pedida) : elLunesDe(hoy)
  const dias = laSemanaDe(lunes)

  const estaSemana = lunes === elLunesDe(hoy)
  const enPalabras = laSemanaEnPalabras(lunes, hoy)

  const [menus, lasRecetas, listas] = await Promise.all([
    losMenus(supabase, casa, dias[0], dias[6]),
    /*
      El cajón de recetas de la casa. Envuelto como todo lo que puede no
      estar: sin el sql/48, la pantalla del menú no puede caerse por una
      columna de la derecha.
    */
    (async () => {
      try {
        const { data, error } = await supabase
          .from('recetas')
          .select('id, titulo, url, nota, ingredientes')
          .eq('hogar_id', casa)
          .order('creado_en', { ascending: false })
          .limit(40)

        /*
          Los ingredientes son del paso 80. Sin él, Postgres rechaza la
          consulta ENTERA y la pared se quedaría sin recetas por una
          casilla que todavía no existe. Se vuelve a pedir sin ellos.

          Es la misma red que en `/api/menus`, y por lo mismo: una
          columna nueva nunca puede ser obligatoria para lo que ya
          funcionaba.
        */
        if (error) {
          const segunda = await supabase
            .from('recetas')
            .select('id, titulo, url, nota')
            .eq('hogar_id', casa)
            .order('creado_en', { ascending: false })
            .limit(40)
          if (segunda.error) return []
          return (segunda.data ?? []) as Receta[]
        }
        return (data ?? []) as Receta[]
      } catch {
        return []
      }
    })(),
    /* Las listas de la compra, para poder mandarles lo que falte sin
       salir de la cocina. Envuelto: sin el sql/23 devuelve vacío y el
       paso de «¿a qué lista?» lo dice con palabras. */
    lasListasDeCompra(supabase, casa),
  ])

  /* Lo que lleva cada receta, para poder preguntarlo en su día. */
  const loQueLleva = new Map(
    lasRecetas.map((r) => [r.id, (r.ingredientes ?? []).filter((i) => (i ?? '').trim().length > 1)])
  )

  const hayAlguno = menus.some((m) => (m.que ?? '').trim().length > 0)

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between gap-8">
        <div className="flex items-baseline gap-5">
          <Rotulo>Qué se come</Rotulo>
          {/*
            Primero la palabra y después la fecha: «La semana que viene
            · Del 6 al 12 de octubre». La palabra se lee desde la
            puerta y la fecha se lee de cerca, y en ese orden ninguna
            de las dos estorba a la otra.

            Las semanas lejanas no tienen palabra —`laSemanaEnPalabras`
            devuelve nada— y entonces manda la fecha sola, que es lo
            honesto: «en siete semanas» no sitúa a nadie.
          */}
          <p className="text-[20px] font-extrabold text-tinta-suave">
            {enPalabras && !estaSemana && (
              <span className="text-tinta">{enPalabras} · </span>
            )}
            {comoSeLlamaLaSemana(lunes)}
          </p>
        </div>

        {/*
          ── ADELANTE Y ATRÁS ──

          Los mismos 60 px, el mismo redondeo y el mismo botón de vuelta
          que el Calendario de la pared. Se mira de pie, de paso y a
          veces con una mano ocupada.

          Y el del medio solo sale cuando hace falta: un «Esta semana»
          encendido estando ya en esta semana es un botón que no hace
          nada, y en una pared eso lo prueba todo el mundo una vez.
        */}
        <div className="flex shrink-0 items-center gap-3">
          <Flecha hacia={otraSemana(lunes, -1)} icono="atras" que="Semana anterior" />
          {!estaSemana && (
            <a
              href="/casa/menu"
              className="flex h-[60px] items-center rounded-full border border-borde bg-superficie px-6 text-[18px] font-extrabold text-tinta"
            >
              Esta semana
            </a>
          )}
          <Flecha hacia={otraSemana(lunes, 1)} icono="flecha" que="Semana siguiente" />
        </div>
      </div>

      <div className="mt-2 xl:grid xl:grid-cols-[1.35fr_1fr] xl:items-start xl:gap-12">
      <div>
      {/*
        ── Y LA SEMANA SE PINTA SIEMPRE, AUNQUE ESTÉ VACÍA ──

        Antes, una semana sin nada puesto enseñaba un cartel en lugar de
        los siete días. Tenía sentido cuando esto no se podía escribir;
        ahora era justo lo contrario de lo que hace falta — la semana
        vacía es cuando MÁS falta hacen los siete botones de «poner
        algo».

        El aviso se queda, arriba y en una línea: dice qué pasa sin
        quitar de en medio lo que hay que tocar.
      */}
      {/*
        Y el aviso dice DE QUÉ semana habla. Escribir «esta semana»
        mirando la que viene es decirle a alguien que está donde no
        está, y en una pantalla que vuelve sola a Hoy cada tres minutos
        eso se confunde enseguida.
      */}
      {!hayAlguno && (
        <div className="mt-6">
          <Nada>
            {estaSemana
              ? 'Esta semana no hay nada puesto todavía. Toca un día y ponlo.'
              : `${enPalabras ?? 'Esa semana'} no tiene nada puesto todavía. Toca un día y ponlo.`}
          </Nada>
        </div>
      )}

      <ul className="mt-5 space-y-2.5">
          {dias.map((dia) => {
            const esHoy = dia === hoy
            const pasado = dia < hoy
            /* En plural: desde el paso 85, en una comida caben varios
               platos. Vienen ya ordenados por cuándo se escribieron,
               que es el orden en que se comen. */
            const comida = menus.filter((m) => m.fecha === dia && m.momento === 'comida')
            const cena = menus.filter((m) => m.fecha === dia && m.momento === 'cena')

            return (
              <li
                key={dia}
                /*
                  Menos aire y menos radio: eran 28 de radio con 28 de
                  lado y 20 de alto, y con siete días eso se come la
                  pantalla entera antes de llegar al domingo. Los
                  pasados, además, a la mitad de fuerza: lo que se comió
                  el lunes ya no es una decisión.
                */
                className={`flex items-start gap-6 rounded-[22px] border px-6 py-3.5 ${
                  pasado ? 'opacity-40' : ''
                }`}
                style={{
                  background: esHoy
                    ? `color-mix(in srgb, ${AMBITO.arena} 8%, var(--t-superficie))`
                    : 'var(--t-superficie)',
                  borderColor: esHoy
                    ? `color-mix(in srgb, ${AMBITO.arena} 45%, transparent)`
                    : 'var(--t-borde)',
                  borderLeft: `6px solid ${esHoy ? AMBITO.arena : 'var(--t-borde)'}`,
                }}
              >
                {/*
                  ── EL DÍA, EN 104 PX EN VEZ DE 190 ──

                  Eran 190 px para escribir «MIÉRCOLES» y un número, o
                  sea casi un tercio del ancho de la fila ocupado por lo
                  único que ya se sabe. Ahora el día va en corto —«MIÉ»—
                  y el número al lado, en la misma línea.

                  Hoy es la excepción y se dice entero, con su color: es
                  la fila que se busca al pasar por la cocina, y una
                  franja de color a la izquierda no basta para
                  encontrarla de un vistazo desde la puerta.
                */}
                <span className="flex w-[104px] shrink-0 items-baseline gap-2">
                  <span
                    className="text-[15px] font-extrabold uppercase tracking-wider"
                    style={{ color: esHoy ? AMBITO.arena : 'var(--t-tenue)' }}
                  >
                    {esHoy ? 'Hoy' : nombreDelDia(dia).slice(0, 3)}
                  </span>
                  <span className="text-[25px] font-extrabold leading-none tabular-nums text-tinta">
                    {Number(dia.slice(8, 10))}
                  </span>
                </span>

                <Comida
                  etiqueta="Comida"
                  fecha={dia}
                  momento="comida"
                  platos={comida.map((m) => ({
                    id: m.id,
                    que: m.que ?? null,
                    momento: 'comida' as const,
                    fecha: dia,
                    comprobado_en: m.comprobado_en ?? null,
                    faltan: m.faltan ?? null,
                    receta_id: m.receta_id ?? null,
                    /* Lo que lleva, ya resuelto aqui: entre el servidor
                       y la pantalla solo pasan datos. */
                    ingredientes: loQueLleva.get(m.receta_id ?? '') ?? [],
                  }))}
                  listas={listas}
                  recetas={lasRecetas}
                  apagado={pasado}
                />
                <Comida
                  etiqueta="Cena"
                  fecha={dia}
                  momento="cena"
                  platos={cena.map((m) => ({
                    id: m.id,
                    que: m.que ?? null,
                    momento: 'cena' as const,
                    fecha: dia,
                    comprobado_en: m.comprobado_en ?? null,
                    faltan: m.faltan ?? null,
                    receta_id: m.receta_id ?? null,
                    /* Lo que lleva, ya resuelto aqui: entre el servidor
                       y la pantalla solo pasan datos. */
                    ingredientes: loQueLleva.get(m.receta_id ?? '') ?? [],
                  }))}
                  listas={listas}
                  recetas={lasRecetas}
                  apagado={pasado}
                />
            </li>
          )
        })}
      </ul>
      </div>

      {/*
        ── LAS RECETAS, A LA DERECHA ──

        Con su ventana encima: se toca una y se abre ahí mismo, sea un
        vídeo de YouTube o la página de donde salió.

        Es la cocina. Tener la receta en la pared en vez de en el móvil
        apoyado en la encimera con las manos llenas de harina es toda la
        diferencia — y es, probablemente, lo que más se va a usar de
        toda esta pantalla.

        De esa ventana no se sale: lo impone el `sandbox` del marco, que
        no lleva ni `allow-top-navigation` ni `allow-popups`. Está
        explicado en `lib/enlace-seguro.ts`.
      */}
      <div className="mt-12 xl:mt-0">
        <Recetas recetas={lasRecetas} />
      </div>
      </div>
    </section>
  )
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function nombreDelDia(iso: string): string {
  return DIAS[new Date(`${iso}T12:00:00`).getDay()]
}

/*
  Una flecha de semana. Es la misma que la del Calendario de la pared,
  copiada a propósito en vez de compartida: son dos pantallas con dos
  direcciones distintas, y sacarla a un archivo común obligaría a
  pasarle el camino como parámetro para ahorrar doce renglones.

  El dibujo va solo, que es la única excepción de MAPPEL a «un dibujo
  nunca va solo», y se paga con el `aria-label`: dos flechas a los
  lados de una fecha son el idioma de cualquier calendario, y escribir
  «Semana siguiente» al lado de cada una le robaría a la fecha el sitio
  que necesita.
*/
function Flecha({ hacia, icono, que }: { hacia: string; icono: Icono; que: string }) {
  return (
    <Link
      href={`/casa/menu?lunes=${hacia}`}
      aria-label={que}
      title={que}
      className="tocable flex h-[60px] w-[60px] items-center justify-center rounded-full border border-borde bg-superficie text-tinta"
    >
      <Ico nombre={icono} tam={26} grosor={2.3} />
    </Link>
  )
}
