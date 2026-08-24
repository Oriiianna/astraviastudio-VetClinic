import { useCallback, useEffect, useRef, useState } from 'react'
import { clientesApi } from '../../api/clientes'
import { useDebounce } from '../../hooks/useDebounce'
import { POR_PAGINA } from '../../lib/constants'

/**
 * Estado del listado de clientes: busqueda, paginacion y recarga.
 *
 * Dos detalles que evitan bugs sutiles:
 *
 * - El termino de busqueda pasa por debounce (300 ms), asi la recepcionista
 * puede tipear un apellido completo generando una sola consulta.
 * - Cada peticion lleva un AbortController. Sin el, dos busquedas veloces
 * pueden resolverse fuera de orden y la lista termina mostrando el
 * resultado de la consulta VIEJA (condicion de carrera clasica).
 */
export function useClientes() {
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [clientes, setClientes] = useState([])
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
      const res = await clientesApi.listar({
        q: busquedaDebounced,
        page: pagina,
        perPage: POR_PAGINA,
        signal: controller.signal,
      })

      setClientes(res?.data ?? [])
      setMeta(res?.meta ?? { total: 0, total_pages: 0, page: 1 })
    } catch (err) {
      // Una peticion abortada no es un error: la reemplazo otra mas nueva.
      if (err.name === 'AbortError') return

      setError(err.message)
      setClientes([])
    } finally {
      if (!controller.signal.aborted) setCargando(false)
    }
  }, [busquedaDebounced, pagina])

  useEffect(() => {
    cargar()

    return () => abortRef.current?.abort()
  }, [cargar])

  // Al cambiar el filtro hay que volver a la primera pagina: si el usuario
  // estaba en la 3 y busca algo con un solo resultado, veria una lista vacia.
  useEffect(() => {
    setPagina(1)
  }, [busquedaDebounced])

  return {
    clientes,
    meta,
    cargando,
    error,
    busqueda,
    setBusqueda,
    pagina,
    setPagina,
    recargar: cargar,
    // true mientras el usuario sigue escribiendo y aun no salio la peticion.
    buscando: busqueda !== busquedaDebounced,
  }
}
