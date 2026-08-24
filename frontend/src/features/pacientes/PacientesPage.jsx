import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePacientes } from './usePacientes'
import { useCatalogo } from './useCatalogo'
import { PacienteForm } from './PacienteForm'
import { pacientesApi } from '../../api/pacientes'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { RoleGate } from '../../auth/RoleGate'
import { calcularEdad, formatearPeso } from '../../lib/format'

export function PacientesPage() {
  const [params, setParams] = useSearchParams()
  const clienteIdParam = params.get('cliente_id')

  const {
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
    recargar,
    buscando,
  } = usePacientes({ clienteId: clienteIdParam ? Number(clienteIdParam) : null })

  const { especies } = useCatalogo()

  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [aEliminar, setAEliminar] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  // Shortcut ?nuevo=1, igual que en Clientes.
  useEffect(() => {
    if (params.get('nuevo') === '1') {
      setEditando(null)
      setFormAbierto(true)

      const resto = new URLSearchParams(params)
      resto.delete('nuevo')
      setParams(resto, { replace: true })
    }
  }, [params, setParams])

  const abrirNuevo = () => {
    setEditando(null)
    setFormAbierto(true)
  }

  const confirmarEliminar = async () => {
    setEliminando(true)
    setErrorAccion(null)

    try {
      await pacientesApi.eliminar(aEliminar.id)
      setAEliminar(null)
      recargar()
    } catch (err) {
      setErrorAccion(err.message)
    } finally {
      setEliminando(false)
    }
  }

  const duenoFiltrado = clienteIdParam && pacientes[0]

  /**
   * Datos del dueno cuando el listado esta filtrado por cliente. Se arman a
   * partir de la primera fila, que ya trae los campos desnormalizados del
   * dueno, para no pedir la ficha entera solo por el nombre y el documento.
   */
  const duenoDelFiltro = duenoFiltrado
    ? {
        id: Number(clienteIdParam),
        nombre: duenoFiltrado.cliente_nombre,
        apellido: duenoFiltrado.cliente_apellido,
        documento: duenoFiltrado.cliente_documento,
        telefono: duenoFiltrado.cliente_telefono,
      }
    : null

  return (
    <div className="escalonar mx-auto max-w-6xl">
      <PageHeader
        rotulo="Registro"
        titulo="Pacientes"
        bajada={
          <>
            {meta.total} {meta.total === 1 ? 'mascota registrada' : 'mascotas registradas'}
            {duenoFiltrado && (
              <>
                {' de '}
                <span className="font-medium text-tinta-2">
                  {duenoFiltrado.cliente_apellido}, {duenoFiltrado.cliente_nombre}
                </span>{' '}
                <Link to="/pacientes" className="enlace">
                  ver todos
                </Link>
              </>
            )}
          </>
        }
        acciones={
          <Button onClick={abrirNuevo}>
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 4a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 0110 4z" />
            </svg>
            Nuevo paciente
          </Button>
        }
      />

      {/* --- Filtros --- */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-tinta-4">
            <svg className="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l3.08 3.08a.75.75 0 11-1.06 1.06l-3.08-3.08A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
          </span>

          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por mascota, microchip o datos del dueno..."
            aria-label="Buscar pacientes"
            className="block w-full rounded border border-linea-fuerte bg-papel-alto py-2.5 pl-10 pr-10 text-[13.5px] text-tinta transition-colors placeholder:text-tinta-4 focus:border-pino-600"
          />

          {buscando && (
            <span className="absolute inset-y-0 right-3 grid place-items-center">
              <span className="size-4 animate-spin rounded-full border-2 border-linea-fuerte border-t-laton-500" />
            </span>
          )}
        </div>

        <select
          value={especieId}
          onChange={(e) => setEspecieId(e.target.value)}
          aria-label="Filtrar por especie"
          className="rounded border border-linea-fuerte bg-papel-alto py-2.5 pl-3 pr-8 text-[13px] text-tinta transition-colors focus:border-pino-600"
        >
          <option value="">Todas las especies</option>
          {especies.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 whitespace-nowrap text-[13px] text-tinta-2">
          <input
            type="checkbox"
            checked={incluirFallecidos}
            onChange={(e) => setIncluirFallecidos(e.target.checked)}
            className="size-4 rounded border-linea-fuerte text-pino-700 focus:border-pino-600"
          />
          Incluir fallecidos
        </label>
      </div>

      {error && (
        <Alert tono="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* --- Listado --- */}
      <div className="overflow-hidden rounded border border-linea bg-papel-alto">
        {cargando && pacientes.length === 0 ? (
          <div className="grid place-items-center py-16">
            <Spinner etiqueta="Cargando pacientes..." />
          </div>
        ) : pacientes.length === 0 ? (
          <EmptyState
            titulo={busqueda || especieId ? 'Sin resultados' : 'Todavia no hay pacientes'}
            descripcion={
              busqueda || especieId
                ? 'Proba con otros criterios de busqueda.'
                : 'Carga la primera mascota. Necesitas tener dado de alta a su dueno.'
            }
            accion={
              !busqueda && !especieId && <Button onClick={abrirNuevo}>Nuevo paciente</Button>
            }
          />
        ) : (
          <>
            {/* Tabla en escritorio */}
            <table className="hidden w-full text-left text-[13px] sm:table">
              <thead className="border-b border-linea bg-papel-hondo/70">
                <tr>
                  <th scope="col" className="rotulo px-4 py-3">Paciente</th>
                  <th scope="col" className="rotulo px-4 py-3">Especie / Raza</th>
                  <th scope="col" className="rotulo px-4 py-3">Edad</th>
                  <th scope="col" className="rotulo px-4 py-3">Peso</th>
                  <th scope="col" className="rotulo px-4 py-3">Dueno</th>
                  <th scope="col" className="rotulo px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {pacientes.map((p) => (
                  <tr key={p.id} className={`hover:bg-papel-hondo ${p.fallecido ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <Link
                        to={`/pacientes/${p.id}`}
                        className="font-medium text-tinta hover:text-pino-700 hover:underline"
                      >
                        {p.nombre}
                      </Link>
                      {Boolean(p.fallecido) && (
                        <span className="ml-2 rounded-full bg-piedra-50 px-2 py-0.5 text-[11.5px] text-piedra-600">
                          Fallecido
                        </span>
                      )}
                      {p.microchip && (
                        <p className="text-[11.5px] text-tinta-4">Chip {p.microchip}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-tinta-2">
                      {p.especie}
                      {p.raza && <span className="text-tinta-4"> / {p.raza}</span>}
                    </td>
                    {/* La edad se deriva de fecha_nacimiento, no se almacena. */}
                    <td className="px-4 py-3 text-tinta-2">
                      {calcularEdad(p.fecha_nacimiento)}
                    </td>
                    <td className="px-4 py-3 text-tinta-2">{formatearPeso(p.peso_kg)}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/pacientes?cliente_id=${p.cliente_id}`}
                        className="text-tinta-2 hover:text-pino-700 hover:underline"
                      >
                        {p.cliente_apellido}, {p.cliente_nombre}
                      </Link>
                      <p className="text-[11.5px] text-tinta-4">{p.cliente_telefono}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variante="fantasma"
                          tamanio="sm"
                          onClick={() => {
                            setEditando(p)
                            setFormAbierto(true)
                          }}
                        >
                          Editar
                        </Button>
                        <RoleGate roles={['admin']}>
                          <Button
                            variante="fantasma"
                            tamanio="sm"
                            className="text-ladrillo-600 hover:bg-ladrillo-50"
                            onClick={() => setAEliminar(p)}
                          >
                            Eliminar
                          </Button>
                        </RoleGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tarjetas en movil */}
            <ul className="divide-y divide-linea sm:hidden">
              {pacientes.map((p) => (
                <li key={p.id} className={`px-4 py-3 ${p.fallecido ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/pacientes/${p.id}`}
                        className="truncate font-medium text-tinta hover:underline"
                      >
                        {p.nombre}
                      </Link>
                      <p className="text-[13px] text-tinta-3">
                        {p.especie}
                        {p.raza && ` / ${p.raza}`} · {calcularEdad(p.fecha_nacimiento)}
                      </p>
                      <p className="text-[11.5px] text-tinta-4">
                        {p.cliente_apellido}, {p.cliente_nombre}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] text-tinta-3">
                      {formatearPeso(p.peso_kg)}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Button
                      variante="secundario"
                      tamanio="sm"
                      onClick={() => {
                        setEditando(p)
                        setFormAbierto(true)
                      }}
                    >
                      Editar
                    </Button>
                    <RoleGate roles={['admin']}>
                      <Button
                        variante="fantasma"
                        tamanio="sm"
                        className="text-ladrillo-600"
                        onClick={() => setAEliminar(p)}
                      >
                        Eliminar
                      </Button>
                    </RoleGate>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* --- Paginacion --- */}
      {meta.total_pages > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Paginacion">
          <p className="text-[13px] text-tinta-3">
            Pagina {meta.page} de {meta.total_pages}
          </p>
          <div className="flex gap-2">
            <Button
              variante="secundario"
              tamanio="sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variante="secundario"
              tamanio="sm"
              disabled={pagina >= meta.total_pages}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </nav>
      )}

      {/* --- Modales --- */}
      {formAbierto && (
        <PacienteForm
          abierto={formAbierto}
          paciente={editando}
          // Si el listado ya viene filtrado por un dueno (?cliente_id=), el
          // alta hereda ese vinculo en vez de hacer buscarlo de nuevo.
          clienteFijo={!editando ? duenoDelFiltro : null}
          onCerrar={() => setFormAbierto(false)}
          onGuardado={recargar}
        />
      )}

      <Modal
        abierto={aEliminar !== null}
        onCerrar={() => setAEliminar(null)}
        titulo="Eliminar paciente"
        pie={
          <>
            <Button variante="secundario" onClick={() => setAEliminar(null)} disabled={eliminando}>
              Cancelar
            </Button>
            <Button variante="peligro" onClick={confirmarEliminar} cargando={eliminando}>
              Eliminar
            </Button>
          </>
        }
      >
        {errorAccion && (
          <Alert tono="error" className="mb-3">
            {errorAccion}
          </Alert>
        )}
        <p className="text-[13px] text-tinta-2">
          Se dara de baja a <strong className="text-tinta">{aEliminar?.nombre}</strong>. Si el
          animal falleció, conviene marcarlo como fallecido en lugar de eliminarlo: asi se conserva
          la ficha junto a su historial clinico.
        </p>
      </Modal>
    </div>
  )
}
