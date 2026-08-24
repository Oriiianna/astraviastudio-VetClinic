import { useOnlineStatus } from '../../hooks/useOnlineStatus'

/**
 * Aviso fijo cuando el navegador pierde la red.
 *
 * Es informacion importante en una clinica: el usuario debe saber que lo que
 * esta viendo puede venir de la cache del service worker y que sus cambios no
 * llegaran al servidor hasta que vuelva la conexion.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()

  if (online) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2.5 bg-ocre-600 px-4 py-2 text-[12px] font-medium tracking-[0.01em] text-papel"
    >
      <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" d="M18.4 5.6a9 9 0 010 12.8M5.6 18.4a9 9 0 010-12.8M3 3l18 18" />
      </svg>
      Sin conexion. Estas viendo datos guardados; los cambios no se guardaran.
    </div>
  )
}
