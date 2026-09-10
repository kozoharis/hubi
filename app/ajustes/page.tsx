import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { clienteServidor } from '@/lib/supabase/servidor'
import BotonSalir from '../boton-salir'
import Barra from '../barra'
import Cabecera from '../cabecera'
import { Ico, Logo, Volver, type Icono } from '../iconos'
import { ambitoDe, AMBITO, type Ambito, PastillaAmbito, Pildora } from '../piezas'
import SelectorTema from '../tema'
import { leerPerfil } from '@/lib/perfil'
import { miHogar, mandaEnSuCasa } from '@/lib/hogar'
import { planDeLaCasa, type Rutina } from '@/lib/rutinas'
import { colorApagado } from '@/lib/gente'
import TuPerfil from './foto'
import NuevaActividad from './nueva-actividad'
import Gente, { type Vecino } from './gente'
import Carpetas, { type Carpeta } from './carpetas'
import Compra from './compra'
import ImpuestoDeLaCasa from './impuesto'
import { esImpuesto, type Impuesto } from '@/lib/impuesto'
import MiCalendario from './mi-calendario'

export const dynamic = 'force-dynamic'

/*
  Ajustes.

  Ya no es una pestaña: se entra tocando la inicial de arriba a la
  derecha en Inicio. Así las cinco pestañas de abajo son secciones de
  verdad y ningún ajuste ocupa sitio.
*/

/*
  ═══════════════════════════════════════════════════════════════
  AJUSTES, EN DOS · Fase 2
  ═══════════════════════════════════════════════════════════════

  Aquí había NUEVE bloques y unos veinticinco controles en una sola
  pantalla: tu nombre, la gente de la casa, el tema, los avisos, los
  papeles, Google, las carpetas, la compra, el impuesto, tu
  calendario, tus actividades y salir. Todo seguido, todo del mismo
  tamaño, y para llegar a lo último había que pasar por delante de
  todo lo demás.

  ─────────────────────────────────────────────────────────────
  EN DOS, NO EN TRES

  La nota de Fase 1 decía «partirlo en tres: Tú / La casa /
  Conexiones». Al mirar los contenidos uno por uno, eso no se sostiene:
  «Conexiones» es un cajón TÉCNICO, y además rompe por el sitio
  equivocado — el Drive es de la casa y tu calendario es tuyo, y los
  metería juntos por el único motivo de que los dos son de Google.

  Se parten en dos, y en dos que cualquiera hace sin pensar:

      TÚ         tu nombre y tu foto · cómo se ve · los avisos de
                 ESTE teléfono · tu calendario · salir
      LA CASA    quién vive aquí · el Drive · las carpetas · la
                 compra · el impuesto · tus actividades

  La regla que las separa es una sola: **lo de «Tú» solo te afecta a
  ti; lo de «La casa» lo notan los demás.** Cambiar el tema oscuro no
  se lo cambia a nadie más; apagar la lista de la compra sí.

  ─────────────────────────────────────────────────────────────
  Y NO CUESTA UN TOQUE MÁS

  Se pensó en una pantalla-índice con dos tarjetas, y eso sí cobra un
  toque a todo el mundo cada vez. Son dos píldoras arriba, las mismas
  que Semana/Mes en la Agenda: se entra directamente en «Tú» —que es
  donde está lo que más se toca— y «La casa» está al lado.
*/
export default async function Ajustes({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>
}) {
  const { ver } = await searchParams
  const enLaCasa = ver === 'casa'

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const perfil = await leerPerfil(supabase, user.id, user.email)

  /* De qué casa es quien mira esta pantalla. Todo lo de Google —el
     Drive conectado, el calendario— es de SU casa, no «el» de HUBI. */
  const hogarId = await miHogar(supabase, user.id)

  const admin = clienteServidor()
  const { data: conexion } = hogarId
    ? await admin
        .from('conexion_drive')
        .select('estado, email_cuenta')
        .eq('hogar_id', hogarId)
        .maybeSingle()
    : { data: null }

  const nombre = perfil.nombre

  /* ¿Tiene esta persona su calendario de Google volcado? Se mira si
     hay algo guardado, sin descifrarlo: la dirección no tiene por qué
     salir de `lib/agenda-google.ts` ni para esto. */
  const { data: mio } = await admin
    .from('perfiles')
    .select('ical_desde, ical_compartido')
    .eq('id', user.id)
    .maybeSingle()

  /* Con quién se compartiría. Si vive solo, el interruptor no se
     enseña: un ajuste para compartir con nadie es una pregunta sin
     sentido.

     Va con la SESIÓN y no con la clave de servidor. Con la clave de
     servidor no hay políticas: el «otro» que salía aquí podía ser
     cualquiera de HUBI, y esta pantalla le habría enseñado a alguien
     el nombre de pila de un desconocido. */
  const { data: otros } = await supabase
    .from('perfiles')
    .select('id, nombre')
    .neq('id', user.id)
    .limit(1)
  const elOtro = otros?.[0]?.nombre?.split(' ')[0] ?? null

  /*
    ── Las carpetas raíz de la casa, leídas UNA vez ──

    Las usan dos bloques de esta pantalla: el reparto de permisos, que
    necesita TODAS —también las actividades y las apagadas, porque una
    carpeta apagada sigue teniendo papeles dentro—, y la lista de «Tus
    carpetas», que enseña solo las que archivan.

    Leerlas dos veces serían dos viajes a la base de datos para pintar
    la misma pantalla.
  */
  const todasLasRaices: { id: string; nombre: string; icono: string; activa: boolean; cuentas: boolean }[] =
    []

  try {
    const { data: raices } = await supabase
      .from('categorias')
      .select('id, nombre, icono, activa, lleva_cuentas')
      .is('padre_id', null)
      .order('orden')

    for (const c of raices ?? []) {
      todasLasRaices.push({
        id: c.id as string,
        nombre: c.nombre as string,
        icono: (c.icono as string) || '📁',
        activa: c.activa !== false,
        cuentas: c.lleva_cuentas === true,
      })
    }
  } catch {
    /* Sin `lleva_cuentas` todavía. El resto de Ajustes sigue entero. */
  }

  /*
    ── Quién vive en esta casa ──

    Se lee con la SESIÓN: las políticas por hogar son justamente lo
    que hace que aquí salgan los de tu casa y no los de otra.

    Va envuelto porque `miembros` puede no existir todavía en una base
    de datos vieja, y una lista de gente que falla no puede dejar sin
    Ajustes —ni sin poder salir de la sesión— a quien entra.
  */
  const gente: Vecino[] = []

  try {
    /* `ve_todo` y `escribe_todo` son columnas nuevas. Si el SQL 33 no
       se ha ejecutado, Postgres rechaza la consulta ENTERA en vez de
       decir «esa columna no existe» — así que se pide aparte y con su
       propio respaldo. La misma trampa de siempre. */
    let filas: {
      perfil_id: string
      papel: string
      ve_todo?: boolean
      escribe_todo?: boolean
      aceptado_en?: string | null
      rol?: string | null
      acceso_hasta?: string | null
      color?: string | null
    }[] = []

    /*
      `.eq('hogar_id', …)` explícito, y no confiando en las políticas.

      Las políticas dejan ver también TUS filas en otras casas —hacen
      falta para que la pantalla de invitaciones funcione—, así que
      quien tenga dos casas se vería a sí mismo dos veces en esta
      lista. Aquí se pregunta por los de ESTA casa.
    */
    const conPermisos = hogarId
      ? await supabase
          .from('miembros')
          .select('perfil_id, papel, ve_todo, escribe_todo, aceptado_en, rol, acceso_hasta, color')
          .eq('hogar_id', hogarId)
          .order('unido_en')
      : { data: [], error: null }

    if (conPermisos.error) {
      const basico = hogarId
        ? await supabase
            .from('miembros')
            .select('perfil_id, papel')
            .eq('hogar_id', hogarId)
            .order('unido_en')
        : { data: [] }
      filas = (basico.data ?? []) as typeof filas
    } else {
      filas = (conPermisos.data ?? []) as typeof filas
    }

    const ids = filas.map((m) => m.perfil_id as string)

    if (ids.length > 0) {
      const { data: quienes } = await supabase
        .from('perfiles')
        .select('id, nombre')
        .in('id', ids)

      const nombreDe = new Map((quienes ?? []).map((p) => [p.id as string, p.nombre as string]))

      /* Lo concedido carpeta a carpeta. Envuelto aparte: la tabla es
         nueva y su ausencia no puede dejar sin Ajustes a nadie. */
      const concedido = new Map<string, { ver: boolean; escribir: boolean }>()
      try {
        const { data: permisos } = await supabase
          .from('permisos_carpeta')
          .select('perfil_id, categoria_id, ver, escribir')

        for (const p of permisos ?? []) {
          concedido.set(`${p.perfil_id}·${p.categoria_id}`, {
            ver: p.ver === true,
            escribir: p.escribir === true,
          })
        }
      } catch {
        /* Sin la tabla todavía: todo el mundo lo ve todo, como hasta hoy. */
      }

      /* TODAS las raíces, también las apagadas: una carpeta apagada
         sigue teniendo papeles dentro y su permiso sigue contando. */
      const raices = todasLasRaices

      for (const m of filas) {
        const id = m.perfil_id as string
        gente.push({
          id,
          nombre: nombreDe.get(id) ?? 'Alguien',
          manda: m.papel === 'propietario',
          soloMira: m.papel === 'lector',
          soyYo: id === user.id,
          /* Invitado pero todavía sin contestar. Sin esto, quien
             invita ve a Marta en la lista y da por hecho que ya está
             dentro — y luego se extraña de que no vea nada. */
          pendiente: m.aceptado_en === null,
          rol: m.rol ?? null,
          hasta: m.acceso_hasta ?? null,
          /* Sin la columna del SQL 39, el de su papel. Se pierde poder
             distinguir a dos personas del mismo papel, pero la lista
             sale con color igual. Y lo guardado se traduce a la paleta
             apagada: los colores de antes incluían el de acción. */
          color: colorApagado(m.color, m.rol),
          veTodo: m.ve_todo !== false,
          escribeTodo: m.escribe_todo !== false,
          carpetas: raices.map((r) => {
            const suyo = concedido.get(`${id}·${r.id}`)
            return {
              id: r.id,
              nombre: r.nombre,
              icono: r.icono,
              ver: suyo?.ver ?? false,
              escribir: suyo?.escribir ?? false,
            }
          }),
        })
      }
    }
  } catch {
    /* Sin la tabla todavía. El resto de Ajustes sigue entero. */
  }

  /*
    ── Las secciones que se dividen, con lo que tienen dentro ──

    Todo esto va envuelto para que no pueda tumbar Ajustes. `unidades`
    y `palabra_unidad` son cosas nuevas: si el SQL todavía no se ha
    ejecutado, Postgres no falla «esa columna» — rechaza la consulta
    entera. Y una pantalla de Ajustes en blanco deja a la persona sin
    poder ni siquiera salir de la sesión.

    Se lee con la SESIÓN y no con la clave de servidor: las unidades
    son del hogar de quien ha entrado, y las políticas por hogar son
    justamente lo que impide ver las de otra casa.
  */
  const conUnidades: {
    id: string
    nombre: string
    /* Su carpeta de Drive, que es de donde sale su color. Antes se
       llevaban el `color` y el `fondo` guardados en la fila, que son
       los de la paleta vieja. */
    segmento: string | null
    pie: string
  }[] = []

  try {
    /* TODAS las actividades, se dividan o no. Antes solo salían las
       divididas, y por eso la Finca no aparecía por ningún lado: no
       había manera de decirle a HUBI «ésta también quiero llevarla
       por partes». El interruptor está ahora dentro de cada una. */
    const { data: secciones } = await supabase
      .from('categorias')
      .select('id, nombre, segmento_drive, usa_unidades, palabra_unidad')
      .is('padre_id', null)
      .eq('lleva_cuentas', true)
      .eq('activa', true)
      .order('orden')

    for (const s of secciones ?? []) {
      const divide = s.usa_unidades === true
      const palabra = ((s.palabra_unidad as string | null) ?? '').replace(
        /^(el|la|los|las)\s+/i,
        ''
      )

      conUnidades.push({
        id: s.id as string,
        nombre: s.nombre as string,
        segmento: (s.segmento_drive as string | null) ?? null,
        pie: divide
          ? `Por ${palabra || 'partes'} · partidas`
          : 'Una sola · partidas',
      })
    }
  } catch {
    /* Sin unidades todavía. Ajustes sigue funcionando entero. */
  }

  /*
    ── Las carpetas que solo guardan papeles ──

    Las de cuentas van aparte, en «Tus actividades». Aquí solo las que
    archivan: Casa, Salud, Vehículos… Se leen APAGADAS TAMBIÉN, que es
    lo único que permite volver a encenderlas.
  */
  const carpetas: Carpeta[] = []

  try {
    const soloPapeles = todasLasRaices.filter((c) => !c.cuentas)

    /* Cuántos papeles tiene cada una. De una vez para todas: con ocho
       carpetas, una consulta por cada una serían ocho viajes a la base
       de datos para pintar una pantalla. */
    const cuenta = new Map<string, number>()

    if (soloPapeles.length > 0) {
      const { data: todas } = await supabase.from('categorias').select('id, padre_id')
      const { data: papeles } = await supabase.from('documentos').select('categoria_id')

      /* De qué raíz cuelga cada categoría. */
      const padre = new Map((todas ?? []).map((c) => [c.id as string, c.padre_id as string | null]))
      const raizDe = (id: string): string | null => {
        let actual: string | null = id
        for (let i = 0; i < 8 && actual; i++) {
          const arriba: string | null = padre.get(actual) ?? null
          if (!arriba) return actual
          actual = arriba
        }
        return actual
      }

      for (const d of papeles ?? []) {
        const r = d.categoria_id ? raizDe(d.categoria_id as string) : null
        if (r) cuenta.set(r, (cuenta.get(r) ?? 0) + 1)
      }
    }

    for (const c of soloPapeles) {
      carpetas.push({
        id: c.id,
        nombre: c.nombre,
        icono: c.icono,
        activa: c.activa,
        papeles: cuenta.get(c.id) ?? 0,
      })
    }
  } catch {
    /* Sin carpetas todavía. Ajustes sigue entero. */
  }

  /* ¿Usa la lista de la compra? Envuelto: la columna es nueva y, si
     el SQL 32 no se ha ejecutado, Postgres rechaza la consulta entera
     en vez de decir «esa columna no existe». */
  let usaCompra = true
  let impuesto: Impuesto = 'ninguno'
  try {
    /* Nunca `.eq('id', hogarId ?? '')`: la cadena vacía no es un
       identificador válido y Postgres rechazaría la consulta entera,
       en silencio. */
    if (hogarId) {
      /* En dos intentos: `impuesto` es del SQL 46 y no puede tumbar la
         lectura de `usa_compra`, que funciona desde el 32. */
      let casa: { usa_compra?: boolean; impuesto?: string } | null = null

      const con = await supabase
        .from('hogares')
        .select('usa_compra, impuesto')
        .eq('id', hogarId)
        .maybeSingle()

      if (con.error) {
        const sin = await supabase
          .from('hogares')
          .select('usa_compra')
          .eq('id', hogarId)
          .maybeSingle()
        casa = sin.data
      } else casa = con.data

      if (casa && casa.usa_compra === false) usaCompra = false
      if (casa && esImpuesto(casa.impuesto)) impuesto = casa.impuesto
    }
  } catch {
    /* Sin la columna todavía: se comporta como siempre. */
  }

  const icalDesde = mio?.ical_desde
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(
        new Date(mio.ical_desde as string)
      )
    : null

  const conectado = conexion?.estado === 'activa'

  /* Quien creó la casa: es quien puede invitar, y quien conecta
     Google desde su propia pantalla. */
  const manda = await mandaEnSuCasa(supabase, user.id)

  /*
    ── El plan de la semana de la casa ──

    Se lee entero y una vez, y cada persona verá el suyo dentro de su
    ficha. Pedirlo al abrir cada semana sería un viaje a la base de
    datos por cada toque en el calendario de una fila.

    `planDeLaCasa` ya viene envuelto: sin las tablas del SQL 38
    devuelve una lista vacía y nadie se queda sin Ajustes por eso.
  */
  const plan: Rutina[] = manda ? await planDeLaCasa(supabase) : []


  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href="/" />

        <h1 className="t-titulo">Ajustes</h1>

        <div className="mt-2 flex gap-2" role="group" aria-label="Qué ajustes">
          <Pildora href="/ajustes" puesta={!enLaCasa} className="flex-1">
            Tú
          </Pildora>
          <Pildora href="/ajustes?ver=casa" puesta={enLaCasa} className="flex-1">
            La casa
          </Pildora>
        </div>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-1">

        {/* ══════════════ TÚ ══════════════ */}
        {!enLaCasa && (
          <>
        {/* ── Quién eres ── */}
        <div className="mt-3">
          <TuPerfil nombre={nombre} foto={perfil.foto} />
        </div>

        {/*
          ── CÓMO SE USA HUBI ──

          Estaba abajo del todo, encima de «Salir», con el
          razonamiento de que es donde se busca la ayuda en casi
          cualquier aplicación. Y es verdad —para quien la BUSCA.

          El problema es el otro: quien no sabe que existe. Ése no
          baja hasta el final de una pantalla de ajustes, porque no
          sabe que hay nada que encontrar. Y es exactamente la persona
          para la que se hizo.

          Se llamaba «Cómo se hace», que no dice de qué. Ahora lleva
          el objeto puesto y se ve: es lo primero de «Tú» después de
          tu nombre, con el símbolo delante y en su propio color, no
          una fila más entre las filas.

          Y sin el vídeo dentro, a propósito. Un vídeo de treinta
          segundos moviéndose en la pantalla de ajustes es algo que
          quien ya sabe usar HUBI se traga cada vez que entra a
          cambiar el tema.
        */}
        <Link
          href="/como-se-hace"
          className="tocable mt-4 flex items-center gap-3.5 rounded-[20px] border px-4 py-4"
          style={{
            borderColor: `${AMBITO.azul}59`,
            background: `${AMBITO.azul}14`,
          }}
        >
          <Logo tam={40} />
          <span className="min-w-0 flex-1">
            <span className="block text-[19px] font-extrabold leading-snug tracking-tight">
              Cómo se usa HUBI
            </span>
            <span className="t-apoyo mt-1 block">
              Un vídeo corto de cada cosa que sabe hacer
            </span>
          </span>
          <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0" />
        </Link>

        {/* ── Cómo se ve ── */}
        <h2 className="rotulo mt-5">Cómo se ve</h2>
        <div className="mt-2.5">
          <SelectorTema />
        </div>

        {/* ── Los avisos de ESTE teléfono ── */}
        <h2 className="rotulo mt-5">Tus avisos</h2>
        <div className="mt-2.5 space-y-2.5">
          <Opcion
            href="/avisos"
            icono="campana"
            ambito="arena"
            titulo="Avisos en el móvil"
            pie="Recordatorios y vencimientos"
          />
        </div>

        {/*
          ── AQUÍ ESTABA «LOS PAPELES», Y SE HA IDO ──

          Era un enlace a `/documentos`. Y `/documentos` es una de las
          CINCO PESTAÑAS de la barra desde la Fase 2: está siempre
          abajo, en todas las pantallas, a un toque. Una fila en
          Ajustes para llegar a algo que ya tienes debajo del pulgar no
          es un ajuste, es un rodeo.
        */}

        {/* ── Tu calendario de Google ── */}
        {/*
          Va en «Tú» y no en «La casa»: esto lo hace cada uno con SU
          calendario, y cada uno ve solo el suyo. El calendario personal
          de alguien no se le enseña al otro porque sí — si lo quieren
          compartir, Google Calendar sirve para eso y es su decisión,
          no la nuestra.
        */}
        <h2 className="rotulo mt-5">Tu calendario</h2>
        <div className="mt-2.5">
          <MiCalendario
            conectado={Boolean(mio?.ical_desde)}
            desde={icalDesde}
            compartido={mio?.ical_compartido === true}
            elOtro={elOtro}
          />
        </div>

        {/* ── Y la puerta de salida, al final de lo tuyo ── */}
        <div className="mt-8 border-t border-borde pt-6">
          <BotonSalir />
        </div>
          </>
        )}

        {/* ══════════════ LA CASA ══════════════ */}
        {enLaCasa && (
          <>
        {/* ── Quién vive aquí ── */}
        {/*
          Va lo primero. Es la respuesta a la pregunta que más importa
          de toda esta pantalla: quién más ve mis facturas y mis
          informes.
        */}
        {gente.length > 0 && (
          <>
            <h2 className="rotulo mt-3">Quién vive aquí</h2>
            <div className="mt-2.5">
              <Gente gente={gente} puedoInvitar={manda} plan={plan} />
            </div>
          </>
        )}

        {/* ── Dónde se guardan los papeles ── */}
        <h2 className="rotulo mt-5">Dónde se guarda todo</h2>
        <div className="mt-2.5 space-y-2.5">
          {/*
            UNA SOLA FILA PARA GOOGLE.

            Aquí había TRES seguidas —«Google Drive», «Volver a
            conectar Google» y «Calendario en Google»— diciendo casi lo
            mismo, y la primera llevaba a la pantalla de diagnóstico,
            que es una herramienta de mantenimiento y no un ajuste.
          */}
          <Opcion
            href="/ajustes/google"
            icono="escudo"
            ambito="azul"
            titulo="Google"
            pie={
              conectado
                ? `Conectado · ${conexion?.email_cuenta ?? 'la cuenta de tu casa'}`
                : manda
                  ? 'Sin conectar · hace falta para guardar papeles'
                  : `Lo conecta ${elOtro ?? 'quien creó esta casa'}`
            }
            bien={conectado}
          />
        </div>

        {/* ── Tus carpetas ── */}
        {/*
          Las que solo guardan papeles. Las actividades —con sus
          cuentas— van más abajo y en su propio apartado: son dos cosas
          distintas y mezclarlas obligaría a mirar dos veces cada
          nombre para saber cuál es cuál.
        */}
        {carpetas.length > 0 && (
          <>
            <h2 className="rotulo mt-5">Tus carpetas</h2>
            <p className="mt-1 text-[14.5px] font-semibold leading-snug text-tenue">
              Donde se guardan los papeles. Apaga las que no uses y añade las que te falten.
            </p>
            <div className="mt-2.5">
              <Carpetas carpetas={carpetas} />
            </div>
          </>
        )}

        {/* ── Lo que además usas ── */}
        <h2 className="rotulo mt-5">La lista de la compra</h2>
        <div className="mt-2.5">
          <Compra puesta={usaCompra} />

          <div className="mt-3">
            <ImpuestoDeLaCasa puesto={impuesto} />
          </div>
        </div>

        {/*
          ── Lo que hay dentro de cada sección ──

          Solo sale si alguna sección se divide. Una casa que no tenga
          apartamentos, obras ni pisos no ve nada de esto: el punto 5
          pide pocas decisiones por pantalla, y un apartado vacío es
          una decisión que alguien tiene que descartar cada vez que
          pasa por aquí.
        */}
        {/*
          Este apartado sale SIEMPRE, tenga o no actividades. Antes
          solo aparecía si ya había alguna, y eso dejaba a una casa
          recién creada sin ninguna forma de añadir la primera: para
          tener una actividad había que tener ya una actividad.
        */}
        <h2 className="rotulo mt-5">Tus actividades</h2>
        <p className="mt-1 text-[14.5px] font-semibold leading-snug text-tenue">
          Una finca, unas obras, unos pisos… lo que tenga sus propios gastos e
          ingresos.
        </p>
        <div className="mt-2.5 space-y-2.5">
          {conUnidades.map((s) => (
            <Opcion
              key={s.id}
              href={`/seccion/${s.id}/ajustes`}
              icono="euro"
              ambito={ambitoDe(s.segmento)}
              titulo={s.nombre}
              pie={s.pie}
            />
          ))}
          <NuevaActividad />
        </div>
          </>
        )}

        <p className="mt-6 text-center text-[14.5px] font-semibold text-tenue">
          <Link href="/privacidad">Privacidad</Link>
          {' · '}
          <Link href="/terminos">Términos</Link>
        </p>
      </div>

      <Barra voz={false} />
    </main>
  )
}

/*
  Esta fila se me quedó a medias al migrar Ajustes: usaba `Opcion` del
  sistema para el texto pero seguía pidiendo `color` y `fondo` en
  hexadecimal, y por ahí se colaban el `#14B8A6` de acción y el ámbar
  vivo. Ahora habla en ámbitos, como el resto.
*/
function Opcion({
  href,
  icono,
  ambito = 'pizarra',
  titulo,
  pie,
  bien = false,
}: {
  href: string
  icono: Icono
  ambito?: Ambito
  titulo: string
  pie: string
  bien?: boolean
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[20px] border border-borde bg-superficie px-3.5 py-3"
    >
      <PastillaAmbito icono={icono} ambito={ambito} tam={44} />
      <span className="min-w-0 flex-1">
        <span className="t-tarjeta block truncate">{titulo}</span>
        {/* `text-verde` era el verde de sección. «Conectado» es un
            estado, y va con el color de estado. */}
        <span
          className="t-apoyo mt-0.5 block"
          style={bien ? { color: 'var(--t-bien)' } : undefined}
        >
          {pie}
        </span>
      </span>
      <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0" />
    </Link>
  )
}
