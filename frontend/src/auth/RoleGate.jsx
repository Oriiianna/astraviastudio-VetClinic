import { useAuth } from './useAuth'

/**
 * Muestra su contenido solo si el usuario tiene el rol o el permiso pedido.
 * Sirve para elementos sueltos (un boton de borrar, una columna de la tabla)
 * donde montar una ruta protegida seria excesivo.
 *
 * <RoleGate roles={['admin']}>
 * <Button onClick={borrar}>Eliminar</Button>
 * </RoleGate>
 */
export function RoleGate({ roles = null, modulo = null, children, fallback = null }) {
  const { rol, puede } = useAuth()

  if (roles !== null && !roles.includes(rol)) return fallback
  if (modulo !== null && !puede(modulo)) return fallback

  return children
}
