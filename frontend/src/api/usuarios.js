import { api } from './client'

/** Perfil del usuario autenticado. Disponible para cualquier rol. */
export const perfilApi = {
  obtener: () => api.get('/auth/me'),

  /**
   * Actualiza los datos propios. El servidor toma el id del token, no del
   * body, y `rol` no esta en la whitelist del modelo: aunque se envie, no se
   * escribe.
   */
  actualizar: (datos) => api.put('/auth/perfil', datos),

  cambiarPassword: (passwordActual, passwordNueva) =>
    api.post('/auth/password', {
      password_actual: passwordActual,
      password_nueva: passwordNueva,
    }),
}

/** Administracion de usuarios. Solo admin (la API devuelve 403 al resto). */
export const usuariosApi = {
  listar: ({ rol, incluirInactivos = false } = {}) =>
    api.get('/usuarios', {
      params: { rol, incluir_inactivos: incluirInactivos ? '1' : '' },
    }),

  obtener: (id) => api.get(`/usuarios/${id}`),

  crear: (datos) => api.post('/usuarios', datos),

  actualizar: (id, datos) => api.put(`/usuarios/${id}`, datos),

  cambiarEstado: (id, activo) => api.patch(`/usuarios/${id}/estado`, { activo }),

  resetearPassword: (id, password) => api.post(`/usuarios/${id}/password`, { password }),
}
