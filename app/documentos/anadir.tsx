import { BotonSecundario } from '../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  AÑADIR UN PAPEL, DESDE DONDE VA A IR
  ═══════════════════════════════════════════════════════════════

  Faltaba, y era un rodeo diario: para guardar una factura de la luz
  había que volver al inicio, pulsar «Guardar documento» y volver a
  bajar a mano por Casa → Facturas — el mismo camino que se acababa de
  recorrer con el dedo. El punto 29 dice justo lo contrario: la
  complejidad la pone el sistema.

  Aquí abajo, al final de la carpeta, el sitio ya está decidido.

  ─────────────────────────────────────────────────────────────
  VA AL FINAL Y NO ARRIBA

  Se pensó ponerlo de primero, que es lo que haría una aplicación de
  oficina. Pero quien abre una carpeta viene A MIRAR nueve de cada
  diez veces; guardar es lo de después. Un botón grande delante de la
  lista empuja hacia abajo lo que la persona venía a leer.

  Al final está donde se llega al terminar de mirar, que es cuando de
  verdad aparece la intención de añadir algo.
*/

export default function Anadir({
  carpetaId = null,
  texto = 'Añadir documento',
}: {
  /** Dónde va. Si viene, la pantalla de guardar llega con esto puesto. */
  carpetaId?: string | null
  texto?: string
}) {
  return (
    <div className="mt-5">
      <BotonSecundario
        href={carpetaId ? `/guardar?en=${encodeURIComponent(carpetaId)}` : '/guardar'}
        icono="mas"
      >
        {texto}
      </BotonSecundario>
    </div>
  )
}
