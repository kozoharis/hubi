import { redirect } from 'next/navigation'

/*
  Esta pantalla era «Actividades» y ahora vive dentro de Cuentas.

  No se borra, se redirige: alguien puede tener esta dirección en la
  pantalla de inicio de su móvil, y un enlace que de pronto lleva a un
  «no encontrado» se lee como que HUBI se ha roto.
*/
export default function Actividades() {
  redirect('/cuentas')
}
