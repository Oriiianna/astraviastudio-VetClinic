import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { Spinner } from '../components/ui/Spinner'

/**
 * Guarda de rutas: exige sesion y, opcionalmente, permiso sobre un modulo.
 *
 * IMPORTANTE: esto es solo una capa de UX. Ocultar una pantalla no protege
 * los datos; quien controla el acceso de verdad es RoleMiddleware en la API.
 * Cualquier permiso que se aplique aca debe existir tambien en el backend.
 */
export function ProtectedRoute({ modulo = null }) {
  const { autenticado, cargando, puede } = useAuth()
  const location = useLocation()

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-papel-hondo">
        <Spinner etiqueta="Verificando sesion..." />
      </div>
    )
  }

  if (!autenticado) {
    // `state.from` permite volver a donde el usuario queria ir despues de
    // iniciar sesion, en lugar de dejarlo siempre en el inicio.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (modulo !== null && !puede(modulo)) {
    return <Navigate to="/sin-permiso" replace />
  }

  return <Outlet />
}
