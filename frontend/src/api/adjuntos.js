import { api, getAccessToken } from './client'

/**
 * Documentos adjuntos de un paciente.
 *
 * Los binarios no son URLs publicas: se piden con el token por
 * /api/adjuntos/{id}/archivo. Por eso `abrir` y `descargar` hacen un fetch
 * autenticado y crean un blob local, en vez de poner la URL en un <a href>
 * (que viajaria sin cabecera Authorization y devolveria 401).
 */
export const adjuntosApi = {
  listar: (pacienteId) => api.get(`/pacientes/${pacienteId}/adjuntos`),

  /**
   * @param {File} archivo
   * @param {{tipo?: string, descripcion?: string, consultaId?: number}} datos
   */
  subir: (pacienteId, archivo, { tipo = 'documento', descripcion, consultaId } = {}) => {
    const form = new FormData()
    form.append('archivo', archivo)
    form.append('tipo', tipo)
    if (descripcion) form.append('descripcion', descripcion)
    if (consultaId) form.append('consulta_id', String(consultaId))

    // El cliente HTTP detecta FormData y deja que el navegador ponga el
    // Content-Type con su boundary.
    return api.post(`/pacientes/${pacienteId}/adjuntos`, form)
  },

  actualizar: (id, datos) => api.put(`/adjuntos/${id}`, datos),

  eliminar: (id) => api.delete(`/adjuntos/${id}`),

  /**
   * Descarga el binario como blob usando el token en memoria.
   *
   * @returns {Promise<string>} URL de objeto: quien la use debe liberarla
   *          con URL.revokeObjectURL() para no acumular blobs en memoria.
   */
  async urlBlob(id) {
    const base = import.meta.env.VITE_API_URL ?? '/api'

    const res = await fetch(`${base}/adjuntos/${id}/archivo`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      credentials: 'include',
    })

    if (!res.ok) {
      throw new Error('No se pudo obtener el archivo.')
    }

    return URL.createObjectURL(await res.blob())
  },
}

/** Etiquetas de los tipos de adjunto (coinciden con el ENUM de la tabla). */
export const TIPOS_ADJUNTO = {
  documento: 'Documento',
  radiografia: 'Radiografia',
  ecografia: 'Ecografia',
  analisis: 'Analisis',
  foto: 'Foto',
  consentimiento: 'Consentimiento',
  otro: 'Otro',
}

/** Tamano legible: los bytes crudos no le dicen nada a nadie. */
export function formatearTamano(bytes) {
  const n = Number(bytes)

  if (!Number.isFinite(n) || n <= 0) return '-'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`

  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
