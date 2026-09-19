import { laPared } from '@/lib/pared'
import { genteDeLaCasa } from '@/lib/gente'
import { Nada, Rotulo } from '../rotulo'
import Apuntar from './apuntar'
import Nota, { type NotaDelCorcho } from './nota'
import Fotos from '../fotos'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  NOTAS · el corcho de la casa
  ═══════════════════════════════════════════════════════════════

  Lo que alguien deja escrito para todos. «He dejado los papeles del
  seguro en la mesa.» Es el punto 16 del planteamiento, puesto donde
  siempre estuvo el corcho de una casa: en la cocina.

  ─────────────────────────────────────────────────────────────
  AQUÍ NO SE DECIDE QUÉ NOTAS SALEN

  Y es lo más importante de esta pantalla. Se piden TODAS las notas de
  la casa, sin una sola condición, porque la que filtra es la base:

      notas_solo_lo_de_la_casa_en_la_pantalla   (paso 64)
        →  not soy_pantalla_de_casa(hogar_id)
           or coalesce(visible_en_casa, false)

  Una nota privada entre dos personas no llega aquí, y no llega porque
  Postgres no la manda — no porque esta pantalla se acuerde de
  esconderla. Si filtrara también aquí habría dos reglas para lo mismo,
  y el día que una se olvide conviene que se olvide la que no protege.

  Lo que sale en la cocina se decide en Ajustes → La cocina, desde el
  móvil.

  ─────────────────────────────────────────────────────────────
  Y SIN NOMBRES

  El corcho del móvil dice de quién es cada nota. Aquí no: esto lo ve
  cualquiera que entre en la casa, incluida gente que no vive en ella.
  «He dejado los papeles en la mesa» no necesita firma para servir; con
  firma, además, cuenta quién estaba.
*/

export default async function Notas() {
  const { supabase, casa } = await laPared()

  /*
    ⚠️  AQUÍ HABÍA UN FALLO, Y DE LOS QUE NO SE VEN

    Ponía `creado_en`. La columna se llama `creada_en` —una nota es
    femenina, y así se escribió en el sql/35—. Postgres no devuelve la
    columna vacía en ese caso: **rechaza la consulta entera**. O sea que
    esta pestaña no es que saliera sin fechas: salía SIEMPRE vacía,
    diciendo «no hay nada escrito en el corcho» aunque hubiera diez
    notas puestas.

    Y no daba error en ningún sitio, porque el error se recogía en un
    `data` nulo que la pantalla interpreta como «no hay notas».

    La regla que sale de aquí: cuando una pantalla enseñe
    invariablemente su estado vacío, sospechar del nombre de las
    columnas antes que de los datos.

    ── Y lo guardado, fuera ──

    Faltaba también `guardada_en is null`. Una nota que alguien ha
    quitado de en medio desde el móvil seguía colgada en la cocina: la
    restrictiva del paso 63 filtra por `visible_en_casa`, que es otra
    cosa. Se quita de la casa, se quita de la pared.
  */
  const { data } = await supabase
    .from('notas')
    .select('id, texto, creada_en')
    .eq('hogar_id', casa)
    .is('guardada_en', null)
    .order('creada_en', { ascending: false })
    .limit(12)

  /*
    ¿Puede esta pantalla dejar una nota? Se le pregunta a la BASE, no se
    deduce aquí. Si el paso 78 no está dado, la función no existe, esto
    contesta que no y el botón no sale.

    Un botón que falla es peor que ningún botón — la misma regla que con
    lo de tachar y lo de apuntar.
  */
  const puedeDejarNotas = await (async () => {
    try {
      const { data, error } = await supabase.rpc('la_cocina_deja_notas', { casa })
      if (error) return false
      return data === true
    } catch {
      return false
    }
  })()

  /*
    ¿Y puede retirarlas del corcho? (paso 86). Otra pregunta distinta,
    y a la base otra vez: dejar clavar una nota y dejar quitarla son
    dos permisos, y uno puede estar dado y el otro no.
  */
  const puedeQuitarNotas = await (async () => {
    try {
      const { data, error } = await supabase.rpc('la_cocina_quita_notas', { casa })
      if (error) return false
      return data === true
    } catch {
      return false
    }
  })()

  const notas = (data ?? []) as NotaDelCorcho[]

  /*
    Los de la casa, con su color, para que la pizarra pueda preguntar de
    quién es el dibujo. Envuelto: si esto falla, la pizarra sigue
    abriéndose y el dibujo se guarda sin nombre. Nunca al revés — una
    pregunta de adorno no puede tumbar el botón de pintar.
  */
  const gente = await genteDeLaCasa(supabase, casa).catch(() => [])

  return (
    <section className="mt-12">
      <Rotulo>En la casa</Rotulo>

      {notas.length === 0 ? (
        <Nada>No hay nada escrito en el corcho.</Nada>
      ) : (
        /*
          Tres columnas de altura libre. Un corcho no es una lista: las
          notas son de largos muy distintos y alinearlas en filas
          dejaría huecos enormes debajo de las cortas.
        */
        <div className="mt-6 gap-4 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {notas.map((n) => (
            <Nota key={n.id} nota={n} sePuedeQuitar={puedeQuitarNotas} />
          ))}
        </div>
      )}

      {/*
        Y se puede clavar una nota desde aquí (paso 78). Va debajo del
        corcho y no encima: esta pantalla se lee mucho más de lo que se
        escribe, y un campo de texto permanente en una pared invita a
        que alguien escriba cualquier cosa al pasar.
      */}
      {puedeDejarNotas && <Apuntar />}

      {/*
        ══════════════════════════════════════════════════════════
        LAS FOTOS, QUE AHORA VIVEN AQUÍ
        ══════════════════════════════════════════════════════════

        Estaban en Hoy y se fueron de allí para que esa pantalla
        cupiera entera sin desplazarse. Podrían haberse quitado y
        punto; en vez de eso tienen dos casas, y en las dos se ven más
        que antes:

          · A pantalla completa cuando la pared descansa
            (`descanso.tsx`), que es cuando de verdad se miran.
          · Y aquí, en el corcho, que es donde ya estaban las cosas
            que la familia deja puestas para todos.

        Aquí abajo y no arriba, por lo mismo que el campo de escribir:
        el corcho se lee primero. Y con `puedeSubir`, porque **poner
        una foto desde la cocina no se podía perder** — es una de las
        tres cosas que esta pantalla sabe escribir, junto con la compra
        y las notas.
      */}
      <div className="mt-12">
        <Rotulo>En casa</Rotulo>
        <div className="max-w-[760px]">
          <Fotos
            puedeSubir
            gente={gente.map((g) => ({ id: g.id, nombre: g.nombre, color: g.color }))}
          />
        </div>
      </div>
    </section>
  )
}
