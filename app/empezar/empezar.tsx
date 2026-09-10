'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico, Logo } from '../iconos'
import {
  type Ambito,
  Aviso,
  BotonPrincipal,
  BotonTerciario,
  Campo,
  Fila,
  PastillaAmbito,
} from '../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  CREAR TU CASA · dos preguntas, una por pantalla
  ═══════════════════════════════════════════════════════════════

  Es lo primero que ve alguien que acaba de entrar en HUBI por primera
  vez, y por tanto lo que decide si se queda. Dos reglas del
  planteamiento mandan aquí más que en ningún otro sitio:

  · Punto 5 — pocas decisiones por pantalla. Las dos preguntas van
    SEPARADAS aunque cupieran juntas. Un formulario con dos campos y
    cuatro botones delante de alguien que aún no sabe qué es esto es
    un formulario que se abandona.

  · Punto 29 — la complejidad la pone el sistema. No se le pregunta
    por categorías, ni por carpetas, ni por Drive. Se le pregunta cómo
    se llama su casa y si lleva cuentas de algo; de ahí sale un árbol
    entero de carpetas y partidas que él no ha tenido que pensar.

  ─────────────────────────────────────────────────────────────
  LO QUE NO SE PREGUNTA AQUÍ: GOOGLE

  A propósito. Pedirle permiso para entrar en su Drive a los treinta
  segundos de conocerte es donde la gente cierra la pestaña. Se le
  ofrece cuando vaya a guardar su primer papel, que es cuando la
  pregunta se explica sola.
*/

type Actividad = 'finca' | 'obra' | 'alquileres' | 'ninguna'

/*
  Iconos de trazo, no emojis.

  Esta es la PRIMERA pantalla que ve alguien, y con emojis prometía un
  producto que no es el que hay detrás: dentro de HUBI todo son iconos
  de trazo. Además cada teléfono pinta el suyo —el 🧱 de Apple y el de
  Android no se parecen—, así que ni siquiera era una decisión nuestra.

  Y son EXACTAMENTE los mismos icono y color con los que va a salir
  esa actividad dos minutos después, cuando entre en su HUBI. Elegir
  «Una finca» y que aparezca una hoja verde es la primera vez que el
  producto le confirma que le ha entendido.
*/
const ACTIVIDADES: {
  id: Actividad
  icono: 'hoja' | 'casco' | 'llave' | 'casa'
  ambito: Ambito
  titulo: string
  pie: string
}[] = [
  {
    id: 'finca',
    icono: 'hoja',
    ambito: 'verde',
    titulo: 'Una finca o huerta',
    pie: 'Agua, luz, productos, maquinaria… y lo que se venda.',
  },
  {
    id: 'obra',
    icono: 'casco',
    ambito: 'arena',
    titulo: 'Obras o reformas',
    pie: 'Cada obra por separado, con albañilería, carpintería…',
  },
  {
    id: 'alquileres',
    icono: 'llave',
    ambito: 'oliva',
    titulo: 'Pisos en alquiler',
    pie: 'Cada piso por separado, y lo común repartido.',
  },
  {
    id: 'ninguna',
    icono: 'casa',
    ambito: 'pizarra',
    titulo: 'Nada de eso, solo mi casa',
    pie: 'Papeles, citas, recados y compra. Siempre puedes añadirlo después.',
  },
]

export default function Empezar({ nombre }: { nombre: string }) {
  const router = useRouter()

  const [paso, setPaso] = useState<'nombre' | 'actividad'>('nombre')
  const [comoSeLlama, setComoSeLlama] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function crear(actividad: Actividad) {
    setFallo(null)
    setOcupado(true)

    const r = await fetch('/api/casa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: comoSeLlama.trim(),
        actividad: actividad === 'ninguna' ? null : actividad,
      }),
    })

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setOcupado(false)
      setFallo(d.error ?? 'Mira la cobertura y vuelve a tocar la opción.')
      return
    }

    /* `refresh` antes de moverse: el inicio se pinta en el servidor y
       tiene que volver a leer que ahora sí hay casa. Sin esto se
       entraría a un HUBI que todavía cree que no existe. */
    router.refresh()
    router.push('/')
  }

  return (
    <main className="techo-holgado min-h-screen px-5 pb-16">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-center pt-4">
          <Logo tam={54} />
        </div>

        {paso === 'nombre' ? (
          <>
            <h1 className="t-titulo mt-7">Hola, {nombre}</h1>
            <p className="t-cuerpo mt-2 text-tenue">
              Vamos a crear tu espacio en HUBI. Son dos preguntas y ya está.
            </p>

            <Campo
              etiqueta="¿Cómo quieres llamarlo?"
              htmlFor="casa"
              ayuda="Lo que os digáis en casa. «Casa de Marta y Luis», «La finca», «Mi despacho»."
              className="mt-8"
            >
              <input
                id="casa"
                value={comoSeLlama}
                onChange={(e) => setComoSeLlama(e.target.value)}
                placeholder="Casa de Marta y Luis"
                className="entrada"
                autoFocus
                maxLength={60}
              />
            </Campo>

            <div className="mt-5">
              <BotonPrincipal
                onClick={() => {
                  setFallo(null)
                  setPaso('actividad')
                }}
                desactivado={comoSeLlama.trim().length < 2}
                porQue="Escribe primero cómo se llama"
                icono="flecha"
              >
                Continuar
              </BotonPrincipal>
            </div>
          </>
        ) : (
          <>
            <h1 className="t-titulo mt-7">¿Llevas cuentas de algo?</h1>
            <p className="t-cuerpo mt-2 text-tenue">
              Si tienes gastos e ingresos de algo concreto, HUBI te lleva las cuentas
              solo con fotografiar las facturas.
            </p>

            <div className="mt-6 space-y-3">
              {ACTIVIDADES.map((a) => (
                <Fila
                  key={a.id}
                  onClick={() => crear(a.id)}
                  desactivada={ocupado}
                  alto="alta"
                  ambito={a.ambito}
                >
                  <PastillaAmbito icono={a.icono} ambito={a.ambito} tam={48} />
                  <span className="min-w-0 flex-1">
                    <span className="t-tarjeta block">{a.titulo}</span>
                    <span className="t-apoyo mt-0.5 block">{a.pie}</span>
                  </span>
                  <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0" />
                </Fila>
              ))}
            </div>

            {/*
              ═══════════════════════════════════════════════════
              SE LE DICE QUÉ VA A APARECER, NO SE LE PREGUNTA
              ═══════════════════════════════════════════════════

              Las cinco carpetas se crean solas. Se pensó en enseñarlas
              aquí con casillas para desmarcar las que no use, y se
              descartó: en este momento todavía no sabe qué es HUBI, y
              pedirle que decida sobre cinco cosas que no ha visto
              nunca es la peor decisión posible en el peor momento.

              Se le AVISA en dos líneas —para que reconozca lo que
              aparece luego en su HUBI y en su Drive— y se le dice
              dónde se toca. Apagar «Vehículos» cuando descubra que no
              tiene coche cuesta un toque y lo hará entendiendo lo que
              hace.
            */}
            <p className="t-apoyo r-tarjeta mt-6 border border-borde px-4 py-3.5">
              Además tendrás carpetas para <strong className="text-tinta">Casa</strong>,{' '}
              <strong className="text-tinta">Salud</strong>,{' '}
              <strong className="text-tinta">Vehículos</strong>,{' '}
              <strong className="text-tinta">Seguros</strong> y{' '}
              <strong className="text-tinta">Documentos importantes</strong>. Las que no uses
              se apagan en Ajustes, y puedes añadir las que te falten.
            </p>

            <p className="t-apoyo mt-4 text-center">
              Elijas lo que elijas, se puede cambiar después.
            </p>

            {/* Era texto subrayado de 44 px de alto: por debajo del
                suelo de 48 que protege a un dedo. */}
            <div className="mt-3">
              <BotonTerciario
                onClick={() => {
                  setFallo(null)
                  setPaso('nombre')
                }}
                desactivado={ocupado}
                icono="atras"
              >
                Volver
              </BotonTerciario>
            </div>
          </>
        )}

        {ocupado && <p className="t-apoyo mt-5 text-center">Creando tu espacio…</p>}

        {fallo && (
          <div className="mt-5">
            <Aviso
              titulo="No se ha podido crear tu casa"
              explicacion={fallo}
              detalle="No se ha creado nada a medias: puedes volver a intentarlo."
            />
          </div>
        )}
      </div>
    </main>
  )
}
