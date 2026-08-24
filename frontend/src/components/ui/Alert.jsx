/*
 * Avisos.
 *
 * En lugar del recuadro de color saturado habitual, cada aviso se marca con
 * una barra vertical gruesa a la izquierda sobre un fondo apenas tenido. Es
 * la convencion del margen anotado, y no compite con el resto de la pagina.
 */

const TONOS = {
  error: { caja: 'bg-ladrillo-50 text-ladrillo-700', barra: 'bg-ladrillo-600' },
  aviso: { caja: 'bg-ocre-50 text-ocre-700', barra: 'bg-ocre-600' },
  ok: { caja: 'bg-musgo-50 text-musgo-700', barra: 'bg-musgo-600' },
  info: { caja: 'bg-pino-50 text-pino-700', barra: 'bg-pino-600' },
}

export function Alert({ tono = 'info', titulo, children, className = '' }) {
  const { caja, barra } = TONOS[tono]

  return (
    <div
      // role="alert" hace que el lector de pantalla lo anuncie al aparecer,
      // que es justo lo que se necesita tras un login fallido.
      role={tono === 'error' ? 'alert' : 'status'}
      className={`flex overflow-hidden rounded text-[13px] ${caja} ${className}`}
    >
      <span className={`w-[3px] shrink-0 ${barra}`} aria-hidden="true" />

      <div className="px-3.5 py-2.5">
        {titulo && <p className="font-medium tracking-[-0.01em]">{titulo}</p>}
        {children && <div className={titulo ? 'mt-1 leading-snug' : 'leading-snug'}>{children}</div>}
      </div>
    </div>
  )
}
