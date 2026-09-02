import { clienteServidor } from '@/lib/supabase/servidor'
import { descifrar } from '@/lib/cifrado'
import { accesoDesdePermiso, tieneCalendario } from '@/lib/google/oauth'
import { ZONA } from '@/lib/tablon'
import { FIRMA_HUBI } from '@/lib/ical'

/*
  El calendario HUBI dentro del Google de Juan Miguel.

  Por qué un calendario aparte y no el suyo personal:

  - El permiso que pedimos, `calendar.app.created`, solo deja tocar
    calendarios que la propia aplicación haya creado. El calendario
    personal de Juan Miguel queda fuera de nuestro alcance: ni lo
    vemos. Es la misma idea que `drive.file` con los archivos.

  - Se comparte con Conchita por correo, así que a ella le aparece en
    su móvil junto a los suyos sin conectar nada. Se mantiene la regla
    del punto 3: Conchita nunca toca Google.

  - Y si algún día se quiere quitar todo, se borra un calendario y ya.
    Nada queda mezclado con lo suyo.

  Regla de oro de este archivo: **si Google falla, HUBI sigue**. Un
  recordatorio se guarda en la base de datos aunque el calendario no
  responda. Perder el evento de Google es un incordio; perder lo que
  te acaban de dictar es un fallo grave.
*/

const API = 'https://www.googleapis.com/calendar/v3'

export const NOMBRE_CALENDARIO = 'HUBI'
/* La zona horaria se decide en UN solo sitio, `lib/tablon.ts`. Aquí
   estaba escrita a mano como Europe/Madrid: en Canarias eso mete cada
   cita en el calendario con una hora de más. */
const COLOR_MARCA = '#14B8A6'

/** Los datos de conexión, o null si no se puede usar el calendario. */
async function conexion(): Promise<{ acceso: string; calendarioId: string | null } | null> {
  const supa = clienteServidor()

  const { data, error } = await supa
    .from('conexion_drive')
    .select('refresh_token_cifrado, estado, alcances, calendario_id')
    .eq('id', 1)
    .single()

  if (error || !data?.refresh_token_cifrado || data.estado !== 'activa') return null

  // El permiso guardado puede ser anterior al del calendario. No se
  // intenta nada en ese caso: fallaría con un 403 y a saber dónde.
  if (!tieneCalendario(data.alcances)) return null

  try {
    const acceso = await accesoDesdePermiso(descifrar(data.refresh_token_cifrado))
    return { acceso, calendarioId: (data.calendario_id as string | null) ?? null }
  } catch {
    return null
  }
}

async function pedir(
  acceso: string,
  ruta: string,
  opciones: RequestInit = {}
): Promise<Response> {
  return fetch(`${API}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${acceso}`,
      'Content-Type': 'application/json',
      ...(opciones.headers ?? {}),
    },
  })
}

/**
 * El calendario HUBI, creándolo la primera vez.
 *
 * Su identificador se guarda en la base de datos: sin eso se crearía
 * un calendario nuevo cada vez y Juan Miguel acabaría con veinte
 * calendarios llamados HUBI.
 */
async function asegurarCalendario(
  acceso: string,
  guardado: string | null
): Promise<string | null> {
  const supa = clienteServidor()

  // ¿El que ya teníamos sigue existiendo? Puede haberlo borrado a mano.
  if (guardado) {
    const r = await pedir(acceso, `/calendars/${encodeURIComponent(guardado)}`)
    if (r.ok) {
      /*
        Y DE PASO: QUE LA ZONA DEL CALENDARIO SEA LA DE AQUÍ.

        El calendario se creó con la zona que hubiera puesta ese día, y
        durante un tiempo aquí decía Europe/Madrid. Cada evento lleva
        ahora su zona escrita, así que las citas nuevas caen bien igual
        — pero el calendario en sí sigue anunciando la otra, y eso se
        nota al mirarlo desde el móvil o al crear algo a mano dentro de
        él. Se corrige una vez, en silencio, y no se vuelve a tocar.
      */
      const info = (await r.json().catch(() => null)) as { timeZone?: string } | null
      if (info && info.timeZone !== ZONA) {
        await pedir(acceso, `/calendars/${encodeURIComponent(guardado)}`, {
          method: 'PATCH',
          body: JSON.stringify({ timeZone: ZONA }),
        }).catch(() => null)
      }
      return guardado
    }
    if (r.status !== 404 && r.status !== 410) return null
  }

  const creado = await pedir(acceso, '/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: NOMBRE_CALENDARIO,
      description: 'Las citas y los vencimientos de HUBI. Se llena solo.',
      timeZone: ZONA,
    }),
  })

  if (!creado.ok) return null
  const { id } = (await creado.json()) as { id?: string }
  if (!id) return null

  // El color de la marca, para distinguirlo de un vistazo entre los
  // demás calendarios del móvil.
  await pedir(acceso, `/users/me/calendarList/${encodeURIComponent(id)}?colorRgbFormat=true`, {
    method: 'PATCH',
    body: JSON.stringify({ backgroundColor: COLOR_MARCA, foregroundColor: '#0F172A' }),
  }).catch(() => null)

  await supa.from('conexion_drive').update({ calendario_id: id }).eq('id', 1)
  return id
}

/**
 * Intenta compartir el calendario con la otra persona.
 *
 * Aviso importante: con el permiso que tenemos —`calendar.app.created`—
 * Google NO deja compartir. El método que reparte permisos de un
 * calendario (Acl.insert) exige `calendar` o `calendar.acls`, que son
 * permisos «sensibles»: obligan a pasar la verificación de Google y a
 * que Juan Miguel vea una pantalla de advertencia cada vez que conecta.
 *
 * Para dos personas y un calendario que se comparte UNA vez en la
 * vida, eso es un precio absurdo. Así que se intenta —por si algún día
 * se añade el permiso— y, si Google dice que no, se devuelve
 * 'a-mano' y HUBI explica los tres pasos para hacerlo desde Google.
 */
export type Reparto = 'compartido' | 'a-mano' | 'fallo'

export async function compartirCon(correo: string): Promise<Reparto> {
  const c = await conexion()
  if (!c) return 'fallo'

  const id = await asegurarCalendario(c.acceso, c.calendarioId)
  if (!id) return 'fallo'

  const r = await pedir(c.acceso, `/calendars/${encodeURIComponent(id)}/acl`, {
    method: 'POST',
    body: JSON.stringify({
      role: 'writer',
      scope: { type: 'user', value: correo },
    }),
  })

  // 409: ya estaba compartido. Eso es éxito, no error.
  if (r.ok || r.status === 409) return 'compartido'

  // 401/403: falta el permiso. No es una avería: es lo esperado.
  if (r.status === 401 || r.status === 403) return 'a-mano'

  return 'fallo'
}

export type Cita = {
  titulo: string
  fecha: string // AAAA-MM-DD
  hora: string | null // HH:MM
  nota: string | null
  hecho: boolean
}

function cuerpoDelEvento(cita: Cita) {
  const base = {
    summary: cita.hecho ? `✓ ${cita.titulo}` : cita.titulo,
    /* La firma sale de `lib/ical.ts` y no está escrita a mano aquí a
       propósito: es la misma marca que se busca al LEER el calendario
       para no enseñar dos veces lo que HUBI ya tiene. Si las dos se
       escribieran por separado, un día dejarían de coincidir y las
       citas empezarían a duplicarse sin que nadie supiera por qué. */
    description: [cita.nota, FIRMA_HUBI].filter(Boolean).join('\n\n'),
  }

  // Sin hora es un evento de día completo. Google quiere el día
  // siguiente como final, no el mismo.
  if (!cita.hora) {
    const fin = new Date(cita.fecha + 'T12:00:00Z')
    fin.setUTCDate(fin.getUTCDate() + 1)
    return {
      ...base,
      start: { date: cita.fecha },
      end: { date: fin.toISOString().slice(0, 10) },
    }
  }

  /*
    Con hora: una hora de duración. No sabemos cuánto dura una cita
    médica, y bloquear el día entero sería peor que quedarse corto.

    OJO CON LAS ONCE DE LA NOCHE. Aquí había un fallo silencioso: la
    hora final se calculaba con `(h + 1) % 24`, así que una cita a las
    23:30 terminaba a las 00:30 DEL MISMO DÍA — es decir, antes de
    empezar. Google rechaza eso con un 400, `ponerCita` devuelve null y
    la tarea se queda en HUBI sin aparecer nunca en el calendario, sin
    que nadie vea un error por ninguna parte.

    Se pasa al día siguiente, que es lo que significa de verdad.
  */
  const [h, m] = cita.hora.split(':').map(Number)
  const alDiaSiguiente = h + 1 >= 24
  const fin = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const diaFin = alDiaSiguiente ? sumarUnDia(cita.fecha) : cita.fecha

  return {
    ...base,
    start: { dateTime: `${cita.fecha}T${cita.hora}:00`, timeZone: ZONA },
    end: { dateTime: `${diaFin}T${fin}:00`, timeZone: ZONA },
  }
}

function sumarUnDia(iso: string): string {
  const f = new Date(iso + 'T12:00:00Z')
  f.setUTCDate(f.getUTCDate() + 1)
  return f.toISOString().slice(0, 10)
}

/*
  EL IDENTIFICADOR DEL CALENDARIO HUBI, SIN LLAMAR A GOOGLE.

  Hace falta en un sitio muy concreto: cuando alguien va a conectar su
  calendario de Google por la dirección secreta, hay que comprobar que
  no esté pegando LA DEL PROPIO CALENDARIO HUBI. Si lo hiciera, cada
  tarea saldría dos veces en la Agenda —una como tarea de HUBI y otra
  como cita traída de Google— y nadie entendería por qué.
*/
export async function idCalendarioHubi(): Promise<string | null> {
  try {
    const supa = clienteServidor()
    const { data } = await supa
      .from('conexion_drive')
      .select('calendario_id')
      .eq('id', 1)
      .maybeSingle()
    return (data?.calendario_id as string | null) ?? null
  } catch {
    return null
  }
}

/**
 * Escribe la cita en el calendario y devuelve el id del evento.
 *
 * Si ya había uno, lo actualiza. Devuelve null cuando no se ha podido
 * —sin permiso, sin conexión, Google caído— y quien llama sigue como
 * si nada: la cita ya está guardada en HUBI, que es lo que importa.
 */
export async function ponerCita(
  cita: Cita,
  eventoAnterior?: string | null
): Promise<string | null> {
  try {
    const c = await conexion()
    if (!c) return null

    const id = await asegurarCalendario(c.acceso, c.calendarioId)
    if (!id) return null

    const cuerpo = JSON.stringify(cuerpoDelEvento(cita))

    if (eventoAnterior) {
      const r = await pedir(
        c.acceso,
        `/calendars/${encodeURIComponent(id)}/events/${encodeURIComponent(eventoAnterior)}`,
        { method: 'PATCH', body: cuerpo }
      )
      if (r.ok) return eventoAnterior
      // Si el evento ya no existe (lo borraron a mano) se crea otro.
      if (r.status !== 404 && r.status !== 410) return null
    }

    const r = await pedir(c.acceso, `/calendars/${encodeURIComponent(id)}/events`, {
      method: 'POST',
      body: cuerpo,
    })
    if (!r.ok) return null

    const { id: evento } = (await r.json()) as { id?: string }
    return evento ?? null
  } catch {
    return null
  }
}

/** Quita la cita del calendario. Nunca lanza. */
export async function quitarCita(evento: string): Promise<void> {
  try {
    const c = await conexion()
    if (!c?.calendarioId) return

    await pedir(
      c.acceso,
      `/calendars/${encodeURIComponent(c.calendarioId)}/events/${encodeURIComponent(evento)}`,
      { method: 'DELETE' }
    )
  } catch {
    // Da igual: en HUBI ya está borrado.
  }
}

/**
 * Lo que sabemos del calendario SIN llamar a Google.
 *
 * Se usa al pintar Ajustes: allí no se puede pedir un token a Google
 * cada vez que alguien abre la pantalla —tardaría— y tampoco hace
 * falta. Con lo que hay en la base de datos basta.
 *
 * Va a prueba de columnas que todavía no existan: si la migración no
 * se ha ejecutado, esto devuelve «no preparado» en vez de tumbar la
 * pantalla entera. Ya nos pasó una vez con la foto del perfil.
 */
export async function estadoGuardado(): Promise<{
  permiso: boolean
  creado: boolean
}> {
  try {
    const supa = clienteServidor()
    const { data, error } = await supa
      .from('conexion_drive')
      .select('alcances, calendario_id')
      .eq('id', 1)
      .maybeSingle()

    if (error || !data) return { permiso: false, creado: false }

    return {
      permiso: tieneCalendario(data.alcances as string | null),
      creado: Boolean(data.calendario_id),
    }
  } catch {
    return { permiso: false, creado: false }
  }
}

/** Para la pantalla de comprobación: ¿existe ya el calendario? */
export async function estadoCalendario(): Promise<{
  puedeUsarse: boolean
  creado: boolean
  id: string | null
}> {
  const c = await conexion()
  if (!c) return { puedeUsarse: false, creado: false, id: null }
  return { puedeUsarse: true, creado: c.calendarioId != null, id: c.calendarioId }
}

/*
  ¿EXISTE DE VERDAD EL CALENDARIO HUBI?

  `estadoGuardado()` solo mira si tenemos un identificador apuntado en
  nuestra base de datos. Eso no demuestra que el calendario exista:
  demuestra que un día lo creamos. Si alguien lo borró desde Google, o
  se creó en otra cuenta, seguiríamos diciendo "creado" tan tranquilos
  — que es exactamente lo que el punto 26 prohíbe.

  Esto se lo pregunta a Google. Dos cosas distintas, porque fallan por
  motivos distintos:

  1. Que el calendario EXISTA.
  2. Que esté en LA LISTA de calendarios de la cuenta. Un calendario
     puede existir y no estar en la lista, y entonces no se ve en
     ningún sitio aunque esté ahí.

  Y aun estando las dos bien, en el MÓVIL puede seguir sin verse: la
  aplicación de Google Calendar del teléfono no enseña los calendarios
  nuevos hasta que se activan a mano en sus ajustes. Eso ya no lo
  podemos comprobar desde aquí, pero conviene saberlo antes de ponerse
  a buscar una avería que no existe.
*/
export async function comprobarCalendario(): Promise<{
  existe: boolean
  enLaLista: boolean
  nombre: string | null
  id: string | null
  diagnostico: string
}> {
  const nada = { existe: false, enLaLista: false, nombre: null, id: null }

  const c = await conexion()
  if (!c) {
    return { ...nada, diagnostico: 'Google no está conectado, o falta el permiso del calendario.' }
  }
  if (!c.calendarioId) {
    return { ...nada, diagnostico: 'Todavía no se ha creado el calendario HUBI.' }
  }

  try {
    const r = await pedir(c.acceso, `/calendars/${encodeURIComponent(c.calendarioId)}`)
    if (!r.ok) {
      return {
        ...nada,
        id: c.calendarioId,
        diagnostico:
          r.status === 404
            ? 'Tenemos apuntado un calendario que en Google ya no existe. Hay que volver a crearlo.'
            : `Google responde ${r.status} al preguntar por el calendario.`,
      }
    }

    const info = (await r.json()) as { summary?: string }

    /* ¿Está en la lista de la cuenta? Existir y estar a la vista no es
       lo mismo. */
    const enLista = await pedir(
      c.acceso,
      `/users/me/calendarList/${encodeURIComponent(c.calendarioId)}`
    )

    return {
      existe: true,
      enLaLista: enLista.ok,
      nombre: info.summary ?? null,
      id: c.calendarioId,
      diagnostico: enLista.ok
        ? `Existe y está en la cuenta: "${info.summary ?? NOMBRE_CALENDARIO}". Si no lo ves en el móvil, actívalo en los ajustes de la app de Google Calendar.`
        : 'El calendario existe pero NO está en la lista de la cuenta, así que no se ve en ninguna parte.',
    }
  } catch (e) {
    return {
      ...nada,
      id: c.calendarioId,
      diagnostico: e instanceof Error ? e.message : 'No se ha podido preguntar a Google.',
    }
  }
}
