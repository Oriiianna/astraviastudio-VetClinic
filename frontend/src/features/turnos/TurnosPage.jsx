import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { turnosApi, veterinariosApi } from '../../api/turnos'
import { TurnoForm } from './TurnoForm'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { RoleGate } from '../../auth/RoleGate'
import { ESTADOS_TURNO, TIPOS_TURNO } from '../../lib/constants'
import { fechaISO, hoyISO } from '../../lib/format'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

function sumarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number)
  const fecha = new Date(y, m - 1, d + dias)

  return fechaISO(fecha)
}

/** Lunes de la semana a la que pertenece `iso`. */
function lunesDe(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  const dow = (fecha.getDay() + 6) % 7 // lunes = 0

  return sumarDias(iso, -dow)
}

function hora(valor) {
  return String(valor).slice(11, 16)
}

/**
 * Agenda de turnos con vista de dia y de semana.
 *
 * El calendario esta escrito a mano en vez de sumar FullCalendar o
 * react-big-calendar (~150 KB minificados). Esta es una PWA que tiene que
 * arrancar rapido en el celular del veterinario, y lo que hace falta -una
 * grilla por dia con los turnos ordenados- son unas pocas decenas de lineas.
 * Si mas adelante se piden vistas de mes con drag & drop, ahi si conviene
 * reevaluar la libreria.
 */
export function TurnosPage() {
  const [vista, setVista] = useState('dia') // 'dia' | 'semana'
  const [fecha, setFecha] = useState(() => hoyISO())
  const [veterinarioId, setVeterinarioId] = useState('')

  const [turnos, setTurnos] = useState([])
  const [veterinarios, setVeterinarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)

  const [desde, hasta] = useMemo(() => {
    if (vista === 'dia') return [fecha, fecha]

    const lunes = lunesDe(fecha)

    return [lunes, sumarDias(lunes, 6)]
  }, [vista, fecha])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)

    try {
      const datos = await turnosApi.listar({
        desde,
        hasta,
        veterinarioId: veterinarioId || undefined,
      })

      setTurnos(datos ?? [])
    } catch (err) {
      setError(err.message)
      setTurnos([])
    } finally {
      setCargando(false)
    }
  }, [desde, hasta, veterinarioId])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    veterinariosApi.listar().then(setVeterinarios).catch(() => setVeterinarios([]))
  }, [])

  const dias = useMemo(() => {
    const cantidad = vista === 'dia' ? 1 : 7
    const inicio = vista === 'dia' ? fecha : lunesDe(fecha)

    return Array.from({ length: cantidad }, (_, i) => sumarDias(inicio, i))
  }, [vista, fecha])

  const porDia = useMemo(() => {
    const mapa = Object.fromEntries(dias.map((d) => [d, []]))

    for (const t of turnos) {
      const dia = String(t.fecha_hora_inicio).slice(0, 10)
      if (mapa[dia]) mapa[dia].push(t)
    }

    return mapa
  }, [turnos, dias])

  const cambiarEstado = async (id, estado) => {
    setErrorAccion(null)

    try {
      await turnosApi.cambiarEstado(id, estado)
      setDetalle(null)
      cargar()
    } catch (err) {
      setErrorAccion(err.message)
    }
  }

  const eliminar = async (id) => {
    setErrorAccion(null)

    try {
      await turnosApi.eliminar(id)
      setDetalle(null)
      cargar()
    } catch (err) {
      setErrorAccion(err.message)
    }
  }

  const hoy = hoyISO()

  return (
    <div className="escalonar mx-auto max-w-6xl">
      <PageHeader
        rotulo="Agenda"
        titulo="Turnos"
        bajada={`${turnos.length} ${turnos.length === 1 ? 'turno' : 'turnos'} en el periodo mostrado`}
        acciones={
          <Button
            onClick={() => {
              setEditando(null)
              setFormAbierto(true)
            }}
          >
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 4a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 0110 4z" />
            </svg>
            Nuevo turno
          </Button>
        }
      />

      {/* --- Controles ---
           Los tres grupos (vista, periodo, filtro) van en cajas de la misma
           altura y con el mismo filete: antes cada control traia su propia
           altura y la barra se veia desprolija. */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded border border-linea-fuerte">
          {['dia', 'semana'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`px-4 py-[7px] text-[12.5px] font-medium transition-colors ${
                vista === v
                  ? 'bg-pino-800 text-papel'
                  : 'bg-papel-alto text-tinta-2 hover:bg-papel-hondo'
              }`}
            >
              {v === 'dia' ? 'Dia' : 'Semana'}
            </button>
          ))}
        </div>

        <div className="flex items-center overflow-hidden rounded border border-linea-fuerte bg-papel-alto">
          <button
            type="button"
            aria-label="Periodo anterior"
            onClick={() => setFecha((f) => sumarDias(f, vista === 'dia' ? -1 : -7))}
            className="px-3 py-[7px] text-tinta-2 transition-colors hover:bg-papel-hondo"
          >
            &larr;
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            aria-label="Fecha de la agenda"
            className="num border-x border-linea bg-transparent px-3 py-[7px] text-[12.5px] text-tinta focus:outline-none"
          />
          <button
            type="button"
            aria-label="Periodo siguiente"
            onClick={() => setFecha((f) => sumarDias(f, vista === 'dia' ? 1 : 7))}
            className="px-3 py-[7px] text-tinta-2 transition-colors hover:bg-papel-hondo"
          >
            &rarr;
          </button>
        </div>

        <button
          type="button"
          onClick={() => setFecha(hoy)}
          disabled={fecha === hoy}
          className="rounded px-3 py-[7px] text-[12.5px] font-medium text-pino-700 transition-colors hover:bg-pino-50 disabled:text-tinta-4 disabled:hover:bg-transparent"
        >
          Hoy
        </button>

        <select
          value={veterinarioId}
          onChange={(e) => setVeterinarioId(e.target.value)}
          aria-label="Filtrar por veterinario"
          className="ml-auto rounded border border-linea-fuerte bg-papel-alto py-[7px] pl-3 pr-8 text-[12.5px] text-tinta transition-colors focus:border-pino-600"
        >
          <option value="">Todos los veterinarios</option>
          {veterinarios.map((v) => (
            <option key={v.id} value={v.id}>
              {v.apellido}, {v.nombre}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <Alert tono="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* --- Grilla --- */}
      {cargando ? (
        <div className="grid place-items-center rounded border border-linea bg-papel-alto py-16">
          <Spinner etiqueta="Cargando agenda..." />
        </div>
      ) : (
        <div
          className={`grid gap-3 ${vista === 'semana' ? 'sm:grid-cols-2 lg:grid-cols-4' : ''}`}
        >
          {dias.map((dia) => {
            const [y, m, d] = dia.split('-').map(Number)
            const nombreDia = DIAS[new Date(y, m - 1, d).getDay()]
            const delDia = porDia[dia] ?? []

            return (
              <section
                key={dia}
                className={`rounded border bg-papel-alto ${
                  dia === hoy ? 'border-pino-300 ring-1 ring-pino-200' : 'border-linea'
                }`}
              >
                <header className="flex items-baseline justify-between border-b border-linea px-4 py-2.5">
                  <h2 className="font-display text-[15px] font-medium tracking-[-0.01em] text-tinta">
                    {nombreDia} {d}
                    {dia === hoy && (
                      <span className="ml-2 rounded-sm bg-laton-100 px-1.5 py-0.5 text-[9.5px] font-sans font-semibold uppercase tracking-[0.1em] text-laton-700">
                        Hoy
                      </span>
                    )}
                  </h2>
                  <span className="num text-[11.5px] text-tinta-4">
                    {delDia.length > 0 ? `${delDia.length} turno${delDia.length === 1 ? '' : 's'}` : ''}
                  </span>
                </header>

                {delDia.length === 0 ? (
                  // Compacto y accionable: el dia vacio no deberia ocupar el
                  // mismo espacio que uno lleno ni ser un cartel muerto.
                  <button
                    type="button"
                    onClick={() => {
                      setFecha(dia)
                      setEditando(null)
                      setFormAbierto(true)
                    }}
                    className="group flex w-full items-center justify-center gap-2 px-4 py-5 text-[12.5px] text-tinta-4 transition-colors hover:bg-pino-50 hover:text-pino-700"
                  >
                    <span className="opacity-0 transition-opacity group-hover:opacity-100">+</span>
                    Sin turnos
                  </button>
                ) : (
                  <ul className="divide-y divide-linea">
                    {delDia.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setDetalle(t)}
                          className="block w-full px-4 py-2.5 text-left hover:bg-papel-hondo"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[13px] font-medium text-tinta">
                              {hora(t.fecha_hora_inicio)}–{hora(t.fecha_hora_fin)}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                                ESTADOS_TURNO[t.estado]?.clase ?? ''
                              }`}
                            >
                              {ESTADOS_TURNO[t.estado]?.etiqueta ?? t.estado}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[13px] text-tinta-2">
                            {t.paciente_nombre}{' '}
                            <span className="text-tinta-4">({t.especie})</span>
                          </p>
                          <p className="truncate text-[11.5px] text-tinta-3">{t.motivo}</p>
                          <p className="truncate text-[11.5px] text-tinta-4">
                            {t.veterinario_apellido}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* --- Alta / edicion --- */}
      {formAbierto && (
        <TurnoForm
          abierto={formAbierto}
          turno={editando}
          inicioSugerido={editando ? null : `${fecha}T09:00`}
          onCerrar={() => setFormAbierto(false)}
          onGuardado={cargar}
        />
      )}

      {/* --- Detalle del turno --- */}
      <Modal
        abierto={detalle !== null}
        onCerrar={() => {
          setDetalle(null)
          setErrorAccion(null)
        }}
        titulo="Detalle del turno"
        pie={
          <>
            <RoleGate roles={['admin']}>
              <Button
                variante="peligro"
                tamanio="sm"
                className="mr-auto"
                onClick={() => eliminar(detalle.id)}
              >
                Eliminar
              </Button>
            </RoleGate>
            <Button
              variante="secundario"
              onClick={() => {
                setEditando(detalle)
                setDetalle(null)
                setFormAbierto(true)
              }}
            >
              Editar
            </Button>
          </>
        }
      >
        {detalle && (
          <div className="space-y-4">
            {errorAccion && <Alert tono="error">{errorAccion}</Alert>}

            <dl className="space-y-2 text-[13px]">
              <Fila etiqueta="Paciente">
                <Link to={`/pacientes/${detalle.paciente_id}`} className="text-pino-700 hover:underline">
                  {detalle.paciente_nombre}
                </Link>{' '}
                <span className="text-tinta-3">({detalle.especie})</span>
              </Fila>
              <Fila etiqueta="Dueno">
                {detalle.cliente_apellido}, {detalle.cliente_nombre} · {detalle.cliente_telefono}
              </Fila>
              <Fila etiqueta="Veterinario">
                {detalle.veterinario_apellido}, {detalle.veterinario_nombre}
              </Fila>
              <Fila etiqueta="Horario">
                {String(detalle.fecha_hora_inicio).slice(0, 10)} de{' '}
                {hora(detalle.fecha_hora_inicio)} a {hora(detalle.fecha_hora_fin)}
              </Fila>
              <Fila etiqueta="Motivo">{detalle.motivo}</Fila>
              <Fila etiqueta="Tipo">{TIPOS_TURNO[detalle.tipo] ?? detalle.tipo}</Fila>
              {detalle.notas && <Fila etiqueta="Notas">{detalle.notas}</Fila>}
            </dl>

            <div>
              <p className="mb-2 text-[11.5px] font-medium text-tinta-3">Cambiar estado</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(ESTADOS_TURNO).map(([valor, { etiqueta, clase }]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => cambiarEstado(detalle.id, valor)}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium ring-1 ring-inset ${clase} ${
                      detalle.estado === valor ? 'opacity-100 ring-2' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Fila({ etiqueta, children }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-tinta-3">{etiqueta}</dt>
      <dd className="text-tinta">{children}</dd>
    </div>
  )
}
