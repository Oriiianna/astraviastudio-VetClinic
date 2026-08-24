import { api } from './client'

/**
 * Endpoints de clientes (duenos).
 *
 * Este modulo es la plantilla para pacientes.js, historial.js y turnos.js:
 * una funcion por endpoint, sin logica de UI, devolviendo datos ya
 * desempaquetados.
 */
export const clientesApi = {
  /** @returns {Promise<{data: Array, meta: object}>} */
  listar: ({ q, page = 1, perPage = 20, orderBy, orderDir, signal } = {}) =>
    api.get('/clientes', {
      params: { q, page, per_page: perPage, order_by: orderBy, order_dir: orderDir },
      signal,
    }),

  obtener: (id) => api.get(`/clientes/${id}`),

  crear: (datos) => api.post('/clientes', datos),

  actualizar: (id, datos) => api.put(`/clientes/${id}`, datos),

  eliminar: (id) => api.delete(`/clientes/${id}`),
}
