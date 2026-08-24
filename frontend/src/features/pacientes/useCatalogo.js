import { useEffect, useState } from 'react'
import { pacientesApi } from '../../api/pacientes'

/**
 * Catalogo de especies con sus razas.
 *
 * Se cachea a nivel de modulo: son ~50 filas que practicamente no cambian, y
 * asi abrir el formulario diez veces no dispara diez peticiones. La promesa
 * en curso tambien se comparte, para que dos componentes que monten a la vez
 * no pidan lo mismo por duplicado.
 */
let cache = null
let enCurso = null

export function useCatalogo() {
  const [especies, setEspecies] = useState(cache ?? [])
  const [cargando, setCargando] = useState(cache === null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (cache !== null) return

    let vigente = true
    enCurso ??= pacientesApi.especies()

    enCurso
      .then((datos) => {
        cache = datos ?? []
        if (vigente) setEspecies(cache)
      })
      .catch((err) => {
        // Sin catalogo no se puede cargar una mascota: hay que avisarlo, no
        // dejar los selects vacios en silencio.
        enCurso = null
        if (vigente) setError(err.message)
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [])

  return { especies, cargando, error }
}

/** Razas de una especie. Devuelve [] si aun no se eligio ninguna. */
export function razasDe(especies, especieId) {
  if (!especieId) return []

  return especies.find((e) => String(e.id) === String(especieId))?.razas ?? []
}
