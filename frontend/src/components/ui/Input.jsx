import { useId } from 'react'

/*
 * Campos de formulario.
 *
 * Etiquetas en versalitas espaciadas (.rotulo) y campo con filete de 1px en
 * lugar del `ring` de Tailwind: el filete es mas fino y no engorda al enfocar,
 * que es lo que hace que un formulario denso se vea inquieto.
 *
 * `aria-describedby` + `aria-invalid` son lo que hace que un lector de
 * pantalla lea el error al enfocar; sin eso el error no existe para quien no
 * ve la pantalla. El atributo `data-error` da un anclaje estable a las
 * pruebas E2E, que si no quedarian atadas a una clase de color.
 */

const BASE = `block w-full rounded border bg-papel-alto px-3 py-2 text-[13.5px] text-tinta
  transition-colors duration-150 placeholder:text-tinta-4
  disabled:bg-papel-hondo disabled:text-tinta-3`

export function Input({
  label,
  error,
  ayuda,
  requerido = false,
  className = '',
  as = 'input',
  ...props
}) {
  const id = useId()
  const idError = `${id}-error`
  const idAyuda = `${id}-ayuda`
  const Etiqueta = as

  const descripcion = [error ? idError : null, ayuda ? idAyuda : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="rotulo mb-1.5 block">
          {label}
          {requerido && (
            <span className="ml-1 text-laton-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <Etiqueta
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={descripcion || undefined}
        aria-required={requerido || undefined}
        className={`${BASE}
          ${as === 'textarea' ? 'min-h-24 resize-y leading-relaxed' : ''}
          ${
            error
              ? 'border-ladrillo-600 focus:border-ladrillo-700'
              : 'border-linea-fuerte focus:border-pino-600'
          }`}
        {...props}
      />

      {ayuda && !error && (
        <p id={idAyuda} className="mt-1.5 text-[11.5px] leading-snug text-tinta-3">
          {ayuda}
        </p>
      )}

      {error && (
        <p
          id={idError}
          data-error
          className="mt-1.5 flex items-start gap-1 text-[11.5px] leading-snug text-ladrillo-600"
        >
          <span aria-hidden="true" className="mt-px">
            &bull;
          </span>
          {error}
        </p>
      )}
    </div>
  )
}

export function Select({ label, error, requerido = false, className = '', children, ...props }) {
  const id = useId()
  const idError = `${id}-error`

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="rotulo mb-1.5 block">
          {label}
          {requerido && (
            <span className="ml-1 text-laton-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <select
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? idError : undefined}
        className={`${BASE} appearance-none bg-[length:14px] bg-[right_0.6rem_center] bg-no-repeat pr-9
          ${
            error
              ? 'border-ladrillo-600 focus:border-ladrillo-700'
              : 'border-linea-fuerte focus:border-pino-600'
          }`}
        style={{
          backgroundImage:
"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%237c8a82'%3E%3Cpath d='M4.5 6.5L8 10l3.5-3.5' stroke='%237c8a82' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {children}
      </select>

      {error && (
        <p
          id={idError}
          data-error
          className="mt-1.5 flex items-start gap-1 text-[11.5px] leading-snug text-ladrillo-600"
        >
          <span aria-hidden="true" className="mt-px">
            &bull;
          </span>
          {error}
        </p>
      )}
    </div>
  )
}
