import { useEffect, useId, useRef, useState } from 'react'
import { clientesApi } from '../../api/clientes'
import { useDebounce } from '../../hooks/useDebounce'

/**
 * Selector de dueno con busqueda.
 *
 * Un <select> con todos los clientes deja de ser usable apenas la clinica
 * pasa el centenar, y ademas obligaria a descargarlos todos. Aca se busca
 * contra la API con debounce y se muestran los primeros resultados.
 */
// El componente es no controlado a proposito: mantiene el cliente elegido en
// su propio estado (arrancando en `clienteInicial`) y solo comunica el id
// hacia arriba con onChange. Recibir ademas el valor obligaria al padre a
// tener el objeto cliente completo, que es justo lo que este selector busca.
export function SelectorCliente({ onChange, clienteInicial = null, error, requerido }) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [seleccionado, setSeleccionado] = useState(clienteInicial)
  const [resultados, setResultados] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)

  const contenedorRef = useRef(null)
  const consulta = useDebounce(texto, 300)

  // Cerrar al hacer click fuera: sin esto el desplegable queda flotando
  // sobre el resto del formulario.
  useEffect(() => {
    const alClickear = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false)
      }
    }

    document.addEventListener('mousedown', alClickear)
    return () => document.removeEventListener('mousedown', alClickear)
  }, [])

  useEffect(() => {
    if (!abierto) return

    let vigente = true
    const controller = new AbortController()
    setCargando(true)

    clientesApi
      .listar({ q: consulta, perPage: 8, signal: controller.signal })
      .then((res) => {
        if (vigente) setResultados(res?.data ?? [])
      })
      .catch((err) => {
        if (err.name !== 'AbortError' && vigente) setResultados([])
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
      controller.abort()
    }
  }, [consulta, abierto])

  const elegir = (cliente) => {
    setSeleccionado(cliente)
    setTexto('')
    setAbierto(false)
    onChange(cliente.id)
  }

  const limpiar = () => {
    setSeleccionado(null)
    setTexto('')
    onChange('')
  }

  return (
    <div ref={contenedorRef} className="relative">
      <label htmlFor={id} className="rotulo mb-1.5 block">
        Dueno
        {requerido && <span className="ml-1 text-laton-500" aria-hidden="true">*</span>}
      </label>

      {seleccionado ? (
        <div
          className={`flex items-center justify-between gap-2 rounded border bg-papel-alto px-3 py-2 text-[13.5px] ${
            error ? 'border-ladrillo-600' : 'border-linea-fuerte'
          }`}
        >
          <span className="truncate">
            <span className="font-medium text-tinta">
              {seleccionado.apellido}, {seleccionado.nombre}
            </span>
            <span className="ml-2 text-tinta-3">{seleccionado.telefono}</span>
          </span>
          <button
            type="button"
            onClick={limpiar}
            className="shrink-0 rounded p-1 text-tinta-4 hover:bg-papel-hondo hover:text-tinta-2"
            aria-label="Cambiar dueno"
          >
            <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      ) : (
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={`${id}-lista`}
          autoComplete="off"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          placeholder="Buscar por nombre, apellido, documento o telefono..."
          className={`block w-full rounded border bg-papel-alto px-3 py-2 text-[13.5px] text-tinta transition-colors placeholder:text-tinta-4
            ${error ? 'border-ladrillo-600 focus:border-ladrillo-700' : 'border-linea-fuerte focus:border-pino-600'}`}
        />
      )}

      {abierto && !seleccionado && (
        <ul
          id={`${id}-lista`}
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-linea-fuerte bg-papel-alto py-1 shadow-[0_14px_32px_-10px_rgba(22,33,28,0.25)]"
        >
          {cargando && <li className="px-3 py-2 text-[13px] text-tinta-4">Buscando...</li>}

          {!cargando && resultados.length === 0 && (
            <li className="px-3 py-2 text-[13px] text-tinta-4">
              Sin resultados. Carga el cliente desde la seccion Clientes.
            </li>
          )}

          {!cargando &&
            resultados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => elegir(c)}
                  className="block w-full px-3 py-2 text-left text-[13px] hover:bg-pino-50 transition-colors"
                >
                  <span className="font-medium text-tinta">
                    {c.apellido}, {c.nombre}
                  </span>
                  <span className="ml-2 text-tinta-3">{c.telefono}</span>
                  {c.documento && (
                    <span className="ml-2 text-[11.5px] text-tinta-4">Doc. {c.documento}</span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      )}

      {error && <p data-error
          className="mt-1.5 text-[11.5px] text-ladrillo-600">{error}</p>}
    </div>
  )
}
