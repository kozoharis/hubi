/*
  El trabajador de fondo de HUBI.

  ESTE ARCHIVO NO EXISTÍA, Y ÉSE ERA EL FALLO.

  `app/avisos/activar.tsx` hacía `navigator.serviceWorker.register('/sw.js')`
  y ese archivo no estaba en ninguna parte. El registro fallaba en la
  primera línea, así que ACTIVAR LOS AVISOS NUNCA PUDO FUNCIONAR — ni
  el "Conchita te ha dejado algo", ni el repaso diario, ni el aviso de
  la compra. Todo el sistema de notificaciones estaba construido y no
  tenía dónde aterrizar.

  Un trabajador de fondo es un trozo de código que el navegador guarda
  y ejecuta aunque HUBI esté cerrado. Es la única forma de que suene un
  aviso cuando nadie está mirando la pantalla.

  DELIBERADAMENTE NO GUARDA COPIAS DE LAS PÁGINAS. Un service worker
  suele usarse para que la aplicación funcione sin conexión, guardando
  lo ya visto. Aquí eso sería un error: en algo que sirve para
  recordar, enseñar una lista de tareas de anteayer es peor que decir
  que no hay conexión. Cada pantalla se pide fresca, siempre.
*/

/* Al instalarse, que entre en servicio ya, sin esperar a que se
   cierren las pestañas abiertas. Si no, la primera activación de los
   avisos no serviría hasta la siguiente vez que se abriera HUBI. */
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim())
})

/*
  Llega un aviso.

  El servidor manda un JSON con { titulo, cuerpo, url, tag }, que es lo
  que arma `lib/push.ts`. Si por lo que sea no viniera o no se pudiera
  leer, se enseña algo igualmente: un aviso que no aparece es un aviso
  perdido, y el navegador además penaliza al que recibe un empujón y no
  muestra nada.
*/
self.addEventListener('push', (evento) => {
  let aviso = { titulo: 'HUBI', cuerpo: 'Tienes algo nuevo', url: '/', tag: 'hubi' }

  try {
    if (evento.data) aviso = { ...aviso, ...evento.data.json() }
  } catch {
    try {
      const texto = evento.data && evento.data.text()
      if (texto) aviso.cuerpo = texto
    } catch {
      /* Ni JSON ni texto: se queda el mensaje de siempre. */
    }
  }

  evento.waitUntil(
    self.registration.showNotification(aviso.titulo || 'HUBI', {
      body: aviso.cuerpo || '',
      icon: '/icono-192.png',
      badge: '/icono-192.png',
      /* La misma etiqueta sustituye el aviso anterior en vez de
         apilarlo. Tres avisos de la compra seguidos son uno. */
      tag: aviso.tag || 'hubi',
      renotify: false,
      /* Que no se vaya solo: una persona mayor puede tardar en mirar
         el teléfono, y un aviso que desaparece a los cinco segundos no
         ha avisado de nada. */
      requireInteraction: true,
      data: { url: aviso.url || '/' },
    })
  )
})

/*
  Se toca el aviso.

  Si HUBI ya está abierto en alguna pestaña, se trae esa al frente y se
  la lleva a donde toca — en vez de abrir una segunda, que acaba con
  cuatro HUBIs abiertos y la persona sin saber cuál es el bueno.
*/
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = (evento.notification.data && evento.notification.data.url) || '/'

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abiertas) => {
      for (const pestana of abiertas) {
        if ('focus' in pestana) {
          if ('navigate' in pestana) pestana.navigate(destino).catch(() => {})
          return pestana.focus()
        }
      }
      return self.clients.openWindow(destino)
    })
  )
})
