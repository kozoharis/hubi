'use client'

import HubiCaja from './hubi-caja'

/*
  ═══════════════════════════════════════════════════════════════
  LA INVITACIÓN DEL INICIO · ahora se puede escribir en ella
  ═══════════════════════════════════════════════════════════════

  Era una barra de 74 px con frases que iban cambiando solas y un
  micrófono al lado. Llevaba a `/hablar` y ya está: no se podía
  escribir en ella.

  Y eso la dejaba a medias de lo que dice el planteamiento. HABLAR ·
  FOTOGRAFIAR · CONSULTAR, y aquí solo se podía hablar — en una casa
  donde alguien tiene setenta años, la voz falla más a menudo, no
  menos, y quien no puede o no quiere hablarle en voz alta al móvil en
  ese momento se quedaba sin asistente.

  Ahora es la caja de HUBI: se escribe o se habla, y las dos cosas
  acaban en el mismo sitio.

  ─────────────────────────────────────────────────────────────
  LAS FRASES SE QUEDAN, Y AHORA HACEN MÁS

  Siguen rotando, porque son la única parte de HUBI que enseña qué se
  le puede pedir: nadie lee un manual, pero todo el mundo lee una
  frase que se mueve delante de sus ojos.

  La diferencia es que antes eran un cartel y ahora son el hueco del
  campo — o sea que la frase que estás leyendo es literalmente lo que
  puedes escribir ahí. Y se paran en cuanto empiezas a escribir.

  ─────────────────────────────────────────────────────────────
  SIN NOMBRES PROPIOS

  Decía «Recuérdale a Conchita lo del médico». En casa de Juan Miguel
  eso es verdad; en cualquier otra casa es el nombre de una
  desconocida, y un ejemplo que nombra a gente que no conoces enseña a
  no fiarte de la pantalla.
*/

const FRASES = [
  '¿Qué necesitas?',
  '«Apunta un gasto de 40 € de productos»',
  '«¿Cuánto llevamos gastado en luz?»',
  '«Recuérdale mañana lo del médico»',
  '«Busca la última factura del seguro»',
]

export default function Invitacion() {
  return (
    <div className="mt-3.5">
      <HubiCaja donde="inicio" rotando={FRASES} buscarEn="/documentos" />
    </div>
  )
}
