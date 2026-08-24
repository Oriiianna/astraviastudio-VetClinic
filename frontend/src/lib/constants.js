/** Etiquetas y catalogos compartidos por toda la UI. */

export const ROLES = {
  admin: 'Administrador',
  veterinario: 'Veterinario',
  recepcionista: 'Recepcionista',
}

export const SEXOS = {
  macho: 'Macho',
  hembra: 'Hembra',
  desconocido: 'Desconocido',
}

/**
 * Estados de un turno.
 *
 * Toda la escala vive dentro de la paleta calida del producto, sin los
 * semaforos saturados de una libreria de componentes. La progresion natural
 * del dia -programado, confirmado, en sala, atendido- va ganando saturacion,
 * asi que la agenda se lee de un vistazo: lo mas apagado es lo que todavia no
 * paso, lo mas fuerte es lo que esta ocurriendo.
 */
export const ESTADOS_TURNO = {
  programado: { etiqueta: 'Programado', clase: 'bg-papel-hondo text-tinta-2 ring-linea-fuerte' },
  confirmado: { etiqueta: 'Confirmado', clase: 'bg-pino-50 text-pino-700 ring-pino-200' },
  en_sala: { etiqueta: 'En sala', clase: 'bg-ocre-50 text-ocre-700 ring-ocre-200' },
  atendido: { etiqueta: 'Atendido', clase: 'bg-musgo-50 text-musgo-700 ring-musgo-200' },
  cancelado: { etiqueta: 'Cancelado', clase: 'bg-ladrillo-50 text-ladrillo-700 ring-ladrillo-200' },
  ausente: { etiqueta: 'No asistio', clase: 'bg-piedra-50 text-piedra-600 ring-piedra-200' },
}

export const TIPOS_TURNO = {
  consulta: 'Consulta',
  vacunacion: 'Vacunacion',
  cirugia: 'Cirugia',
  control: 'Control',
  peluqueria: 'Peluqueria',
  urgencia: 'Urgencia',
  otro: 'Otro',
}

/** Vias de administracion de un medicamento (tabla `recetas`). */
export const VIAS_RECETA = {
  oral: 'Oral',
  topica: 'Topica',
  inyectable: 'Inyectable',
  oftalmica: 'Oftalmica',
  otica: 'Otica',
  otra: 'Otra',
}

export const TIPOS_DESPARASITACION = {
  interna: 'Interna',
  externa: 'Externa',
  mixta: 'Mixta',
}

export const VIAS_DESPARASITACION = {
  oral: 'Oral',
  topica: 'Topica',
  inyectable: 'Inyectable',
}

export const POR_PAGINA = 20
