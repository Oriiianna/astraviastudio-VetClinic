import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useClientes } from './useClientes'
import { ClienteForm } from './ClienteForm'
import { clientesApi } from '../../api/clientes'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { RoleGate } from '../../auth/RoleGate'

export function ClientesPage() {
  const {
    clientes,
    meta,
    cargando,
    error,
    busqueda,
    setBusqueda,
    pagina,
    setPagina,
    recargar,
    buscando,
  } = useClientes()

  const [params, setParams] = useSearchParams()
  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [aEliminar, setAEliminar] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  // Soporta el shortcut del manifest: /clientes?nuevo=1 abre el alta directo
  // desde el icono de la pantalla de inicio.
  useEffect(() => {
    if (params.get('nuevo') === '1') {
      setEditando(null)
      setFormAbierto(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const abrirNuevo = () => {
    setEditando(null)
    setFormAbierto(true)
  }

  const abrirEdicion = (cliente) => {
    setEditando(cliente)
    setFormAbierto(true)
  }

  const confirmarEliminar = async () => {
    setEliminando(true)
    setErrorAccion(null)

    try {
      await clientesApi.eliminar(aEliminar.id)
      setAEliminar(null)
      recargar()
    } catch (err) {
      setErrorAccion(err.message)
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="escalonar mx-auto max-w-6xl">
      <PageHeader
        rotulo="Registro"
        titulo="Clientes"
        bajada={`${meta.total} ${meta.total === 1 ? 'cliente registrado' : 'clientes registrados'}`}
        acciones={
          <Button onClick={abrirNuevo}>
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 4a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 0110 4z" />
            </svg>
            Nuevo cliente
          </Button>
        }
      />

      {/* --- Buscador --- */}
      <div className="relative mb-4">
        <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-tinta-4">
          <svg className="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l3.08 3.08a.75.75 0 11-1.06 1.06l-3.08-3.08A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        </span>

        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, apellido, documento, telefono o email..."
          aria-label="Buscar clientes"
          className="block w-full rounded border border-linea-fuerte bg-papel-alto py-2.5 pl-10 pr-10 text-[13.5px] text-tinta transition-colors placeholder:text-tinta-4 focus:border-pino-600"
        />

        {buscando && (
          <span className="absolute inset-y-0 right-3 grid place-items-center">
            <span className="size-4 animate-spin rounded-full border-2 border-linea-fuerte border-t-laton-500" />
          </span>
        )}
      </div>

      {error && (
        <Alert tono="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* --- Listado --- */}
      <div className="overflow-hidden rounded border border-linea bg-papel-alto">
        {cargando && clientes.length === 0 ? (
          <div className="grid place-items-center py-16">
            <Spinner etiqueta="Cargando clientes..." />
          </div>
        ) : clientes.length === 0 ? (
          <EmptyState
            titulo={busqueda ? 'Sin resultados' : 'Todavia no hay clientes'}
            descripcion={
              busqueda
                ? `No se encontro ningun cliente para "${busqueda}".`
                : 'Carga el primer cliente para empezar a registrar mascotas y turnos.'
            }
            accion={!busqueda && <Button onClick={abrirNuevo}>Nuevo cliente</Button>}
          />
        ) : (
          <>
            {/* Tabla en escritorio */}
            <table className="hidden w-full text-left text-[13px] sm:table">
              <thead className="border-b border-linea bg-papel-hondo/70">
                <tr>
                  <th scope="col" className="rotulo px-4 py-3">Cliente</th>
                  <th scope="col" className="rotulo px-4 py-3">Documento</th>
                  <th scope="col" className="rotulo px-4 py-3">Contacto</th>
                  <th scope="col" className="rotulo px-4 py-3">Mascotas</th>
                  <th scope="col" className="rotulo px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {clientes.map((c) => (
                  <tr key={c.id} className="hover:bg-papel-hondo">
                    <td className="px-4 py-3">
                      {/* Abre la ficha, donde se puede cargar una mascota con
                          el dueno ya vinculado. */}
                      <Link
                        to={`/clientes/${c.id}`}
                        className="font-medium text-tinta transition-colors hover:text-pino-700 hover:underline"
                      >
                        {c.apellido}, {c.nombre}
                      </Link>
                      {c.ciudad && <p className="text-[11.5px] text-tinta-3">{c.ciudad}</p>}
                    </td>
                    <td className="px-4 py-3 text-tinta-2">{c.documento ?? '-'}</td>
                    <td className="px-4 py-3">
                      <p className="text-tinta-2">{c.telefono}</p>
                      {c.email && <p className="text-[11.5px] text-tinta-4">{c.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {/* El contador enlaza al listado de pacientes ya
                          filtrado por este dueno: es el salto que mas se
                          repite en el mostrador. */}
                      <Link
                        to={`/pacientes?cliente_id=${c.id}`}
                        className="inline-flex items-center rounded-full bg-pino-50 px-2 py-0.5 text-[11.5px] font-medium text-pino-700 ring-1 ring-inset ring-pino-200 hover:bg-pino-100"
                      >
                        {c.total_pacientes}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variante="fantasma" tamanio="sm" onClick={() => abrirEdicion(c)}>
                          Editar
                        </Button>
                        {/* Solo admin: coincide con RoleMiddleware(['admin'])
                            en la ruta DELETE de la API. */}
                        <RoleGate roles={['admin']}>
                          <Button
                            variante="fantasma"
                            tamanio="sm"
                            className="text-ladrillo-600 hover:bg-ladrillo-50"
                            onClick={() => setAEliminar(c)}
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
              {clientes.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/clientes/${c.id}`}
                        className="block truncate font-medium text-tinta hover:underline"
                      >
                        {c.apellido}, {c.nombre}
                      </Link>
                      <p className="text-[13px] text-tinta-3">{c.telefono}</p>
                      {c.documento && <p className="text-[11.5px] text-tinta-4">Doc. {c.documento}</p>}
                    </div>
                    <Link
                      to={`/pacientes?cliente_id=${c.id}`}
                      className="shrink-0 rounded-full bg-pino-50 px-2 py-0.5 text-[11.5px] font-medium text-pino-700 ring-1 ring-inset ring-pino-200"
                    >
                      {c.total_pacientes} mascota(s)
                    </Link>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Button variante="secundario" tamanio="sm" onClick={() => abrirEdicion(c)}>
                      Editar
                    </Button>
                    <RoleGate roles={['admin']}>
                      <Button
                        variante="fantasma"
                        tamanio="sm"
                        className="text-ladrillo-600"
                        onClick={() => setAEliminar(c)}
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
        <ClienteForm
          abierto={formAbierto}
          cliente={editando}
          onCerrar={() => setFormAbierto(false)}
          onGuardado={recargar}
        />
      )}

      <Modal
        abierto={aEliminar !== null}
        onCerrar={() => setAEliminar(null)}
        titulo="Dar de baja al cliente"
        pie={
          <>
            <Button variante="secundario" onClick={() => setAEliminar(null)} disabled={eliminando}>
              Cancelar
            </Button>
            <Button variante="peligro" onClick={confirmarEliminar} cargando={eliminando}>
              Dar de baja
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
          Se dara de baja a{' '}
          <strong className="text-tinta">
            {aEliminar?.apellido}, {aEliminar?.nombre}
          </strong>
          . Es una baja logica: el historial clinico asociado se conserva y la
          operacion puede revertirse desde la base de datos.
        </p>
      </Modal>
    </div>
  )
}
