'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../../../iconos'
import { Aviso, BotonPrincipal, BotonSecundario } from '../../../piezas'
import { api } from '@/lib/api'

/*
  ═══════════════════════════════════════════════════════════════
  ¿QUIÉN VE ESTA CARPETA?
  ═══════════════════════════════════════════════════════════════

  El punto 21 del planteamiento, por fin con una pantalla:

  > Debe quedar perfectamente claro visualmente quién puede ver cada
  > documento.

  Y va DENTRO de la carpeta, no en Ajustes. Es la diferencia entre
  «configurar la privacidad» —que nadie hace— y estar mirando los
  informes médicos y pensar «esto no tiene por qué verlo nadie más»,
  que es cuando de verdad se decide.

  ─────────────────────────────────────────────────────────────
  DOS ESTADOS, Y SE VEN LOS DOS SIEMPRE

  No es un interruptor. Un interruptor obliga a deducir qué significa
  que esté apagado, y «apagado» puede leerse igual de bien como
  «compartida» o como «privada».

      ● De toda la familia        Juan Miguel y Conchita la ven
      ○ Solo mía                  Nadie más ve lo que hay dentro

  El que está puesto se ve puesto, y el otro dice lo que pasaría.

  ─────────────────────────────────────────────────────────────
  Y CERRARLA PIDE CONFIRMACIÓN. ABRIRLA NO

  Cerrar una carpeta le quita algo a la otra persona sin avisarla, y
  además —desde el paso 82— ni quien creó la casa puede deshacerlo por
  ella. Es de las pocas cosas de MAPPEL que no arregla otro.

  Abrirla no le quita nada a nadie: se hace y ya está. El punto 5 pide
  que lo importante sea reversible, y esto lo es en un toque.
*/

export default function DeQuienEs({
  carpetaId,
  nombre,
  mia,
  deOtro,
}: {
  carpetaId: string
  nombre: string
  /** Es mía ahora mismo. */
  mia: boolean
  /** Es de otra persona: su nombre de pila. Entonces aquí no se decide nada. */
  deOtro?: string | null
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function poner(quieroQueSeaMia: boolean) {
    setOcupado(true)
    setFallo(null)

    const r = await fetch(api('/api/carpetas/privada'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: carpetaId, mia: quieroQueSeaMia }),
    })
    setOcupado(false)
    setConfirmando(false)

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setFallo(d.error ?? 'No se ha podido cambiar.')
      return
    }
    router.refresh()
  }

  /*
    ── LA DE OTRA PERSONA NO SE TOCA ──

    Esta pantalla no debería llegar a verse con una carpeta ajena —la
    base no deja entrar— pero si algún día llegara, dice de quién es y
    no ofrece ningún botón. Un botón que siempre falla es peor que
    ninguno.
  */
  if (deOtro) {
    return (
      <div className="mt-6 rounded-[20px] border border-borde bg-superficie px-4 py-4">
        <p className="t-cuerpo flex items-center gap-2 font-extrabold">
          <Ico nombre="candado" tam={20} grosor={2.2} />
          Esta carpeta es de {deOtro}
        </p>
        <p className="t-apoyo mt-1 leading-snug">
          Solo {deOtro} puede abrirla. Ni siquiera quien creó la casa.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-[20px] border border-borde bg-superficie px-4 py-4">
      <p className="rotulo">¿Quién ve esta carpeta?</p>

      <div className="mt-3 space-y-2.5">
        <Opcion
          puesta={!mia}
          icono="gente"
          titulo="De toda la familia"
          explicacion="Todos los que viven en la casa ven lo que hay dentro."
        />
        <Opcion
          puesta={mia}
          icono="candado"
          titulo="Solo mía"
          explicacion="Nadie más ve lo que hay dentro. Tampoco quien creó la casa."
        />
      </div>

      {!mia ? (
        confirmando ? (
          <div className="mt-4">
            <Aviso
              tono="atencion"
              titulo={`«${nombre}» dejará de verse en casa`}
              explicacion="Lo que hay dentro pasa a ser solo tuyo. Nadie más podrá abrirla, y solo tú puedes volver a compartirla."
            />
            <div className="mt-3 space-y-2.5">
              <BotonPrincipal onClick={() => poner(true)} desactivado={ocupado} icono="candado">
                {ocupado ? 'Un momento…' : 'Sí, que sea solo mía'}
              </BotonPrincipal>
              <BotonSecundario onClick={() => setConfirmando(false)} desactivado={ocupado}>
                Dejarlo como está
              </BotonSecundario>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <BotonSecundario onClick={() => setConfirmando(true)} icono="candado">
              Hacerla solo mía
            </BotonSecundario>
          </div>
        )
      ) : (
        /* Abrirla no le quita nada a nadie: un toque y ya. */
        <div className="mt-4">
          <BotonSecundario onClick={() => poner(false)} desactivado={ocupado} icono="gente">
            {ocupado ? 'Un momento…' : 'Compartirla con la familia'}
          </BotonSecundario>
        </div>
      )}

      {fallo && (
        <div className="mt-3">
          <Aviso titulo="No se ha podido" explicacion={fallo} />
        </div>
      )}
    </div>
  )
}

function Opcion({
  puesta,
  icono,
  titulo,
  explicacion,
}: {
  puesta: boolean
  icono: 'gente' | 'candado'
  titulo: string
  explicacion: string
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-[16px] border px-3.5 py-3"
      style={{
        borderColor: puesta ? 'var(--t-tinta)' : 'var(--t-borde)',
        background: puesta ? 'var(--t-velo)' : 'transparent',
      }}
    >
      <span
        aria-hidden
        className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2"
        style={{
          borderColor: puesta ? 'var(--t-tinta)' : 'var(--t-borde)',
          background: puesta ? 'var(--t-tinta)' : 'transparent',
          color: 'var(--t-fondo)',
        }}
      >
        {puesta && <Ico nombre="check" tam={16} grosor={3} />}
      </span>
      <span className="min-w-0">
        <span className="t-cuerpo flex items-center gap-2 font-extrabold">
          <Ico nombre={icono} tam={18} grosor={2.2} />
          {titulo}
        </span>
        <span className="t-apoyo mt-0.5 block leading-snug">{explicacion}</span>
      </span>
    </div>
  )
}
