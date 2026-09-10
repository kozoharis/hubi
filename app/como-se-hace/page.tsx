import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { miHogar } from '@/lib/hogar'
import { genteDeLaCasa } from '@/lib/gente'
import { accionesDe, type Papel } from '@/lib/guia'
import Cabecera from '../cabecera'
import { Volver } from '../iconos'
import { PastillaAmbito } from '../piezas'
import Guia from './guia'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  CÓMO SE HACE
  ═══════════════════════════════════════════════════════════════

  La guía de dentro de HUBI. Vive en Ajustes y se llega también
  desde la nota de «Primeros pasos» del Inicio.

  ─────────────────────────────────────────────────────────────
  POR QUÉ NO SE LLAMA «AYUDA»

  Porque «ayuda» suena a que algo va mal, y aquí no va mal nada:
  alguien está aprendiendo a usar su casa. «Cómo se hace» es lo que
  diría una persona.

  ─────────────────────────────────────────────────────────────
  Y NO ES LA GUÍA ESCRITA

  Hay una guía larga, de diecinueve apartados, para quien MONTA una
  casa: conectar Drive, repartir permisos, decidir qué ve cada uno.
  Ésta es para quien la USA, y son cosas distintas. Conchita no va a
  leer diecinueve apartados nunca, y no tiene por qué.
*/
export default async function ComoSeHace({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>
}) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) redirect('/empezar')

  /* Qué papel tiene, para enseñarle lo suyo. Sin rol puesto se le
     trata como familia: un permiso que se endurece solo porque falta
     un dato es un permiso que rompe cosas al azar. */
  const gente = await genteDeLaCasa(supabase, hogarId)
  const yo = gente.find((g) => g.id === user.id)
  const papel = ((yo?.rol as Papel) ?? 'familia') as Papel

  const acciones = accionesDe(papel)
  const { ver } = await searchParams
  const abrir = ver && acciones.some((a) => a.clave === ver) ? ver : null

  return (
    <main className="min-h-screen pb-24">
      <Cabecera>
        <Volver href="/ajustes" />
        <div className="flex h-14 items-center gap-3">
          <PastillaAmbito icono="ojo" ambito="azul" tam={44} />
          <h1 className="t-titulo">Cómo se hace</h1>
        </div>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-1">
        {!abrir && (
          <>
            {/*
              El vídeo de arriba no explica nada: enseña QUÉ HAY. En
              treinta segundos alguien que acaba de entrar ve las
              siete cosas seguidas y ya sabe qué puede pedirle a
              HUBI. Aprender es entrar después en la que le interese.
            */}
            <video
              src="/guia/hubi-todo.mp4"
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
              aria-label="Todo lo que hace HUBI"
              className="w-full rounded-[20px] border border-borde bg-fondo"
            />
            <p className="t-apoyo mt-3">
              Treinta segundos con todo lo que sabe hacer. Debajo, cada cosa por
              separado.
            </p>
            <h2 className="t-seccion mt-7">Una por una</h2>
            <p className="t-apoyo mt-1 mb-3">Toca la que quieras ver.</p>
          </>
        )}

        <Guia acciones={acciones} abrir={abrir} />
      </div>
    </main>
  )
}
