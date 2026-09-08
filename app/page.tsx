import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { clienteServidor } from '@/lib/supabase/servidor'
import Barra from './barra'
import Arranque from './arranque'
import Invitacion from './invitacion'
import SinAvisos from './sin-avisos'
import Cabecera from './cabecera'
import { BotonAjustes, Ico, Logo, Pastilla, pintaDe } from './iconos'
import Avatar from './avatar'
import { cuando, type Recordatorio } from '@/lib/tablon'
import { leerPerfil } from '@/lib/perfil'
import { miHogar, mandaEnSuCasa, quienManda } from '@/lib/hogar'
import { casasDe } from '@/lib/casas'
import { cuantasNotas, paraMi, cuandoSePuso } from '@/lib/notas'
import { gastadoEnCasa } from '@/lib/gastos-casa'
import { queVeEnInicio } from '@/lib/roles'
import { eurosRedondo } from '@/lib/periodos'
import { loDeHoy } from '@/lib/rutinas'
import { genteDeLaCasa, elAsesor } from '@/lib/gente'
import Casas from './casas'
import { type Deber } from './rutinas-hoy'

export const dynamic = 'force-dynamic'

function saludo() {
  const hora = new Date().getHours()
  if (hora < 6) return 'Buenas noches'
  if (hora < 14) return 'Buenos días'
  if (hora < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

function hoyEnPalabras() {
  const f = new Date()
  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${dias[f.getDay()]}, ${f.getDate()} de ${meses[f.getMonth()]}`
}

const AVISOS: Record<string, { texto: string; bien: boolean }> = {
  conectado: { texto: 'Google Drive conectado correctamente.', bien: true },
  cancelado: { texto: 'No se ha dado el permiso. Puedes intentarlo otra vez.', bien: false },
  /* Sin nombres escritos a mano: quien conecta el Drive es distinto
     en cada casa, y en la de al lado «Juan Miguel» no significa nada. */
  'no-eres-tu': {
    texto: 'El Drive lo conecta quien creó esta casa: la cuenta de Google es suya.',
    bien: false,
  },
  'sin-casa': {
    texto: 'Tu cuenta todavía no está en ninguna casa. Avisa a quien te invitó.',
    bien: false,
  },
  'sin-permiso': {
    texto:
      'Google no ha devuelto un permiso duradero. Entra en la cuenta de Google, quita el acceso de HUBI y vuelve a conectarlo.',
    bien: false,
  },
  estado: { texto: 'La conexión se ha interrumpido por seguridad. Inténtalo de nuevo.', bien: false },
  error: { texto: 'Algo ha fallado al conectar con Google. Inténtalo de nuevo.', bien: false },
}

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>
}) {
  const { drive: avisoClave } = await searchParams
  const aviso = avisoClave ? AVISOS[avisoClave] : null

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const hoyISO = new Date().toISOString().slice(0, 10)

  // Lo que viene: los próximos 60 días.
  const dentroDe60 = new Date()
  dentroDe60.setDate(dentroDe60.getDate() + 60)

  const admin = clienteServidor()

  /*
    ── ¿TIENE CASA? ──

    Quien entra sin hogar no ve NADA: todas las políticas de la base
    de datos dicen `hogar_id = mi_hogar()`, así que cada consulta le
    devuelve cero filas. Y un HUBI completamente vacío, con sus cinco
    pestañas y ni un dato, no parece una casa nueva: parece una
    aplicación rota.

    Se le lleva a crear la suya, que es lo que de verdad le falta.
  */
  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) redirect('/empezar')

  /* En cuántas casas está, y si le han invitado a alguna. Con una sola
     —o sea, casi siempre— esto no pinta nada en la pantalla. */
  const casas = await casasDe(supabase, user.id)

  const CAMPOS =
    'id, titulo, tipo, asignado_a, creado_por, fecha, hora, estado, nota, documento_origen_id'

  /*
    Las cinco consultas, a la vez.

    Antes iban una detrás de otra, y ninguna necesitaba el resultado de
    la anterior: eran cuatro viajes de ida y vuelta a la base de datos
    puestos en fila por costumbre, no por necesidad. En un móvil, con
    la base de datos al otro lado, eso son cuatro esperas donde bastaba
    con una.
  */
  const [
    perfil,
    { data: pendientes },
    { data: siguientes },
    { data: conexion },
    { count: porComprar },
    notasPuestas,
    gastoCasa,
    { data: ultimoPapel, count: cuantosPapeles },
  ] =
    await Promise.all([
      leerPerfil(supabase, user.id, user.email),

      // Lo de hoy y lo que se quedó atrás: nada más. El inicio no es una lista.
      supabase
        .from('recordatorios')
        .select(CAMPOS)
        .eq('estado', 'pendiente')
        .lte('fecha', hoyISO)
        .order('hora', { ascending: true, nullsFirst: true })
        .limit(4),

      supabase
        .from('recordatorios')
        .select(CAMPOS)
        .eq('estado', 'pendiente')
        .gt('fecha', hoyISO)
        .lte('fecha', dentroDe60.toISOString().slice(0, 10))
        .order('fecha', { ascending: true })
        .limit(3),

      hogarId
        ? admin.from('conexion_drive').select('estado').eq('hogar_id', hogarId).maybeSingle()
        : Promise.resolve({ data: null }),

      /* Cuántas cosas faltan. Solo el número: la lista entera se ve
         al entrar, y el inicio no es una lista. */
      supabase
        .from('compra')
        .select('id', { count: 'exact', head: true })
        .eq('comprado', false)
        .is('archivado_en', null),

      /* Las notas del corcho, y cuántas te están esperando a ti. */
      cuantasNotas(supabase, user.id),

      /* Lo que se va este trimestre fuera de las actividades, y en qué. */
      gastadoEnCasa(supabase),

      /*
        Cuántos papeles hay guardados y cuándo fue el último.

        No es adorno: la tarjeta de «Guardar documento» era la única
        del Inicio que no decía NADA de lo que hay dentro. Y es
        justamente donde más tranquiliza saberlo — quien guarda una
        factura y no vuelve a verla nunca acaba dudando de si se
        guardó. «34 papeles · el último, hace 2 días» contesta esa
        duda sin entrar.
      */
      supabase
        .from('documentos')
        .select('creado_en', { count: 'exact' })
        .is('eliminado_en', null)
        .order('creado_en', { ascending: false })
        .limit(1),
    ])

  /* ¿Esta casa usa la lista de la compra? Envuelto: la columna es
     nueva y, si el SQL 32 no se ha ejecutado, Postgres rechaza la
     consulta entera en vez de decir «esa columna no existe». */
  let usaCompra = true
  try {
    const { data: casa } = await supabase
      .from('hogares')
      .select('usa_compra')
      .eq('id', hogarId)
      .maybeSingle()
    if (casa && casa.usa_compra === false) usaCompra = false
  } catch {
    /* Sin la columna todavía: se comporta como siempre. */
  }

  const hoy = (pendientes ?? []) as Recordatorio[]
  const proximos = (siguientes ?? []) as Recordatorio[]

  const nombre = perfil.nombre

  /*
    ── QUÉ LE ENSEÑA HUBI A ESTA PERSONA ──

    Y esto es lo que de verdad cambia con los roles, más que los
    permisos. A quien ayuda en casa, HUBI no le abre en «Cuentas de
    casa» y «Papeles»: le abre en lo de hoy y la compra. El permiso
    evita que vea algo; la pantalla hace que encuentre lo suyo en un
    segundo.

    OJO: esto es lo que se OFRECE, no lo que protege. Lo que no puede
    ver sigue sin poder verlo aunque escriba la dirección a mano — de
    eso se encargan las políticas de la base de datos, y así tiene que
    seguir siendo. Esconder un botón nunca es una medida de seguridad.

    Envuelto: `rol` es del SQL 37. Sin él, todo el mundo ve lo de
    siempre.
  */
  let rol: string | null = null
  try {
    const { data: mio } = await supabase
      .from('miembros')
      .select('rol')
      .eq('perfil_id', user.id)
      .eq('hogar_id', hogarId)
      .maybeSingle()
    rol = (mio?.rol as string | null) ?? null
  } catch {
    /* Sin la columna: se comporta como antes. */
  }
  const ve = queVeEnInicio(rol)

  /*
    ── LO DE HOY: EL PLAN DE LA SEMANA ──

    Lo que toca hoy según lo que se programó una vez. A quien ayuda en
    casa se le enseña SOLO lo suyo —y lo de la casa que no tiene dueño,
    porque «sacar la basura» sin nombre es de quien esté—; a la familia
    se le enseña todo lo de hoy, con el nombre de quien lo tiene.

    Envuelto por dentro: sin las tablas del SQL 38, `loDeHoy` devuelve
    una lista vacía y aquí no sale la sección. Ninguna pantalla se
    rompe por eso.
  */
  const deberes: Deber[] = []

  try {
    const mias = rol === 'ayuda'
    const filas = await loDeHoy(supabase, mias ? user.id : null)

    if (filas.length > 0) {
      /* Los nombres, de una vez. Un viaje por cada rutina para poner
         «Marta» debajo de cada línea son seis viajes para pintar seis
         renglones. */
      const deQuienes = [...new Set(filas.map((r) => r.para).filter(Boolean))] as string[]

      const nombreDe = new Map<string, string>()
      if (!mias && deQuienes.length > 0) {
        const { data: quienes } = await supabase
          .from('perfiles')
          .select('id, nombre')
          .in('id', deQuienes)
        for (const p of quienes ?? []) {
          nombreDe.set(p.id as string, ((p.nombre as string) ?? '').split(' ')[0])
        }
      }

      for (const r of filas) {
        deberes.push({
          id: r.id,
          que: r.que,
          hora: r.hora,
          hecha: r.hecha,
          deQuien: r.para ? (nombreDe.get(r.para) ?? null) : null,
        })
      }
    }

  } catch {
    /* Sin las tablas todavía. El Inicio sigue entero. */
  }

  /*
    QUIÉN MANDA AQUÍ, Y CÓMO SE LLAMA.

    Antes era `perfil.es_propietario_drive`, una casilla global que
    solo tiene Juan Miguel — así que en cualquier otra casa NADIE veía
    el botón de conectar Drive, y a todos les salía el aviso de
    esperar a que lo conectara él.
  */
  const manda = await mandaEnSuCasa(supabase, user.id)
  const elJefe = manda || !hogarId ? null : await quienManda(supabase, hogarId)
  const conectado = conexion?.estado === 'activa'
  const caducado = conexion?.estado === 'caducada'

  /*
    ── EL ASESOR ──

    Si en esta casa hay un gestor, tiene su propio sitio en el Inicio.
    No es una tarjeta más: es la única persona de fuera con la que hay
    una conversación de ida y vuelta —«falta la factura de
    septiembre», «te la he subido»— y sin un sitio propio eso acaba en
    un WhatsApp que se pierde.

    Lo que se cuenta en la tarjeta es lo que TE ESTÁ ESPERANDO: sus
    avisos sin ver y las tareas que te ha puesto sin hacer. Un número
    que no baja nunca deja de mirarse.

    Y por el otro lado igual: cuando quien entra ES el asesor, la
    tarjeta le lleva al mismo sitio con el nombre de la casa.
  */
  let deLaGestoria: { nombre: string; color: string; esperando: number } | null = null
  /* Quien ayuda en casa, para poner su nombre y su color en la tarjeta
     del día. Se saca de la misma lectura de gente: pedirla dos veces
     sería un viaje de más para pintar la misma pantalla. */
  let deLaAyuda: { nombre: string; color: string } | null = null
  /** Las notas que te están esperando a ti, con quién las dejó. */
  const tuyas: { id: string; texto: string; de: string; color: string; cuando: string }[] = []

  try {
    const gente = await genteDeLaCasa(supabase, hogarId)
    const yoSoy = gente.find((g) => g.id === user.id)

    const ayuda = gente.find((g) => g.rol === 'ayuda' && !g.pendiente)
    if (ayuda) deLaAyuda = { nombre: ayuda.nombre.split(' ')[0], color: ayuda.color }

    /*
      ── LO QUE TE HAN DEJADO A TI ──

      Hasta ahora solo salía el número —«2 · una es para ti»—. Y un
      número no dice QUÉ te han dejado, así que había que entrar a
      mirarlo: una nota que hay que ir a buscar es una nota que a veces
      no se lee.

      Se leen aquí porque ya tenemos los nombres y los colores de la
      casa: pedirlos otra vez sería un viaje de más para pintar la
      misma pantalla.
    */
    if (ve.notas) {
      const suyas = await paraMi(supabase, user.id, 2)
      for (const n of suyas) {
        const dequien = gente.find((g) => g.id === n.escrita_por)
        tuyas.push({
          id: n.id,
          texto: n.texto,
          de: dequien?.nombre.split(' ')[0] ?? 'Alguien',
          color: dequien?.color ?? '#64748B',
          cuando: cuandoSePuso(n.creada_en),
        })
      }
    }

    const conQuien =
      yoSoy?.rol === 'asesor'
        ? (gente.find((g) => g.id !== user.id && g.rol !== 'asesor') ?? null)
        : elAsesor(gente)

    if (conQuien) {
      let esperando = 0

      /* Sus avisos que todavía no has abierto. Envuelto aparte: sin la
         tabla `notas` la tarjeta sale igual, con cero. */
      try {
        const { count } = await supabase
          .from('notas')
          .select('id', { count: 'exact', head: true })
          .eq('escrita_por', conQuien.id)
          .is('guardada_en', null)
          .is('vista_en', null)
        esperando += count ?? 0
      } catch {
        /* Sin notas: solo cuentan las tareas. */
      }

      const { count: suyas } = await supabase
        .from('recordatorios')
        .select('id', { count: 'exact', head: true })
        .eq('creado_por', conQuien.id)
        .eq('estado', 'pendiente')

      esperando += suyas ?? 0

      deLaGestoria = {
        nombre: conQuien.nombre.split(' ')[0],
        color: conQuien.color,
        esperando,
      }
    }
  } catch {
    /* Sin la columna `rol` todavía, o sin gente. El Inicio sigue entero. */
  }

  /*
    ── «LA CASA HOY» ES UNA TARJETA, NO UNA LISTA ──

    Estaba entera aquí: cinco líneas con sus casillas, debajo de las
    tarjetas. Y ocupaba media pantalla todos los días para decir algo
    que casi siempre se resume en «0 de 4» — mientras empujaba hacia
    abajo el médico de las diez, que es lo que de verdad hay que ver
    al abrir.

    Ahora es una tarjeta con el número, del color de quien tiene ese
    trabajo, y dentro está todo: las tareas, sus horas y lo que quiera
    contar del día. Cabe lo que necesite porque ya no compite con
    nada.

    Sigue arriba para quien ayuda en casa —es a lo que viene— y debajo
    de lo suyo para la familia.
  */
  const casaHoy =
    ve.agenda && deberes.length > 0
      ? {
          hechas: deberes.filter((d) => d.hecha).length,
          total: deberes.length,
          /* De quién es el día. Con el color de esa persona, que es
             el mismo con el que sale en la agenda y en el corcho. */
          nombre: deLaAyuda?.nombre ?? null,
          color: deLaAyuda?.color ?? '#0EA5E9',
        }
      : null

  return (
    <main className="relative min-h-screen pb-40">
      <Arranque />

      {/* El color, de borde a borde y siempre por detrás */}
      <div aria-hidden className="telon">
        <span className="mancha deriva-1" style={{ width: 300, height: 300, left: -110, top: -130, background: 'rgba(20,184,166,.30)' }} />
        <span className="mancha deriva-3" style={{ width: 280, height: 280, right: -110, top: -140, background: 'rgba(59,130,246,.26)' }} />
        <span className="mancha deriva-2" style={{ width: 260, height: 260, left: 110, top: -40, background: 'rgba(139,92,246,.18)' }} />
        <span className="mancha deriva-4" style={{ width: 300, height: 300, right: -130, bottom: -140, background: 'rgba(255,107,107,.12)' }} />
        <span
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom,' +
              'color-mix(in srgb, var(--t-fondo) 30%, transparent),' +
              'color-mix(in srgb, var(--t-fondo) 82%, transparent) 38%,' +
              'var(--t-fondo) 70%)',
          }}
        />
      </div>

      {/* ── Cabecera, clavada arriba ── */}
      <Cabecera>
        {/*
          ── ARRIBA: QUIÉN ERES, Y AJUSTES ──

          Antes la foto ERA el botón de ajustes, y eso no lo adivina
          nadie: una foto de perfil dice «este eres tú», no «toca aquí
          para configurar». Quien no lo supiera de antemano no
          encontraba los ajustes en toda la aplicación.

          Ahora son dos cosas distintas:

            · La foto solo dice quién está usando HUBI. Ya no se puede
              tocar, porque no llevaba a ningún sitio que se pudiera
              adivinar.
            · Al lado, un botón con la rueda Y la palabra «Ajustes».

          Con la palabra, no solo el dibujo. Es el punto 5 —«iconos
          siempre acompañados por texto»— y aquí se nota especialmente:
          la rueda la reconoce cualquiera que use el móvil a diario,
          pero no todo el mundo usa el móvil a diario.

          Se descartó la otra idea, la de animar la foto para que
          girase y enseñara una rueda de vez en cuando: un botón que
          solo se entiende si lo miras en el segundo correcto es un
          botón que a veces no existe. Y en una pantalla pensada para
          ir con prisa, eso es peor que no tener nada.
        */}
        <div className="flex h-14 items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Logo tam={36} />
            <span className="text-[22px] font-extrabold tracking-[0.09em]">HUBI</span>
          </span>

          {/*
            ── AJUSTES ──

            Se lee como se leen las pestañas de abajo: el dibujo
            arriba, la palabra debajo, sin caja. No es una decisión
            estética suelta — toda la navegación de HUBI ya habla ese
            idioma, y Ajustes ES lo mismo que ellas: un sitio al que
            se va. Que se parezca es lo honesto.

            Una píldora con el borde en degradado, del turquesa de la
            H al morado, y dentro los mandos, la palabra y la flecha.
            El dibujo del botón está en `iconos.tsx`, con el porqué de
            cada pieza.
          */}
          {/* El margen invisible arriba y abajo: la píldora se ve de 30
              px y se toca de 48. Ninguna pantalla de HUBI tiene algo
              pulsable por debajo de esa medida, y este botón no iba a
              ser la excepción por quedar más fino. Al bajar de 34 a 30
              el relleno sube de 7 a 9: lo que encoge es el dibujo, no
              la zona donde cae el dedo. */}
          <Link href="/ajustes" className="-mr-1 shrink-0 py-[9px] pl-2">
            <BotonAjustes />
          </Link>
        </div>
      </Cabecera>

      <div className="relative z-10 mx-auto w-full max-w-md px-5 pt-1">
        {/* ── En qué casa estás, y las que te han ofrecido ── */}
        {/* Va lo primero, encima del saludo del día: si alguien te ha
            dado acceso a los papeles de su casa, eso no puede quedar
            debajo de la lista de la compra. */}
        <Casas casas={casas} />

        {/* ── Saludo ── */}
        {/*
          ── EL SALUDO, CON LA FOTO ──

          La foto estaba arriba, pegada al logo, y ahí no decía nada:
          era un adorno al lado de una marca. Aquí sí — «Buenas tardes,
          Haris» y su cara son la misma frase, y de un vistazo se sabe
          con qué cuenta se ha entrado, que en una casa donde dos
          personas comparten el mismo iPad no es un detalle.
        */}
        <div className="mt-2.5 flex items-center gap-3">
          <Avatar nombre={nombre} foto={perfil.foto} tam={52} />
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-bold text-tenue">{hoyEnPalabras()}</p>
            {/* Nunca "Buenas tardes," a secas: si no hubiera nombre, se
                saluda sin coma y punto. Una frase colgando hace dudar de
                todo lo que viene debajo. */}
            <h1 className="mt-0.5 text-[24px] font-extrabold leading-tight tracking-tight">
              {nombre ? `${saludo()}, ${nombre}` : saludo()}
            </h1>
          </div>
        </div>

        {/*
          ── PARA QUÉ ESTÁS AQUÍ ──

          Solo a quien no es de la familia. Una empleada o un gestor
          entran en la casa de OTRO: sin una línea que lo diga, la
          pantalla parece a medio cargar —«¿y lo demás?»— cuando en
          realidad está completa.

          Y al asesor le hace más falta que a nadie: su Inicio no lleva
          ninguna tarjeta, porque lo suyo son las cuentas y ésas están
          en las pestañas de abajo.
        */}
        {rol && rol !== 'familia' && (
          <p className="mt-4 rounded-[18px] border border-borde bg-superficie px-4 py-3.5 text-[15.5px] font-semibold leading-snug text-tinta-suave">
            {rol === 'ayuda'
              ? 'Aquí tienes lo que te han encargado y la lista de la compra. El ticket del súper se guarda desde la propia compra.'
              : rol === 'asesor'
                ? 'Tienes acceso a las cuentas y a los papeles de las actividades de esta casa. Están abajo. No puedes cambiar nada.'
                : 'Puedes ver las cosas de esta casa, pero no cambiar nada.'}
          </p>
        )}

        {conectado && <Invitacion />}

        {aviso && (
          <p
            className={`mt-5 rounded-2xl px-5 py-4 text-[17px] font-medium leading-snug ${
              aviso.bien ? 'bg-verde-suave text-verde' : 'bg-coral-suave text-coral'
            }`}
          >
            {aviso.texto}
          </p>
        )}

        {/*
          ═══════════════════════════════════════════════════════
          EL MOSAICO
          ═══════════════════════════════════════════════════════

          Eran cuatro filas idénticas de 74 px. Se entendían —eso
          nunca fue el problema— pero pesaban todas lo mismo, y en una
          pantalla donde todo pesa igual no hay nada que mirar
          primero: hay que leerse las cuatro.

          Ahora la FORMA dice la importancia, que es lo que hace un
          mosaico bien hecho:

            ancha    Guardar documento — el punto 6 la quiere sola
            cuadrado La compra · Notas — dos cosas del día a día
            ancha    Cuentas de casa — para que el número sea grande

          ─────────────────────────────────────────────────────
          Y LOS CUADRADOS SE TOCAN MEJOR, NO PEOR

          Es lo primero que preocupa al pensar en manos de 75 años, y
          sale al revés: en una pantalla de móvil cada cuadrado mide
          unos 170 × 150 px. Las filas de antes tenían 74 de alto. El
          dedo tiene el doble de sitio donde caer, y encima ya no hay
          que apuntar a una franja fina.

          Se pasa de unos 340 px de alto a unos 270, y eso sube «Hoy»
          hasta donde se ve sin arrastrar la pantalla — que era lo
          único que de verdad se quedaba abajo.
        */}

        {/* AVISO DE QUE ALGO NO FUNCIONA, Y POR ESO VA EL PRIMERO.

            No es una tarjeta más ni una sugerencia: es HUBI diciendo
            que ahora mismo no puede cumplir lo que promete. Eso no se
            pone debajo de seis tarjetas.

            Se pinta solo cuando hace falta —y en el ordenador nunca—,
            así que en un teléfono bien puesto esta línea no existe. */}
        <SinAvisos />

        {/* ── La grande: hacer una foto ── */}
        {conectado && ve.guardarDocumento && (
          <Link
            href="/guardar"
            className="mt-2.5 flex h-[76px] items-center gap-3.5 rounded-[22px] px-4"
            style={{
              background: 'color-mix(in srgb, #14B8A6 12%, transparent)',
              border: '1px solid color-mix(in srgb, #14B8A6 30%, transparent)',
            }}
          >
            <span className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[15px] bg-superficie text-verde">
              <Ico nombre="foto" tam={25} grosor={2.1} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block whitespace-nowrap text-[19px] font-extrabold tracking-tight">
                Guardar documento
              </span>
              {/* Lo que hay dentro, en una línea. Era la única tarjeta
                  del Inicio que no decía nada de sí misma — y es donde
                  más tranquiliza saberlo: quien guarda una factura y no
                  vuelve a verla nunca acaba dudando de si se guardó. */}
              <span className="block truncate text-[14.5px] font-bold text-verde">
                {cuantosPapeles && cuantosPapeles > 0
                  ? `${cuantosPapeles} guardados${
                      desdeElUltimo(ultimoPapel?.[0]?.creado_en as string | undefined)
                        ? ` · ${desdeElUltimo(ultimoPapel?.[0]?.creado_en as string | undefined)}`
                        : ''
                    }`
                  : 'Haz una foto y yo lo archivo'}
              </span>
            </span>
            <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-verde" />
          </Link>
        )}

        {/*
          ═══════════════════════════════════════════════════════
          PARA TI
          ═══════════════════════════════════════════════════════

          Va justo DEBAJO de «Guardar documento», y encima de todo lo
          demás. Estaba la primera de todas —por delante incluso de la
          foto— y ahí empujaba hacia abajo lo que el punto 6 pone como
          protagonista de la pantalla.

          Detrás de la foto, pero no más abajo: sigue siendo lo único
          que alguien de tu casa te ha dejado a TI en concreto, y lo
          que se pone debajo de seis tarjetas se lee mañana.

          Se enseña el texto, SIEMPRE. Hubo una versión que ponía «2 ·
          una es para ti» y nada más: obligaba a entrar para saber qué
          era, y una nota que hay que ir a buscar es una nota que a
          veces no se lee.

          El número de delante no vuelve atrás en eso — se suma. De
          lejos y sin gafas contesta lo primero que se pregunta al
          abrir («¿tengo algo?») y el texto sigue debajo contestando
          lo segundo («¿el qué?»). Es la idea del widget del teléfono,
          pero a 17 px y sin quitar nada: allí el número SUSTITUYE al
          texto, y por eso allí hay que entrar.

          Desaparece sola en cuanto dices que la has visto, desde
          Notas. Si se quedara, el Inicio acabaría con una lista fija
          que se deja de mirar en una semana.
        */}
        {tuyas.length > 0 && (
          <section className="mt-4">
            {/* El número y su rótulo, en una fila. `tabular-nums` para
                que al pasar de 9 a 10 no baile lo de al lado. */}
            <div className="flex items-center gap-3">
              <span className="text-[44px] font-extrabold leading-none tracking-tight tabular-nums">
                {tuyas.length}
              </span>
              <h2 className="rotulo leading-[1.3]">
                {tuyas.length === 1 ? 'Nota que' : 'Notas que'}
                <br />
                te han dejado
              </h2>
            </div>
            <ul className="mt-3 space-y-2">
              {tuyas.map((n) => (
                <li key={n.id}>
                  <Link
                    href="/notas"
                    className="block rounded-[20px] border bg-superficie px-4 py-3.5"
                    style={{
                      borderColor: `color-mix(in srgb, ${n.color} 42%, transparent)`,
                      borderLeft: `4px solid ${n.color}`,
                    }}
                  >
                    <span className="block text-[16.5px] font-semibold leading-snug">
                      {n.texto.length > 140 ? `${n.texto.slice(0, 140)}…` : n.texto}
                    </span>
                    <span className="mt-1 block text-[13.5px] font-bold text-tenue">
                      {n.de} · {n.cuando.toLowerCase()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Los dos cuadrados ── */}
        {(usaCompra && ve.compra) || ve.notas ? (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {usaCompra && ve.compra && (
              <Cuadro
                href="/compra"
                icono="bolsa"
                color="#0EA5E9"
                titulo="La compra"
                /* Con cifra, el pie dice QUÉ son. Sin cifra, dice
                   cómo está la lista. Poner «3» y debajo «Faltan 3
                   cosas» sería decir lo mismo dos veces en un sitio
                   donde no sobra ni una palabra. */
                pie={
                  !porComprar
                    ? 'La lista está vacía'
                    : porComprar === 1
                      ? 'cosa por coger'
                      : 'cosas por coger'
                }
                /* El número, grande, solo cuando hay algo que contar.
                   Un «0» enorme en la pantalla de inicio es un
                   reproche por algo que no has hecho mal. */
                cifra={porComprar && porComprar > 0 ? String(porComprar) : null}
              />
            )}

            {ve.notas && (
              <Cuadro
                href="/notas"
                icono="chincheta"
                color="#F59E0B"
                titulo="Notas"
                pie={
                  notasPuestas.paraMi > 0
                    ? notasPuestas.paraMi === 1
                      ? 'una es para ti'
                      : `${notasPuestas.paraMi} son para ti`
                    : notasPuestas.puestas === 0
                      ? 'Deja un recado'
                      : notasPuestas.puestas === 1
                        ? 'puesta en el corcho'
                        : 'puestas en el corcho'
                }
                cifra={notasPuestas.puestas > 0 ? String(notasPuestas.puestas) : null}
                /* Lo que es PARA TI se ve desde el otro lado de la
                   habitación. Es lo único del Inicio que te está
                   esperando a ti en concreto. */
                avisa={notasPuestas.paraMi > 0}
              />
            )}
          </div>
        ) : null}

        {/* ── El asesor, con su color ── */}
        {deLaGestoria && (
          <Link
            href="/asesor"
            className="mt-2.5 flex h-[76px] items-center gap-3.5 rounded-[22px] px-4"
            style={{
              background: `color-mix(in srgb, ${deLaGestoria.color} ${
                deLaGestoria.esperando > 0 ? 18 : 11
              }%, transparent)`,
              border: `1px solid color-mix(in srgb, ${deLaGestoria.color} ${
                deLaGestoria.esperando > 0 ? 50 : 28
              }%, transparent)`,
            }}
          >
            {/* Su inicial y su color, no un icono genérico: es una
                persona, y aquí es la única tarjeta que lo es. */}
            <span
              className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[15px] text-[20px] font-extrabold text-white"
              style={{ background: deLaGestoria.color }}
            >
              {deLaGestoria.nombre.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[19px] font-extrabold tracking-tight">
                {deLaGestoria.nombre}
              </span>
              <span
                className="block truncate text-[14.5px] font-bold"
                style={{ color: deLaGestoria.color }}
              >
                {deLaGestoria.esperando === 0
                  ? 'Nada nuevo por ahora'
                  : deLaGestoria.esperando === 1
                    ? 'Te ha dejado una cosa'
                    : `Te ha dejado ${deLaGestoria.esperando} cosas`}
              </span>
            </span>
            <span className="shrink-0" style={{ color: deLaGestoria.color }}>
              <Ico nombre="flecha" tam={22} grosor={2.2} />
            </span>
          </Link>
        )}

        {/* ── Y las cuentas, anchas, con el número de protagonista ── */}
        {ve.cuentasCasa && (
          <Link
            href="/gastos"
            className="mt-2.5 flex h-[76px] items-center gap-3.5 rounded-[22px] px-4"
            style={{
              background: 'color-mix(in srgb, #8B5CF6 12%, transparent)',
              border: '1px solid color-mix(in srgb, #8B5CF6 30%, transparent)',
            }}
          >
            <span
              className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[15px] bg-superficie"
              style={{ color: '#8B5CF6' }}
            >
              <Ico nombre="euro" tam={25} grosor={2.1} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block whitespace-nowrap text-[15px] font-bold text-tenue">
                Cuentas de casa
              </span>
              {gastoCasa.total > 0 ? (
                <>
                  <span className="block text-[24px] font-extrabold leading-tight tracking-tight">
                    {eurosRedondo(gastoCasa.total)}
                    <span className="ml-1.5 text-[14.5px] font-bold text-tenue">
                      este trimestre
                    </span>
                  </span>
                  {/* En qué se va más. «1.240 €» dice cuánto; esto dice
                      si hay algo que mirar, que es lo que hace entrar. */}
                  {gastoCasa.mayor && (
                    <span
                      className="mt-0.5 block truncate text-[13.5px] font-bold"
                      style={{ color: '#8B5CF6' }}
                    >
                      Lo que más, {gastoCasa.mayor.toLowerCase()}
                    </span>
                  )}
                </>
              ) : (
                <span className="block text-[18px] font-extrabold leading-snug tracking-tight">
                  Todavía no hay nada apuntado
                </span>
              )}
            </span>
            <span className="shrink-0" style={{ color: '#8B5CF6' }}>
              <Ico nombre="flecha" tam={22} grosor={2.2} />
            </span>
          </Link>
        )}
        {/* ── Conectar Drive ── */}
        {!conectado && manda && (
          <div className="mt-6">
            <a
              href="/api/google/conectar"
              className="flex h-[60px] items-center justify-center rounded-[18px] bg-verde text-[18px] font-extrabold text-white"
            >
              {caducado ? 'Volver a conectar Google Drive' : 'Conectar Google Drive'}
            </a>
            <p className="mt-4 text-[16px] leading-relaxed text-tinta-suave">
              Google mostrará un aviso de aplicación no verificada. Es normal: pulsa{' '}
              <strong>Configuración avanzada</strong> y después <strong>Ir a HUBI</strong>.
              Solo ocurre esta vez.
            </p>
          </div>
        )}

        {!conectado && !manda && (
          <p className="mt-6 rounded-2xl bg-superficie px-5 py-4 text-[17px] leading-snug text-tinta-suave">
            Guardar documentos estará disponible cuando{' '}
            {elJefe ?? 'quien creó esta casa'} conecte su Google Drive.
          </p>
        )}

        {rol === 'ayuda' && casaHoy && <TarjetaCasa {...casaHoy} mia />}

        {/* ── Hoy ── */}
        {ve.agenda && hoy.length > 0 && (
          <section className="mt-6">
            <h2 className="rotulo">Hoy</h2>
            <ul className="mt-2.5 space-y-2.5">
              {hoy.map((r) => {
                const p = pintaDe(r.titulo)
                return (
                  <li key={r.id}>
                    <Link
                      href={`/tablon/${r.id}`}
                      className="flex items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-3.5 py-3"
                    >
                      <Pastilla nombre={p.icono} color={p.color} fondo={p.fondo} tam={44} icono={22} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17.5px] font-bold leading-snug">
                          {r.titulo}
                        </span>
                        <span className="mt-0.5 block text-[15px] font-semibold text-tenue">
                          {cuando(r.fecha, r.hora)}
                        </span>
                      </span>
                      <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0 text-borde" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* ── Próximamente ── */}
        {ve.agenda && proximos.length > 0 && (
          <section className="mt-6">
            <h2 className="rotulo">Próximamente</h2>
            <ul className="mt-1">
              {proximos.map((r) => {
                const p = pintaDe(r.titulo)
                return (
                  <li key={r.id}>
                    <Link href={`/tablon/${r.id}`} className="flex items-center gap-3.5 px-0.5 py-2.5">
                      <Pastilla
                        nombre={p.icono}
                        color={p.color}
                        fondo={p.fondo}
                        tam={38}
                        icono={20}
                        redondez={12}
                      />
                      <span className="min-w-0 flex-1 truncate text-[17px] font-bold">
                        {r.titulo}
                      </span>
                      <span
                        className="shrink-0 text-[15px] font-bold"
                        style={{ color: p.color }}
                      >
                        {enCuanto(r.fecha)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {rol !== 'ayuda' && casaHoy && <TarjetaCasa {...casaHoy} />}

        {ve.agenda &&
          hoy.length === 0 &&
          proximos.length === 0 &&
          deberes.length === 0 &&
          conectado && (
            <p className="mt-6 rounded-[20px] bg-superficie px-6 py-8 text-center text-[17px] font-medium text-tinta-suave">
              Hoy no hay nada apuntado.
            </p>
          )}
      </div>

      <Barra activa="inicio" voz={false} />
    </main>
  )
}

/*
  ═══════════════════════════════════════════════════════════════
  UN CUADRADO DEL MOSAICO
  ═══════════════════════════════════════════════════════════════

  El icono arriba, la cifra en grande en medio, y abajo qué es y qué
  hay. Es el orden en que se mira un mosaico: primero el color y la
  forma, luego el número, y solo si hace falta se lee la letra.

  ─────────────────────────────────────────────────────────────
  LA CIFRA NO SALE SIEMPRE, Y ES LO IMPORTANTE

  Un «0» enorme en la pantalla de inicio es un reproche por algo que
  no has hecho mal. Cuando no hay nada, el cuadrado dice qué es y para
  qué sirve —«Deja un recado»— y ya está: invita en vez de regañar.

  Y el número es UN dato, no una tabla. «3» y debajo «Faltan 3 cosas»
  sería decir lo mismo dos veces, así que el pie cambia: con cifra
  dice lo que son, sin cifra dice para qué vale.
*/
function Cuadro({
  href,
  icono,
  color,
  titulo,
  pie,
  cifra,
  avisa = false,
}: {
  href: string
  icono: 'bolsa' | 'chincheta'
  color: string
  titulo: string
  pie: string
  /** El número, si hay algo que contar. */
  cifra: string | null
  /** Algo te está esperando a ti: se ve desde lejos. */
  avisa?: boolean
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[152px] flex-col justify-between rounded-[22px] p-4"
      style={{
        background: `color-mix(in srgb, ${color} ${avisa ? 20 : 12}%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} ${avisa ? 55 : 30}%, transparent)`,
      }}
    >
      <span
        className="flex h-[44px] w-[44px] items-center justify-center rounded-[14px] bg-superficie"
        style={{ color }}
      >
        <Ico nombre={icono} tam={23} grosor={2.1} />
      </span>

      <span className="mt-3 block">
        {cifra && (
          <span
            className="block text-[34px] font-extrabold leading-none tracking-tight"
            style={{ color }}
          >
            {cifra}
          </span>
        )}
        <span className="mt-1.5 block text-[17.5px] font-extrabold leading-tight tracking-tight">
          {titulo}
        </span>
        <span className="mt-0.5 block text-[14px] font-bold leading-snug" style={{ color }}>
          {pie}
        </span>
      </span>
    </Link>
  )
}

/*
  «el último, hoy» · «hace 2 días» · «hace 3 semanas»

  Se dice en tiempo transcurrido y no con la fecha: lo que se quiere
  saber al mirar el Inicio no es qué día fue, es si esto sigue vivo.
  «14/08/2026» obliga a restar mentalmente; «hace 3 semanas» ya es la
  respuesta.
*/
function desdeElUltimo(iso: string | undefined): string | null {
  if (!iso) return null
  const cuando = new Date(iso)
  if (Number.isNaN(cuando.getTime())) return null

  const dias = Math.floor((Date.now() - cuando.getTime()) / 86_400_000)
  if (dias <= 0) return 'el último, hoy'
  if (dias === 1) return 'el último, ayer'
  if (dias < 14) return `hace ${dias} días`
  if (dias < 60) return `hace ${Math.round(dias / 7)} semanas`
  return `hace ${Math.round(dias / 30)} meses`
}

/** "en 8 días", "mañana", "en 2 meses" */
function enCuanto(fecha: string | null): string {
  if (!fecha) return ''
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dia = new Date(fecha + 'T12:00:00')
  dia.setHours(0, 0, 0, 0)
  const dias = Math.round((dia.getTime() - hoy.getTime()) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias < 45) return `en ${dias} días`
  return `en ${Math.round(dias / 30)} meses`
}

/*
  ═══════════════════════════════════════════════════════════════
  LA CASA HOY, EN UNA TARJETA
  ═══════════════════════════════════════════════════════════════

  El número grande y quién lo lleva. Nada más: lo que hay dentro se ve
  entrando, y lo que se contesta desde aquí —«¿va bien la mañana?»— se
  contesta con «2 de 5» sin abrir nada.

  Cuando está todo hecho cambia de tono en vez de desaparecer: haberlo
  terminado es una noticia, y quitarle la tarjeta a quien acaba de
  terminar sería quitarle el acuse de recibo.
*/
function TarjetaCasa({
  hechas,
  total,
  nombre,
  color,
  mia = false,
}: {
  hechas: number
  total: number
  nombre: string | null
  color: string
  /** Es mi día: entonces la tarjeta habla en segunda persona. */
  mia?: boolean
}) {
  const todo = hechas === total

  return (
    <Link
      href="/lacasa"
      className="mt-2.5 flex h-[76px] items-center gap-3.5 rounded-[22px] px-4"
      style={{
        background: `color-mix(in srgb, ${color} ${todo ? 10 : 16}%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} ${todo ? 26 : 42}%, transparent)`,
      }}
    >
      {/* El número, que es todo lo que hay que leer de un vistazo. */}
      <span
        className="flex h-[48px] w-[48px] shrink-0 flex-col items-center justify-center rounded-[15px] bg-superficie leading-none"
        style={{ color }}
      >
        <span className="text-[19px] font-extrabold tracking-tight">{hechas}</span>
        <span className="mt-0.5 text-[10.5px] font-bold opacity-70">de {total}</span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block whitespace-nowrap text-[19px] font-extrabold tracking-tight">
          {mia ? 'Lo de hoy' : 'La casa hoy'}
        </span>
        <span className="block truncate text-[14.5px] font-bold" style={{ color }}>
          {todo
            ? mia
              ? '¡Todo hecho!'
              : `${nombre ?? 'Todo'} lo ha terminado`
            : mia
              ? `Te quedan ${total - hechas}`
              : nombre
                ? `${nombre} · faltan ${total - hechas}`
                : `Faltan ${total - hechas}`}
        </span>
      </span>
      <span className="shrink-0" style={{ color }}>
        <Ico nombre="flecha" tam={22} grosor={2.2} />
      </span>
    </Link>
  )
}
