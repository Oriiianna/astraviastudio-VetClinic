import { api, refrescarSesion, setAccessToken } from './client'

export const authApi = {
  async login(email, password) {
    const data = await api.post('/auth/login', { email, password })
    setAccessToken(data.access_token)

    return data.usuario
  },

  /**
   * Recupera la sesion al abrir la app. El access token vive en memoria, asi
   * que tras un F5 se perdio; la cookie httpOnly del refresh sigue ahi y es
   * la que permite volver a entrar sin pedir credenciales.
   *
   * Usa refrescarSesion() del cliente HTTP y no una llamada suelta: esa
   * funcion deduplica los refresh concurrentes. Sin eso, el doble montaje de
   * efectos de <StrictMode> dispara dos veces el endpoint y, como el servidor
   * rota el token en cada uso, la segunda llamada llega con uno ya revocado y
   * expulsa al usuario. Devuelve null si no habia sesion, que es un caso
   * esperado y no un error.
   */
  async restaurarSesion() {
    const data = await refrescarSesion()

    return data?.usuario ?? null
  },

  async logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      // El estado local se limpia pase lo que pase: si el servidor no
      // responde, el usuario igual debe quedar deslogueado en su dispositivo.
      setAccessToken(null)
    }
  },

  me: () => api.get('/auth/me'),

  cambiarPassword: (passwordActual, passwordNueva) =>
    api.post('/auth/password', {
      password_actual: passwordActual,
      password_nueva: passwordNueva,
    }),
}
