import { createContext } from 'react'

/**
 * El contexto y los permisos viven separados de AuthProvider a proposito:
 * si un archivo exporta componentes Y otras cosas, Fast Refresh deja de
 * funcionar en el, y perder la recarga en caliente sobre el arbol de
 * autenticacion se siente en cada iteracion.
 */
export const AuthContext = createContext(null)

/** Permisos por rol, en un solo lugar para no dispersar `if (rol === ...)`. */
export const PERMISOS = {
  admin: ['clientes', 'pacientes', 'historial', 'turnos', 'usuarios', 'reportes'],
  veterinario: ['clientes', 'pacientes', 'historial', 'turnos'],
  recepcionista: ['clientes', 'pacientes', 'turnos'],
}

/** Prefijo de ruta => modulo cuyo permiso la protege. */
const MODULO_POR_RUTA = [
  ['/clientes', 'clientes'],
  ['/pacientes', 'pacientes'],
  ['/historial', 'historial'],
  ['/turnos', 'turnos'],
  ['/usuarios', 'usuarios'],
]

/** @returns {string|null} Modulo que protege la ruta, o null si es libre. */
function moduloDeRuta(pathname = '') {
  const encontrado = MODULO_POR_RUTA.find(
    ([prefijo]) => pathname === prefijo || pathname.startsWith(`${prefijo}/`)
  )

  return encontrado ? encontrado[1] : null
}

/**
 * Destino seguro despues de iniciar sesion.
 *
 * Al cerrar sesion, la ruta en la que estabas queda guardada como `from` para
 * devolverte ahi. Pero si a continuacion entra OTRO usuario con menos
 * permisos, ese destino puede estarle vedado y aterrizaria en "sin permiso"
 * justo despues de un login correcto. Aca se comprueba antes y, si no
 * corresponde, se lo manda al inicio.
 */
export function destinoTrasLogin(rol, rutaDeseada) {
  if (!rutaDeseada || rutaDeseada === '/login') return '/'

  const modulo = moduloDeRuta(rutaDeseada)

  if (modulo === null) return rutaDeseada

  return (PERMISOS[rol] ?? []).includes(modulo) ? rutaDeseada : '/'
}
