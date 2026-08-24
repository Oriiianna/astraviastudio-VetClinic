import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/*
 * Dialogo modal.
 *
 * Se apoya en <dialog> nativo con showModal(), que resuelve gratis el atrapado
 * del foco, el cierre con Escape y el bloqueo del fondo.
 *
 * Detalle de composicion: el titulo va en el serif de display y lleva encima
 * un rotulo en versalitas; ese par (rotulo chico + titulo grande) es lo que
 * da el aire de portada de ficha y no de "ventana de sistema".
 */
export function Modal({ abierto, onCerrar, titulo, rotulo, children, pie, ancho = 'max-w-lg' }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return

    if (abierto && !dialogo.open) dialogo.showModal()
    if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return

    // 'cancel' se dispara con Escape: se previene el cierre nativo para que el
    // estado de React siga siendo la unica fuente de verdad.
    const alCancelar = (e) => {
      e.preventDefault()
      onCerrar?.()
    }

    dialogo.addEventListener('cancel', alCancelar)
    return () => dialogo.removeEventListener('cancel', alCancelar)
  }, [onCerrar])

  if (!abierto) return null

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby="modal-titulo"
      className={`w-[calc(100%-2rem)] ${ancho} rounded border border-linea-fuerte bg-papel p-0
        text-tinta shadow-[0_24px_60px_-12px_rgba(22,33,28,0.28)]
        backdrop:bg-pino-900/45 backdrop:backdrop-blur-[2px]`}
      onClick={(e) => {
        // Click en el fondo (fuera del contenido) cierra el dialogo.
        if (e.target === ref.current) onCerrar?.()
      }}
    >
      {/* Filete de laton al tope: la firma visual del modal. */}
      <div className="h-[3px] bg-laton-500" aria-hidden="true" />

      <div className="flex items-start justify-between gap-4 border-b border-linea px-6 py-4">
        <div>
          {rotulo && <p className="rotulo mb-1">{rotulo}</p>}
          <h2
            id="modal-titulo"
            className="font-display text-[19px] font-medium leading-tight text-tinta"
          >
            {titulo}
          </h2>
        </div>

        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="-mr-1.5 -mt-1 rounded p-1.5 text-tinta-3 transition-colors hover:bg-papel-hondo hover:text-tinta"
        >
          <svg className="size-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>

      <div className="max-h-[68vh] overflow-y-auto px-6 py-5">{children}</div>

      {pie && (
        <div className="flex justify-end gap-2 border-t border-linea bg-papel-hondo px-6 py-3.5">
          {pie}
        </div>
      )}
    </dialog>,
    document.body
  )
}
