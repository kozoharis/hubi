/*
  El trabajador de fondo de MAPPEL.

  ESTE ARCHIVO NO EXISTÍA, Y ÉSE ERA EL FALLO.

  `app/avisos/activar.tsx` hacía `navigator.serviceWorker.register('/sw.js')`
  y ese archivo no estaba en ninguna parte. El registro fallaba en la
  primera línea, así que ACTIVAR LOS AVISOS NUNCA PUDO FUNCIONAR — ni
  el "Conchita te ha dejado algo", ni el repaso diario, ni el aviso de
  la compra. Todo el sistema de notificaciones estaba construido y no
  tenía dónde aterrizar.

  Un trabajador de fondo es un trozo de código que el navegador guarda
  y ejecuta aunque MAPPEL esté cerrado. Es la única forma de que suene un
  aviso cuando nadie está mirando la pantalla.

  DELIBERADAMENTE NO GUARDA COPIAS DE LAS PÁGINAS. Un service worker
  suele usarse para que la aplicación funcione sin conexión, guardando
  lo ya visto. Aquí eso sería un error: en algo que sirve para
  recordar, enseñar una lista de tareas de anteayer es peor que decir
  que no hay conexión. Cada pantalla se pide fresca, siempre.

  Lo único que se guarda es la pantalla de «no hay conexión», y por
  dos motivos que van juntos — el segundo explicado abajo del todo,
  en el `fetch`.
*/

/* La versión va en el nombre del almacén: cambiarla aquí es lo que
   hace que la próxima vez se tire lo viejo y se vuelva a guardar. */
const ALMACEN = 'mappel-sin-conexion-v1'
const SIN_CONEXION = '/sin-conexion.html'

/* La página y su icono. El icono va con ella porque si no, sin red,
   la pantalla de «no hay conexión» saldría con la imagen rota. */
const LO_QUE_SE_GUARDA = [SIN_CONEXION, '/icono-192.png']

/* Al instalarse, que entre en servicio ya, sin esperar a que se
   cierren las pestañas abiertas. Si no, la primera activación de los
   avisos no serviría hasta la siguiente vez que se abriera MAPPEL. */
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      try {
        const almacen = await caches.open(ALMACEN)
        await almacen.addAll(LO_QUE_SE_GUARDA)
      } catch {
        /* Si no se puede guardar —sin sitio, sin red en ese
           momento—, el trabajador se instala igual. Los avisos son lo
           importante; la pantalla de sin conexión es un extra, y
           `fetch` ya contempla que no esté. */
      }
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      /* Fuera los almacenes de versiones anteriores. Son dos archivos,
         pero un almacén huérfano se queda en el teléfono para
         siempre. */
      const nombres = await caches.keys()
      await Promise.all(
        nombres.map((n) => (n.startsWith('mappel-') && n !== ALMACEN ? caches.delete(n) : null))
      )
      await self.clients.claim()
    })()
  )
})

/*
  ═══════════════════════════════════════════════════════════════
  EL `fetch`, QUE NO GUARDA NADA Y AUN ASÍ TIENE QUE ESTAR
  ═══════════════════════════════════════════════════════════════

  Esto no existía, y era lo que impedía instalar MAPPEL en Android.

  Chrome sólo ofrece «Instalar aplicación» si el trabajador de fondo
  tiene un `fetch` que sepa contestar algo válido SIN CONEXIÓN. Sin
  eso no sale el aviso de instalar, no funciona `beforeinstallprompt`,
  y la única forma de ponerla en la pantalla de inicio es el menú de
  tres puntos → «Añadir a pantalla de inicio», que además crea un
  acceso directo tonto —se abre en Chrome, con su barra— en vez de la
  aplicación de verdad.

  En iPhone nunca se notó, porque Safari no pide nada de esto: allí se
  instala siempre a mano desde Compartir. Por eso la instalación
  «funcionaba» en el teléfono donde se probó.

  LO QUE HACE, Y LO QUE NO:

    · No guarda ni una sola página. Se pide todo a la red, siempre,
      igual que antes. La regla de arriba no ha cambiado.
    · Si la red falla Y se estaba pidiendo una PANTALLA (no una
      imagen, no un dato), se enseña la pantalla de sin conexión.
    · Todo lo demás —imágenes, datos, la API— se deja pasar tal cual:
      cada pantalla ya sabe decir lo suyo cuando algo no llega.
*/
self.addEventListener('fetch', (evento) => {
  const peticion = evento.request

  /* Sólo las de ir a una pantalla. Lo demás ni se toca: meterse en
     medio de una subida de archivo o de una petición a la API sólo
     puede estropearla. */
  if (peticion.method !== 'GET' || peticion.mode !== 'navigate') return

  evento.respondWith(
    (async () => {
      try {
        return await fetch(peticion)
      } catch {
        const guardada = await caches.match(SIN_CONEXION)
        if (guardada) return guardada
        /* Ni red ni copia guardada: al menos una respuesta honesta y
           no un error en blanco del navegador. */
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Sin conexion</title>' +
            '<p style="font:600 19px system-ui;padding:24px">No hay conexión. ' +
            'Comprueba el wifi o los datos del teléfono.</p>',
          { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      }
    })()
  )
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
  /* En minúsculas, como en todas partes. Estuvo en versales hasta
     septiembre de 2026 y era el sitio con más ojos de toda la marca:
     el título de un aviso en la pantalla de bloqueo del teléfono. El
     servidor ya mandaba 'mappel'; esta copia se quedó atrás porque el
     service worker no se toca casi nunca. */
  let aviso = { titulo: 'mappel', cuerpo: 'Tienes algo nuevo', url: '/', tag: 'mappel' }

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
    self.registration.showNotification(aviso.titulo || 'mappel', {
      body: aviso.cuerpo || '',
      icon: '/icono-192.png',

      /*
        ── EL DISTINTIVO DE LA BARRA DE ESTADO, QUE ERA UN CUADRADO ──

        Aquí iba `/icono-192.png`, el mismo que el grande. Y Android no
        pinta el `badge` tal cual: coge su CANAL ALFA y rellena de
        blanco todo lo que sea opaco. Ese icono es la m sobre crema,
        opaco de esquina a esquina, así que en la barra de estado de
        Juan Miguel salía UN CUADRADO BLANCO. No la m: un cuadrado.

        En iPhone `badge` se ignora, y por eso nadie lo vio nunca.

        `distintivo-96.png` es la silueta: fondo transparente y la m
        opaca, a los 96 px que Android espera.
      */
      badge: '/distintivo-96.png',

      /* La misma etiqueta sustituye el aviso anterior en vez de
         apilarlo. Tres avisos de la compra seguidos son uno. */
      tag: aviso.tag || 'mappel',

      /*
        ── Y `renotify` TIENE QUE SER `true`, O EL SEGUNDO NO SUENA ──

        Estaba en `false`, que en Android quiere decir: si ya hay un
        aviso con esta etiqueta, cámbiale el texto EN SILENCIO — sin
        sonido, sin vibración y sin asomarse por arriba.

        Como la compra usa siempre `tag: 'compra'`, pasaba esto:
        Conchita apunta algo a las diez y el teléfono suena; apunta
        otra cosa a la una y el teléfono NO HACE NADA. El aviso de las
        diez se reescribe por dentro y nadie se entera.

        Que es exactamente el fallo que `app/sin-avisos.tsx` llama «el
        peor posible»: creer que está avisando cuando no avisa.
      */
      renotify: true,

      /* Y vibra, que en Android se puede y en iPhone no. Dos toques
         cortos: se nota en el bolsillo sin sobresaltar. */
      vibrate: [180, 90, 180],

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

  Si MAPPEL ya está abierto en alguna pestaña, se trae esa al frente y se
  la lleva a donde toca — en vez de abrir una segunda, que acaba con
  cuatro MAPPELs abiertos y la persona sin saber cuál es el bueno.
*/
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = (evento.notification.data && evento.notification.data.url) || '/'

  /*
    ── LO QUE FALLABA AQUÍ, Y SÓLO SE NOTA EN ANDROID ──

    Se cogía LA PRIMERA ventana de la lista, sin mirar cuál era. En un
    iPhone casi siempre hay una sola. En un Android es normal tener a
    la vez la aplicación instalada Y una pestaña de Chrome con mappel
    abierta, y ganaba la que viniera antes en la lista — que es un
    orden arbitrario.

    Resultado: tocabas «Conchita ha añadido 3 cosas a la compra» y
    aterrizabas en Ajustes, o en el papel que tuvieras abierto. Sin
    error y sin pista.

    Tres arreglos:

      · Se busca primero una ventana que YA esté donde va el aviso, y
        si no, la que esté visible, y si no, cualquiera.
      · `navigate()` se ESPERA. Antes se lanzaba y se devolvía
        `focus()` en la misma línea, así que `waitUntil` se daba por
        satisfecho con el foco y la navegación podía morir por el
        camino.
      · Si `navigate()` falla —pasa cuando la ventana no la controla
        este service worker, que es justo lo que `includeUncontrolled`
        deja entrar— se abre una nueva en vez de tragarse el error.
  */
  evento.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      const mismaRuta = (c) => {
        try {
          return new URL(c.url).pathname === new URL(destino, c.url).pathname
        } catch {
          return false
        }
      }

      const elegida =
        abiertas.find(mismaRuta) ||
        abiertas.find((c) => c.visibilityState === 'visible') ||
        abiertas[0]

      if (elegida) {
        try {
          if ('navigate' in elegida && !mismaRuta(elegida)) await elegida.navigate(destino)
          return await elegida.focus()
        } catch {
          /* La ventana no se deja llevar: se abre una nueva, que es
             mejor que dejar a la persona mirando otra pantalla. */
        }
      }

      return self.clients.openWindow(destino)
    })()
  )
})
