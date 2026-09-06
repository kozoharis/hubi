import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { quien } from '@/lib/supabase/quien'
import { miHogar, mandaEnSuCasa, SIN_CASA } from '@/lib/hogar'

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

  let cuerpo: { correo?: string; nombre?: string; papel?: string }
  try {
    cuerpo = (await peticion.json()) as { correo?: string; nombre?: string; papel?: string }
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
    QUÉ VA A PODER HACER.

    Solo dos, y a propósito. Una tabla de permisos por sección es
    justo la complejidad empresarial que el punto 28 descarta, y estas
    dos cubren lo que la gente pide de verdad: la pareja entra
    completa, un hijo o un gestor solo mira.

    Lo que no esté en la lista es 'miembro'. Nunca se pasa a la base
    de datos algo que venga del navegador sin comprobarlo.
  */
  const papel = cuerpo.papel === 'lector' ? 'lector' : 'miembro'

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
  const { data: metida, error: alMeter } = await admin
    .from('miembros')
    .insert({ hogar_id: hogarId, perfil_id: id, papel, aceptado_en: null })
    .select('perfil_id')

  /* Con el `.select()`: sin él, una inserción que no entre devuelve
     «todo bien» habiendo metido cero filas. */
  if (alMeter || !metida || metida.length === 0) {
    console.error('[HUBI] La persona no ha entrado en la casa:', alMeter)
    return NextResponse.json(
      { error: 'No se ha podido meterla en tu casa.', detalle: alMeter?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true, correo, nombre, papel, pendiente: true })
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
