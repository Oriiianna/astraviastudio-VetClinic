import { api } from './client'

export const turnosApi = {
  /**
   * Turnos de un rango de fechas. No esta paginado: la agenda siempre pide
   * un dia o una semana y necesita todo el rango para dibujarse.
   */
  listar: ({ desde, hasta, veterinarioId, estado, pacienteId, signal } = {}) =>
    api.get('/turnos', {
      params: {
        desde,
        hasta,
        veterinario_id: veterinarioId,
        estado,
        paciente_id: pacienteId,
      },
      signal,
    }),

  obtener: (id) => api.get(`/turnos/${id}`),

  crear: (datos) => api.post('/turnos', datos),

  actualizar: (id, datos) => api.put(`/turnos/${id}`, datos),

  /** Endpoint dedicado: es la operacion mas frecuente del mostrador. */
  cambiarEstado: (id, estado) => api.patch(`/turnos/${id}/estado`, { estado }),

  eliminar: (id) => api.delete(`/turnos/${id}`),

  resumenDelDia: (fecha) => api.get('/turnos/resumen', { params: { fecha } }),
}

/** Veterinarios activos, para los selectores de la agenda. */
export const veterinariosApi = {
  listar: () => api.get('/veterinarios'),
}
