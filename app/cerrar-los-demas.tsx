'use client'

import { useState } from 'react'
import { clienteNavegador } from '@/lib/supabase/navegador'
import { BotonSecundario, Aviso } from './piezas'

/*
  ═══════════════════════════════════════════════════════════════
  CERRAR mappel EN LOS DEMÁS APARATOS
  ═══════════════════════════════════════════════════════════════

  Haris: *«¿has puesto que en el móvil se vea en cuántas ubicaciones
  tienes abierta la app? Eso creo que es importante»*.

  Y lo es, pero la respuesta se parte en dos mitades muy distintas, y
  esto es la que de verdad protege.

  ─────────────────────────────────────────────────────────────
  POR QUÉ NO SE ENSEÑA LA LISTA

  Supabase **no tiene API pública** para enumerar las sesiones de
  alguien. La tabla existe —`auth.sessions`— pero su documentación
  sólo la contempla para comprobar si una sesión sigue viva, no para
  leerla. Se podría consultar con la llave de servicio, y entonces
  esta pantalla dependería de una tabla interna suya: el día que la
  cambien en una actualización, o se rompe, o —mucho peor— **miente**
  y dice «un sitio» cuando hay tres. Una pantalla de seguridad que se
  equivoca es peor que no tenerla, porque tranquiliza.

  Y «ubicación» significa geolocalizar la IP con un servicio externo.
  Para la cuenta de uno mismo es razonable; convertirlo en «dónde
  tiene Julia la app abierta» ya no es seguridad, es vigilancia. Se
  decidió no entrar ahí.

  ─────────────────────────────────────────────────────────────
  LO QUE SÍ SE PUEDE, Y ES LO QUE HACE FALTA

  `signOut({ scope: 'others' })` está documentado y cierra todas las
  sesiones MENOS ésta. Saber cuántas hay es informativo; poder
  cerrarlas es lo que arregla el problema. Ante la duda —un ordenador
  prestado, un móvil viejo que se vendió— se pulsa esto y se acabó.

  `others` y no `global` a propósito: `global` cerraría también la de
  este teléfono, y a quien acaba de pulsar un botón de seguridad no se
  le echa fuera de golpe. Aquí no pasa nada debajo de tus manos.

  ─────────────────────────────────────────────────────────────
  Y DICE QUE LO HA HECHO

  Esta acción no cambia nada que se vea: sin un mensaje, el botón
  parecería no haber funcionado y se pulsaría tres veces. Así que
  contesta, y cuando falla también lo dice.

  No lleva confirmación. Es reversible con el código de seis cifras de
  siempre —«acciones importantes fácilmente reversibles»— y sólo
  afecta a TU cuenta: no echa a nadie más de la casa.
*/
export default function CerrarLosDemas() {
  const [yendo, setYendo] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [fallo, setFallo] = useState(false)

  async function cerrar() {
    setYendo(true)
    setFallo(false)
    const { error } = await clienteNavegador().auth.signOut({ scope: 'others' })
    setYendo(false)
    if (error) {
      setFallo(true)
      return
    }
    setHecho(true)
  }

  if (hecho) {
    return (
      <Aviso
        tono="bien"
        titulo="Cerrado en los demás sitios"
        explicacion="Donde estuviera abierto habrá que volver a entrar con el código. Aquí sigues dentro."
      />
    )
  }

  return (
    <>
      <p className="text-[15px] font-semibold leading-snug text-tenue">
        Si te has dejado mappel abierto en otro sitio —un ordenador prestado, un
        móvil que ya no usas—, esto lo cierra en todos menos en éste.
      </p>

      <div className="mt-2.5">
        <BotonSecundario onClick={cerrar} desactivado={yendo} icono="escudo">
          {yendo ? 'Cerrando…' : 'Cerrar mappel en los demás aparatos'}
        </BotonSecundario>
      </div>

      {fallo && (
        <div className="mt-3">
          <Aviso
            tono="alerta"
            titulo="No se ha podido cerrar"
            explicacion="Vuelve a intentarlo. Si sigue sin poder, sal de mappel aquí abajo y vuelve a entrar: eso cierra esta sesión con seguridad."
          />
        </div>
      )}
    </>
  )
}
