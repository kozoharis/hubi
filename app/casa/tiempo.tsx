import { COMO_SE_LLAMA, elCielo, elTiempo, type Cielo } from '@/lib/tiempo'
import { Ico, type Icono } from '../iconos'
import { AMBITO } from '../piezas'
import { Rotulo } from './rotulo'

/*
  ═══════════════════════════════════════════════════════════════
  EL TIEMPO EN LA PARED
  ═══════════════════════════════════════════════════════════════

  Hoy grande, y los tres días siguientes pequeños. Nada más.

  ─────────────────────────────────────────────────────────────
  POR QUÉ TRES DÍAS Y NO SIETE

  Porque a partir del cuarto día la previsión deja de acertar lo
  suficiente como para decidir algo, y en una cocina lo que se hace con
  esto es DECIDIR: si se riega, si se tiende, si se adelanta la
  recogida. Siete columnas serían cuatro de adorno.

  ─────────────────────────────────────────────────────────────
  Y LA LLUVIA SE DICE CON PALABRAS

  «60 %» obliga a traducir. «Puede llover» no. El porcentaje solo sale
  cuando es alto, y entonces sale como aviso y no como dato — que es lo
  que de verdad significa.

  ─────────────────────────────────────────────────────────────
  SI NO LLEGA, NO SALE

  Ni mensaje de error ni hueco gris. Una pared que dice «no se ha podido
  cargar el tiempo» es un cartel de avería colgado en la cocina todo el
  día. Si la previsión falla, esta esquina no existe hoy y mañana
  vuelve.
*/

const DIBUJO: Record<Cielo, Icono> = {
  sol: 'sol',
  nubes: 'nube',
  cubierto: 'nube',
  niebla: 'niebla',
  lluvia: 'lluvia',
  tormenta: 'tormenta',
  nieve: 'nieve',
}

/* El color solo distingue lo que hay que tener en cuenta de lo que no.
   El sol no es «bueno» ni la lluvia «mala» —en una finca en verano es
   justo al revés—: el arena es para lo despejado y el azul para cuando
   cae agua, que es lo único que cambia lo que se hace ese día. */
const COLOR: Record<Cielo, string> = {
  sol: AMBITO.arena,
  nubes: AMBITO.arena,
  cubierto: AMBITO.pizarra,
  niebla: AMBITO.pizarra,
  lluvia: AMBITO.azul,
  tormenta: AMBITO.violeta,
  nieve: AMBITO.azul,
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export default async function Tiempo() {
  const t = await elTiempo()
  if (!t || t.dias.length === 0) return null

  const hoy = t.dias[0]
  const cieloHoy = elCielo(t.codigoAhora)
  const color = COLOR[cieloHoy]

  /* De los cuatro días que se piden, el primero es hoy. */
  const siguientes = t.dias.slice(1, 4)

  return (
    <section>
      <Rotulo>El tiempo</Rotulo>

      <div className="mt-6 rounded-[28px] border border-borde bg-superficie px-7 py-6">
        {/* ── Hoy ── */}
        <div className="flex items-center gap-6">
          <span
            className="flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-[26px]"
            style={{
              background: `color-mix(in srgb, ${color} 16%, var(--t-superficie))`,
              color,
            }}
          >
            <Ico nombre={DIBUJO[cieloHoy]} tam={44} grosor={2} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[48px] font-extrabold leading-none tabular-nums tracking-tight text-tinta">
              {t.ahora}°
            </p>
            <p className="mt-1.5 text-[20px] font-extrabold leading-tight text-tinta-suave">
              {COMO_SE_LLAMA[cieloHoy]}
              <span className="text-tenue">
                {' · '}
                {hoy.maxima}° / {hoy.minima}°
              </span>
            </p>
          </div>
        </div>

        {/*
          El aviso de lluvia, y solo cuando de verdad lo es. A partir del
          50 % se dice; por debajo no se dice nada, porque un «30 % de
          probabilidad» todos los días acaba siendo ruido que no se lee.
        */}
        {hoy.lluvia >= 50 && (
          <p
            className="mt-4 flex items-center gap-2.5 text-[19px] font-extrabold"
            style={{ color: AMBITO.azul }}
          >
            <Ico nombre="lluvia" tam={22} grosor={2.2} />
            Hoy puede llover
          </p>
        )}

        {/* ── Los tres siguientes ── */}
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-borde pt-5">
          {siguientes.map((d) => {
            const cielo = elCielo(d.codigo)
            return (
              <div key={d.fecha} className="flex flex-col items-center gap-1.5">
                <span className="text-[15px] font-extrabold uppercase tracking-wider text-tenue">
                  {DIAS[new Date(`${d.fecha}T12:00:00`).getDay()]}
                </span>
                <span style={{ color: COLOR[cielo] }}>
                  <Ico nombre={DIBUJO[cielo]} tam={30} grosor={2} />
                </span>
                <span className="text-[19px] font-extrabold tabular-nums text-tinta">
                  {d.maxima}°
                  <span className="ml-1.5 font-bold text-tenue">{d.minima}°</span>
                </span>
                {/* El punto de lluvia solo si la hay. Un hueco reservado
                    para él haría bailar los números de un día a otro. */}
                {d.lluvia >= 50 && (
                  <span
                    className="block h-[6px] w-[6px] rounded-full"
                    style={{ background: AMBITO.azul }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
