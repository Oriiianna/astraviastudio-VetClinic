import { useCallback, useEffect, useRef, useState } from 'react'
import { pacientesApi } from '../../api/pacientes'
import { useDebounce } from '../../hooks/useDebounce'
import { POR_PAGINA } from '../../lib/constants'

/**
 * Estado del listado de pacientes.
 *
 * Calcado de useClientes: debounce en la busqueda y AbortController por
 * peticion para que dos busquedas veloces no se resuelvan fuera de orden.
 *
 * @param {{clienteId?: number}} opciones Fija el filtro por dueno, para
 * reutilizar el hook desde la ficha de un cliente.
 */
export function usePacientes({ clienteId = null } = {}) {
  const [busqueda, setBusqueda] = useState('')
  const [especieId, setEspecieId] = useState('')
  const [incluirFallecidos, setIncluirFallecidos] = useState(false)
  const [pagina, setPagina] = useState(1)

  const [pacientes, setPacientes] = useState([])
  const [meta, setMeta] = useState({ total: 0, total_pages: 0, page: 1 })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const busquedaDebounced = useDebounce(busqueda, 300)
  const abortRef = useRef(null)

  const cargar = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setCargando(true)
    setError(null)

    try {
      const res = await pacientesApi.listar({
        q: busquedaDebounced,
        clienteId,
        especieId: especieId || undefined,
        incluirFallecidos,
        page: pagina,
        perPage: POR_PAGINA,
        signal: controller.signal,
      })

      setPacientes(res?.data ?? [])
      setMeta(res?.meta ?? { total: 0, total_pages: 0, page: 1 })
    } catch (err) {
      // Una peticion abortada no es un error: la reemplazo otra mas nueva.
      if (err.name === 'AbortError') return

      setError(err.message)
      setPacientes([])
    } finally {
      if (!controller.signal.aborted) setCargando(false)
    }
  }, [busquedaDebounced, clienteId, especieId, incluirFallecidos, pagina])

  useEffect(() => {
    cargar()

    return () => abortRef.current?.abort()
  }, [cargar])

  // Cualquier cambio de filtro vuelve a la primera pagina: si el usuario
  // estaba en la 3 y filtra algo con un solo resultado, veria una lista vacia.
  useEffect(() => {
    setPagina(1)
  }, [busquedaDebounced, especieId, incluirFallecidos])

  return {
    pacientes,
    meta,
    cargando,
    error,
    busqueda,
    setBusqueda,
    especieId,
    setEspecieId,
    incluirFallecidos,
    setIncluirFallecidos,
    pagina,
    setPagina,
    recargar: cargar,
    buscando: busqueda !== busquedaDebounced,
  }
}
