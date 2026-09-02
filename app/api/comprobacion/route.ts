import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clienteServidor } from '@/lib/supabase/servidor'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { descifrar } from '@/lib/cifrado'
import { accesoDesdePermiso } from '@/lib/google/oauth'
import { accesoDrive } from '@/lib/google/drive'
import { contar, hijosDe, type Categoria } from '@/lib/carpetas'
import { tieneCalendario } from '@/lib/google/oauth'
import { estadoGuardado, comprobarCalendario } from '@/lib/google/calendario'

export const dynamic = 'force-dynamic'

/**
 * Comprobación del sistema.
 *
 * No devuelve ningún secreto: solo si cada pieza responde o no, y en qué
 * punto exacto falla si falla.
 */
/*
  HACE FALTA HABER ENTRADO.

  Esta ruta no comprobaba la sesión. Devolvía, a quien tuviera la
  dirección: cuántas familias hay, cuántos miembros, cuántos documentos
  y cuántas categorías, y el estado del Drive. Nada de eso es un
  secreto grave, pero es información de las familias que la usan, y no
  tiene por qué estar en la calle.

  Sigue sin devolver NINGÚN valor secreto: solo si cada pieza responde.
*/
export async function GET() {
  const sesion = await clienteSesion()
  if (!(await quien(sesion))) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const resultado = {
    variables: {
      url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      publishable: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      secreta: Boolean(process.env.SUPABASE_SECRET_KEY),
      googleId: Boolean(process.env.GOOGLE_CLIENT_ID),
      googleSecreto: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      googleRetorno: process.env.GOOGLE_REDIRECT_URI ?? null,
      claveCifrado: Boolean(process.env.ENCRYPTION_KEY),
    },
    servidor: {
      ok: false,
      categorias: 0,
      raices: 0,
      documentos: 0,
      error: null as string | null,
    },
    /*
      El hogar. Añadido con la fase 1a.

      La pregunta que contesta es una sola: ¿queda alguna fila sin
      hogar? Porque una fila sin hogar, en cuanto se aprieten las
      políticas, no la verá NADIE — ni siquiera su dueño. Y un
      documento que desaparece en silencio es lo peor que puede
      pasarle a esta aplicación.
    */
    hogar: {
      ok: false,
      hogares: 0,
      miembros: 0,
      sinHogar: {} as Record<string, number>,
      error: null as string | null,
      /*
        ¿PUEDE QUIEN HA ENTRADO LEER SU PROPIO PERFIL?

        Parece una tontería preguntarlo. No lo es: una política mal
        escrita en `miembros` se contagió a `perfiles` y durante días
        NADIE pudo leer su propia ficha. Y no se notó porque
        `leerPerfil` está hecho para no dejar la pantalla sin saludo:
        cuando la base de datos no responde, saca el nombre del correo.
        Hacía lo que se le pidió —tapar el fallo— y de paso lo escondió.

        Se comprueba con la SESIÓN, no con la clave de servidor: la
        clave de servidor se salta las políticas y diría que todo va
        bien siempre.
      */
      leoMiPerfil: false,
      leoMiembros: false,
      errorLectura: null as string | null,
    },
    seguridad: {
      ok: false,
      filasVisiblesSinSesion: null as number | null,
      error: null as string | null,
    },
    drive: {
      estado: 'desconocido' as string,
      puedeDescifrar: false,
      puedeAcceder: false,
      diagnostico: null as string | null,
    },
    calendario: {
      permisoConcedido: false,
      creado: false,
      /* Ya no basta con "lo tenemos apuntado". Se le pregunta a Google
         si el calendario existe y si está en la lista de la cuenta. */
      existeEnGoogle: false,
      enLaLista: false,
      diagnostico: null as string | null,
      /*
        ¿ESTÁ LLEGANDO DE VERDAD LO QUE SE APUNTA?

        Que el calendario exista no dice nada de si se está llenando.
        Esto sí: de las tareas que tienen día, cuántas han conseguido
        su cita en Google. Si son la mitad, la sincronización está
        rota aunque todo lo de arriba salga en verde — y esa era
        exactamente la avería: las citas se lanzaban a Google sin
        esperarlas y Vercel congelaba la función al contestar, así que
        unas llegaban y otras no, sin ningún patrón.
      */
      tareasConFecha: 0,
      tareasEnGoogle: 0,
      sincronizando: null as string | null,
    },
    lectura: {
      motor: 'gemini' as 'vision' | 'gemini' | 'ninguno',
      diagnostico: null as string | null,
    },
    /*
      LOS PAPELES — dónde se rompe la cadena.

      Guardar un documento son cuatro pasos encadenados, y cuando algo
      no aparece hay que saber CUÁL de los cuatro falló. Adivinarlo por
      fuera es imposible: los cuatro se ven igual de vacíos.

        1. ¿Existe la fila?              → `enElServidor`
        2. ¿La deja ver la base a quien  → `losQueVeo`
           ha entrado?  (las políticas
           por hogar pueden esconderla)
        3. ¿Su carpeta sigue viva?       → `sinCarpetaViva`
           (si la categoría no existe o
           está desactivada, el papel no
           sale en ningún sitio aunque
           la fila esté perfecta)
        4. ¿El archivo se abre de Drive? → `driveAbre`

      El cuarto se prueba DE VERDAD, pidiéndole a Google el último
      documento guardado. No se da por bueno porque haya un
      identificador escrito: eso es exactamente lo que el punto 26 del
      planteamiento prohíbe — "no simules una conexión diciendo que
      funciona".
    */
    papeles: {
      ok: false,
      enElServidor: 0,
      losQueVeo: 0,
      sinCarpetaViva: 0,
      ultimos: [] as { titulo: string; fecha: string; carpeta: string; enDrive: boolean }[],
      driveAbre: null as boolean | null,
      driveDiagnostico: null as string | null,
      error: null as string | null,
      /*
        LAS PANTALLAS, TAL CUAL.

        Que las filas existan y se vean NO significa que se vean en
        pantalla: cada pantalla hace su propia consulta, con sus
        propias columnas y sus propios enlaces, y cualquiera de ellas
        puede fallar por su cuenta.

        Y falla EN SILENCIO. Las pantallas hacen
        `const { data } = await consulta` sin mirar el error: si la
        consulta revienta, `data` viene vacío y la pantalla dice
        tranquilamente "todavía no hay papeles". Es indistinguible de
        no tener ninguno.

        Así que aquí se ejecutan LAS MISMAS consultas, con las mismas
        columnas, y esta vez SÍ se mira el error.
      */
      pantallas: {
        inicio: { filas: 0, error: null as string | null },
        carpeta: { filas: 0, error: null as string | null },
      },
      /* Lo que debería salir en la pantalla de Documentos, sección por
         sección. Si aquí sale "Finca: 7" y en el móvil pone "Todavía
         vacía", el fallo está en la pantalla y no en los datos. */
      porSeccion: [] as { nombre: string; papeles: number }[],
    },
  }

  // ── Base de datos ──────────────────────────────────────────
  try {
    const supa = clienteServidor()

    const { count, error } = await supa
      .from('categorias')
      .select('*', { count: 'exact', head: true })
    if (error) throw error

    const { count: raices } = await supa
      .from('categorias')
      .select('*', { count: 'exact', head: true })
      .is('padre_id', null)

    const { count: documentos } = await supa
      .from('documentos')
      .select('*', { count: 'exact', head: true })

    resultado.servidor.ok = true
    resultado.servidor.categorias = count ?? 0
    resultado.servidor.raices = raices ?? 0
    resultado.servidor.documentos = documentos ?? 0
  } catch (e) {
    resultado.servidor.error = e instanceof Error ? e.message : 'Error desconocido'
  }

  // ── Seguridad ──────────────────────────────────────────────
  try {
    const sinSesion = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data, error } = await sinSesion.from('categorias').select('id').limit(5)

    if (error) {
      resultado.seguridad.ok = true
      resultado.seguridad.filasVisiblesSinSesion = 0
    } else {
      const filas = data?.length ?? 0
      resultado.seguridad.filasVisiblesSinSesion = filas
      resultado.seguridad.ok = filas === 0
    }
  } catch (e) {
    resultado.seguridad.error = e instanceof Error ? e.message : 'Error desconocido'
  }

  // ── El hogar: que no quede ni una fila huérfana ────────────
  try {
    const supa = clienteServidor()

    const [{ count: hogares }, { count: miembros }] = await Promise.all([
      supa.from('hogares').select('id', { count: 'exact', head: true }),
      supa.from('miembros').select('perfil_id', { count: 'exact', head: true }),
    ])

    resultado.hogar.hogares = hogares ?? 0
    resultado.hogar.miembros = miembros ?? 0

    const TABLAS = [
      'categorias', 'documentos', 'carpetas_drive', 'conexion_drive',
      'movimientos', 'recordatorios', 'compra',
    ]

    let huerfanas = 0
    for (const tabla of TABLAS) {
      const { count, error } = await supa
        .from(tabla)
        .select('*', { count: 'exact', head: true })
        .is('hogar_id', null)

      /* Si la columna no existe todavía, se dice cuál — es la señal de
         que ese SQL no se ha ejecutado, y no un fallo raro. */
      if (error) {
        resultado.hogar.error = `${tabla}: ${error.message}`
        continue
      }
      resultado.hogar.sinHogar[tabla] = count ?? 0
      huerfanas += count ?? 0
    }

    /* La prueba de verdad: leer con la sesión puesta. */
    const yo = await quien(sesion)
    const mio = await sesion.from('perfiles').select('nombre').eq('id', yo?.id ?? '').maybeSingle()
    const mis = await sesion.from('miembros').select('hogar_id').limit(1)

    resultado.hogar.leoMiPerfil = !mio.error && Boolean(mio.data)
    resultado.hogar.leoMiembros = !mis.error
    resultado.hogar.errorLectura = mio.error?.message ?? mis.error?.message ?? null

    resultado.hogar.ok =
      !resultado.hogar.error &&
      huerfanas === 0 &&
      (hogares ?? 0) > 0 &&
      (miembros ?? 0) > 0 &&
      resultado.hogar.leoMiPerfil &&
      resultado.hogar.leoMiembros
  } catch (e) {
    resultado.hogar.error = e instanceof Error ? e.message : 'Error desconocido'
  }

  // ── Los papeles: dónde se rompe la cadena ──────────────────
  try {
    const supa = clienteServidor()

    /* 1 · ¿Existen las filas? Con la clave de servidor, que no mira
       políticas: esto es la verdad de la base de datos. */
    const { count: enElServidor } = await supa
      .from('documentos')
      .select('*', { count: 'exact', head: true })
    resultado.papeles.enElServidor = enElServidor ?? 0

    /* 2 · ¿Las ve quien ha entrado? Con SU sesión, pasando por las
       políticas. Si este número es menor que el de arriba, el papel
       está guardado pero la base de datos se lo esconde a su dueño —
       que es la avería más desconcertante de todas. */
    const { data: mios } = await sesion
      .from('documentos')
      .select('id, titulo, fecha_documento, categoria_id, drive_file_id')
      .order('fecha_documento', { ascending: false })
      .limit(500)

    const vistos = mios ?? []
    resultado.papeles.losQueVeo = vistos.length

    /* 3 · ¿Su carpeta sigue viva? Un documento cuya categoría ya no
       existe o está desactivada no aparece en NINGUNA pantalla, por
       mucho que la fila esté impecable. */
    const { data: vivas } = await sesion
      .from('categorias')
      .select('id, nombre')
      .eq('activa', true)

    const nombreCarpeta = new Map((vivas ?? []).map((c) => [c.id as string, c.nombre as string]))

    resultado.papeles.sinCarpetaViva = vistos.filter(
      (d) => !d.categoria_id || !nombreCarpeta.has(d.categoria_id)
    ).length

    resultado.papeles.ultimos = vistos.slice(0, 3).map((d) => ({
      titulo: d.titulo ?? '(sin título)',
      fecha: d.fecha_documento ?? '',
      carpeta: d.categoria_id
        ? (nombreCarpeta.get(d.categoria_id) ?? '⚠ carpeta borrada o desactivada')
        : '⚠ sin carpeta',
      enDrive: Boolean(d.drive_file_id),
    }))

    /* 4 · ¿Se abre de verdad? Se le pide a Google el último documento
       guardado. Un identificador escrito en la base no demuestra nada:
       demuestra que un día se escribió. */
    const ultimo = vistos.find((d) => d.drive_file_id)
    if (!ultimo) {
      resultado.papeles.driveDiagnostico = 'Todavía no hay ningún papel que probar.'
    } else {
      try {
        const { acceso } = await accesoDrive()
        const r = await fetch(
          `https://www.googleapis.com/drive/v3/files/${ultimo.drive_file_id}?fields=id,name,trashed`,
          { headers: { Authorization: `Bearer ${acceso}` } }
        )
        if (r.ok) {
          const info = (await r.json()) as { trashed?: boolean; name?: string }
          resultado.papeles.driveAbre = info.trashed !== true
          resultado.papeles.driveDiagnostico = info.trashed
            ? 'El archivo está en la papelera de Google Drive.'
            : `Abre bien: ${info.name ?? ''}`
        } else {
          resultado.papeles.driveAbre = false
          resultado.papeles.driveDiagnostico = `Google responde ${r.status}. ${
            r.status === 404
              ? 'Ese archivo ya no está en el Drive, o lo subió otra conexión distinta.'
              : 'Puede que haya que volver a conectar Google.'
          }`
        }
      } catch (e) {
        resultado.papeles.driveAbre = false
        resultado.papeles.driveDiagnostico =
          e instanceof Error ? e.message : 'No se ha podido preguntar a Google.'
      }
    }

    /* 5 · La consulta EXACTA de la pantalla de Documentos. Pide
       `anio` y `trimestre`, que las otras no piden. */
    const inicio = await sesion
      .from('documentos')
      .select('id, categoria_id, fecha_documento, anio, trimestre')
      .limit(5000)
    resultado.papeles.pantallas.inicio.filas = inicio.data?.length ?? 0
    resultado.papeles.pantallas.inicio.error = inicio.error?.message ?? null

    /* 6 · LA SONDA DEL CRUCE.

       Las pantallas ya NO cruzan tablas: piden los nombres aparte. Pero
       esta sonda mantiene a propósito el cruce de la vieja manera,
       porque es la pregunta que quedó sin contestar: ¿de verdad la base
       de datos se niega a ir de un documento a una persona desde que
       existen los hogares?

       Si esta línea sale en rojo, ésa era la avería. Si sale en verde,
       la avería era otra y hay que seguir buscando — pero las pantallas
       ya no dependen de ello. */
    const carpeta = await sesion
      .from('documentos')
      .select(
        'id, titulo, categoria_id, perfiles(nombre), categorias(nombre)'
      )
      .limit(200)
    resultado.papeles.pantallas.carpeta.filas = carpeta.data?.length ?? 0
    resultado.papeles.pantallas.carpeta.error = carpeta.error?.message ?? null

    /* 7 · Lo que debería poner cada sección en la pantalla de
       Documentos, contado igual que lo cuenta ella. */
    const { data: arbol } = await sesion
      .from('categorias')
      .select('id, padre_id, nombre, segmento_drive, orden')
      .eq('activa', true)

    const cats = (arbol ?? []) as Categoria[]
    const cuantos = contar(
      cats,
      vistos.map((d) => ({
        id: d.id,
        categoria_id: d.categoria_id,
        fecha_documento: d.fecha_documento,
        anio: null,
        trimestre: null,
      }))
    )
    resultado.papeles.porSeccion = hijosDe(cats, null).map((c) => ({
      nombre: c.nombre,
      papeles: cuantos.get(c.id) ?? 0,
    }))

    resultado.papeles.ok =
      resultado.papeles.losQueVeo === resultado.papeles.enElServidor &&
      resultado.papeles.sinCarpetaViva === 0 &&
      resultado.papeles.driveAbre !== false &&
      !resultado.papeles.pantallas.inicio.error &&
      !resultado.papeles.pantallas.carpeta.error
  } catch (e) {
    resultado.papeles.error = e instanceof Error ? e.message : 'Error desconocido'
  }

  // ── Drive: los tres eslabones, por separado ────────────────
  try {
    const supa = clienteServidor()
    const { data: conexion } = await supa
      .from('conexion_drive')
      .select('estado, refresh_token_cifrado, carpeta_raiz_id, alcances')
      .eq('id', 1)
      .single()

    resultado.drive.estado = conexion?.estado ?? 'sin_fila'

    resultado.calendario.permisoConcedido = tieneCalendario(conexion?.alcances)

    if (!conexion?.refresh_token_cifrado) {
      resultado.drive.diagnostico = 'No hay ningún permiso guardado todavía.'
    } else {
      let permiso: string | null = null

      // 1. ¿La clave de cifrado de este entorno abre el permiso guardado?
      try {
        permiso = descifrar(conexion.refresh_token_cifrado)
        resultado.drive.puedeDescifrar = true
      } catch {
        resultado.drive.diagnostico =
          'ENCRYPTION_KEY no coincide con la que cifró el permiso. ' +
          'Debe ser idéntica en local y en Vercel.'
      }

      // 2. ¿Google acepta ese permiso con estas credenciales?
      if (permiso) {
        try {
          await accesoDesdePermiso(permiso)
          resultado.drive.puedeAcceder = true
          resultado.drive.diagnostico = 'Todo correcto.'
        } catch (e) {
          const motivo = e instanceof Error ? e.message : ''
          resultado.drive.diagnostico =
            motivo === 'PERMISO_CADUCADO'
              ? 'Google ha rechazado el permiso. Juan Miguel debe volver a conectarlo.'
              : 'Google no devuelve acceso. Revisa GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.'
        }
      }
    }
  } catch (e) {
    resultado.drive.diagnostico = e instanceof Error ? e.message : 'Error desconocido'
  }

  // ── Calendario ─────────────────────────────────────────────
  // Aparte del bloque de Drive a propósito: si la columna
  // `calendario_id` todavía no existe, esto falla solo y no se lleva
  // por delante el diagnóstico de Drive.
  const cal = await estadoGuardado()
  resultado.calendario.permisoConcedido =
    resultado.calendario.permisoConcedido || cal.permiso
  resultado.calendario.creado = cal.creado

  if (!resultado.calendario.permisoConcedido) {
    resultado.calendario.diagnostico =
      'Este permiso es anterior al calendario. Juan Miguel tiene que volver a conectar.'
  } else if (!cal.creado) {
    resultado.calendario.diagnostico =
      'Permiso concedido. Falta pulsar «Calendario en Google» en Ajustes.'
  } else {
    /*
      ANTES AQUÍ PONÍA "Calendario HUBI creado." Y YA ESTÁ.

      Y era falso en el sentido que importa: solo miraba si teníamos un
      identificador apuntado en NUESTRA base de datos. Eso no demuestra
      que el calendario exista — demuestra que un día lo creamos. Si lo
      hubieran borrado en Google, o se hubiera creado en otra cuenta,
      esta línea habría seguido en verde diciendo que todo bien.

      Ahora se le pregunta a Google.
    */
    const real = await comprobarCalendario()
    resultado.calendario.existeEnGoogle = real.existe
    resultado.calendario.enLaLista = real.enLaLista
    resultado.calendario.diagnostico = real.diagnostico
  }

  /*
    ── ¿Llega a Google lo que se apunta? ────────────────────

    Se cuentan las tareas CON DÍA —las que sin más no tienen cita que
    poner— y cuántas de ellas guardan el identificador del evento de
    Google. Es la única prueba de que la cadena entera funciona, y es
    un número, no una promesa.

    Va a prueba de que la columna no exista: si `evento_google` no
    está, esto no puede tumbar la pantalla de comprobación entera.
  */
  try {
    const supa = clienteServidor()
    const { count: conFecha } = await supa
      .from('recordatorios')
      .select('id', { count: 'exact', head: true })
      .not('fecha', 'is', null)

    const { count: enGoogle, error: fallo } = await supa
      .from('recordatorios')
      .select('id', { count: 'exact', head: true })
      .not('fecha', 'is', null)
      .not('evento_google', 'is', null)

    if (!fallo) {
      const total = conFecha ?? 0
      const puestas = enGoogle ?? 0
      resultado.calendario.tareasConFecha = total
      resultado.calendario.tareasEnGoogle = puestas

      resultado.calendario.sincronizando =
        total === 0
          ? 'Todavía no hay ninguna tarea con día. En cuanto pongas una, aquí se verá si llega a Google.'
          : puestas === total
            ? `Las ${total} tareas con día tienen su cita en Google.`
            : puestas === 0
              ? `Ninguna de las ${total} tareas con día ha llegado a Google. Las de antes del arreglo se quedaron por el camino: al editarlas o marcarlas se vuelven a intentar.`
              : `${puestas} de ${total} tareas con día están en Google. Las que faltan son anteriores al arreglo; al tocarlas se vuelven a intentar.`
    }
  } catch {
    /* Si la columna no existe todavía, no se dice nada y ya está. */
  }

  /*
    ── Cómo se leen los documentos ──────────────────────────

    ESTO ESTABA MINTIENDO, Y ERA LO PEOR QUE PODÍA MENTIR.

    Decía "Cloud Vision saca el texto y HUBI lo entiende en su propio
    servidor" con solo mirar si existía la variable de Vision. Pero el
    29/8 se quitó ese desvío del código: Vision devolvía 403 —nunca se
    activó la facturación— y encima entendía con reglas, no con el
    modelo. Las fotos van al modelo desde entonces.

    La variable sigue puesta en Vercel, así que esta pantalla seguía
    diciendo que los papeles se leían en casa. Y ésta es justo la
    pantalla que existe para decir la verdad sobre dónde van los
    documentos de una familia.

    Ahora dice lo que hace el código de verdad. Y si algún día vuelve
    a cambiar, esto tiene que cambiar CON él, no después.
  */
  if (process.env.GEMINI_API_KEY) {
    resultado.lectura.motor = 'gemini'
    resultado.lectura.diagnostico =
      'Un PDF con texto dentro se lee en el propio teléfono, sin salir. ' +
      'Una FOTO de un papel se manda a Gemini, que la lee y la entiende. ' +
      'Por estar en la UE, Google no usa el contenido para entrenar.'
  } else {
    resultado.lectura.motor = 'ninguno'
    resultado.lectura.diagnostico =
      'No hay lector configurado: falta GEMINI_API_KEY. ' +
      'Los PDF con texto se seguirán leyendo, las fotos no.'
  }

  /* Cloud Vision quedó fuera el 29/8 y su archivo se borró el 29/8.
     Si la variable sigue en Vercel, se dice — para que nadie crea que
     está en uso ni la busque en el código, donde ya no está. */
  if (process.env.GOOGLE_VISION_API_KEY) {
    resultado.lectura.diagnostico +=
      ' · GOOGLE_VISION_API_KEY sigue puesta en el entorno y YA NO SE USA: se puede borrar.'
  }

  return NextResponse.json(resultado)
}
