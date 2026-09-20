import { startTransition } from 'react'

/*
  ═══════════════════════════════════════════════════════════════
  REFRESCAR SIN CONGELAR LA PANTALLA
  ═══════════════════════════════════════════════════════════════

  Haris: *«cuando tocas un botón parece que no reaccionan y a veces le
  tienes que dar como dos veces»*. Y luego, al preguntarle cuáles:
  *«les pasa a todos»*.

  Tenía razón en las dos cosas, y la causa es una sola línea repetida
  en cuarenta y cinco pantallas:

      await fetch(...)
      router.refresh()        // ← aquí

  ── QUÉ HACE `router.refresh()` DE VERDAD ──

  Vuelve a pedirle al servidor la pantalla entera y la vuelve a
  pintar. En mappel eso no es barato: cada pantalla es `force-dynamic`
  y hace sus consultas a Supabase, o sea medio segundo largo desde un
  móvil con mala cobertura.

  Y sin envolverlo, React trata esa actualización como URGENTE. Urgente
  quiere decir que **puede bloquear la interfaz mientras llega**: el
  dedo toca otra cosa y no pasa nada, porque React está esperando.

  Es exactamente la sensación que describe. No es que el botón no haya
  hecho nada —casi todos se pintan al instante, eso ya estaba bien
  resuelto—: es que **lo de después se come la pantalla**.

  ── Y ENVUELTO NO ──

  `startTransition` dice: esto no corre prisa. React se queda con lo
  que hay en pantalla, sigue atendiendo toques, y cambia cuando el
  servidor conteste. La actualización tarda lo mismo; lo que cambia es
  que mientras tanto la aplicación sigue viva.

  ── POR QUÉ UNA FUNCIÓN Y NO `useTransition` EN CADA SITIO ──

  `useTransition` es un hook y da además un «está en marcha» que aquí
  no hace falta —de enseñarlo se encarga `SigueTrabajando`, en un solo
  sitio para toda la aplicación—. `startTransition` suelto hace el
  trabajo y se puede llamar desde donde sea: dentro de un `catch`, de
  un `.then()`, de una función que no es un componente.

  Así el cambio en las cuarenta y cinco pantallas es una línea por
  pantalla y ninguna tiene que aprenderse nada.

  ── CÓMO SE USA ──

      import { refrescar } from '@/lib/refrescar'
      ...
      refrescar(router)

  Donde `router` es el de siempre, `useRouter()`.
*/
export function refrescar(router: { refresh: () => void }): void {
  startTransition(() => router.refresh())
}
