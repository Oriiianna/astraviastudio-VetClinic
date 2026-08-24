export function Spinner({ etiqueta = 'Cargando...', className = '' }) {
  return (
    <div className={`flex items-center gap-3 text-tinta-3 ${className}`} role="status">
      {/* Anillo fino en laton: coherente con los filetes del resto. */}
      <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" className="opacity-25" />
        <path
          d="M22 12a10 10 0 00-10-10"
          stroke="var(--color-laton-500)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      {/* El texto se anuncia por lector de pantalla aunque no se muestre. */}
      <span className={etiqueta ? 'rotulo' : 'sr-only'}>{etiqueta || 'Cargando'}</span>
    </div>
  )
}
