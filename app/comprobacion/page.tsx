'use client'

import { useEffect, useState } from 'react'

type Resultado = {
  variables: { url: boolean; publishable: boolean; secreta: boolean }
  servidor: { ok: boolean; categorias: number; raices: number; error: string | null }
  seguridad: { ok: boolean; filasVisiblesSinSesion: number | null; error: string | null }
  hogar?: {
    ok: boolean
    hogares: number
    miembros: number
    sinHogar: Record<string, number>
    error: string | null
    leoMiPerfil?: boolean
    leoMiembros?: boolean
    errorLectura?: string | null
  }
  papeles?: {
    ok: boolean
    enElServidor: number
    losQueVeo: number
    sinCarpetaViva: number
    ultimos: { titulo: string; fecha: string; carpeta: string; enDrive: boolean }[]
    driveAbre: boolean | null
    driveDiagnostico: string | null
    error: string | null
    pantallas?: {
      inicio: { filas: number; error: string | null }
      carpeta: { filas: number; error: string | null }
    }
    porSeccion?: { nombre: string; papeles: number }[]
  }
  drive?: { estado: string; puedeAcceder: boolean; diagnostico: string | null }
  calendario?: {
    permisoConcedido: boolean
    creado: boolean
    existeEnGoogle?: boolean
    enLaLista?: boolean
    diagnostico: string | null
    /* Cuántas tareas con día han conseguido su cita en Google. Es lo
       único que demuestra que la sincronización funciona. */
    tareasConFecha?: number
    tareasEnGoogle?: number
    sincronizando?: string | null
  }
  lectura?: { motor: 'vision' | 'gemini' | 'ninguno'; diagnostico: string | null }
}

export default function Comprobacion() {
  const [datos, setDatos] = useState<Resultado | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/comprobacion')
      .then((r) => r.json())
      .then(setDatos)
      .catch((e) => setFallo(String(e)))
  }, [])

  return (
    <main className="min-h-screen bg-[#F1F5F9] px-6 py-12 text-[#0F172A]">
      <div className="mx-auto max-w-xl">
        <p className="text-sm uppercase tracking-[0.2em] text-[#8A7F73]">
          J+C · Family Hub
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight">
          Comprobación del sistema
        </h1>
        <p className="mt-3 text-lg text-[#6B6157]">
          Esta pantalla no forma parte de Family Hub. Solo sirve para verificar
          que las piezas están realmente conectadas.
        </p>

        {fallo && (
          <p className="mt-8 rounded-2xl bg-[#FFE7E7] p-5 text-lg">
            No se ha podido consultar el servidor: {fallo}
          </p>
        )}

        {!datos && !fallo && (
          <p className="mt-8 text-lg text-[#6B6157]">Comprobando…</p>
        )}

        {datos && (
          <div className="mt-10 space-y-4">
            <Bloque titulo="1 · Claves de acceso">
              <Linea ok={datos.variables.url} texto="Dirección del proyecto" />
              <Linea ok={datos.variables.publishable} texto="Clave pública" />
              <Linea ok={datos.variables.secreta} texto="Clave secreta" />
            </Bloque>

            <Bloque titulo="2 · El servidor habla con la base de datos">
              <Linea
                ok={datos.servidor.ok}
                texto={
                  datos.servidor.ok
                    ? `Conectado · ${datos.servidor.categorias} categorías, ${datos.servidor.raices} principales`
                    : 'Sin conexión'
                }
              />
              {datos.servidor.error && (
                <p className="mt-2 text-base text-[#9B4A3F]">{datos.servidor.error}</p>
              )}
            </Bloque>

            <Bloque titulo="3 · La seguridad está activa">
              <Linea
                ok={datos.seguridad.ok}
                texto={
                  datos.seguridad.ok
                    ? 'Sin sesión iniciada no se ve ningún dato'
                    : `Atención: se ven ${datos.seguridad.filasVisiblesSinSesion} filas sin haber entrado`
                }
              />
              {datos.seguridad.error && (
                <p className="mt-2 text-base text-[#9B4A3F]">{datos.seguridad.error}</p>
              )}
            </Bloque>

            {/*
              Estas tres piezas ya existían en la respuesta del servidor
              pero no se enseñaban en ningún sitio: había que abrir la
              dirección de la API y leer el JSON a mano. Una pantalla de
              comprobación que obliga a leer JSON no comprueba nada.
            */}
            {datos.hogar && (
              <Bloque titulo="4 · El hogar">
                <Linea
                  ok={datos.hogar.ok}
                  texto={
                    datos.hogar.error
                      ? datos.hogar.error
                      : datos.hogar.hogares === 0
                        ? 'Todavía no hay ningún hogar creado'
                        : datos.hogar.ok
                          ? `${datos.hogar.hogares} hogar · ${datos.hogar.miembros} miembros · ninguna fila huérfana`
                          : 'Hay filas sin hogar — NO seguir con la fase 1b'
                  }
                />
                {/* La prueba que faltaba: leer con la sesión puesta.
                    Una política que se mordía la cola hizo que nadie
                    pudiera leer su propio perfil, y no se notó porque
                    la aplicación tapaba el hueco con el correo. */}
                <Linea
                  ok={datos.hogar.leoMiPerfil !== false}
                  texto={
                    datos.hogar.leoMiPerfil === false
                      ? `NO PUEDES LEER TU PROPIO PERFIL: ${datos.hogar.errorLectura ?? 'sin motivo'}`
                      : 'Puedes leer tu perfil (tu nombre y tu foto son de verdad)'
                  }
                />
                <Linea
                  ok={datos.hogar.leoMiembros !== false}
                  texto={
                    datos.hogar.leoMiembros === false
                      ? `NO SE PUEDE LEER LA FAMILIA: ${datos.hogar.errorLectura ?? 'sin motivo'}`
                      : 'Puedes leer quién es de tu casa'
                  }
                />

                {!datos.hogar.ok && Object.values(datos.hogar.sinHogar).some((n) => n > 0) && (
                  <ul className="mt-2 space-y-1 text-base text-[#6B7280]">
                    {Object.entries(datos.hogar.sinHogar)
                      .filter(([, n]) => n > 0)
                      .map(([tabla, n]) => (
                        <li key={tabla}>
                          {tabla}: {n} sin hogar
                        </li>
                      ))}
                  </ul>
                )}
              </Bloque>
            )}

            {/*
              LOS PAPELES.

              Puesto porque hizo falta: aparecía el gasto de una
              factura pero no había manera de llegar a la foto, y por
              fuera no se distinguía cuál de los cuatro eslabones
              estaba roto. Los cuatro se ven igual de vacíos.

              Cada línea contesta una pregunta distinta, y la primera
              que salga en rojo es la avería.
            */}
            {datos.papeles && (
              <Bloque titulo="5 · Los papeles">
                <Linea
                  ok={datos.papeles.enElServidor > 0}
                  texto={`Guardados en la base de datos: ${datos.papeles.enElServidor}`}
                />
                <Linea
                  ok={datos.papeles.losQueVeo === datos.papeles.enElServidor}
                  texto={
                    datos.papeles.losQueVeo === datos.papeles.enElServidor
                      ? `Los ves todos: ${datos.papeles.losQueVeo}`
                      : `TÚ SOLO VES ${datos.papeles.losQueVeo} de ${datos.papeles.enElServidor} — la base de datos te esconde los demás`
                  }
                />
                <Linea
                  ok={datos.papeles.sinCarpetaViva === 0}
                  texto={
                    datos.papeles.sinCarpetaViva === 0
                      ? 'Todos están en una carpeta que existe'
                      : `${datos.papeles.sinCarpetaViva} sin carpeta viva — guardados, pero no salen en ninguna pantalla`
                  }
                />
                <Linea
                  ok={datos.papeles.driveAbre !== false}
                  texto={datos.papeles.driveDiagnostico ?? 'Sin probar'}
                />

                {datos.papeles.ultimos.length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-base text-[#6B7280]">
                    {datos.papeles.ultimos.map((u, i) => (
                      <li key={i}>
                        <span className="font-semibold text-[#0F172A]">{u.titulo}</span>
                        {' · '}
                        {u.fecha}
                        {' · '}
                        {u.carpeta}
                        {!u.enDrive && ' · ⚠ sin archivo en Drive'}
                      </li>
                    ))}
                  </ul>
                )}

                {/*
                  LAS PANTALLAS, POR SEPARADO.

                  Que los datos estén bien no quiere decir que se vean.
                  Cada pantalla hace su propia consulta y ninguna mira
                  el error: si falla, enseña "todavía no hay papeles",
                  que es exactamente lo que enseñaría si de verdad no
                  hubiera ninguno.
                */}
                {datos.papeles.pantallas && (
                  <>
                    <Linea
                      ok={!datos.papeles.pantallas.inicio.error}
                      texto={
                        datos.papeles.pantallas.inicio.error
                          ? `Pantalla Documentos ROTA: ${datos.papeles.pantallas.inicio.error}`
                          : `Pantalla Documentos: ${datos.papeles.pantallas.inicio.filas} filas`
                      }
                    />
                    <Linea
                      ok={!datos.papeles.pantallas.carpeta.error}
                      texto={
                        datos.papeles.pantallas.carpeta.error
                          ? `Cruzar tablas YA NO FUNCIONA: ${datos.papeles.pantallas.carpeta.error}`
                          : `Cruzar tablas sigue funcionando: ${datos.papeles.pantallas.carpeta.filas} filas`
                      }
                    />
                  </>
                )}

                {datos.papeles.porSeccion && datos.papeles.porSeccion.length > 0 && (
                  <div className="mt-3">
                    <p className="text-base font-semibold text-[#0F172A]">
                      Lo que debería poner cada sección:
                    </p>
                    <ul className="mt-1 space-y-1 text-base text-[#6B7280]">
                      {datos.papeles.porSeccion.map((s) => (
                        <li key={s.nombre}>
                          {s.nombre}: {s.papeles === 0 ? 'vacía' : `${s.papeles} papeles`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {datos.papeles.error && (
                  <p className="mt-2 text-base text-[#B91C1C]">{datos.papeles.error}</p>
                )}
              </Bloque>
            )}

            {datos.drive && (
              <Bloque titulo="6 · Google Drive">
                <Linea
                  ok={datos.drive.puedeAcceder}
                  texto={datos.drive.diagnostico ?? datos.drive.estado}
                />
              </Bloque>
            )}

            {datos.calendario && (
              <Bloque titulo="7 · El calendario HUBI">
                <Linea
                  ok={datos.calendario.existeEnGoogle === true && datos.calendario.enLaLista === true}
                  texto={datos.calendario.diagnostico ?? '—'}
                />
                {/* Que el calendario exista no dice si se está
                    llenando. Esto sí, y con un número. */}
                {datos.calendario.sincronizando && (
                  <Linea
                    ok={
                      (datos.calendario.tareasConFecha ?? 0) > 0 &&
                      datos.calendario.tareasEnGoogle === datos.calendario.tareasConFecha
                    }
                    texto={datos.calendario.sincronizando}
                  />
                )}
              </Bloque>
            )}

            {datos.lectura && (
              <Bloque titulo="8 · Cómo se leen los documentos">
                {/*
                  ESTA LÍNEA PINTABA UNA CRUZ ROJA PERMANENTE.

                  Pedía `motor === 'vision'` para dar el visto bueno, y
                  el servidor dejó de devolver 'vision' cuando Cloud
                  Vision salió del flujo. Resultado: el estado NORMAL y
                  correcto del sistema salía en rojo, y debajo un texto
                  diciendo que faltaba configurar algo que ya no existe.

                  Se arregló el servidor y esta pantalla se quedó sin
                  actualizar. Que sirva de recordatorio: cuando cambia
                  lo que hace el código, cambia CON él lo que dice.
                */}
                <Linea
                  ok={datos.lectura.motor === 'gemini'}
                  texto={
                    datos.lectura.motor === 'gemini'
                      ? 'Los papeles se leen · y no salen a entrenar nada'
                      : 'Sin lector configurado · falta GEMINI_API_KEY'
                  }
                />
                {datos.lectura.diagnostico && (
                  <p className="mt-2 text-base text-[#6B6157]">{datos.lectura.diagnostico}</p>
                )}
              </Bloque>
            )}

            {/* Esta pantalla no tenía ninguna salida: se entraba y solo
                se salía con el botón atrás del navegador. */}
            <a
              href="/ajustes"
              className="mt-8 flex h-[60px] items-center justify-center rounded-[18px] border border-[#E5E0D8] bg-white text-[17px] font-bold text-[#3F3A34]"
            >
              Volver a Ajustes
            </a>

            <div className="mt-8 rounded-3xl bg-white p-7 shadow-sm">
              {todoOk(datos) ? (
                <>
                  <p className="text-2xl font-semibold">✓ Base de datos validada</p>
                  <p className="mt-2 text-lg text-[#6B6157]">
                    Web, claves, base de datos y seguridad funcionan de verdad.
                    Siguiente capa: la entrada de Juan Miguel y Conchita.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold">Todavía falta algo</p>
                  <p className="mt-2 text-lg text-[#6B6157]">
                    Revisa arriba qué línea no está en verde.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function todoOk(d: Resultado) {
  return (
    d.variables.url &&
    d.variables.publishable &&
    d.variables.secreta &&
    d.servidor.ok &&
    d.seguridad.ok
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-7 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-[#8A7F73]">
        {titulo}
      </h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  )
}

function Linea({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <div className="flex items-start gap-4">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ${
          ok ? 'bg-[#14B8A6]' : 'bg-[#FF6B6B]'
        }`}
      >
        {ok ? '✓' : '×'}
      </span>
      <span className="text-lg leading-snug">{texto}</span>
    </div>
  )
}
