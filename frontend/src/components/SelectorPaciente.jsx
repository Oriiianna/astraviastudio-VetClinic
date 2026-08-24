import { useEffect, useId, useRef, useState } from 'react'
import { pacientesApi } from '../api/pacientes'
import { useDebounce } from '../hooks/useDebounce'

/**
 * Selector de paciente con busqueda.
 *
 * Vive en components/ y no dentro de una feature porque lo usan tres modulos
 * distintos (historial, turnos y, mas adelante, facturacion). Busca tanto por
 * el nombre de la mascota como por los datos del dueno, que es como lo pide
 * quien esta al telefono.
 */
export function SelectorPaciente({
  onChange,
  pacienteInicial = null,
  error,
  requerido,
  label = 'Paciente',
}) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [seleccionado, setSeleccionado] = useState(pacienteInicial)
  const [resultados, setResultados] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)

  const contenedorRef = useRef(null)
  const consulta = useDebounce(texto, 300)

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

    pacientesApi
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

  const elegir = (paciente) => {
    setSeleccionado(paciente)
    setTexto('')
    setAbierto(false)
    onChange(paciente)
  }

  return (
    <div ref={contenedorRef} className="relative">
      <label htmlFor={id} className="rotulo mb-1.5 block">
        {label}
        {requerido && <span className="ml-1 text-laton-500" aria-hidden="true">*</span>}
      </label>

      {seleccionado ? (
        <div
          className={`flex items-center justify-between gap-2 rounded border bg-papel-alto px-3 py-2 text-[13.5px] ${
            error ? 'border-ladrillo-600' : 'border-linea-fuerte'
          }`}
        >
          <span className="truncate">
            <span className="font-medium text-tinta">{seleccionado.nombre}</span>
            <span className="ml-2 text-tinta-3">
              {seleccionado.especie}
              {seleccionado.raza ? ` / ${seleccionado.raza}` : ''}
            </span>
            <span className="ml-2 text-[11.5px] text-tinta-4">
              {seleccionado.cliente_apellido}, {seleccionado.cliente_nombre}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              setSeleccionado(null)
              setTexto('')
              onChange(null)
            }}
            className="shrink-0 rounded p-1 text-tinta-4 hover:bg-papel-hondo hover:text-tinta-2"
            aria-label="Cambiar paciente"
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
          autoComplete="off"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          placeholder="Buscar por mascota, microchip o dueno..."
          className={`block w-full rounded border bg-papel-alto px-3 py-2 text-[13.5px] text-tinta transition-colors placeholder:text-tinta-4
            ${error ? 'border-ladrillo-600 focus:border-ladrillo-700' : 'border-linea-fuerte focus:border-pino-600'}`}
        />
      )}

      {abierto && !seleccionado && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-linea-fuerte bg-papel-alto py-1 shadow-[0_14px_32px_-10px_rgba(22,33,28,0.25)]"
        >
          {cargando && <li className="px-3 py-2 text-[13px] text-tinta-4">Buscando...</li>}

          {!cargando && resultados.length === 0 && (
            <li className="px-3 py-2 text-[13px] text-tinta-4">
              Sin resultados. Da de alta la mascota en Pacientes.
            </li>
          )}

          {!cargando &&
            resultados.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => elegir(p)}
                  className="block w-full px-3 py-2 text-left text-[13px] hover:bg-pino-50 transition-colors"
                >
                  <span className="font-medium text-tinta">{p.nombre}</span>
                  <span className="ml-2 text-tinta-3">
                    {p.especie}
                    {p.raza ? ` / ${p.raza}` : ''}
                  </span>
                  <span className="ml-2 text-[11.5px] text-tinta-4">
                    {p.cliente_apellido}, {p.cliente_nombre}
                  </span>
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
