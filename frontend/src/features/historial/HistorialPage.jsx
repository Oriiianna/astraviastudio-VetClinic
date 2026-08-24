import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { consultasApi, recordatoriosApi } from '../../api/historial'
import { ConsultaForm } from './ConsultaForm'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useDebounce } from '../../hooks/useDebounce'
import { formatearFechaHora, formatearFecha } from '../../lib/format'
import { POR_PAGINA } from '../../lib/constants'

/**
 * Portada del historial clinico: ultimas consultas de toda la clinica,
 * buscables, y los vencimientos proximos.
 *
 * Para leer la historia de UN paciente esta /historial/:pacienteId.
 */
export function HistorialPage() {
  const [busqueda, setBusqueda] = useState('')
  const [consultas, setConsultas] = useState([])
  const [meta, setMeta] = useState({ total: 0, total_pages: 0, page: 1 })
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [recordatorios, setRecordatorios] = useState([])
  const [formAbierto, setFormAbierto] = useState(false)

  const q = useDebounce(busqueda, 300)
  const abortRef = useRef(null)

  const cargar = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setCargando(true)
    setError(null)

    try {
      const res = await consultasApi.listar({
        q,
        page: pagina,
        perPage: POR_PAGINA,
        signal: controller.signal,
      })

      setConsultas(res?.data ?? [])
      setMeta(res?.meta ?? { total: 0, total_pages: 0, page: 1 })
    } catch (err) {
      if (err.name === 'AbortError') return

      setError(err.message)
      setConsultas([])
    } finally {
      if (!controller.signal.aborted) setCargando(false)
    }
  }, [q, pagina])

  useEffect(() => {
    cargar()

    return () => abortRef.current?.abort()
  }, [cargar])

  useEffect(() => {
    setPagina(1)
  }, [q])

  useEffect(() => {
    // Los recordatorios no bloquean la pantalla: si fallan, simplemente no
    // se muestra el panel.
    recordatoriosApi.listar(30).then(setRecordatorios).catch(() => setRecordatorios([]))
  }, [])

  const vencidos = recordatorios.filter((r) => Number(r.dias_restantes) < 0)
  const proximos = recordatorios.filter((r) => Number(r.dias_restantes) >= 0)

  return (
    <div className="escalonar mx-auto max-w-6xl">
      <PageHeader
        rotulo="Clinica"
        titulo="Historial clinico"
        bajada={`${meta.total} ${meta.total === 1 ? 'consulta registrada' : 'consultas registradas'}`}
        acciones={
          <Button onClick={() => setFormAbierto(true)}>
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 4a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 0110 4z" />
            </svg>
            Nueva consulta
          </Button>
        }
      />

      {/* --- Recordatorios --- */}
      {recordatorios.length > 0 && (
        <section className="mb-6 grid gap-3 sm:grid-cols-2">
          {vencidos.length > 0 && (
            <Alert tono="error" titulo={`${vencidos.length} vencimiento(s) atrasado(s)`}>
              <ul className="mt-1 space-y-0.5 text-[11.5px]">
                {vencidos.slice(0, 4).map((r) => (
                  <li key={`${r.tipo}-${r.id}`}>
                    <Link to={`/historial/${r.paciente_id}`} className="hover:underline">
                      {r.paciente} — {r.detalle} ({formatearFecha(r.fecha_proxima)})
                    </Link>
                  </li>
                ))}
                {vencidos.length > 4 && <li>y {vencidos.length - 4} mas...</li>}
              </ul>
            </Alert>
          )}

          {proximos.length > 0 && (
            <Alert tono="aviso" titulo={`${proximos.length} vencimiento(s) en 30 dias`}>
              <ul className="mt-1 space-y-0.5 text-[11.5px]">
                {proximos.slice(0, 4).map((r) => (
                  <li key={`${r.tipo}-${r.id}`}>
                    <Link to={`/historial/${r.paciente_id}`} className="hover:underline">
                      {r.paciente} — {r.detalle} ({formatearFecha(r.fecha_proxima)})
                    </Link>
                  </li>
                ))}
                {proximos.length > 4 && <li>y {proximos.length - 4} mas...</li>}
              </ul>
            </Alert>
          )}
        </section>
      )}

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
          placeholder="Buscar por motivo, diagnostico, tratamiento o paciente..."
          aria-label="Buscar consultas"
          className="block w-full rounded border border-linea-fuerte bg-papel-alto py-2.5 pl-10 pr-4 text-[13.5px] text-tinta transition-colors placeholder:text-tinta-4 focus:border-pino-600"
        />
      </div>

      {error && (
        <Alert tono="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="overflow-hidden rounded border border-linea bg-papel-alto">
        {cargando && consultas.length === 0 ? (
          <div className="grid place-items-center py-16">
            <Spinner etiqueta="Cargando consultas..." />
          </div>
        ) : consultas.length === 0 ? (
          <EmptyState
            titulo={busqueda ? 'Sin resultados' : 'Todavia no hay consultas'}
            descripcion={
              busqueda
                ? 'Proba con otros terminos.'
                : 'Registra la primera consulta del historial clinico.'
            }
            accion={!busqueda && <Button onClick={() => setFormAbierto(true)}>Nueva consulta</Button>}
          />
        ) : (
          <ul className="divide-y divide-linea">
            {consultas.map((c) => (
              <li key={c.id} className="px-4 py-3 hover:bg-papel-hondo">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-tinta">{c.motivo}</p>
                    <p className="mt-0.5 text-[13px] text-tinta-3">
                      <Link to={`/historial/${c.paciente_id}`} className="hover:text-pino-700 hover:underline">
                        {c.paciente_nombre}
                      </Link>
                      <span className="text-tinta-4"> ({c.especie}) · </span>
                      {c.cliente_apellido}, {c.cliente_nombre}
                    </p>
                    {c.diagnostico && (
                      <p className="mt-1 line-clamp-2 text-[13px] text-tinta-2">{c.diagnostico}</p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[13px] text-tinta-3">{formatearFechaHora(c.fecha)}</p>
                    <p className="text-[11.5px] text-tinta-4">
                      {c.veterinario_nombre} {c.veterinario_apellido}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {meta.total_pages > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Paginacion">
          <p className="text-[13px] text-tinta-3">
            Pagina {meta.page} de {meta.total_pages}
          </p>
          <div className="flex gap-2">
            <Button variante="secundario" tamanio="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
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

      {formAbierto && (
        <ConsultaForm
          abierto={formAbierto}
          onCerrar={() => setFormAbierto(false)}
          onGuardado={cargar}
        />
      )}
    </div>
  )
}
