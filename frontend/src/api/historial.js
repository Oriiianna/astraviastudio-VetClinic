import { api } from './client'

/** Consultas medicas y sus recetas. */
export const consultasApi = {
  listar: ({ pacienteId, veterinarioId, desde, hasta, q, page = 1, perPage = 20, signal } = {}) =>
    api.get('/consultas', {
      params: {
        paciente_id: pacienteId,
        veterinario_id: veterinarioId,
        desde,
        hasta,
        q,
        page,
        per_page: perPage,
      },
      signal,
    }),

  obtener: (id) => api.get(`/consultas/${id}`),

  crear: (datos) => api.post('/consultas', datos),

  actualizar: (id, datos) => api.put(`/consultas/${id}`, datos),

  eliminar: (id) => api.delete(`/consultas/${id}`),

  /** Linea de tiempo completa: consultas + vacunas + desparasitaciones. */
  historialDe: (pacienteId) => api.get(`/pacientes/${pacienteId}/historial`),
}

/**
 * Vacunas y desparasitaciones.
 *
 * Comparten forma, asi que se genera un cliente por tipo en vez de duplicar
 * las cinco funciones.
 */
function crearApiSanidad(recurso) {
  return {
    listar: (pacienteId) => api.get(`/pacientes/${pacienteId}/${recurso}`),
    crear: (datos) => api.post(`/${recurso}`, datos),
    actualizar: (id, datos) => api.put(`/${recurso}/${id}`, datos),
    eliminar: (id) => api.delete(`/${recurso}/${id}`),
  }
}

export const vacunasApi = crearApiSanidad('vacunas')
export const desparasitacionesApi = crearApiSanidad('desparasitaciones')

/** Vacunas y desparasitaciones vencidas o proximas a vencer. */
export const recordatoriosApi = {
  listar: (dias = 30) => api.get('/recordatorios', { params: { dias } }),
}
