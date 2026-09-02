import Link from 'next/link'
export const metadata = {
  title: 'Privacidad · HUBI',
}

export default function Privacidad() {
  return (
    <main className="min-h-screen px-6 py-16">
      <article className="mx-auto w-full max-w-2xl">
        <p className="text-sm tracking-[0.25em] text-tenue">HUBI</p>
        <h1 className="mt-4 text-[28px] font-extrabold leading-tight tracking-tight text-tinta">
          Política de privacidad
        </h1>
        <p className="mt-3 text-base text-tenue">Actualizada el 26 de agosto de 2026</p>

        <div className="mt-10 space-y-8 text-lg leading-relaxed text-tinta-suave">
          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Qué es HUBI</h2>
            <p className="mt-3">
              HUBI es una aplicación privada de uso familiar, creada para dos
              personas concretas. No es un servicio público, no admite registro
              abierto y no está disponible para nadie fuera de esas dos cuentas
              autorizadas.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Qué datos se guardan</h2>
            <p className="mt-3">
              Documentos personales y familiares que los propios usuarios suben —
              facturas, seguros, informes, contratos y similares — junto con la
              información que los describe: fecha, importe, proveedor, categoría y
              quién los subió.
            </p>
            <p className="mt-3">
              También se guardan las direcciones de correo de los dos usuarios, que
              son lo único necesario para poder entrar. No se almacenan contraseñas.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Dónde se guardan</h2>
            <p className="mt-3">
              Los archivos se almacenan en la cuenta personal de Google Drive del
              titular de la aplicación, dentro de una carpeta creada específicamente
              para HUBI. La información que los describe se guarda en una base
              de datos privada alojada en la Unión Europea.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">
              Qué permisos de Google se utilizan
            </h2>
            <p className="mt-3">
              HUBI solicita únicamente el permiso <code>drive.file</code>, que
              limita el acceso a los archivos que la propia aplicación crea. Family
              Hub no puede ver, leer ni modificar ningún otro contenido del Google
              Drive del usuario.
            </p>
            <p className="mt-3">
              El permiso puede revocarse en cualquier momento desde la configuración
              de la cuenta de Google.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Con quién se comparten</h2>
            <p className="mt-3">
              Los datos no se venden, no se ceden a terceros, no se utilizan con
              fines publicitarios y no se emplean para entrenar sistemas de
              inteligencia artificial. No hay publicidad ni seguimiento.
            </p>
            <p className="mt-3">
              Hay <strong>una excepción, y conviene contarla entera</strong>: para
              leer un papel fotografiado, HUBI envía esa fotografía al servicio de
              lectura de Google (Gemini), que devuelve los datos que contiene —el
              proveedor, la fecha, el importe—. Lo mismo ocurre con la voz cuando el
              teléfono no puede transcribirla por su cuenta.
            </p>
            <p className="mt-3">
              Por estar en la Unión Europea, a ese servicio se le aplican las
              condiciones del nivel de pago aunque se use sin coste:{' '}
              <strong>Google no utiliza el contenido para entrenar sus modelos</strong>.
            </p>
            <p className="mt-3">
              Un PDF que ya trae el texto escrito dentro —los que llegan por correo—
              se lee <strong>en el propio teléfono</strong> y no sale a ninguna
              parte.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Salud y datos personales</h2>
            <p className="mt-3">
              De los documentos guardados en <strong>Salud</strong> y en{' '}
              <strong>Personal</strong>, HUBI <strong>no conserva el texto leído</strong>.
              El archivo se guarda en Google Drive como cualquier otro y se puede
              ver y abrir igual, pero su contenido no queda almacenado en la base de
              datos de HUBI.
            </p>
            <p className="mt-3">
              Eso significa que un informe médico se encuentra por su título, su
              fecha y su carpeta, pero no por lo que pone dentro. Es una limitación
              buscada.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Quién puede verlos</h2>
            <p className="mt-3">
              Solo las personas de la misma casa. Sin haber iniciado sesión no es
              posible acceder a ningún dato, y la separación entre casas la impone
              la propia base de datos, no la aplicación.
            </p>
            <p className="mt-3">
              Hoy <strong>todos los documentos de una casa son compartidos</strong>{' '}
              entre sus miembros. La posibilidad de marcar un documento como privado
              está prevista pero todavía no está disponible.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Borrado</h2>
            <p className="mt-3">
              Los usuarios pueden eliminar sus documentos en cualquier momento, tanto
              desde HUBI como directamente desde Google Drive. Si se revoca el
              permiso de Google, la aplicación deja inmediatamente de tener acceso a
              los archivos.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Contacto</h2>
            <p className="mt-3">
              Para cualquier cuestión relacionada con la privacidad:{' '}
              <a className="text-verde underline" href="mailto:jmnazco@gmail.com">
                jmnazco@gmail.com
              </a>
            </p>
          </section>
        </div>

        <Link
          href="/"
          className="mt-14 inline-block rounded-2xl border-2 border-borde px-6 py-4 text-lg font-medium text-tinta-suave"
        >
          Volver
        </Link>
      </article>
    </main>
  )
}
