import { useEffect, useState } from 'react'

/**
 * Estado de conectividad del navegador.
 *
 * Advertencia: navigator.onLine solo informa si hay una interfaz de red
 * activa. Estar conectado a un wifi sin salida a internet reporta `true`. Es
 * suficiente para avisarle al usuario, pero no reemplaza al manejo de errores
 * de red del cliente HTTP.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const conectado = () => setOnline(true)
    const desconectado = () => setOnline(false)

    window.addEventListener('online', conectado)
    window.addEventListener('offline', desconectado)

    return () => {
      window.removeEventListener('online', conectado)
      window.removeEventListener('offline', desconectado)
    }
  }, [])

  return online
}
