import Link from '@/app/enlace'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { clienteServidor } from '@/lib/supabase/servidor'
import Barra from './barra'
import Arranque from './arranque'
import Invitacion from './invitacion'
import SinAvisos from './sin-avisos'
import PrimerosPasos from './primeros-pasos'
import { accionesDe, primerosPasos, type Papel } from '@/lib/guia'
import { pasosHechos } from '@/lib/pasos'
import Cabecera from './cabecera'
import { BotonAjustes, Ico, Logo, pintaDe } from './iconos'
import Avatar from './avatar'
import { cuando, type Recordatorio } from '@/lib/tablon'
import { leerPerfil } from '@/lib/perfil'
import { mandaEnSuCasa, quienManda } from '@/lib/hogar'
import { casasDe } from '@/lib/casas'
import { paraMi, cuandoSePuso } from '@/lib/notas'
import { queVeEnInicio } from '@/lib/roles'
import { loDeHoy } from '@/lib/rutinas'
import { genteDeLaCasa } from '@/lib/gente'
import { AMBITO, Aviso, BotonPrincipal, Fila, PastillaAmbito, Vacio } from './piezas'
import Casas from './casas'
import { type Deber } from './rutinas-hoy'
import { elEspacio, elEspacioO } from '@/lib/espacio'
import { laMesa, haceCuanto } from '@/lib/escritorio'
import { euros, eurosRedondo } from '@/lib/periodos'
import { laPuertaQueFalta } from '@/lib/enlaces'

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
  const hogarId = await elEspacio(supabase)
  if (!hogarId) redirect('/empezar')

  /*
    Y si se ha llegado aquí sin espacio en la dirección —que es lo que
    pasa al abrir HUBI—, se entra por la puerta.

    A partir de este momento la pestaña sabe en qué casa está y ya no
    se la pisa nadie. Es la última vez que `casa_activa` decide algo.
  */
  const puerta = await laPuertaQueFalta(hogarId)
  if (puerta) redirect(puerta)

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

  const espacio = await elEspacioO(supabase)
  const [
    perfil,
    { data: pendientes },
    { data: siguientes },
    { data: conexion },
    { data: ultimoPapel, count: cuantosPapeles },
    mesa,
  ] =
    await Promise.all([
      leerPerfil(supabase, user.id, user.email),

      // Lo de hoy y lo que se quedó atrás: nada más. El inicio no es una lista.
      supabase
        .from('recordatorios')
        .select(CAMPOS)
        .eq('hogar_id', espacio)
        .eq('estado', 'pendiente')
        .lte('fecha', hoyISO)
        .order('hora', { ascending: true, nullsFirst: true })
        .limit(4),

      supabase
        .from('recordatorios')
        .select(CAMPOS)
        .eq('hogar_id', espacio)
        .eq('estado', 'pendiente')
        .gt('fecha', hoyISO)
        .lte('fecha', dentroDe60.toISOString().slice(0, 10))
        .order('fecha', { ascending: true })
        .limit(3),

      hogarId
        ? admin.from('conexion_drive').select('estado').eq('hogar_id', hogarId).maybeSingle()
        : Promise.resolve({ data: null }),

      /*
        Cuántos papeles hay guardados y cuándo fue el último.

        No es adorno: la tarjeta de «Guardar documento» era la única
        del Inicio que no decía NADA de lo que hay dentro. Y es
        justamente donde más tranquiliza saberlo — quien guarda una
        factura y no vuelve a verla nunca acaba dudando de si se
        guardó. «34 papeles · el último, hace 2 días» contesta esa
        duda sin entrar.
      */
      /*
        Y de paso vienen CINCO, no uno.

        El móvil sigue usando solo el primero y el total. Pero en una
        pantalla grande cabe la lista de los últimos papeles, y traerla
        aquí no cuesta un viaje más: es la misma consulta pidiendo
        cuatro filas de más.

        Sin cruzar con `categorias` ni con `perfiles`: desde que
        existen los hogares hay dos caminos para ir de un documento a
        una persona y la base de datos se niega a elegir. La ruta de la
        carpeta se enseña en Papeles, que sí tiene el árbol cargado.
      */
      supabase
        .from('documentos')
        .select('id, titulo, proveedor, importe, creado_en', { count: 'exact' })
        .eq('hogar_id', espacio)
        .is('eliminado_en', null)
        .order('creado_en', { ascending: false })
        .limit(5),

      /*
        LAS CIFRAS DE LA CASA, en una sola llamada.

        `mi_escritorio` ya existe desde el SQL 52 y calcula en la base
        de datos lo del trimestre en curso: ingresos, gastos, papeles y
        lo que te espera. Se usaba solo en el escritorio; aquí sirve
        para la fila de números que solo sale en grande.

        Envuelto: si el SQL 52 no estuviera ejecutado, `laMesa`
        devuelve `null` y la fila no se pinta. Nadie se queda sin
        Inicio por una fila de cifras.
      */
      laMesa(supabase).catch(() => null),
    ])

  /* La fila de esta casa dentro de la mesa. Con una sola casa es la
     única que hay; con varias, la que se está mirando. */
  const cifras = (mesa ?? []).find((c) => c.id === hogarId) ?? null

  const ultimos = (ultimoPapel ?? []) as {
    id: string
    titulo: string | null
    proveedor: string | null
    importe: number | null
    creado_en: string
  }[]

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
    ── LOS PRIMEROS PASOS ──

    Se piden AQUÍ, después del rol, porque cada papel tiene los
    suyos: a quien ayuda en casa no se le propone guardar papeles.

    Y se preguntan a lo que ya hay —¿tienes algún documento?, ¿alguna
    nota?— en vez de guardar una marca al hacer cada cosa. Preguntando
    por los datos, la lista no puede mentir; con marcas, un fallo al
    escribir una dejaría a alguien con la tarjeta puesta para siempre.
  */
  const papel = ((rol as Papel | null) ?? 'familia') as Papel
  const pasos = primerosPasos(papel)
  const hechos = pasos.length > 0 ? await pasosHechos(supabase, user.id) : new Set<string>()

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
    const filas = await loDeHoy(supabase, espacio, mias ? user.id : null)

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

  /* Quien ayuda en casa, para poner su nombre y su color en la tarjeta
     del día. Se saca de la misma lectura de gente: pedirla dos veces
     sería un viaje de más para pintar la misma pantalla. */
  let deLaAyuda: { nombre: string; color: string } | null = null
  /** Las notas que te están esperando a ti, con quién las dejó. */
  const tuyas: { id: string; texto: string; de: string; color: string; cuando: string }[] = []

  try {
    const gente = await genteDeLaCasa(supabase, hogarId)

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
          color: dequien?.color ?? AMBITO.pizarra,
          cuando: cuandoSePuso(n.creada_en),
        })
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
          /* Era `#0EA5E9`, el cian sin declarar. */
          color: deLaAyuda?.color ?? AMBITO.azul,
        }
      : null

  return (
    <main className="relative min-h-screen pb-40 lg:pb-16">
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

      {/*
        ── LA CABECERA, SOLO EN EL MÓVIL ──

        En grande sobra entera: el logotipo ya está en el rail —salía
        dos veces, y una marca repetida en la misma pantalla se lee
        como un fallo de montaje— y Ajustes se ha ido al pie del rail,
        que es donde se buscan los ajustes en un ordenador.
      */}
      <div className="lg:hidden">
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

            Una píldora pequeña con relleno de velo, y dentro los
            mandos y la palabra. Nada más: ni borde, ni degradado, ni
            flecha — las tres cosas estuvieron y las tres se fueron.

            Tuvo el borde en degradado hasta la D8 (turquesa a morado:
            colores que no son de HUBI, pegados al logotipo), y después
            un borde de tarjeta que sobre el papel cálido de la Fase 3
            da 1,13:1 y no se ve. Un botón sin caja visible pero con el
            hueco de la caja es justo lo que se veía raro.

            Ahora la caja es un relleno, que a igual contraste sí se
            percibe porque ocupa área. El dibujo del botón está en
            `iconos.tsx`, con los números de los dos modos.
          */}
          {/* El margen invisible arriba y abajo: la píldora se ve de 30
              px y se toca de 48. Ninguna pantalla de HUBI tiene algo
              pulsable por debajo de esa medida, y este botón no iba a
              ser la excepción por quedar más fino. Al bajar de 34 a 30
              el relleno sube de 7 a 9: lo que encoge es el dibujo, no
              la zona donde cae el dedo. */}
          <Link href="/ajustes" className="tocable -mr-1 shrink-0 py-[9px] pl-2">
            <BotonAjustes />
          </Link>
        </div>
      </Cabecera>
      </div>

      {/*
        ── Y AQUÍ SE ENSANCHA ──

        En el móvil, `max-w-md`: la columna de siempre, sin tocar.

        En grande, hasta 1100 px y a la IZQUIERDA, no centrada. Con el
        rail al lado, una columna centrada deja un pasillo de aire
        entre la navegación y lo que se lee, y la vista tiene que
        saltarlo en cada renglón. Pegada al rail, se lee de corrido.

        No es el ancho completo: 1100 px es donde una línea de texto
        deja de poder seguirse sin perder el renglón. Lo que sobra a la
        derecha es margen, y está bien que lo sea.
      */}
      <div className="relative z-10 mx-auto w-full max-w-md px-5 pt-1 lg:mx-0 lg:max-w-[1100px] lg:px-9 lg:pt-5">
        {/*
          ═══════════════════════════════════════════════════════
          LA CABECERA, EN GRANDE, EN DOS
          ═══════════════════════════════════════════════════════

          En el móvil esto es una columna y no cambia ni un píxel: los
          `lg:` de abajo no existen por debajo de 1024 px.

          En grande se reparte:

            IZQUIERDA          DERECHA
            quién eres         qué día es
            en qué casa        hablar o buscar
            (tu papel)         guardar documento

          A la izquierda, QUIÉN y DÓNDE: la foto, el nombre, y debajo
          la casa en la que estás. Van juntos porque son la misma
          pregunta —«¿quién soy y dónde estoy?»— y porque elegir casa
          es algo que se hace desde uno mismo, no desde un menú suelto
          arriba del todo.

          A la derecha, QUÉ VAS A HACER: el día, y las dos acciones.

          La colocación es EXPLÍCITA —`col-start` y `row-start` en cada
          pieza— y no por orden de aparición. Así el orden del móvil se
          queda como está y no hay que mover nada de sitio en el
          código: en una pantalla el orden de lectura y el orden del
          documento pueden ser distintos, y forzarlos a coincidir es lo
          que obliga a reescribir media pantalla por un cambio de
          columna.
        */}
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">

        {/* ── El día, arriba a la derecha y en grande ── */}
        <p className="hidden text-[19px] font-bold text-tenue lg:col-start-2 lg:row-start-1 lg:block lg:text-right">
          {hoyEnPalabras()}
        </p>

        {/* ── En qué casa estás, y las que te han ofrecido ── */}
        {/* Va lo primero, encima del saludo del día: si alguien te ha
            dado acceso a los papeles de su casa, eso no puede quedar
            debajo de la lista de la compra. */}
        <div className="lg:col-start-1 lg:row-start-2">
          <Casas casas={casas} />
        </div>

        {/* ── Saludo ── */}
        {/*
          ── EL SALUDO, CON LA FOTO ──

          La foto estaba arriba, pegada al logo, y ahí no decía nada:
          era un adorno al lado de una marca. Aquí sí — «Buenas tardes,
          Haris» y su cara son la misma frase, y de un vistazo se sabe
          con qué cuenta se ha entrado, que en una casa donde dos
          personas comparten el mismo iPad no es un detalle.
        */}
        <div className="mt-2.5 flex items-center gap-3 lg:col-start-1 lg:row-start-1 lg:mt-0">
          <Avatar nombre={nombre} foto={perfil.foto} tam={52} />
          <div className="min-w-0 flex-1">
            {/* En grande el día se va arriba a la derecha y en grande de
                verdad: es lo primero que se mira al sentarse. */}
            <p className="text-[14.5px] font-bold text-tenue lg:hidden">{hoyEnPalabras()}</p>
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
          <p className="mt-4 rounded-[18px] border border-borde bg-superficie px-4 py-3.5 text-[15.5px] font-semibold leading-snug text-tinta-suave lg:col-start-1 lg:row-start-3">
            {rol === 'ayuda'
              ? 'Aquí tienes lo que te han encargado y la lista de la compra. El ticket del súper se guarda desde la propia compra.'
              : rol === 'asesor'
                ? 'Tienes acceso a las cuentas y a los papeles de las actividades de esta casa. Están abajo. No puedes cambiar nada.'
                : 'Puedes ver las cosas de esta casa, pero no cambiar nada.'}
          </p>
        )}

        <div className="lg:col-start-2 lg:row-start-2">
          {conectado && <Invitacion />}
        </div>

        {aviso && (
          <div className="mt-5 lg:col-span-2 lg:row-start-4">
            <Aviso tono={aviso.bien ? 'bien' : 'alerta'} titulo={aviso.texto} />
          </div>
        )}

        {/*
          ═══════════════════════════════════════════════════════
          EL INICIO DEJA DE SER UN MENÚ · Fase 2
          ═══════════════════════════════════════════════════════

          Aquí había SEIS accesos —La compra, Notas, Menús, el asesor,
          Cuentas de casa y La casa hoy— porque no había otro sitio
          donde ponerlos: la barra tenía sus cinco huecos ocupados, dos
          de ellos por las actividades.

          Y el resultado era éste, medido de arriba abajo:

              saludo · invitación · guardar · notas para ti
              compra · notas · menús · asesor · cuentas
              → HOY, en la posición 9

          O sea: para ver que a las diez hay médico había que pasar por
          delante de seis botones. La pantalla que existe para decir
          qué pasa hoy tenía «hoy» al final.

          Los seis accesos se han ido a sus pestañas —Cuentas y El día
          a día— y lo que queda aquí es SOLO lo que contesta «¿qué
          pasa?»:

              saludo · hablar · guardar
              HOY · lo que te han dejado · PRÓXIMAMENTE

          Nada de esto es un menú. Todo es una respuesta.
        */}

        {/* AVISO DE QUE ALGO NO FUNCIONA, Y POR ESO VA EL PRIMERO.

            No es una tarjeta más ni una sugerencia: es HUBI diciendo
            que ahora mismo no puede cumplir lo que promete. Eso no se
            pone debajo de seis tarjetas.

            Se pinta solo cuando hace falta —y en el ordenador nunca—,
            así que en un teléfono bien puesto esta línea no existe.

            Va envuelto y con sitio dicho —fila 5, las dos columnas—
            porque dentro de una rejilla lo que no dice dónde va se
            coloca solo, en el primer hueco libre que encuentre. Y el
            primer hueco libre de esta rejilla está arriba, al lado del
            saludo. */}
        <div className="lg:col-span-2 lg:row-start-5">
          <SinAvisos />
        </div>

        {/*
          ── PRIMEROS PASOS ──

          Debajo del aviso de que algo no funciona y ENCIMA de todo
          lo demás. El orden importa: un fallo se dice antes que una
          bienvenida, pero una bienvenida que hay que ir a buscar no
          la lee nadie.

          Desaparece sola cuando las cuatro cosas están hechas. A
          partir de ahí, la guía vive en Ajustes y nada más.
        */}
        {pasos.length > 0 && (
          <div className="lg:col-span-2 lg:row-start-6">
            <PrimerosPasos
              pasos={pasos}
              hechos={[...hechos]}
              cuantasMas={accionesDe(papel).length - pasos.length}
            />
          </div>
        )}

        {/* ── La grande: hacer una foto ── */}
        {conectado && ve.guardarDocumento && (
          /*
            FOTOGRAFIAR es una de las tres cosas que HUBI promete
            —hablar, fotografiar, consultar— y en esta pantalla es LA
            acción. Así que va con el botón de acción, no con una
            tarjeta teñida de teal a mano.

            El pie dice lo que hay dentro. Era la única tarjeta del
            Inicio que no decía nada de sí misma, y es donde más
            tranquiliza saberlo: quien guarda una factura y no vuelve a
            verla nunca acaba dudando de si se guardó.
          */
          <div className="mt-2.5 lg:col-start-2 lg:row-start-3">
            <BotonPrincipal href="/guardar" icono="foto">
              Guardar documento
            </BotonPrincipal>
            <p className="t-apoyo mt-2 text-center">
              {cuantosPapeles && cuantosPapeles > 0
                ? `${cuantosPapeles} guardados${
                    desdeElUltimo(ultimoPapel?.[0]?.creado_en as string | undefined)
                      ? ` · ${desdeElUltimo(ultimoPapel?.[0]?.creado_en as string | undefined)}`
                      : ''
                  }`
                : 'Haz una foto y yo lo archivo'}
            </p>
          </div>
        )}

        {/* Aquí se acaba la rejilla de la cabecera. Lo de abajo
            —conectar Drive, HOY, PRÓXIMAMENTE— tiene su propio
            reparto y no entra en estas dos columnas. */}
        </div>

        {/* ── Conectar Drive ── */}
        {!conectado && manda && (
          <div className="mt-6">
            <BotonPrincipal href="/api/google/conectar" externo icono="escudo">
              {caducado ? 'Volver a conectar Google Drive' : 'Conectar Google Drive'}
            </BotonPrincipal>
            <p className="t-cuerpo mt-4">
              Google mostrará un aviso de aplicación no verificada. Es normal: pulsa{' '}
              <strong>Configuración avanzada</strong> y después <strong>Ir a HUBI</strong>.
              Solo ocurre esta vez.
            </p>
          </div>
        )}

        {!conectado && !manda && (
          <div className="mt-6">
            <Aviso
              tono="atencion"
              titulo="Todavía no se pueden guardar papeles"
              explicacion={`${elJefe ?? 'Quien creó esta casa'} tiene que conectar su Google Drive.`}
              detalle="Lo que ya está guardado se sigue viendo con normalidad."
            />
          </div>
        )}

        {rol === 'ayuda' && casaHoy && <TarjetaCasa {...casaHoy} mia />}

        {/*
          ── LO QUE SOLO CABE EN GRANDE ──

          Una pantalla de ordenador no tiene que enseñar lo mismo más
          ancho: tiene que enseñar MÁS. En el móvil, saber lo del
          trimestre cuesta entrar en Cuentas, y ver los últimos papeles
          cuesta entrar en Papeles. Aquí caben las dos cosas sin entrar
          en ninguna parte, y ése es todo el motivo de que exista una
          versión ancha.

          `hidden lg:grid`: en el móvil no se pinta. No es que se
          esconda pequeño — es que ahí abajo sobra, y una fila de
          cuatro cifras a 360 px son cuatro cifras ilegibles.
        */}
        {cifras && rol !== 'ayuda' && (
          <div className="mt-6 hidden grid-cols-4 gap-4 lg:grid">
            <Cifra
              rotulo="Papeles guardados"
              valor={String(cifras.papeles)}
              pie={
                cifras.ultimoPapel
                  ? `El último, ${haceCuanto(cifras.ultimoPapel, hoyISO).toLowerCase()}`
                  : 'Todavía ninguno'
              }
            />
            <Cifra
              rotulo="Este trimestre"
              valor={eurosRedondo(cifras.balance, true)}
              /* El color dice lo mismo que el signo, y para quien no
                 distingue bien los signos pequeños dice más. */
              color={cifras.balance < 0 ? 'text-alerta' : 'text-bien'}
              pie={`Ingresos ${eurosRedondo(cifras.ingresos)} · Gastos ${eurosRedondo(cifras.gastos)}`}
            />
            <Cifra
              rotulo="Para hoy"
              valor={hoy.length === 0 ? 'Nada' : String(hoy.length)}
              color={hoy.length > 0 ? 'text-atencion' : undefined}
              pie={hoy.length === 1 ? 'una cosa apuntada' : 'cosas apuntadas'}
            />
            <Cifra
              rotulo="Lo que viene"
              valor={proximos.length === 0 ? 'Nada' : String(proximos.length)}
              pie={
                proximos[0]?.fecha
                  ? `Lo primero, ${enCuanto(proximos[0].fecha).toLowerCase()}`
                  : 'en los próximos dos meses'
              }
            />
          </div>
        )}

        {/*
          ── DE UNA COLUMNA A DOS ──

          En el móvil esto sigue siendo lo que era: todo seguido, y lo
          de hoy justo debajo de la acción.

          En grande se pone al lado. A la izquierda HOY, que es lo que
          hay que hacer y lo que más ocupa; a la derecha LO QUE VIENE,
          que es una lista corta de avisos.

          Y en ese orden, no al revés: la vista empieza por la
          izquierda, y lo primero que se lee tiene que ser lo de hoy.
          Lo de dentro de tres semanas puede esperar a la segunda
          mirada.

          `items-start` para que las dos no se estiren a la altura de
          la más larga: tres avisos estirados para igualar a doce
          tareas son aire con borde.
        */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
          <div>
        {/* ── Hoy ── */}
        {ve.agenda && hoy.length > 0 && (
          <section className="mt-6">
            {/* «Hoy» es ahora lo PRIMERO que hay debajo de la acción,
                no lo noveno. Se le sube el rótulo a título de sección:
                es de lo que va la pantalla. */}
            <h2 className="t-seccion">Hoy</h2>
            <ul className="mt-2.5 space-y-2.5">
              {hoy.map((r) => {
                const p = pintaDe(r.titulo)
                return (
                  <li key={r.id}>
                    <Fila href={`/tablon/${r.id}`} ambito={p.ambito}>
                      <PastillaAmbito icono={p.icono} ambito={p.ambito} tam={44} />
                      <span className="min-w-0 flex-1">
                        <span className="t-cuerpo block">{r.titulo}</span>
                        <span className="t-apoyo mt-0.5 block">{cuando(r.fecha, r.hora)}</span>
                      </span>
                      <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0" />
                    </Fila>
                  </li>
                )
              })}
            </ul>
          </section>
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

          </div>

          <div>
        {/* ── Próximamente ── */}
        {ve.agenda && proximos.length > 0 && (
          <section className="mt-6">
            <h2 className="t-seccion">Próximamente</h2>
            <ul className="mt-2.5 space-y-2">
              {proximos.map((r) => {
                const p = pintaDe(r.titulo)
                return (
                  <li key={r.id}>
                    {/* Iban en una fila de 44 px sin borde, y el «dentro
                        de 8 días» del color del ámbito. Un plazo no es
                        un ámbito: es tinta, como cualquier otro dato. */}
                    <Link
                      href={`/tablon/${r.id}`}
                      className="flex min-h-[48px] items-center gap-3 px-0.5 py-1.5"
                    >
                      <PastillaAmbito icono={p.icono} ambito={p.ambito} tam={40} />
                      <span className="t-cuerpo min-w-0 flex-1 truncate">{r.titulo}</span>
                      <span className="t-apoyo shrink-0">{enCuanto(r.fecha)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {ve.agenda &&
          hoy.length === 0 &&
          proximos.length === 0 &&
          deberes.length === 0 &&
          conectado && (
            <div className="mt-6">
              <Vacio
                titulo="Hoy no hay nada apuntado"
                explicacion="Lo que apuntes con la voz o desde la Agenda saldrá aquí."
              />
            </div>
          )}
            {/*
              ── LOS ÚLTIMOS PAPELES ──

              Solo en grande, y por el mismo motivo que las cifras: en
              el móvil esto es la pantalla de Papeles, y repetirla en el
              Inicio sería alargar la única pantalla que tiene que poder
              leerse de un vistazo.
            */}
            {/* A quien ayuda en casa, no: la base de datos le vacía los
                papeles —eso funciona— pero una sección vacía no se lee
                como «esto no es para ti», se lee como «esto está
                roto». Al asesor sí, aunque no pueda subirlos: los
                papeles son justamente a lo que viene. */}
            {rol !== 'ayuda' && ultimos.length > 0 && (
              <section className="mt-6 hidden lg:block">
                <h2 className="t-seccion">Últimos papeles</h2>
                <ul className="mt-2.5 space-y-2">
                  {ultimos.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/documentos/${d.id}`}
                        className="tocable flex items-center gap-3 rounded-[16px] border border-borde bg-superficie px-4 py-3"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="t-cuerpo block truncate">
                            {d.proveedor || d.titulo || 'Papel sin nombre'}
                          </span>
                          <span className="t-apoyo block truncate">
                            {haceCuanto(d.creado_en.slice(0, 10), hoyISO)}
                          </span>
                        </span>
                        {d.importe != null && (
                          <span className="t-cifra-2 shrink-0 tabular-nums">
                            {euros(Number(d.importe))}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>

      {/*
        EL BOTÓN DE VOZ APARECE CUANDO LA INVITACIÓN NO ESTÁ.

        Aquí ponía `voz={false}` a secas, y la razón era buena: arriba
        está la invitación de HUBI con el mismo símbolo, y dos botones
        para lo mismo en una pantalla es uno de más.

        Lo que no se vio es que esa invitación SOLO SE PINTA SI DRIVE
        ESTÁ CONECTADO. Así que una casa recién creada, o una a la que
        se le ha caducado el permiso de Google, se quedaba con la
        pantalla principal sin ninguna entrada al asistente — la
        función que define el producto, apagada por una integración de
        almacenamiento que no tiene nada que ver con ella.

        La regla sigue siendo la misma —un solo botón— pero ahora se
        cumple mirando si el otro existe.
      */}
      <Barra activa="inicio" voz={!conectado} />
    </main>
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

/*
  ═══════════════════════════════════════════════════════════════
  UNA CIFRA
  ═══════════════════════════════════════════════════════════════

  Rótulo pequeño arriba, el número grande, y debajo lo que significa.
  Ese orden y no otro: el número es lo que se busca, y tiene que poder
  leerse sin leer nada más. Lo de abajo es para la segunda mirada.

  `tabular-nums` para que 127,43 y 1.940,00 tengan las cifras en la
  misma columna. Sin eso, cuatro tarjetas en fila bailan.
*/
function Cifra({
  rotulo,
  valor,
  pie,
  color,
}: {
  rotulo: string
  valor: string
  pie?: string
  color?: string
}) {
  return (
    <div className="rounded-[20px] border border-borde bg-superficie px-5 py-4">
      <p className="rotulo">{rotulo}</p>
      <p className={'t-cifra mt-2 tabular-nums ' + (color ?? 'text-tinta')}>{valor}</p>
      {pie && <p className="t-apoyo mt-1.5">{pie}</p>}
    </div>
  )
}
