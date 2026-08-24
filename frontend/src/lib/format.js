/**
 * Formateo de datos para mostrar. Sin dependencias: date-fns o dayjs no se
 * justifican para estas cuatro funciones.
 */

const LOCALE = 'es-AR'

/**
 * Fecha en formato 'YYYY-MM-DD' segun el huso LOCAL.
 *
 * No usar `new Date().toISOString().slice(0,10)`: eso devuelve la fecha en
 * UTC. En Argentina (UTC-3) a partir de las 21:00 ya informa el dia
 * SIGUIENTE, asi que un valor por defecto o un `max` calculado asi quedan un
 * dia adelantados y el servidor -que valida en hora local- los rechaza por
 * "fecha futura".
 */
export function hoyISO() {
  return fechaISO(new Date())
}

/** Convierte un Date a 'YYYY-MM-DD' respetando el huso local. */
export function fechaISO(fecha) {
  const d = new Date(fecha)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())

  return d.toISOString().slice(0, 10)
}

export function formatearFecha(valor) {
  if (!valor) return '-'

  // 'YYYY-MM-DD' parseado por Date() se interpreta como UTC y, en husos
  // negativos, muestra el dia anterior. Se construye la fecha por partes
  // para forzar la interpretacion local.
  const [y, m, d] = String(valor).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return '-'

  return new Date(y, m - 1, d).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatearFechaHora(valor) {
  if (!valor) return '-'

  const fecha = new Date(String(valor).replace(' ', 'T'))
  if (Number.isNaN(fecha.getTime())) return '-'

  return fecha.toLocaleString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Edad legible a partir de la fecha de nacimiento.
 *
 * Se calcula aqui y no se guarda en la base: una edad almacenada queda
 * desactualizada al dia siguiente. En cachorros se expresa en meses, que es
 * como la maneja la clinica.
 */
export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return 'Edad desconocida'

  const [y, m, d] = String(fechaNacimiento).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return 'Edad desconocida'

  const nacimiento = new Date(y, m - 1, d)
  const hoy = new Date()

  if (nacimiento > hoy) return 'Fecha invalida'

  let meses = (hoy.getFullYear() - nacimiento.getFullYear()) * 12
  meses += hoy.getMonth() - nacimiento.getMonth()
  if (hoy.getDate() < nacimiento.getDate()) meses--

  if (meses < 1) {
    const dias = Math.floor((hoy - nacimiento) / 86_400_000)
    return `${dias} dia${dias === 1 ? '' : 's'}`
  }

  if (meses < 24) return `${meses} mes${meses === 1 ? '' : 'es'}`

  const anios = Math.floor(meses / 12)
  const resto = meses % 12

  return resto === 0
    ? `${anios} anios`
    : `${anios} anios y ${resto} mes${resto === 1 ? '' : 'es'}`
}

export function formatearPeso(kg) {
  if (kg === null || kg === undefined || kg === '') return '-'

  return `${Number(kg).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`
}

export function iniciales(persona) {
  if (!persona) return '?'

  return `${persona.nombre?.[0] ?? ''}${persona.apellido?.[0] ?? ''}`.toUpperCase() || '?'
}
