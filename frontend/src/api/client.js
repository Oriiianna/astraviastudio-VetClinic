/**
 * Cliente HTTP de la aplicacion.
 *
 * Concentra tres cosas que, dispersas por los componentes, se vuelven
 * inconsistentes enseguida:
 *
 * 1. El access token vive en MEMORIA de este modulo, no en localStorage.
 * localStorage es legible por cualquier script de la pagina, asi que un
 * XSS se llevaria la sesion entera. En memoria, el token muere al cerrar
 * la pestana y se recupera con la cookie httpOnly del refresh.
 *
 * 2. Renovacion transparente ante un 401: se pide un token nuevo y se
 * reintenta la peticion original una sola vez. Las llamadas concurrentes
 * comparten la misma promesa de refresh para no dispararlo N veces.
 *
 * 3. Errores tipados: todo fallo llega a los componentes como ApiError, con
 * `status` y `errors` por campo listos para pintar en un formulario.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

/** Error de la API con el detalle que necesitan los formularios. */
class ApiError extends Error {
  constructor(message, { status = 0, errors = null, esRed = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
    this.esRed = esRed
  }
}

// --- Token en memoria -------------------------------------------------- //

let accessToken = null
let alCerrarSesion = null

export function setAccessToken(token) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

/** Callback que AuthContext registra para limpiar su estado ante un 401 final. */
export function onSesionExpirada(callback) {
  alCerrarSesion = callback
}

// --- Refresh compartido ------------------------------------------------ //

let refreshEnCurso = null

/**
 * Renueva la sesion usando la cookie httpOnly del refresh token.
 *
 * TODO el codigo que necesite refrescar debe pasar por aqui, incluida la
 * restauracion de sesion al arrancar la app. El motivo es la deduplicacion:
 * el servidor ROTA el refresh token en cada uso, asi que dos llamadas
 * concurrentes harian que la segunda viaje con un token ya revocado y
 * recibiera un 401, cerrando la sesion de un usuario legitimo.
 *
 * Pasa exactamente eso con <StrictMode> en desarrollo, que monta los efectos
 * dos veces, y tambien en produccion si varias peticiones fallan a la vez.
 *
 * @returns {Promise<{usuario: object, access_token: string}|null>}
 */
export async function refrescarSesion() {
  // Si ya hay un refresh volando, todos comparten esa misma promesa.
  refreshEnCurso ??= (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // imprescindible: envia la cookie httpOnly
        headers: { Accept: 'application/json' },
      })

      if (!res.ok) return null

      const json = await res.json()

      accessToken = json?.data?.access_token ?? null
      return json?.data ?? null
    } catch {
      return null
    } finally {
      // Se libera en el macrotask siguiente para que quienes ya estaban
      // esperando lean el resultado antes de que se limpie.
      setTimeout(() => {
        refreshEnCurso = null
      }, 0)
    }
  })()

  return refreshEnCurso
}

// --- Peticion base ----------------------------------------------------- //

async function peticion(ruta, { metodo = 'GET', body, params, reintentar = true, signal } = {}) {
  let url = `${BASE_URL}${ruta}`

  if (params) {
    // Se descartan los parametros vacios para no ensuciar la URL (y para que
    // el service worker cachee bajo una clave estable).
    const qs = new URLSearchParams(
      Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== ''
      )
    ).toString()

    if (qs) url += `?${qs}`
  }

  const headers = { Accept: 'application/json' }
  const esFormData = body instanceof FormData

  // Con FormData el navegador debe fijar el Content-Type junto con el
  // boundary; ponerlo a mano rompe la subida de archivos.
  if (body && !esFormData) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let res
  try {
    res = await fetch(url, {
      method: metodo,
      headers,
      credentials: 'include',
      signal,
      body: esFormData ? body : body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw e

    throw new ApiError(
      'Sin conexion con el servidor. Verifica tu conexion a internet.',
      { esRed: true }
    )
  }

  // 401: intentar renovar y repetir una unica vez. La renovacion no se
  // intenta sobre los propios endpoints de auth, o se entraria en bucle.
  if (res.status === 401 && reintentar && !ruta.startsWith('/auth/')) {
    const renovada = await refrescarSesion()

    if (renovada?.access_token) {
      return peticion(ruta, { metodo, body, params, reintentar: false, signal })
    }

    accessToken = null
    alCerrarSesion?.()
  }

  if (res.status === 204) return null

  let json = null
  try {
    json = await res.json()
  } catch {
    if (!res.ok) {
      throw new ApiError(`Error ${res.status} del servidor.`, { status: res.status })
    }
    return null
  }

  if (!res.ok || json?.success === false) {
    throw new ApiError(json?.message ?? `Error ${res.status}.`, {
      status: res.status,
      errors: json?.errors ?? null,
    })
  }

  // `meta` solo viene en listados paginados; se adjunta para que los hooks
  // puedan leer el total sin romper el desempaquetado habitual de `data`.
  if (json?.meta) return { data: json.data, meta: json.meta }

  return json?.data ?? null
}

export const api = {
  get: (ruta, opciones) => peticion(ruta, { ...opciones, metodo: 'GET' }),
  post: (ruta, body, opciones) => peticion(ruta, { ...opciones, metodo: 'POST', body }),
  put: (ruta, body, opciones) => peticion(ruta, { ...opciones, metodo: 'PUT', body }),
  patch: (ruta, body, opciones) => peticion(ruta, { ...opciones, metodo: 'PATCH', body }),
  delete: (ruta, opciones) => peticion(ruta, { ...opciones, metodo: 'DELETE' }),
}
