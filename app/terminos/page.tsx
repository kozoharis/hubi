import Link from 'next/link'
export const metadata = {
  title: 'Términos de uso · HUBI',
}

export default function Terminos() {
  return (
    <main className="min-h-screen px-6 py-16">
      <article className="mx-auto w-full max-w-2xl">
        <p className="text-sm tracking-[0.25em] text-tenue">HUBI</p>
        <h1 className="mt-4 text-[28px] font-extrabold leading-tight tracking-tight text-tinta">
          Términos de uso
        </h1>
        <p className="mt-3 text-base text-tenue">Actualizados el 26 de agosto de 2026</p>

        <div className="mt-10 space-y-8 text-lg leading-relaxed text-tinta-suave">
          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Uso privado</h2>
            <p className="mt-3">
              HUBI es una aplicación de uso estrictamente privado y familiar.
              No se ofrece como servicio a terceros, no admite registro abierto y no
              tiene ningún fin comercial.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Quién puede usarla</h2>
            <p className="mt-3">
              Únicamente las dos cuentas de correo autorizadas expresamente. Cualquier
              otra dirección es rechazada por el sistema.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Responsabilidad</h2>
            <p className="mt-3">
              La aplicación se ofrece tal cual, sin garantías de disponibilidad
              continua. HUBI organiza y da acceso a documentos, pero no
              sustituye a la conservación de los originales ni al cumplimiento de las
              obligaciones legales o fiscales de sus usuarios.
            </p>
            <p className="mt-3">
              Los avisos de vencimiento son una ayuda, no una garantía. La
              responsabilidad de renovar seguros, pasar revisiones o acudir a citas
              sigue siendo de los usuarios.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Tus documentos son tuyos</h2>
            <p className="mt-3">
              Los archivos permanecen en la cuenta de Google Drive de su titular. La
              aplicación no reclama ningún derecho sobre ellos. Si HUBI dejara
              de existir, los documentos seguirían íntegros y accesibles en Drive,
              organizados en carpetas con nombres legibles.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Cambios</h2>
            <p className="mt-3">
              Estos términos pueden actualizarse a medida que la aplicación evoluciona.
              La fecha de la última revisión aparece siempre al principio.
            </p>
          </section>

          <section>
            <h2 className="text-[21px] font-extrabold text-tinta">Contacto</h2>
            <p className="mt-3">
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
