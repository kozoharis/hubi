import { redirect } from 'next/navigation'
import { elEspacioO } from '@/lib/espacio'
import { clienteSesion } from '@/lib/supabase/sesion'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  AQUÍ ESTABA «TAREAS», Y AHORA LLEVA AL CALENDARIO
  ═══════════════════════════════════════════════════════════════

  Lo dijo Haris: *«tareas y calendario para mí es lo mismo»*. Y no es
  solo su opinión — es el punto 18 del planteamiento, escrito al
  principio de todo:

      «Para Juan Miguel y Conchita no quiero que exista una diferencia
       conceptual complicada entre evento, tarea, recordatorio y
       deadline. Para ellos todo debe ser: COSAS QUE TENGO QUE
       RECORDAR.»

  Dos pestañas obligaban a esa distinción todos los días: ¿lo del médico
  del martes es una tarea o es calendario? Se buscaba en las dos.

  ─────────────────────────────────────────────────────────────
  POR QUÉ UN DESVÍO Y NO BORRAR EL FICHERO

  Porque una pantalla colgada de una pared se queda abierta donde la
  dejaron. Si esta dirección dejara de existir de golpe, la tableta que
  estuviera en Tareas en ese momento —o la que se reinicie con esa
  dirección guardada— se encontraría un «no existe» en la cocina.

  Así se va sola al sitio nuevo y nadie se entera. Se puede borrar
  dentro de unos meses, cuando ya no quede ninguna abierta ahí.
*/
export default async function DondeEstabanLasTareas() {
  const supabase = await clienteSesion()
  const casa = await elEspacioO(supabase).catch(() => null)

  /* Con el espacio delante si lo hay: una pantalla de quien tenga dos
     casas no puede acabar en la otra. */
  redirect(casa ? `/e/${casa}/casa/calendario` : '/casa/calendario')
}
