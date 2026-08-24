import { api } from './client'

/**
 * Endpoints de pacientes (mascotas).
 *
 * Misma forma que clientes.js: una funcion por endpoint, sin logica de UI.
 */
export const pacientesApi = {
  /** @returns {Promise<{data: Array, meta: object}>} */
  listar: ({
    q,
    clienteId,
    especieId,
    incluirFallecidos = false,
    page = 1,
    perPage = 20,
    orderBy,
    orderDir,
    signal,
  } = {}) =>
    api.get('/pacientes', {
      params: {
        q,
        cliente_id: clienteId,
        especie_id: especieId,
        // El cliente HTTP descarta los parametros vacios, asi que solo se
        // manda la bandera cuando esta activa.
        incluir_fallecidos: incluirFallecidos ? '1' : '',
        page,
        per_page: perPage,
        order_by: orderBy,
        order_dir: orderDir,
      },
      signal,
    }),

  obtener: (id) => api.get(`/pacientes/${id}`),

  crear: (datos) => api.post('/pacientes', datos),

  actualizar: (id, datos) => api.put(`/pacientes/${id}`, datos),

  eliminar: (id) => api.delete(`/pacientes/${id}`),

  /** Especies con sus razas anidadas, para los selects del formulario. */
  especies: () => api.get('/especies'),
}
