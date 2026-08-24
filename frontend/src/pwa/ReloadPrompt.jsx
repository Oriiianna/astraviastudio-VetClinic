import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Avisos del service worker.
 *
 * Con registerType: 'prompt' la actualizacion NO se aplica sola: se le ofrece
 * al usuario. Es deliberado. Un veterinario a mitad de cargar una consulta
 * perderia el formulario si la app se recargara por su cuenta.
 */
export function ReloadPrompt() {
  const {
    offlineReady: [listaOffline, setListaOffline],
    needRefresh: [necesitaActualizar, setNecesitaActualizar],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url, registro) {
      // Busca versiones nuevas cada hora. Sin esto, una pestana abierta
      // durante toda la jornada no se enteraria de un despliegue.
      if (!registro) return

      setInterval(() => registro.update(), 60 * 60 * 1000)
    },
    onRegisterError(error) {
      console.error('Fallo el registro del service worker:', error)
    },
  })

  const cerrar = () => {
    setListaOffline(false)
    setNecesitaActualizar(false)
  }

  if (!listaOffline && !necesitaActualizar) return null

  return (
    <div
      role="status"
      className="surgir fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm overflow-hidden rounded border border-linea-fuerte bg-papel-alto shadow-[0_18px_40px_-12px_rgba(22,33,28,0.3)] lg:bottom-6"
    >
      <div className="h-[3px] bg-laton-500" aria-hidden="true" />

      <div className="p-4">
        <p className="rotulo">{necesitaActualizar ? 'Actualizacion' : 'Sin conexion'}</p>
        <p className="mt-1.5 text-[13px] leading-snug text-tinta-2">
          {necesitaActualizar
            ? 'Hay una version nueva de la aplicacion disponible.'
            : 'La app quedo lista para usarse sin conexion.'}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          {necesitaActualizar && (
            <button
              type="button"
              onClick={() => updateServiceWorker(true)}
              className="rounded bg-pino-800 px-3 py-1.5 text-[12.5px] font-medium text-papel transition-colors hover:bg-pino-700"
            >
              Actualizar
            </button>
          )}
          <button
            type="button"
            onClick={cerrar}
            className="rounded px-3 py-1.5 text-[12.5px] font-medium text-tinta-2 transition-colors hover:bg-papel-hondo"
          >
            {necesitaActualizar ? 'Mas tarde' : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  )
}
