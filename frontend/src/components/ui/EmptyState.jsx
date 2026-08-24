export function EmptyState({ titulo, descripcion, accion, icono = null }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {/* Rombo de filete en laton: un ornamento, no un icono de relleno. */}
      <div
        className="mb-5 grid size-11 rotate-45 place-items-center border border-laton-300 bg-laton-100/50"
        aria-hidden="true"
      >
        <span className="-rotate-45 text-laton-700">
          {icono ?? (
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          )}
        </span>
      </div>

      <h3 className="font-display text-[17px] font-medium text-tinta">{titulo}</h3>
      {descripcion && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-tinta-3">{descripcion}</p>
      )}
      {accion && <div className="mt-6">{accion}</div>}
    </div>
  )
}
