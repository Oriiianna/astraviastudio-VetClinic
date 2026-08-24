import { Link } from 'react-router-dom'

/**
 * Encabezado de pagina.
 *
 * Existe para que las once pantallas abran igual. Antes cada una resolvia su
 * titulo por su cuenta y se notaba: unas llevaban rotulo y filete, otras un
 * h1 suelto. La estructura fija -rotulo chico, titulo en display, filete de
 * laton- es la que le da a la aplicacion aire de documento y no de pantalla.
 *
 * @param {string}  rotulo   Versalitas sobre el titulo (la seccion).
 * @param {string}  titulo   Titulo en el serif de display.
 * @param {node}    bajada   Linea de contexto bajo el titulo (conteos, filtros).
 * @param {node}    acciones Botones alineados a la derecha.
 * @param {{a,texto}} volver Enlace de regreso sobre el rotulo.
 */
export function PageHeader({ rotulo, titulo, bajada, acciones, volver, className = '' }) {
  return (
    <header className={`mb-7 ${className}`}>
      {volver && (
        <Link
          to={volver.a}
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-tinta-3 transition-colors hover:text-tinta"
        >
          <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L9.06 10l3.71 3.71a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06.02z"
              clipRule="evenodd"
            />
          </svg>
          {volver.texto}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {rotulo && <p className="rotulo">{rotulo}</p>}
          <h1 className="mt-2 font-display text-[27px] font-light leading-tight tracking-[-0.03em] text-tinta">
            {titulo}
          </h1>
        </div>

        {/* Las acciones se alinean con el titulo, no con la bajada: si no,
            "bailan" segun cuanto texto de contexto tenga cada pantalla. */}
        {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
      </div>

      <div className="filete mt-5" aria-hidden="true" />

      {bajada && <div className="mt-3 text-[13px] text-tinta-3">{bajada}</div>}
    </header>
  )
}
