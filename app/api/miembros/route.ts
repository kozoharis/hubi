import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { quien } from '@/lib/supabase/quien'
import { miHogar, mandaEnSuCasa, SIN_CASA } from '@/lib/hogar'
import { esRol, type Rol } from '@/lib/roles'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  INVITAR A ALGUIEN A TU CASA
  ═══════════════════════════════════════════════════════════════

  Sin esto, HUBI solo servía para una persona por casa. Se podía crear
  una casa, pero no meter a nadie más en ella — y toda la aplicación
  está pensada alrededor de dos: el tablón, los recados, «para los
  dos», el aviso de «Conchita te ha dejado una tarea».

  ─────────────────────────────────────────────────────────────
  CÓMO FUNCIONA, Y POR QUÉ ASÍ

  Se crea su cuenta y se la mete en el hogar de quien invita. A partir
  de ese momento esa persona entra por la pantalla de siempre —su
  correo, su número— y aparece DENTRO de esta casa, sin pantalla de
  empezar y sin conectar ningún Drive: usa el de quien lo conectó.

  Es el camino por el que entró Conchita, ahora sin tocar SQL.

  No se manda ningún correo de invitación: HUBI todavía escribe desde
  el Gmail personal de Juan Miguel, y mandar correos a desconocidos
  desde ahí no se sostiene. Quien invita le dice a la otra persona
  «entra con tu correo», que además es más fiable que un correo que
  puede caer en spam.

  ─────────────────────────────────────────────────────────────
  QUIÉN PUEDE INVITAR

  Solo quien creó la casa. No es jerarquía por gusto: quien invita
  está dando acceso a las facturas, los informes médicos y el Drive de
  todos los que ya están dentro. Esa decisión es de quien montó la
  casa, no de cualquiera que pase por ella.
*/

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 403 })

  if (!(await mandaEnSuCasa(supabase, user.id))) {
    return NextResponse.json(
      { error: 'Solo quien creó esta casa puede invitar a alguien.' },
      { status: 403 }
    )
  }

  let cuerpo: { correo?: string; nombre?: string; papel?: string; rol?: string; hasta?: string }
  try {
    cuerpo = (await peticion.json()) as {
      correo?: string
      nombre?: string
      papel?: string
      rol?: string
      hasta?: string
    }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const correo = String(cuerpo.correo ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return NextResponse.json({ error: 'Ese correo no parece correcto.' }, { status: 400 })
  }

  /*
    EL NOMBRE, DESDE EL PRINCIPIO.

    Sin esto, la persona invitada aparecía en toda la aplicación como
    el trozo de delante de la arroba —«kozoharis»— hasta que ella
    misma se pusiera nombre. Y eso sale en sitios donde importa:
    «Para kozoharis», «kozoharis te ha dejado una tarea». Quien invita
    sabe cómo se llama; solo hay que preguntárselo.

    Es lo que se ve, no una identidad: si luego ella lo cambia en su
    perfil, manda el suyo.
  */
  const nombre = String(cuerpo.nombre ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
  if (nombre.length < 2) {
    return NextResponse.json({ error: '¿Cómo se llama?' }, { status: 400 })
  }

  /*
    QUIÉN ES, Y HASTA CUÁNDO.

    Antes eran dos opciones —«todo, como tú» o «solo mirar»— y eso
    deja fuera a casi todo el mundo real: quien ayuda en casa no
    necesita las facturas del seguro, y un asesor necesita eso y nada
    más.

    Ahora es un rol, que es un ATAJO: al ponerlo, `poner_rol` rellena
    el papel, el ve_todo y los permisos carpeta a carpeta que ya
    existían. Ninguna política pregunta por el rol — si lo hiciera,
    habría dos fuentes de verdad y ahí se filtran las cosas.

    Lo que no esté en la lista es 'familia'. Nunca se pasa a la base
    de datos algo que venga del navegador sin comprobarlo. Y `papel`
    se sigue admitiendo por si alguna pantalla vieja lo manda.
  */
  const rol: Rol = esRol(cuerpo.rol)
    ? cuerpo.rol
    : cuerpo.papel === 'lector'
      ? 'mirar'
      : 'familia'

  const papel = rol === 'asesor' || rol === 'mirar' ? 'lector' : 'miembro'

  /* Hasta cuándo. Una fecha suelta o nada: quien no la pone, no
     caduca. Se comprueba que sea una fecha y que sea futura — una
     fecha pasada dejaría a esa persona fuera desde el primer día sin
     que nadie entendiera por qué. */
  const hoy = new Date().toISOString().slice(0, 10)
  const hasta =
    typeof cuerpo.hasta === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(cuerpo.hasta) &&
    cuerpo.hasta > hoy
      ? cuerpo.hasta
      : null

  const admin = clienteServidor()

  /* ¿Existe ya esa cuenta? Se mira de verdad, no se deduce del texto
     de un error. */
  const { data: lista, error: alBuscar } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })

  if (alBuscar) {
    console.error('[HUBI] No se ha podido leer las cuentas:', alBuscar)
    return NextResponse.json(
      { error: 'No se ha podido invitar.', detalle: alBuscar.message },
      { status: 500 }
    )
  }

  let id = (lista?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === correo)?.id ?? null

  if (!id) {
    const { data: creada, error } = await admin.auth.admin.createUser({
      email: correo,
      email_confirm: true,
    })

    if (error || !creada?.user?.id) {
      console.error('[HUBI] No se ha podido crear la cuenta invitada:', error)
      return NextResponse.json(
        { error: 'No se ha podido crear su cuenta.', detalle: error?.message },
        { status: 500 }
      )
    }
    id = creada.user.id
  }

  /*
    ¿YA ESTÁ EN ESTA CASA?

    Solo en ÉSTA. Antes se rechazaba a cualquiera que estuviera en
    otra —«cada persona pertenece a una sola»— y eso era una
    limitación técnica disfrazada de regla: castigaba a quien hubiera
    entrado en HUBI primero. El hijo que tiene su casa y además ayuda
    con la de sus padres es un caso normal, no una excepción.

    Desde sql/34 una persona puede estar en varias y elegir cuál mira.
  */
  const { data: yaEsta } = await admin
    .from('miembros')
    .select('hogar_id, aceptado_en')
    .eq('perfil_id', id)
    .eq('hogar_id', hogarId)
    .maybeSingle()

  if (yaEsta) {
    return NextResponse.json(
      {
        error: yaEsta.aceptado_en
          ? 'Esa persona ya está en tu casa.'
          : 'Ya le invitaste. Está pendiente de que ella acepte.',
      },
      { status: 409 }
    )
  }

  /*
    El nombre va ANTES de meterla en la casa. Si esto falla, no ha
    entrado todavía y quien invita ve un error honesto; al revés,
    tendríamos a alguien dentro llamándose «kozoharis» y un error que
    parece decir que no ha entrado.

    `nombre` es obligatorio en `perfiles`, así que la fila ya existe:
    la crea un disparador al nacer la cuenta. Aquí solo se cambia.
  */
  /*
    El nombre solo si no tiene el suyo puesto.

    Antes se sobrescribía siempre. Con gente que ya usa HUBI eso
    significaría que invitar a alguien le CAMBIA el nombre en su
    propia casa — donde lleva meses llamándose como él quiso.
  */
  const { data: comoSeLlama } = await admin
    .from('perfiles')
    .select('nombre')
    .eq('id', id)
    .maybeSingle()

  const suyoEsElCorreo =
    !comoSeLlama?.nombre || comoSeLlama.nombre === correo.split('@')[0]

  const { error: alNombrar } = suyoEsElCorreo
    ? await admin.from('perfiles').update({ nombre }).eq('id', id).select('id')
    : { error: null }

  if (alNombrar) {
    console.error('[HUBI] No se ha podido ponerle nombre:', alNombrar)
    return NextResponse.json(
      { error: 'No se ha podido invitar.', detalle: alNombrar.message },
      { status: 500 }
    )
  }

  /*
    SE INVITA, NO SE METE.

    `aceptado_en` a nulo: la fila existe —así los permisos por carpeta
    se pueden preparar desde ya— pero esa casa todavía no existe para
    esa persona. Ni la ve, ni cuenta como suya, ni se le puede
    activar, hasta que diga que sí.

    Meter a alguien en tu casa sin preguntarle era aceptable cuando
    nadie tenía cuenta antes de ser invitado. Con gente que ya usa
    HUBI, no.
  */
  /*
    El rol y la fecha de fin se piden APARTE del insert principal, en
    dos intentos. Son columnas del SQL 37: si no se ha ejecutado,
    meterlas aquí no falla esas columnas — hace que Postgres rechace
    la fila ENTERA, y el resultado sería que no se puede invitar a
    nadie. Una función a medio instalar no puede tumbar la que
    funcionaba.
  */
  const fila: Record<string, unknown> = {
    hogar_id: hogarId,
    perfil_id: id,
    papel,
    aceptado_en: null,
  }

  let conRol = await admin
    .from('miembros')
    .insert({ ...fila, rol, acceso_hasta: hasta })
    .select('perfil_id')

  if (conRol.error) {
    console.error('[HUBI] Sin rol todavía (¿falta el SQL 37?):', conRol.error)
    conRol = await admin.from('miembros').insert(fila).select('perfil_id')
  }

  const { data: metida, error: alMeter } = conRol

  /* Con el `.select()`: sin él, una inserción que no entre devuelve
     «todo bien» habiendo metido cero filas. */
  if (alMeter || !metida || metida.length === 0) {
    console.error('[HUBI] La persona no ha entrado en la casa:', alMeter)
    return NextResponse.json(
      { error: 'No se ha podido meterla en tu casa.', detalle: alMeter?.message },
      { status: 500 }
    )
  }

  /*
    Y ahora el rol de verdad: `poner_rol` reparte los permisos por
    carpeta que le tocan. Va DESPUÉS de meterla —la función exige que
    ya esté en la casa— y con la SESIÓN, porque comprueba que quien
    llama sea quien creó la casa.

    Si falla, la persona está invitada igualmente: se le queda el
    permiso base y quien invita puede repartírselo a mano desde
    «¿Qué puede ver?». Se dice, no se esconde.
  */
  let repartido = true
  try {
    const { error: alRepartir } = await supabase.rpc('poner_rol', {
      a_quien: id,
      el_rol: rol,
    })
    if (alRepartir) {
      console.error('[HUBI] Invitada pero sin repartir el rol:', alRepartir)
      repartido = false
    }
  } catch (e) {
    console.error('[HUBI] Invitada pero sin repartir el rol:', e)
    repartido = false
  }

  return NextResponse.json({ bien: true, correo, nombre, papel, rol, hasta, repartido, pendiente: true })
}

/*
  ─────────────────────────────────────────────────────────────
  SACAR A ALGUIEN

  No se borra su cuenta: se la saca de esta casa. Sus cosas —los
  papeles que subió, los apuntes— se quedan, porque son de la casa y
  no suyos: borrarlos dejaría agujeros en las cuentas de todos.

  Y no se puede sacar a quien manda: es la persona cuyo Google Drive
  guarda todos los documentos. Sacarla dejaría a la casa entera sin
  poder abrir ni un papel.
*/
export async function DELETE(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 403 })

  if (!(await mandaEnSuCasa(supabase, user.id))) {
    return NextResponse.json(
      { error: 'Solo quien creó esta casa puede sacar a alguien.' },
      { status: 403 }
    )
  }

  const id = new URL(peticion.url).searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'Falta la persona.' }, { status: 400 })

  if (id === user.id) {
    return NextResponse.json(
      { error: 'No puedes sacarte a ti mismo: el Drive de la casa es tuyo.' },
      { status: 400 }
    )
  }

  const admin = clienteServidor()

  const { data: fuera, error } = await admin
    .from('miembros')
    .delete()
    .eq('hogar_id', hogarId)
    .eq('perfil_id', id)
    .neq('papel', 'propietario')
    .select('perfil_id')

  if (error || !fuera || fuera.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido sacar a esa persona.', detalle: error?.message },
      { status: error ? 500 : 409 }
    )
  }

  return NextResponse.json({ bien: true })
}

/*
  ─────────────────────────────────────────────────────────────
  CAMBIAR EL ROL DE ALGUIEN, O SU FECHA DE FIN

  Hacía falta y no estaba: se elegía al invitar y ya no había manera
  de rectificar. Y rectificar es justo lo que pasa en la vida real —
  quien entró para ayudar con la compra acaba llevando también los
  papeles, o al revés.

  El rol lo pone `poner_rol`, que es quien reparte los permisos por
  carpeta. Aquí no se toca `miembros` a mano para eso: si el reparto
  viviera en dos sitios, un día uno de los dos se quedaría sin
  actualizar y alguien tendría un rol puesto y los permisos de otro.
*/
export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 403 })

  if (!(await mandaEnSuCasa(supabase, user.id))) {
    return NextResponse.json(
      { error: 'Solo quien creó esta casa reparte los accesos.' },
      { status: 403 }
    )
  }

  let cuerpo: { id?: string; rol?: string; hasta?: string | null }
  try {
    cuerpo = (await peticion.json()) as { id?: string; rol?: string; hasta?: string | null }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const id = String(cuerpo.id ?? '')
  if (!id) return NextResponse.json({ error: 'Falta la persona.' }, { status: 400 })

  if (id === user.id) {
    return NextResponse.json(
      { error: 'No puedes cambiarte el rol a ti mismo: el Drive de la casa es tuyo.' },
      { status: 400 }
    )
  }

  // ── El rol, con todo lo que arrastra ──────────────────────
  if (cuerpo.rol !== undefined) {
    if (!esRol(cuerpo.rol)) {
      return NextResponse.json({ error: 'Ese rol no existe.' }, { status: 400 })
    }

    const { error } = await supabase.rpc('poner_rol', { a_quien: id, el_rol: cuerpo.rol })

    if (error) {
      console.error('[HUBI] No se ha podido cambiar el rol:', error)
      return NextResponse.json(
        {
          error: 'No se ha podido cambiar el rol.',
          detalle: error.message ?? 'Puede que falte ejecutar el SQL 37.',
        },
        { status: 500 }
      )
    }
  }

  // ── Y hasta cuándo entra ──────────────────────────────────
  /*
    `undefined` es «no lo toques»; `null` es «quítale la fecha». Son
    dos cosas distintas y confundirlas aquí borraría fechas de fin sin
    que nadie lo pidiera.
  */
  if (cuerpo.hasta !== undefined) {
    const hoy = new Date().toISOString().slice(0, 10)
    const hasta =
      typeof cuerpo.hasta === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(cuerpo.hasta) &&
      cuerpo.hasta > hoy
        ? cuerpo.hasta
        : null

    const admin = clienteServidor()
    const { data, error } = await admin
      .from('miembros')
      .update({ acceso_hasta: hasta })
      .eq('hogar_id', hogarId)
      .eq('perfil_id', id)
      .select('perfil_id')

    if (error || !data || data.length === 0) {
      console.error('[HUBI] No se ha podido cambiar la fecha de fin:', error)
      return NextResponse.json(
        {
          error: 'No se ha podido cambiar la fecha.',
          detalle: error?.message ?? 'Puede que falte ejecutar el SQL 37.',
        },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ bien: true })
}
