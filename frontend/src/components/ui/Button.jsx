/*
 * Botones.
 *
 * Radio de 4px y no pastilla: el filo preciso lee "impreso", el redondeo
 * generoso lee "app generica". El primario lleva un filete interior claro
 * arriba (inset shadow) que simula la luz sobre una superficie entintada;
 * es el unico relieve de toda la interfaz.
 */

const VARIANTES = {
  primario: `bg-pino-800 text-papel hover:bg-pino-700 active:bg-pino-900
     shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]
     disabled:bg-pino-200 disabled:text-pino-50 disabled:shadow-none`,

  secundario: `bg-papel-alto text-tinta border border-linea-fuerte
     hover:bg-papel-hondo hover:border-tinta-4 active:bg-papel-sombra
     disabled:text-tinta-4 disabled:border-linea`,

  peligro: `bg-ladrillo-600 text-papel hover:bg-ladrillo-700
     shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]
     disabled:bg-ladrillo-200`,

  fantasma: `text-tinta-2 hover:bg-papel-hondo hover:text-tinta
     active:bg-papel-sombra disabled:text-tinta-4`,

  /* Enlace subrayado en laton: para acciones terciarias dentro de texto. */
  filete: `text-pino-700 underline decoration-laton-300 underline-offset-4
     decoration-1 hover:decoration-laton-500 hover:text-pino-900`,
}

const TAMANIOS = {
  sm: 'px-2.5 py-1.5 text-[12.5px] gap-1.5',
  md: 'px-4 py-2 text-[13.5px] gap-2',
  lg: 'px-6 py-2.5 text-[15px] gap-2',
}

export function Button({
  variante = 'primario',
  tamanio = 'md',
  cargando = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      // type="button" por defecto: el default del navegador es "submit", que
      // hace que cualquier boton dentro de un form lo envie sin querer.
      type="button"
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={`inline-flex items-center justify-center rounded font-medium
        tracking-[-0.005em] transition-[background-color,border-color,color] duration-150
        disabled:cursor-not-allowed
        ${VARIANTES[variante]} ${TAMANIOS[tamanio]} ${className}`}
      {...props}
    >
      {cargando && (
        <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3.5A4.5 4.5 0 007.5 12H4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
